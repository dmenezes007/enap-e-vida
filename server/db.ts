import {AsyncLocalStorage} from 'node:async_hooks';
import pg, {type PoolClient, type QueryResultRow} from 'pg';
import {generateId} from './crypto';

const transactionClient = new AsyncLocalStorage<PoolClient>();
let pool: pg.Pool | undefined;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Configure DATABASE_URL para o PostgreSQL do piloto.');
    pool = new pg.Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', (error: NodeJS.ErrnoException) => {
      console.error('Conexão ociosa do PostgreSQL interrompida.', error.code ?? '');
    });
  }
  return pool;
}

function query<Row extends QueryResultRow>(sql: string, values: unknown[] = []) {
  return (transactionClient.getStore() ?? getPool()).query<Row>(sql, values);
}

export const db = {
  async one<Row extends QueryResultRow = QueryResultRow>(sql: string, ...values: unknown[]): Promise<Row | undefined> {
    return (await query<Row>(sql, values)).rows[0];
  },
  async all<Row extends QueryResultRow = QueryResultRow>(sql: string, ...values: unknown[]): Promise<Row[]> {
    return (await query<Row>(sql, values)).rows;
  },
  async run(sql: string, ...values: unknown[]): Promise<void> {
    await query(sql, values);
  },
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      try {
        const result = await transactionClient.run(client, work);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          discard = true;
        }
        throw error;
      }
    } finally {
      client.release(discard);
    }
  },
};

