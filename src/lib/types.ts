export type RoleCode =
  | 'pre_ingresso'
  | 'usuario_regular'
  | 'chefia'
  | 'resp_ambientacao'
  | 'resp_pre_ingresso'
  | 'gestor_pqvt'
  | 'gestor_conteudo'
  | 'resp_dei'
  | 'analista_estrategico'
  | 'admin_tecnico'
  | 'auditor_lgpd';

export type PermissionCode =
  | 'admin:access'
  | 'users:manage'
  | 'roles:view'
  | 'preboarding:manage'
  | 'preboarding:view_restricted_vault'
  | 'preboarding:manage_gaeg_params'
  | 'journey:manage'
  | 'journey:supervisor_tasks'
  | 'activities:manage'
  | 'events:manage'
  | 'surveys:manage'
  | 'feedback:manage'
  | 'repository:manage'
  | 'dei:manage'
  | 'indicators:view'
  | 'indicators:export'
  | 'improvement:manage'
  | 'audit:view';

export type GaegModality = 'GAEG_NS' | 'GAEG_NI';

export type PreboardingStatus =
  | 'convite_encaminhado'
  | 'preenchimento_iniciado'
  | 'formulario_recebido'
  | 'em_analise'
  | 'complementacao_solicitada'
  | 'complementacao_recebida'
  | 'consulta_orgao_origem'
  | 'preparacao_ingresso'
  | 'ingresso_confirmado'
  | 'encerrado_cancelado';

export type JourneyOperationalStage =
  | 'pre_embarque'
  | 'embarque'
  | 'pos_embarque'
  | 'gestao_continua';

export type JourneyMoment =
  | 'preparacao'
  | 'acolhimento'
  | 'aprendizagem'
  | 'integracao'
  | 'pertencimento';

export type FalaEnapStatus =
  | 'recebida'
  | 'em_analise'
  | 'em_avaliacao_unidade'
  | 'respondida'
  | 'incorporada_plano'
  | 'encerrada';

export type SurveyAnonymityMode = 'identificada' | 'confidencial' | 'anonima';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  preferredName: string;
  socialName?: string | null;
  employmentType: string;
  organizationalUnit: string;
  positionTitle: string;
  entryDate: string | null;
  journeyStage?: string | null;
  roles: RoleCode[];
  permissions: PermissionCode[];
  mfaEnabled: boolean;
  mfaVerified?: boolean;
  accessibilityPrefs: {
    largeText: boolean;
    highContrast: boolean;
    reducedMotion: boolean;
  };
  notificationPrefs: {
    jornada: boolean;
    atividades: boolean;
    eventos: boolean;
    enquetes: boolean;
    comunicados: boolean;
    emailChannel: boolean;
    webPushChannel: boolean;
  };
}

export interface ResidenceRecord {
  cidade: string;
  uf: string;
  periodo: string;
}

export interface PreboardingFormData {
  // Etapa 1 — Identificação pessoal
  nome: string;
  cpf: string;
  naturalidadeUf: string;
  racaCor: string;
  dataNascimento: string;
  rg: string;
  orgaoExpedidor: string;
  filiacao: string;
  tituloEleitor: string;
  // Etapa 2 — Formação, residência e contato
  escolaridade: string;
  formacao: string;
  residenciasUltimos10Anos: ResidenceRecord[];
  enderecoAtual: string;
  telefoneParticular: string;
  // Etapa 3 — Informações funcionais
  orgaoOrigem: string;
  cargoEfetivo: string;
  matriculaSiape: string;
  ingressoServicoPublico: string;
  estagioProbatorioConcluido: 'SIM' | 'NAO' | '';
  entradaPorCotas: 'NAO' | 'RACIAL' | 'PCD' | '';
  pessoaComDeficiencia: 'SIM' | 'NAO' | '';
  estaEmPgd: 'SIM' | 'NAO' | '';
  modalidadePgd: string;
  propostaCargoFuncaoEnap: string;
  orgaoExercicioAtual: string;
  // Etapa 4 — Seleção e cessão
  selecaoMedianteEdital: string;
  negociacaoPreviaCedente: string;
  mudancaDomicilio: 'SIM' | 'NAO' | '';
  // Etapa 5 — Dados bancários (segregados)
  tipoConta: 'CONTA_SALARIO' | 'CONTA_CORRENTE' | '';
  banco: string;
  agenciaComDv: string;
  contaBancaria: string;
  // Etapa 6 — Ciência remuneratória
  cienteRemuneracaoMaxima: boolean;
  // Etapa 7 — Chefia imediata
  chefiaNome: string;
  chefiaEmail: string;
  chefiaCargo: string;
  chefiaOrgao: string;
  // Etapa 8 — Ciência aviso de privacidade
  cienteAvisoPrivacidade: boolean;
}

export interface GaegParameter {
  id: string;
  modality: GaegModality;
  label: string;
  gaegValue: number;
  maxTotalRemuneration: number;
  declarationText: string;
  legalBasis: string;
  validFrom: string;
  validUntil: string | null;
  version: string;
  validatedBy: string;
  isReferencePrototypeValue: boolean;
}
