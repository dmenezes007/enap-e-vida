-- ============================================================================
-- ENAP E-VIDA — ESQUEMA DE REFERÊNCIA POSTGRESQL 16+ (MIGRAÇÃO INICIAL 001)
-- Arquitetura multi-schema com segregação de dados bancários/sensíveis,
-- separação técnica de anonimato em enquetes e Row-Level Security (RLS).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS identity_access;
CREATE SCHEMA IF NOT EXISTS preboarding;
CREATE SCHEMA IF NOT EXISTS journey;
CREATE SCHEMA IF NOT EXISTS engagement;
CREATE SCHEMA IF NOT EXISTS surveys;
CREATE SCHEMA IF NOT EXISTS governance_content;
CREATE SCHEMA IF NOT EXISTS intelligence;
CREATE SCHEMA IF NOT EXISTS audit_security;

-- ============================================================================
-- 1. SCHEMA identity_access
-- ============================================================================
CREATE TABLE identity_access.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  alternative_email TEXT,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  preferred_name TEXT NOT NULL,
  social_name TEXT,
  employment_type TEXT NOT NULL,
  organizational_unit TEXT NOT NULL,
  position_title TEXT NOT NULL,
  entry_date DATE NOT NULL,
  journey_stage TEXT NOT NULL DEFAULT 'embarque',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  accessibility_prefs JSONB NOT NULL DEFAULT '{"largeText":false,"highContrast":false,"reducedMotion":false}'::jsonb,
  notification_prefs JSONB NOT NULL DEFAULT '{"jornada":true,"atividades":true,"eventos":true,"enquetes":true,"comunicados":true,"emailChannel":true,"webPushChannel":false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE identity_access.roles (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE identity_access.permissions (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