export async function initSchema(): Promise<void> {
  await db.run(`
    -- 1. Identidade e Governança
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      alternative_email TEXT,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      preferred_name TEXT NOT NULL,
      social_name TEXT,
      employment_type TEXT NOT NULL,
      organizational_unit TEXT NOT NULL,
      position_title TEXT NOT NULL,
      entry_date TEXT,
      journey_stage TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      email_verified INTEGER NOT NULL DEFAULT 1,
      mfa_enabled INTEGER NOT NULL DEFAULT 0,
      accessibility_prefs_json TEXT NOT NULL DEFAULT '{"largeText":false,"highContrast":false,"reducedMotion":false}',
      notification_prefs_json TEXT NOT NULL DEFAULT '{"jornada":true,"atividades":true,"eventos":true,"enquetes":true,"comunicados":true,"emailChannel":true,"webPushChannel":false}',
      demo_persona_label TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_code TEXT NOT NULL,
      scope_unit TEXT,
      granted_at TEXT NOT NULL,
      PRIMARY KEY (user_id, role_code)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      ip_address TEXT,
      mfa_verified INTEGER NOT NULL DEFAULT 0,
      last_activity_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL
    );

    -- 2. Pré-Embarque (com segregação física de dados bancários e sensíveis)
    CREATE TABLE IF NOT EXISTS gaeg_parameters (
      id TEXT PRIMARY KEY,
      modality TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      gaeg_value DOUBLE PRECISION NOT NULL,
      max_total_remuneration DOUBLE PRECISION NOT NULL,
      declaration_text TEXT NOT NULL,
      legal_basis TEXT NOT NULL,
      valid_from TEXT NOT NULL,
      valid_until TEXT,
      version TEXT NOT NULL,
      validated_by TEXT NOT NULL,
      is_reference_prototype_value INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      invitee_name TEXT NOT NULL,
      modality TEXT,
      target_unit TEXT NOT NULL,
      proposed_position TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'convite_encaminhado',
      protocol TEXT UNIQUE,
      assigned_to_user_id TEXT REFERENCES users(id),
      linked_user_id TEXT REFERENCES users(id),
      draft_json TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preboarding_submissions (
      id TEXT PRIMARY KEY,
      invitation_id TEXT NOT NULL UNIQUE REFERENCES invitations(id) ON DELETE CASCADE,
      protocol TEXT NOT NULL UNIQUE,
      modality TEXT NOT NULL,
      form_version TEXT NOT NULL,
      nome TEXT NOT NULL,
      cpf_masked TEXT NOT NULL,
      naturalidade_uf TEXT NOT NULL,
      data_nascimento TEXT NOT NULL,
      rg_masked TEXT NOT NULL,
      orgao_expedidor TEXT NOT NULL,
      escolaridade TEXT NOT NULL,
      formacao TEXT NOT NULL,
      residences_json TEXT NOT NULL,
      endereco_atual TEXT NOT NULL,
      telefone_particular TEXT NOT NULL,
      orgao_origem TEXT NOT NULL,
      cargo_efetivo TEXT NOT NULL,
      matricula_siape TEXT NOT NULL,
      ingresso_servico_publico TEXT NOT NULL,
      estagio_probatorio_concluido TEXT NOT NULL,
      esta_em_pgd TEXT NOT NULL,
      modalidade_pgd TEXT,
      proposta_cargo_funcao_enap TEXT NOT NULL,
      orgao_exercicio_atual TEXT NOT NULL,
      selecao_mediante_edital TEXT NOT NULL,
      negociacao_previa_cedente TEXT NOT NULL,
      mudanca_domicilio TEXT NOT NULL,
      chefia_nome TEXT NOT NULL,
      chefia_email TEXT NOT NULL,
      chefia_cargo TEXT NOT NULL,
      chefia_orgao TEXT NOT NULL,
      remuneration_param_version TEXT NOT NULL,
      remuneration_acknowledged_at TEXT NOT NULL,
      privacy_notice_version TEXT NOT NULL,
      privacy_acknowledged_at TEXT NOT NULL,
      submitted_at TEXT NOT NULL
    );

    -- Compartimento segregado e cifrado (AES-256-GCM) para dados bancários
    CREATE TABLE IF NOT EXISTS restricted_bank_details (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL UNIQUE REFERENCES preboarding_submissions(id) ON DELETE CASCADE,
      account_type TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_masked TEXT NOT NULL,
      encrypted_payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Compartimento segregado e cifrado (AES-256-GCM) para atributos pessoais sensíveis e documentos civis completos
    CREATE TABLE IF NOT EXISTS restricted_sensitive_attributes (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL UNIQUE REFERENCES preboarding_submissions(id) ON DELETE CASCADE,
      encrypted_payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preboarding_status_history (
      id TEXT PRIMARY KEY,
      invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_user_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    -- 3. Jornada de Ambientação
    CREATE TABLE IF NOT EXISTS journey_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      description TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      tasks_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journeys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      template_id TEXT REFERENCES journey_templates(id),
      cohort_name TEXT NOT NULL,
      expected_entry_date TEXT NOT NULL,
      effective_entry_date TEXT,
      operational_stage TEXT NOT NULL,
      current_moment TEXT NOT NULL,
      supervisor_user_id TEXT REFERENCES users(id),
      mentor_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ativa',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journey_tasks (
      id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      operational_stage TEXT NOT NULL,
      moment TEXT NOT NULL,
      responsible_actor TEXT NOT NULL,
      responsible_unit TEXT NOT NULL,
      is_essential_day1 INTEGER NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      completed_at TEXT,
      completed_on_time INTEGER,
      depends_on_title TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS journey_assessments (
      id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      milestone_days INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'disponivel',
      role_clarity_score INTEGER,
      team_support_score INTEGER,
      supervisor_support_score INTEGER,
      belonging_score INTEGER,
      expectations_met_score INTEGER,
      qualitative_comment TEXT,
      submitted_at TEXT,
      schedule_adjustment_note TEXT
    );

    CREATE TABLE IF NOT EXISTS journey_support_requests (
      id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberta',
      assigned_unit TEXT NOT NULL,
      resolution_note TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    -- 4. PQVT (Atividades Físicas, Esportivas e de Lazer) e Eventos Integrados
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      category TEXT NOT NULL,
      eligible_audience TEXT NOT NULL,
      modality TEXT NOT NULL,
      location TEXT NOT NULL,
      schedule_summary TEXT NOT NULL,
      next_session_iso TEXT NOT NULL,
      responsible_name TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      registration_deadline TEXT NOT NULL,
      participation_criteria TEXT NOT NULL,
      accessibility_resources TEXT NOT NULL,
      additional_guidelines TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberta',
      featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_registrations (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL, -- 'confirmada' | 'lista_espera' | 'cancelada'
      attendance_confirmed INTEGER NOT NULL DEFAULT 0,
      checkin_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(activity_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS activity_feedback (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(activity_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      source_module TEXT NOT NULL, -- 'jornada' | 'pqvt' | 'comite_dei' | 'institucional'
      category TEXT NOT NULL,
      start_iso TEXT NOT NULL,
      end_iso TEXT NOT NULL,
      location TEXT NOT NULL,
      modality TEXT NOT NULL,
      eligible_audience TEXT NOT NULL,
      organizer TEXT NOT NULL,
      program_json TEXT NOT NULL,
      capacity INTEGER,
      accessibility_resources TEXT NOT NULL,
      materials_json TEXT NOT NULL,
      meeting_url TEXT,
      status TEXT NOT NULL DEFAULT 'publicado',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_registrations (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'confirmada',
      attendance_confirmed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      UNIQUE(event_id, user_id)
    );

    -- 5. Fala, Enap! e Enquetes
    CREATE TABLE IF NOT EXISTS feedback_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'recebida',
      institutional_reply TEXT,
      implemented_highlight INTEGER NOT NULL DEFAULT 0,
      change_summary TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      purpose TEXT NOT NULL,
      eligible_audience TEXT NOT NULL,
      opens_at TEXT NOT NULL,
      closes_at TEXT NOT NULL,
      anonymity_mode TEXT NOT NULL, -- 'identificada' | 'confidencial' | 'anonima'
      allow_edit INTEGER NOT NULL DEFAULT 0,
      show_results_to_users INTEGER NOT NULL DEFAULT 1,
      min_aggregation_threshold INTEGER NOT NULL DEFAULT 10,
      privacy_notice TEXT NOT NULL,
      version TEXT NOT NULL DEFAULT '1.0',
      questions_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberta',
      what_changed_summary TEXT,
      created_at TEXT NOT NULL
    );

    -- Segregação para pesquisas anônimas (§17): tabela de elegibilidade/participação sem referência à resposta
    CREATE TABLE IF NOT EXISTS survey_eligibility (
      survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      participated_at TEXT NOT NULL,
      PRIMARY KEY (survey_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS survey_responses (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      -- NULO em pesquisas efetivamente anônimas!
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      answers_json TEXT NOT NULL,
      submitted_at TEXT NOT NULL
    );

    -- 6. Repositório, Comunicados, Favoritos e Notificações
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      author_unit TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      keywords TEXT NOT NULL,
      published_at TEXT NOT NULL,
      version TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      authorized_audience TEXT NOT NULL,
      format TEXT NOT NULL,
      source_label TEXT NOT NULL,
      content_preview TEXT NOT NULL,
      versions_history_json TEXT NOT NULL,
      is_restricted INTEGER NOT NULL DEFAULT 0,
      editorial_status TEXT NOT NULL DEFAULT 'publicado'
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL, -- 'activity' | 'document'
      item_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, item_type, item_id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      category TEXT NOT NULL,
      published_at TEXT NOT NULL,
      editorial_status TEXT NOT NULL DEFAULT 'publicado'
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link_path TEXT,
      is_operational INTEGER NOT NULL DEFAULT 0,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- 7. Comitê DEI e Laboratório de Melhoria Contínua
    CREATE TABLE IF NOT EXISTS committee_projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL, -- 'projeto' | 'campanha' | 'grupo_trabalho' | 'plano_acao'
      summary TEXT NOT NULL,
      responsible_unit TEXT NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT,
      deliverables_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS improvement_plans (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      journey_phase TEXT NOT NULL,
      canvas_experience TEXT NOT NULL,
      canvas_need TEXT NOT NULL,
      canvas_action TEXT NOT NULL,
      canvas_owner TEXT NOT NULL,
      canvas_evidence TEXT NOT NULL,
      hypothesis TEXT NOT NULL,
      priority TEXT NOT NULL, -- 'alta' | 'media' | 'baixa'
      status TEXT NOT NULL, -- 'descoberta' | 'piloto' | 'em_execucao' | 'avaliacao' | 'implementado'
      linked_indicator_code TEXT,
      pilot_criteria TEXT NOT NULL,
      learnings TEXT,
      due_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- 8. Trilhas de Auditoria
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      actor_email TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      outcome TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

export async function logAuditEvent(params: {
  actorUserId?: string | null;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: 'sucesso' | 'negado' | 'erro';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const safeMetadata = {...(params.metadata ?? {})};
  // Regra §28: nunca gravar dados bancários, senhas ou CPF em texto claro em logs de auditoria
  delete safeMetadata.password;
  delete safeMetadata.contaBancaria;
  delete safeMetadata.agenciaComDv;
  delete safeMetadata.cpf;

  await db.run(
    `
    INSERT INTO audit_events (id, actor_user_id, actor_email, action, resource_type, resource_id, outcome, metadata_json, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `,
    generateId(),
    params.actorUserId ?? null,
    params.actorEmail,
    params.action,
    params.resourceType,
    params.resourceId ?? null,
    params.outcome ?? 'sucesso',
    JSON.stringify(safeMetadata),
    new Date().toISOString(),
  );
}