CREATE TABLE identity_access.role_permissions (
  role_code TEXT NOT NULL REFERENCES identity_access.roles(code) ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES identity_access.permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

CREATE TABLE identity_access.user_roles (
  user_id UUID NOT NULL REFERENCES identity_access.users(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL REFERENCES identity_access.roles(code) ON DELETE CASCADE,
  scope_unit TEXT,
  granted_by UUID REFERENCES identity_access.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE identity_access.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES identity_access.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip_address INET,
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. SCHEMA preboarding (segregação de dados bancários e sensíveis)
-- ============================================================================
CREATE TABLE preboarding.gaeg_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modality TEXT NOT NULL UNIQUE CHECK (modality IN ('GAEG_NS', 'GAEG_NI')),
  label TEXT NOT NULL,
  gaeg_value NUMERIC(12,2) NOT NULL CHECK (gaeg_value > 0),
  max_total_remuneration NUMERIC(12,2) NOT NULL CHECK (max_total_remuneration > 0),
  declaration_text TEXT NOT NULL,
  legal_basis TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_until DATE,
  version TEXT NOT NULL,
  validated_by TEXT NOT NULL,
  is_reference_prototype_value BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE preboarding.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  invitee_name TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('GAEG_NS', 'GAEG_NI')),
  target_unit TEXT NOT NULL,
  proposed_position TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'convite_encaminhado',
  protocol TEXT UNIQUE,
  assigned_to_user_id UUID REFERENCES identity_access.users(id),
  linked_user_id UUID REFERENCES identity_access.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE preboarding.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL UNIQUE REFERENCES preboarding.invitations(id) ON DELETE RESTRICT,
  protocol TEXT NOT NULL UNIQUE,
  modality TEXT NOT NULL CHECK (modality IN ('GAEG_NS', 'GAEG_NI')),
  form_version TEXT NOT NULL,
  nome TEXT NOT NULL,
  cpf_masked TEXT NOT NULL,
  naturalidade_uf TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  rg_masked TEXT NOT NULL,
  orgao_expedidor TEXT NOT NULL,
  escolaridade TEXT NOT NULL,
  formacao TEXT NOT NULL,
  residences_last_10y JSONB NOT NULL,
  endereco_atual TEXT NOT NULL,
  telefone_particular TEXT NOT NULL,
  orgao_origem TEXT NOT NULL,
  cargo_efetivo TEXT NOT NULL,
  matricula_siape TEXT NOT NULL,
  ingresso_servico_publico DATE NOT NULL,
  estagio_probatorio_concluido TEXT NOT NULL CHECK (estagio_probatorio_concluido IN ('SIM', 'NAO')),
  esta_em_pgd TEXT NOT NULL CHECK (esta_em_pgd IN ('SIM', 'NAO')),
  modalidade_pgd TEXT,
  proposta_cargo_funcao_enap TEXT NOT NULL,
  orgao_exercicio_atual TEXT NOT NULL,
  selecao_mediante_edital TEXT NOT NULL CHECK (selecao_mediante_edital IN ('SIM', 'NAO')),
  negociacao_previa_cedente TEXT NOT NULL CHECK (negociacao_previa_cedente IN ('SIM', 'NAO')),
  mudanca_domicilio TEXT NOT NULL CHECK (mudanca_domicilio IN ('SIM', 'NAO')),
  chefia_nome TEXT NOT NULL,
  chefia_email TEXT NOT NULL,
  chefia_cargo TEXT NOT NULL,
  chefia_orgao TEXT NOT NULL,
  remuneration_param_version TEXT NOT NULL,
  remuneration_acknowledged_at TIMESTAMPTZ NOT NULL,
  privacy_notice_version TEXT NOT NULL,
  privacy_acknowledged_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cofre segregado para dados bancários (AES-256-GCM em camada de aplicação + RLS estrita)
CREATE TABLE preboarding.restricted_bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES preboarding.submissions(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('CONTA_CORRENTE', 'CONTA_SALARIO')),
  bank_name TEXT NOT NULL,
  account_masked TEXT NOT NULL,
  encrypted_payload BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cofre segregado para documentos civis completos e atributos sensíveis LGPD
CREATE TABLE preboarding.restricted_sensitive_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL UNIQUE REFERENCES preboarding.submissions(id) ON DELETE CASCADE,
  encrypted_payload BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE preboarding.status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES preboarding.invitations(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_user_id UUID REFERENCES identity_access.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. SCHEMA journey (Jornada de Ambientação — Pessoas, Processos e Evidências)
-- ============================================================================
CREATE TABLE journey.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  employment_scope TEXT NOT NULL,
  version TEXT NOT NULL,
  tasks_spec JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journey.instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES identity_access.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES journey.templates(id),
  cohort_name TEXT NOT NULL,
  expected_entry_date DATE NOT NULL,
  effective_entry_date DATE,
  operational_stage TEXT NOT NULL,
  current_moment TEXT NOT NULL,
  supervisor_user_id UUID REFERENCES identity_access.users(id),
  mentor_name TEXT,
  status TEXT NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journey.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journey.instances(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  operational_stage TEXT NOT NULL,
  moment TEXT NOT NULL,
  responsible_actor TEXT NOT NULL,
  responsible_unit TEXT NOT NULL,
  is_essential_day1 BOOLEAN NOT NULL DEFAULT FALSE,
  due_date DATE NOT NULL,
  depends_on_task_id UUID REFERENCES journey.tasks(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  completed_at TIMESTAMPTZ,
  completed_on_time BOOLEAN,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE journey.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journey.instances(id) ON DELETE CASCADE,
  milestone_days SMALLINT NOT NULL CHECK (milestone_days IN (30, 60, 90)),
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendada',
  role_clarity_score SMALLINT CHECK (role_clarity_score BETWEEN 1 AND 5),
  team_support_score SMALLINT CHECK (team_support_score BETWEEN 1 AND 5),
  supervisor_support_score SMALLINT CHECK (supervisor_support_score BETWEEN 1 AND 5),
  belonging_score SMALLINT CHECK (belonging_score BETWEEN 1 AND 5),
  expectations_met_score SMALLINT CHECK (expectations_met_score BETWEEN 1 AND 5),
  qualitative_comment TEXT,
  submitted_at TIMESTAMPTZ
);

CREATE TABLE journey.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES journey.instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity_access.users(id),
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  assigned_unit TEXT NOT NULL,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- 4. SCHEMA engagement (PQVT, Agenda Integrada, Fala Enap!, Notificações)
-- ============================================================================
CREATE TABLE engagement.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL,
  eligible_audience TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('Presencial', 'Virtual', 'Híbrida')),
  location TEXT NOT NULL,
  schedule_summary TEXT NOT NULL,
  next_session_at TIMESTAMPTZ NOT NULL,
  responsible_name TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  accessibility_resources TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE engagement.activity_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES engagement.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity_access.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('confirmada', 'lista_espera', 'cancelada')),
  attendance_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  checkin_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (activity_id, user_id)
);

CREATE TABLE engagement.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_module TEXT NOT NULL CHECK (source_module IN ('jornada', 'pqvt', 'comite_dei', 'institucional')),
  category TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL,
  modality TEXT NOT NULL,
  organizer TEXT NOT NULL,
  program JSONB NOT NULL DEFAULT '[]'::jsonb,
  capacity INTEGER,
  accessibility_resources TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'publicado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE engagement.feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES identity_access.users(id),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'recebida',
  institutional_reply TEXT,
  implemented_highlight BOOLEAN NOT NULL DEFAULT FALSE,
  change_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE engagement.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES identity_access.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_path TEXT,
  is_operational BOOLEAN NOT NULL DEFAULT FALSE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. SCHEMA surveys (Separação técnica de anonimato + limiar k-anonimato)
-- ============================================================================
CREATE TABLE surveys.definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  purpose TEXT NOT NULL,
  eligible_audience TEXT NOT NULL,
  opens_at DATE NOT NULL,
  closes_at DATE NOT NULL,
  anonymity_mode TEXT NOT NULL CHECK (anonymity_mode IN ('identificada', 'confidencial', 'anonima')),
  min_aggregation_threshold INTEGER NOT NULL DEFAULT 10 CHECK (min_aggregation_threshold >= 3),
  privacy_notice TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  questions JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Controle de elegibilidade/participação SEM respostas (anti-duplicidade)
CREATE TABLE surveys.eligibility_log (
  survey_id UUID NOT NULL REFERENCES surveys.definitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES identity_access.users(id) ON DELETE CASCADE,
  participated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (survey_id, user_id)
);

-- Respostas separadas: user_id permanece NULL quando anonymity_mode = 'anonima'
CREATE TABLE surveys.responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES surveys.definitions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES identity_access.users(id),
  answers JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. SCHEMA governance_content & intelligence & audit_security
-- ============================================================================
CREATE TABLE governance_content.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  author_unit TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  keywords TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0',
  versions_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_restricted BOOLEAN NOT NULL DEFAULT FALSE,
  editorial_status TEXT NOT NULL DEFAULT 'publicado',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE governance_content.committee_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  responsible_unit TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date DATE,
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE intelligence.improvement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  journey_phase TEXT NOT NULL,
  canvas_experience TEXT NOT NULL,
  canvas_need TEXT NOT NULL,
  canvas_action TEXT NOT NULL,
  canvas_owner TEXT NOT NULL,
  canvas_evidence TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'descoberta',
  linked_indicator_code TEXT,
  pilot_criteria TEXT NOT NULL,
  learnings TEXT,
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_security.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES identity_access.users(id),
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'sucesso',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. ROW-LEVEL SECURITY (RLS) NOS COMPARTIMENTOS SEGREGADOS
-- ============================================================================
ALTER TABLE preboarding.restricted_bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE preboarding.restricted_sensitive_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_restricted_bank_only_preboarding_role
  ON preboarding.restricted_bank_details
  USING (current_setting('app.current_role_codes', TRUE) LIKE '%resp_pre_ingresso%');

CREATE POLICY p_restricted_sensitive_only_preboarding_role
  ON preboarding.restricted_sensitive_attributes
  USING (current_setting('app.current_role_codes', TRUE) LIKE '%resp_pre_ingresso%');

-- Índices operacionais
CREATE INDEX idx_invitations_protocol ON preboarding.invitations(protocol);
CREATE INDEX idx_journey_tasks_journey ON journey.tasks(journey_id, status);
CREATE INDEX idx_activity_reg_activity ON engagement.activity_registrations(activity_id, status);
CREATE INDEX idx_audit_events_created ON audit_security.audit_events(created_at DESC);
