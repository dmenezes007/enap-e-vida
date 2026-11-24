import {db, logAuditEvent} from './db';
import {encryptVaultJson, generateId, hashPassword} from './crypto';
import {DEFAULT_GAEG_PARAMETERS, maskBankAccount, maskCpf} from '../src/lib/validators';
import type {RoleCode} from '../src/lib/types';

export const DEMO_PASSWORD = 'EnapDemo@2026';

export async function seedDatabaseIfEmpty(): Promise<void> {
  const existing = await db.one('SELECT COUNT(*)::integer as c FROM users') as {c: number};
  if (existing.c > 0) return;

  const now = new Date().toISOString();
  const inviteExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const demoPassHash = hashPassword(DEMO_PASSWORD);

  // 1. Parâmetros GAEG (preservados integralmente de Formulários.docx)
  const insertGaeg = (...values: unknown[]) => db.run(`
    INSERT INTO gaeg_parameters (
      id, modality, label, gaeg_value, max_total_remuneration, declaration_text,
      legal_basis, valid_from, valid_until, version, validated_by, is_reference_prototype_value, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `, ...values);
  for (const param of Object.values(DEFAULT_GAEG_PARAMETERS)) {
    await insertGaeg(
      generateId(),
      param.modality,
      param.label,
      param.gaegValue,
      param.maxTotalRemuneration,
      param.declarationText,
      param.legalBasis,
      param.validFrom,
      param.validUntil,
      param.version,
      param.validatedBy,
      1,
      now,
    );
  }

  // 2. Perfis fictícios de demonstração (todos os 14 cenários da Seção 33)
  interface SeedPersona {
    id: string;
    email: string;
    fullName: string;
    preferredName: string;
    employmentType: string;
    unit: string;
    position: string;
    entryDate: string | null;
    journeyStage: string | null;
    roles: RoleCode[];
    mfaEnabled: boolean;
    demoLabel: string;
  }

  const personas: SeedPersona[] = [
    {
      id: 'usr-pre-ns',
      email: 'pre.ns@demo.enap.gov.br',
      fullName: 'Helena Ribeiro Costa (Fictício)',
      preferredName: 'Helena',
      employmentType: 'servidora_cedida',
      unit: 'Diretoria de Inovação (DINOV)',
      positionTitle: 'Analista de Projetos — GAEG NS',
      position: 'Analista de Projetos — GAEG NS',
      entryDate: '2026-12-07',
      journeyStage: 'pre_embarque',
      roles: ['pre_ingresso'],
      mfaEnabled: false,
      demoLabel: '1. Pré-ingresso (GAEG Nível Superior)',
    } as SeedPersona,
    {
      id: 'usr-pre-ni',
      email: 'pre.ni@demo.enap.gov.br',
      fullName: 'Mateus Oliveira Santana (Fictício)',
      preferredName: 'Mateus',
      employmentType: 'servidora_cedida',
      unit: 'Diretoria de Gestão Corporativa (DGC)',
      position: 'Assistente Técnico — GAEG NI',
      entryDate: '2026-12-14',
      journeyStage: 'pre_embarque',
      roles: ['pre_ingresso'],
      mfaEnabled: false,
      demoLabel: '2. Pré-ingresso (GAEG Nível Intermediário)',
    },
    {
      id: 'usr-dia1',
      email: 'dia1@demo.enap.gov.br',
      fullName: 'Camila Nogueira Teles (Fictício)',
      preferredName: 'Camila',
      employmentType: 'servidora_efetiva',
      unit: 'Diretoria de Educação Executiva (DEX)',
      position: 'Técnica em Assuntos Educacionais',
      entryDate: '2026-11-19',
      journeyStage: 'embarque',
      roles: ['usuario_regular'],
      mfaEnabled: false,
      demoLabel: '3. Recém-ingressante (Primeiro dia)',
    },
    {
      id: 'usr-30d',
      email: 'acompanhamento30@demo.enap.gov.br',
      fullName: 'Rafael Mendes Azevedo (Fictício)',
      preferredName: 'Rafael',
      employmentType: 'servidora_cedida',
      unit: 'Diretoria de Altos Estudos (DAE)',
      position: 'Especialista em Políticas Públicas',
      entryDate: '2026-10-19',
      journeyStage: 'pos_embarque',
      roles: ['usuario_regular'],
      mfaEnabled: false,
      demoLabel: '4. Em acompanhamento (30 dias)',
    },
    {
      id: 'usr-60d',
      email: 'acompanhamento60@demo.enap.gov.br',
      fullName: 'Larissa Rocha Pinheiro (Fictício)',
      preferredName: 'Larissa',
      employmentType: 'servidora_efetiva',
      unit: 'Diretoria de Desenvolvimento Profissional (DDP)',
      position: 'Analista de Formação',
      entryDate: '2026-09-20',
      journeyStage: 'pos_embarque',
      roles: ['usuario_regular'],
      mfaEnabled: false,
      demoLabel: '5. Em acompanhamento (60 dias)',
    },
    {
      id: 'usr-90d',
      email: 'acompanhamento90@demo.enap.gov.br',
      fullName: 'Tiago Barros Lima (Fictício)',
      preferredName: 'Tiago',
      employmentType: 'cargo_comissionado',
      unit: 'Diretoria de Inovação (DINOV)',
      position: 'Coordenador de Projetos de Inovação',
      entryDate: '2026-08-21',
      journeyStage: 'pos_embarque',
      roles: ['usuario_regular'],
      mfaEnabled: false,
      demoLabel: '6. Em acompanhamento (90 dias)',
    },
    {
      id: 'usr-integrada',
      email: 'integrada@demo.enap.gov.br',
      fullName: 'Beatriz Almeida Duarte (Fictício)',
      preferredName: 'Beatriz',
      employmentType: 'servidora_efetiva',
      unit: 'Coordenação-Geral de Comunicação Institucional',
      position: 'Analista de Comunicação Pública',
      entryDate: '2024-03-11',
      journeyStage: 'gestao_continua',
      roles: ['usuario_regular'],
      mfaEnabled: false,
      demoLabel: '7. Integrada à comunidade Enap (>90 dias)',
    },
    {
      id: 'usr-chefia',
      email: 'chefia@demo.enap.gov.br',
      fullName: 'Fernanda Vasconcelos Dias (Fictício)',
      preferredName: 'Fernanda',
      employmentType: 'cargo_comissionado',
      unit: 'Diretoria de Altos Estudos (DAE)',
      position: 'Coordenadora-Geral de Pesquisa',
      entryDate: '2022-05-02',
      journeyStage: 'gestao_continua',
      roles: ['usuario_regular', 'chefia'],
      mfaEnabled: false,
      demoLabel: '8. Chefia com tarefas de ambientação',
    },
    {
      id: 'usr-ambientacao',
      email: 'ambientacao@demo.enap.gov.br',
      fullName: 'Patrícia Lemos Ferreira (Fictício)',
      preferredName: 'Patrícia',
      employmentType: 'servidora_efetiva',
      unit: 'Coordenação de Gestão de Pessoas (CGP)',
      position: 'Responsável pela Jornada de Ambientação',
      entryDate: '2021-01-15',
      journeyStage: 'gestao_continua',
      roles: ['usuario_regular', 'resp_ambientacao'],
      mfaEnabled: true,
      demoLabel: '9. Responsável pela Jornada',
    },
    {
      id: 'usr-pre-resp',
      email: 'preingresso.gestao@demo.enap.gov.br',
      fullName: 'Sérgio Teixeira Moraes (Fictício)',
      preferredName: 'Sérgio',
      employmentType: 'servidora_efetiva',
      unit: 'Coordenação de Movimentação e Cessão (CGP)',
      position: 'Responsável pelo Pré-ingresso',
      entryDate: '2020-08-10',
      journeyStage: 'gestao_continua',
      roles: ['usuario_regular', 'resp_pre_ingresso'],
      mfaEnabled: true,
      demoLabel: '10. Responsável pelo Pré-ingresso (Cofre)',
    },
    {
      id: 'usr-pqvt',
      email: 'pqvt@demo.enap.gov.br',
      fullName: 'Daniela Moreira Sales (Fictício)',
      preferredName: 'Daniela',
      employmentType: 'servidora_efetiva',
      unit: 'Programa de Qualidade de Vida no Trabalho (PQVT)',
      position: 'Gestora do PQVT',
      entryDate: '2021-09-01',
      journeyStage: 'gestao_continua',
      roles: ['usuario_regular', 'gestor_pqvt'],
      mfaEnabled: true,
      demoLabel: '11. Gestor do PQVT (Atividades/Eventos)',
    },
    {
      id: 'usr-conteudo',
      email: 'conteudo@demo.enap.gov.br',
      fullName: 'Bruno Cardoso Peixoto (Fictício)',
      preferredName: 'Bruno',
      employmentType: 'servidora_efetiva',
      unit: 'Coordenação de Gestão do Conhecimento',
      position: 'Gestor de Conteúdo e Repositório',
      entryDate: '2022-02-14',
      journeyStage: 'gestao_continua',
      roles: ['usuario_regular', 'gestor_conteudo'],
      mfaEnabled: true,
      demoLabel: '12. Gestor de Conteúdo',
    },
    {
      id: 'usr-dei',
      email: 'dei@demo.enap.gov.br',
      fullName: 'Aline Nascimento Borges (Fictício)',
      preferredName: 'Aline',
      employmentType: 'servidora_efetiva',
      unit: 'Comitê de Diversidades, Equidade e Inclusão',
      position: 'Representante do Comitê DEI',
      entryDate: '2021-06-20',
      journeyStage: 'gestao_continua',
      roles: ['usuario_regular', 'resp_dei'],
      mfaEnabled: true,
      demoLabel: '13. Responsável pelo Comitê DEI',
    },
    {
      id: 'usr-analista',
      email: 'estrategia@demo.enap.gov.br',
      fullName: 'Rodrigo Silveira Campos (Fictício)',
      preferredName: 'Rodrigo',
      employmentType: 'servidora_efetiva',
      unit: 'Coordenação de Gestão Estratégica e Modernização',
      position: 'Analista de Indicadores e Evidências',
      entryDate: '2020-04-06',
      journeyStage: 'gestao_continua',
      roles: ['usuario_regular', 'analista_estrategico'],
      mfaEnabled: true,
      demoLabel: '14. Analista de Indicadores',
    },
    {
      id: 'usr-admin',
      email: 'admin@demo.enap.gov.br',
      fullName: 'Mariana Duarte Ribeiro (Fictício)',
      preferredName: 'Mariana',
      employmentType: 'servidora_efetiva',
      unit: 'Coordenação-Geral de Tecnologia da Informação (CGTI)',
      position: 'Administradora Técnica da Plataforma',
      entryDate: '2019-11-04',
      journeyStage: 'gestao_continua',
      roles: ['usuario_regular', 'admin_tecnico', 'auditor_lgpd'],
      mfaEnabled: true,
      demoLabel: '15. Administrador Técnico + Auditoria',
    },
  ];

  const insertUser = (...values: unknown[]) => db.run(`
    INSERT INTO users (
      id, email, password_hash, full_name, preferred_name, employment_type,
      organizational_unit, position_title, entry_date, journey_stage,
      mfa_enabled, demo_persona_label, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
  `, ...values);
  const insertRole = (...values: unknown[]) => db.run(`
    INSERT INTO user_roles (user_id, role_code, scope_unit, granted_at) VALUES ($1, $2, $3, $4)
  `, ...values);

  for (const p of personas) {
    await insertUser(
      p.id,
      p.email,
      demoPassHash,
      p.fullName,
      p.preferredName,
      p.employmentType,
      p.unit,
      p.position,
      p.entryDate,
      p.journeyStage,
      p.mfaEnabled ? 1 : 0,
      p.demoLabel,
      now,
      now,
    );
    for (const r of p.roles) {
      await insertRole(p.id, r, p.unit, now);
    }
  }

  // 3. Convites de Pré-ingresso (2 pendentes para teste interativo + 1 já enviado para painel administrativo)
  const insertInvite = (...values: unknown[]) => db.run(`
    INSERT INTO invitations (
      id, code, email, invitee_name, modality, target_unit, proposed_position,
      status, protocol, assigned_to_user_id, expires_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `, ...values);

  await insertInvite(
    'inv-ns-01',
    'ENAP-2026-NS01',
    'pre.ns@demo.enap.gov.br',
    'Helena Ribeiro Costa (Fictício)',
    'GAEG_NS',
    'Diretoria de Inovação (DINOV)',
    'Coordenadora de Projetos de Inovação',
    'convite_encaminhado',
    null,
    'usr-pre-resp',
    inviteExpiresAt,
    now,
    now,
  );

  await insertInvite(
    'inv-ni-02',
    'ENAP-2026-NI02',
    'pre.ni@demo.enap.gov.br',
    'Mateus Oliveira Santana (Fictício)',
    'GAEG_NI',
    'Diretoria de Gestão Corporativa (DGC)',
    'Assistente Técnico de Logística',
    'convite_encaminhado',
    null,
    'usr-pre-resp',
    inviteExpiresAt,
    now,
    now,
  );

  // Caso já submetido para demonstração do painel administrativo e cofre segregado
  await insertInvite(
    'inv-ns-03',
    'ENAP-2026-NS03',
    'clara.ficticio@exemplo.gov.br',
    'Clara Rezende Alencar (Fictício)',
    'GAEG_NS',
    'Diretoria de Educação Executiva (DEX)',
    'Especialista em Design Instrucional',
    'em_analise',
    'ENAP-PRE-2026-A91F3C',
    'usr-pre-resp',
    inviteExpiresAt,
    '2026-11-10T14:00:00.000Z',
    '2026-11-15T16:30:00.000Z',
  );

  await db.run(
    `
    INSERT INTO preboarding_submissions (
      id, invitation_id, protocol, modality, form_version, nome, cpf_masked,
      naturalidade_uf, data_nascimento, rg_masked, orgao_expedidor, escolaridade, formacao,
      residences_json, endereco_atual, telefone_particular, orgao_origem, cargo_efetivo,
      matricula_siape, ingresso_servico_publico, estagio_probatorio_concluido, esta_em_pgd,
      modalidade_pgd, proposta_cargo_funcao_enap, orgao_exercicio_atual, selecao_mediante_edital,
      negociacao_previa_cedente, mudanca_domicilio, chefia_nome, chefia_email, chefia_cargo,
      chefia_orgao, remuneration_param_version, remuneration_acknowledged_at,
      privacy_notice_version, privacy_acknowledged_at, submitted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37)
  `,
    'sub-ns-03',
    'inv-ns-03',
    'ENAP-PRE-2026-A91F3C',
    'GAEG_NS',
    '1.0-doc-ref',
    'Clara Rezende Alencar (Fictício)',
    maskCpf('52998224725'),
    'Belo Horizonte/MG',
    '1988-06-18',
    '****567',
    'SSP/MG',
    'Mestrado',
    'Políticas Públicas e Gestão Educacional',
    JSON.stringify([
      {cidade: 'Belo Horizonte', uf: 'MG', periodo: '2016–2021'},
      {cidade: 'Brasília', uf: 'DF', periodo: '2021–2026'},
    ]),
    'SQS 308 Bloco D (Endereço Fictício), Brasília/DF',
    '(61) 99999-0103',
    'Ministério da Educação (Fictício)',
    'Técnica em Assuntos Educacionais',
    '2045678',
    '2015-03-09',
    'SIM',
    'SIM',
    'PGD — Teletrabalho parcial',
    'Especialista em Design Instrucional — DEX',
    'Ministério da Educação',
    'Sim — Edital Interno de Seleção nº 02/2026 (Fictício)',
    'Sim — Manifestação favorável preliminar da chefia',
    'NAO',
    'Roberto Queiroz (Fictício)',
    'roberto.chefia@exemplo.gov.br',
    'Coordenador-Geral de Ensino',
    'Ministério da Educação',
    '1.0-doc-ref',
    '2026-11-12T15:10:00.000Z',
    'LGPD-PRE-1.0',
    '2026-11-12T15:12:00.000Z',
    '2026-11-12T15:12:00.000Z',
  );

  await db.run(
    `
    INSERT INTO restricted_bank_details (id, submission_id, account_type, bank_name, account_masked, encrypted_payload, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `,
    'bank-ns-03',
    'sub-ns-03',
    'CONTA_CORRENTE',
    '001 - Banco do Brasil (Fictício)',
    maskBankAccount('0045678-9'),
    encryptVaultJson({
      tipoConta: 'CONTA_CORRENTE',
      banco: '001 - Banco do Brasil (Fictício)',
      agenciaComDv: '3477-0',
      contaBancaria: '0045678-9',
    }),
    '2026-11-12T15:12:00.000Z',
  );

  await db.run(
    `
    INSERT INTO restricted_sensitive_attributes (id, submission_id, encrypted_payload, created_at)
    VALUES ($1, $2, $3, $4)
  `,
    'sens-ns-03',
    'sub-ns-03',
    encryptVaultJson({
      cpf: '529.982.247-25',
      rg: '1234567',
      filiacao: 'Helena Alencar e Carlos Alencar (Fictício)',
      tituloEleitor: '098765432101',
      racaCor: 'Parda',
      entradaPorCotas: 'NAO',
      pessoaComDeficiencia: 'NAO',
    }),
    '2026-11-12T15:12:00.000Z',
  );

  const insertPreHist = (...values: unknown[]) => db.run(`
    INSERT INTO preboarding_status_history (id, invitation_id, status, note, actor_name, actor_user_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, ...values);
  await insertPreHist(generateId(), 'inv-ns-01', 'convite_encaminhado', 'Convite institucional individualizado encaminhado.', 'Sérgio Teixeira Moraes (Fictício)', 'usr-pre-resp', now);
  await insertPreHist(generateId(), 'inv-ni-02', 'convite_encaminhado', 'Convite institucional individualizado encaminhado.', 'Sérgio Teixeira Moraes (Fictício)', 'usr-pre-resp', now);
  await insertPreHist(generateId(), 'inv-ns-03', 'convite_encaminhado', 'Convite encaminhado para movimentação GAEG NS.', 'Sérgio Teixeira Moraes (Fictício)', 'usr-pre-resp', '2026-11-10T14:00:00.000Z');
  await insertPreHist(generateId(), 'inv-ns-03', 'formulario_recebido', 'Formulário recebido com ciência remuneratória registrada.', 'Sistema Enap e-Vida', null, '2026-11-12T15:12:00.000Z');
  await insertPreHist(generateId(), 'inv-ns-03', 'em_analise', 'Conferência documental iniciada pela equipe de movimentação.', 'Sérgio Teixeira Moraes (Fictício)', 'usr-pre-resp', '2026-11-15T16:30:00.000Z');

  // 4. Modelo de Jornada de Ambientação (versionado — referência Semana de Inovação)
  const defaultTemplateTasks = [
    {
      title: 'Confirmar orientações de chegada e documentação prévia',
      description: 'Ler o Guia de Boas-Vindas da Enap, conferir localização no SAFS Quadra 02 Lote 04 e enviar dados preliminares.',
      operationalStage: 'pre_embarque',
      moment: 'preparacao',
      responsibleActor: 'ingressante',
      responsibleUnit: 'CGP / Ingressante',
      isEssentialDay1: true,
      relativeDays: -5,
      dependsOnTitle: null,
    },
    {
      title: 'Provisionar e-mail institucional, rede e acesso ao SEI',
      description: 'Criar conta de rede, e-mail institucional e perfil básico nos sistemas corporativos antes do primeiro dia.',
      operationalStage: 'pre_embarque',
      moment: 'preparacao',
      responsibleActor: 'tecnologia',
      responsibleUnit: 'CGTI',
      isEssentialDay1: true,
      relativeDays: -1,
      dependsOnTitle: 'Confirmar orientações de chegada e documentação prévia',
    },
    {
      title: 'Preparar estação de trabalho e recursos de acessibilidade',
      description: 'Disponibilizar equipamento, crachá provisório e eventuais recursos de acessibilidade solicitados.',
      operationalStage: 'pre_embarque',
      moment: 'preparacao',
      responsibleActor: 'gestao_pessoas',
      responsibleUnit: 'DGC / Logística',
      isEssentialDay1: true,
      relativeDays: -1,
      dependsOnTitle: null,
    },
    {
      title: 'Recepção institucional e visita guiada ao campus Enap',
      description: 'Encontro de acolhimento com a equipe de Gestão de Pessoas, apresentação dos valores institucionais e visita guiada.',
      operationalStage: 'embarque',
      moment: 'acolhimento',
      responsibleActor: 'gestao_pessoas',
      responsibleUnit: 'CGP / PQVT',
      isEssentialDay1: true,
      relativeDays: 0,
      dependsOnTitle: null,
    },
    {
      title: 'Apresentação à equipe e alinhamento inicial com a chefia',
      description: 'Reunião de boas-vindas com a equipe da unidade de destino, definição de mentor(a) e alinhamento das primeiras entregas.',
      operationalStage: 'embarque',
      moment: 'acolhimento',
      responsibleActor: 'chefia',
      responsibleUnit: 'Chefia Imediata',
      isEssentialDay1: true,
      relativeDays: 1,
      dependsOnTitle: 'Recepção institucional e visita guiada ao campus Enap',
    },
    {
      title: 'Conhecer o Regimento Interno, Cadeia de Valor e Programa de Integridade',
      description: 'Explorar os materiais de referência no Repositório e compreender como sua unidade gera valor público.',
      operationalStage: 'embarque',
      moment: 'aprendizagem',
      responsibleActor: 'ingressante',
      responsibleUnit: 'Ingressante',
      isEssentialDay1: false,
      relativeDays: 14,
      dependsOnTitle: 'Apresentação à equipe e alinhamento inicial com a chefia',
    },
    {
      title: 'Conversa de acompanhamento e avaliação dos 30 dias',
      description: 'Responder ao instrumento de escuta de 30 dias (clareza de papel e apoio) e realizar check-in com a chefia.',
      operationalStage: 'pos_embarque',
      moment: 'aprendizagem',
      responsibleActor: 'ingressante',
      responsibleUnit: 'Ingressante / CGP',
      isEssentialDay1: false,
      relativeDays: 30,
      dependsOnTitle: null,
    },
    {
      title: 'Participar de roda de integração interáreas ou atividade do PQVT',
      description: 'Fortalecer conexões transversais conhecendo iniciativas de bem-estar, diversidade e inovação da Escola.',
      operationalStage: 'pos_embarque',
      moment: 'integracao',
      responsibleActor: 'ingressante',
      responsibleUnit: 'PQVT / Comitê DEI',
      isEssentialDay1: false,
      relativeDays: 45,
      dependsOnTitle: null,
    },
    {
      title: 'Avaliação de acompanhamento aos 60 dias',
      description: 'Registrar percepção sobre autonomia, aprendizagem, rotina de trabalho e eventuais barreiras operacionais.',
      operationalStage: 'pos_embarque',
      moment: 'integracao',
      responsibleActor: 'ingressante',
      responsibleUnit: 'Ingressante / CGP',
      isEssentialDay1: false,
      relativeDays: 60,
      dependsOnTitle: 'Conversa de acompanhamento e avaliação dos 30 dias',
    },
    {
      title: 'Avaliação de fechamento do ciclo inicial (90 dias) e plano de desenvolvimento',
      description: 'Consolidar aprendizados dos primeiros 90 dias, pactuar metas de desenvolvimento e transitar para a gestão contínua.',
      operationalStage: 'gestao_continua',
      moment: 'pertencimento',
      responsibleActor: 'chefia',
      responsibleUnit: 'Chefia / Ingressante / CGP',
      isEssentialDay1: false,
      relativeDays: 90,
      dependsOnTitle: 'Avaliação de acompanhamento aos 60 dias',
    },
  ];

  await db.run(
    `
    INSERT INTO journey_templates (id, name, version, description, is_active, tasks_json, created_at, updated_at)
    VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
  `,
    'tpl-padrao-90d',
    'Protocolo Padrão da Jornada de Ambientação (90 dias + Gestão Contínua)',
    '2.1',
    'Modelo estruturado nos cinco momentos orientadores (Preparação, Acolhimento, Aprendizagem, Integração e Pertencimento) e nas dimensões Pessoas, Processos e Evidências.',
    JSON.stringify(defaultTemplateTasks),
    now,
    now,
  );

  // 5. Instanciar jornadas para os perfis de demonstração (Dia 1, 30d, 60d, 90d, Integrada)
  const journeySeeds = [
    {
      id: 'jrn-dia1',
      userId: 'usr-dia1',
      cohort: 'Turma Novembro/2026',
      entry: '2026-11-19',
      opStage: 'embarque',
      moment: 'acolhimento',
      completedCount: 3,
      mentor: 'Beatriz Almeida Duarte (Fictício)',
    },
    {
      id: 'jrn-30d',
      userId: 'usr-30d',
      cohort: 'Turma Outubro/2026',
      entry: '2026-10-19',
      opStage: 'pos_embarque',
      moment: 'aprendizagem',
      completedCount: 6,
      mentor: 'Fernanda Vasconcelos Dias (Fictício)',
    },
    {
      id: 'jrn-60d',
      userId: 'usr-60d',
      cohort: 'Turma Setembro/2026',
      entry: '2026-09-20',
      opStage: 'pos_embarque',
      moment: 'integracao',
      completedCount: 8,
      mentor: 'Patrícia Lemos Ferreira (Fictício)',
    },
    {
      id: 'jrn-90d',
      userId: 'usr-90d',
      cohort: 'Turma Agosto/2026',
      entry: '2026-08-21',
      opStage: 'pos_embarque',
      moment: 'pertencimento',
      completedCount: 9,
      mentor: 'Rodrigo Silveira Campos (Fictício)',
    },
    {
      id: 'jrn-integrada',
      userId: 'usr-integrada',
      cohort: 'Turma Março/2024',
      entry: '2024-03-11',
      opStage: 'gestao_continua',
      moment: 'pertencimento',
      completedCount: 10,
      mentor: 'Patrícia Lemos Ferreira (Fictício)',
    },
  ];

  const insertJourney = (...values: unknown[]) => db.run(`
    INSERT INTO journeys (
      id, user_id, template_id, cohort_name, expected_entry_date, effective_entry_date,
      operational_stage, current_moment, supervisor_user_id, mentor_name, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `, ...values);
  const insertTask = (...values: unknown[]) => db.run(`
    INSERT INTO journey_tasks (
      id, journey_id, title, description, operational_stage, moment, responsible_actor,
      responsible_unit, is_essential_day1, due_date, completed_at, completed_on_time,
      depends_on_title, status, sort_order
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
  `, ...values);
  const insertAssess = (...values: unknown[]) => db.run(`
    INSERT INTO journey_assessments (
      id, journey_id, milestone_days, scheduled_date, status,
      role_clarity_score, team_support_score, supervisor_support_score,
      belonging_score, expectations_met_score, qualitative_comment, submitted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `, ...values);

  const addDays = (isoDate: string, days: number) => {
    const d = new Date(`${isoDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  for (const j of journeySeeds) {
    await insertJourney(
      j.id,
      j.userId,
      'tpl-padrao-90d',
      j.cohort,
      j.entry,
      j.entry,
      j.opStage,
      j.moment,
      'usr-chefia',
      j.mentor,
      j.completedCount >= 10 ? 'concluida' : 'ativa',
      now,
      now,
    );

    for (const [idx, t] of defaultTemplateTasks.entries()) {
      const done = idx < j.completedCount;
      const due = addDays(j.entry, t.relativeDays);
      await insertTask(
        `${j.id}-t${idx + 1}`,
        j.id,
        t.title,
        t.description,
        t.operationalStage,
        t.moment,
        t.responsibleActor,
        t.responsibleUnit,
        t.isEssentialDay1 ? 1 : 0,
        due,
        done ? `${due}T15:00:00.000Z` : null,
        done ? (idx === 1 && j.id === 'jrn-dia1' ? 0 : 1) : null,
        t.dependsOnTitle,
        done ? 'concluida' : 'pendente',
        idx + 1,
      );
    }

    // Avaliações 30 / 60 / 90 dias
    const milestones = [30, 60, 90];
    for (const m of milestones) {
      const scheduled = addDays(j.entry, m);
      let status = 'agendada';
      let submitted = false;
      if (j.id === 'jrn-integrada') {
        status = 'respondida';
        submitted = true;
      } else if (j.id === 'jrn-90d') {
        status = m < 90 ? 'respondida' : 'disponivel';
        submitted = m < 90;
      } else if (j.id === 'jrn-60d') {
        status = m === 30 ? 'respondida' : m === 60 ? 'disponivel' : 'agendada';
        submitted = m === 30;
      } else if (j.id === 'jrn-30d') {
        status = m === 30 ? 'disponivel' : 'agendada';
      }

      await insertAssess(
        `${j.id}-av${m}`,
        j.id,
        m,
        scheduled,
        status,
        submitted ? (m === 30 ? 4 : 5) : null,
        submitted ? 5 : null,
        submitted ? 4 : null,
        submitted ? (m >= 60 ? 5 : 4) : null,
        submitted ? 4 : null,
        submitted ? 'Acolhimento muito bem organizado; clareza crescente sobre os fluxos da unidade.' : null,
        submitted ? `${scheduled}T17:00:00.000Z` : null,
      );
    }
  }

  // Adicionar avaliações históricas fictícias (coorte 2026) na jornada 'jrn-integrada' para garantir n >= 10 em Clareza e Apoio (demonstrando cálculo real sem suprimir tudo)
  for (let i = 1; i <= 9; i++) {
    await insertAssess(
      `hist-av-30-${i}`,
      'jrn-integrada',
      i % 3 === 0 ? 90 : i % 2 === 0 ? 60 : 30,
      '2026-06-15',
      'respondida',
      i % 4 === 0 ? 3 : i % 2 === 0 ? 5 : 4,
      i % 3 === 0 ? 4 : 5,
      i % 5 === 0 ? 3 : 4,
      i <= 4 ? 4 : null, // Pertencimento fica propositalmente com n < 10 para demonstrar supressão k-anonimato!
      4,
      'Registro demonstrativo fictício para cálculo longitudinal de indicadores.',
      '2026-06-16T14:00:00.000Z',
    );
  }

  // Solicitações "Preciso de apoio" (dificuldades registradas)
  const insertSupport = (...values: unknown[]) => db.run(`
    INSERT INTO journey_support_requests (
      id, journey_id, user_id, category, subject, description, status, assigned_unit, resolution_note, created_at, resolved_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, ...values);
  await insertSupport(
    'sup-01',
    'jrn-30d',
    'usr-30d',
    'Acessos e sistemas',
    'Permissão pendente em processo no SEI',
    'Ainda não consigo visualizar os processos da unidade DAE no perfil SEI.',
    'em_andamento',
    'CGTI / Protocolo',
    'Chamado encaminhado à equipe de perfis SEI com previsão de liberação em 24h.',
    '2026-11-17T11:30:00.000Z',
    null,
  );
  await insertSupport(
    'sup-02',
    'jrn-60d',
    'usr-60d',
    'Equipamentos e infraestrutura',
    'Ajuste ergonômico de monitor e suporte',
    'Solicito suporte elevatório para notebook na estação de trabalho presencial.',
    'resolvida',
    'DGC / Logística',
    'Suporte entregue na estação da DDP em 14 horas úteis.',
    '2026-10-05T13:00:00.000Z',
    '2026-10-06T11:00:00.000Z',
  );
  await insertSupport(
    'sup-03',
    'jrn-90d',
    'usr-90d',
    'Aprendizagem e clareza de atribuições',
    'Dúvida sobre fluxo de aprovação de plano de entregas no PGD',
    'Gostaria de confirmar o calendário mensal de registro de entregas na DINOV.',
    'resolvida',
    'CGP / Chefia Imediata',
    'Realizada reunião de 20 minutos com a chefia e enviado guia prático do PGD.',
    '2026-09-12T10:00:00.000Z',
    '2026-09-12T18:00:00.000Z',
  );

  // 6. Módulo PQVT — Atividades Físicas, Esportivas e de Lazer
  const insertActivity = (...values: unknown[]) => db.run(`
    INSERT INTO activities (
      id, title, description, image_url, category, eligible_audience, modality, location,
      schedule_summary, next_session_iso, responsible_name, capacity, registration_deadline,
      participation_criteria, accessibility_resources, additional_guidelines, status, featured, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
  `, ...values);

  await insertActivity(
    'act-01',
    'Alongamento e Mobilidade no Jardim da Enap',
    'Sessão guiada de alongamento, respiração e mobilidade articular ao ar livre, voltada para todas as idades e níveis de condicionamento, sem caráter competitivo.',
    '/src/assets/images/pqvt_bem_estar_1795080544676.jpg',
    'Alongamento e mobilidade',
    'Toda a comunidade Enap (servidoras, servidores, terceirizados e estagiários)',
    'Presencial',
    'Jardim Central — Campus Enap (SAFS Q. 02)',
    'Terças e quintas · 08h30 às 09h15',
    '2026-11-24T11:30:00.000Z',
    'Equipe PQVT (Fictício)',
    15,
    '2026-11-23',
    'Aberto à comunidade Enap; recomenda-se vestimenta confortável.',
    'Área térrea com acesso por rampa, opção de prática sentada em cadeira e acompanhamento adaptado.',
    'Traga garrafa de água reutilizável. Não coletamos dados clínicos ou de desempenho.',
    'aberta',
    1,
    now,
  );

  await insertActivity(
    'act-02',
    'Pausa Ativa e Ergonomia no Teletrabalho (PGD)',
    'Encontro virtual rápido de 25 minutos com orientações práticas de postura, descanso visual e pausas saudáveis durante o expediente remoto.',
    '/src/assets/images/pqvt_bem_estar_1795080544676.jpg',
    'Bem-estar',
    'Pessoas participantes do PGD e demais integrantes da Enap',
    'Virtual',
    'Sala Virtual Institucional (link enviado após inscrição)',
    'Segundas e quartas · 15h00 às 15h25',
    '2026-11-25T18:00:00.000Z',
    'Núcleo de Ergonomia e PQVT (Fictício)',
    40,
    '2026-11-24',
    'Inscrição prévia para envio do link da sala.',
    'Legenda automática ativada, interpretação em Libras sob solicitação e descrição verbal dos movimentos.',
    'Atividade educativa e acolhedora; participação voluntária.',
    'aberta',
    1,
    now,
  );

  await insertActivity(
    'act-03',
    'Clube de Caminhada do Cerrado — Parque da Cidade',
    'Encontro coletivo de convivência e caminhada leve em grupo para integração entre diretorias e fortalecimento de vínculos fora da rotina de telas.',
    '/src/assets/images/jornada_acolhimento_1795080544095.jpg',
    'Atividades coletivas',
    'Toda a comunidade Enap',
    'Presencial',
    'Estacionamento 4 — Parque da Cidade (Brasília/DF)',
    'Sábado · 08h00 às 09h30',
    '2026-11-28T11:00:00.000Z',
    'Grupo de Convivência PQVT (Fictício)',
    2, // Capacidade propositalmente igual a 2 e já ocupada por 2 usuários para demonstrar Lista de Espera!
    '2026-11-27',
    'Vagas limitadas para organização do grupo com lista de espera automática.',
    'Percurso pavimentado e plano, acessível para cadeiras de rodas e mobilidade reduzida.',
    'Trazer protetor solar, boné e água.',
    'aberta',
    0,
    now,
  );

  await insertActivity(
    'act-04',
    'Oficina Cultural: Roda de Leitura e Poesia Brasileira',
    'Espaço mensal de convivência cultural e leitura compartilhada celebrando autoras e autores negros, indígenas e contemporâneos do Brasil.',
    '/src/assets/images/comite_dei_banner_1795080544677.jpg',
    'Cultura',
    'Toda a comunidade Enap',
    'Híbrida',
    'Biblioteca Enap + Transmissão ao vivo',
    'Última sexta-feira do mês · 16h00 às 17h30',
    '2026-11-27T19:00:00.000Z',
    'PQVT e Comitê DEI (Fictício)',
    25,
    '2026-11-26',
    'Não é obrigatório ter concluído a leitura prévia para participar.',
    'Sala acessível, audiolivros de apoio e legendagem no formato virtual.',
    'Tema do mês: vozes plurais no serviço público e literatura brasileira.',
    'aberta',
    0,
    now,
  );

  // Inscrições iniciais (preenchendo act-03 para testar lista de espera!)
  const insertActReg = (...values: unknown[]) => db.run(`
    INSERT INTO activity_registrations (id, activity_id, user_id, status, attendance_confirmed, checkin_code, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, ...values);
  await insertActReg('areg-1', 'act-01', 'usr-integrada', 'confirmada', 1, 'QR-PQVT-9012', now, now);
  await insertActReg('areg-2', 'act-01', 'usr-60d', 'confirmada', 0, 'QR-PQVT-9013', now, now);
  await insertActReg('areg-3', 'act-02', 'usr-30d', 'confirmada', 0, 'QR-PQVT-9014', now, now);
  await insertActReg('areg-4', 'act-03', 'usr-integrada', 'confirmada', 0, 'QR-PQVT-9015', now, now);
  await insertActReg('areg-5', 'act-03', 'usr-chefia', 'confirmada', 0, 'QR-PQVT-9016', now, now);

  // 7. Módulo Eventos (Agenda Integrada: Jornada + PQVT + Comitê DEI + Institucional)
  const insertEvent = (...values: unknown[]) => db.run(`
    INSERT INTO events (
      id, title, description, image_url, source_module, category, start_iso, end_iso,
      location, modality, eligible_audience, organizer, program_json, capacity,
      accessibility_resources, materials_json, meeting_url, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
  `, ...values);

  const eventTime = (daysFromToday: number, hour: number, minute = 0) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() + daysFromToday);
    date.setUTCHours(hour, minute, 0, 0);
    return date.toISOString();
  };

  await insertEvent(
    'evt-01',
    'Encontro de Acolhimento — Turma Novembro/2026',
    'Recepção oficial de novas pessoas servidoras e movimentadas, apresentação dos macroprocessos da Enap, roda de conversa com lideranças e visita guiada ao campus.',
    '/src/assets/images/jornada_acolhimento_1795080544095.jpg',
    'jornada',
    'Jornada de Ambientação',
    eventTime(1, 12, 30),
    eventTime(1, 15, 30),
    'Auditório Principal — Enap (SAFS Q. 02)',
    'Presencial',
    'Ingressantes, chefias imediatas e mentores',
    'CGP / Coordenação de Gestão Estratégica',
    JSON.stringify([
      '09h30 — Café de acolhimento e credenciamento',
      '10h00 — Propósito, Visão e Valores da Enap (RGI 2025)',
      '11h00 — Dinâmica de conexões e apresentação do Enap e-Vida',
      '11h45 — Visita guiada acessível pelos espaços da Escola',
    ]),
    60,
    'Intérprete de Libras, audiodescrição, sala de regulação disponível e mobilidade acessível.',
    JSON.stringify(['Guia de Boas-Vindas Enap (PDF)', 'Mapa de Acessibilidade do Campus']),
    null,
    'publicado',
    now,
  );

  await insertEvent(
    'evt-02',
    '#SouEnap — Encontro de Integração e Alinhamento Institucional',
    'Encontro periódico que mobiliza toda a comunidade Enap para fortalecer a comunicação interna, celebrar entregas coletivas e ampliar o senso de pertencimento.',
    '/src/assets/images/hero_enap_evida_1795080544506.jpg',
    'institucional',
    'Integração Institucional',
    eventTime(9, 17),
    eventTime(9, 19, 30),
    'Auditório Enap + Transmissão institucional',
    'Híbrida',
    'Toda a comunidade Enap',
    'Gabinete da Presidência e Diretoria Executiva',
    JSON.stringify([
      '14h00 — Abertura e destaques das agendas estratégicas',
      '14h45 — Painel "Você participou. Veja o que mudou." (Fala, Enap!)',
      '15h30 — Reconhecimento de projetos e momento de convivência',
    ]),
    200,
    'Tradução em Libras, legendagem ao vivo, sala de regulação e assentos reservados.',
    JSON.stringify(['Relatório de Gestão Integrado 2025 (RGI 2025)']),
    'https://enap.gov.br/souenap-demonstracao',
    'publicado',
    now,
  );

  await insertEvent(
    'evt-03',
    'Diálogos de Equidade: Acessibilidade e Neurodivergência no Trabalho',
    'Roda de diálogo promovida pelo Comitê de Diversidades, Equidade e Inclusão sobre práticas inclusivas no cotidiano das equipes, sala de regulação e comunicação acessível.',
    '/src/assets/images/comite_dei_banner_1795080544677.jpg',
    'comite_dei',
    'Comitê DEI',
    eventTime(3, 18),
    eventTime(3, 19, 30),
    'Sala 204 (Bloco B) + Transmissão Virtual',
    'Híbrida',
    'Toda a comunidade Enap',
    'Comitê de Diversidades, Equidade e Inclusão',
    JSON.stringify([
      '15h00 — Apresentação da Política Integrada de Acessibilidade',
      '15h30 — Relatos e boas práticas de equipes inclusivas',
      '16h10 — Encaminhamentos e sugestões para o Plano de Ação DEI',
    ]),
    80,
    'Libras, audiodescrição, legendas em tempo real, material prévio em formato acessível e sala de regulação.',
    JSON.stringify(['Cartilha de Comunicação Inclusiva e Acessível']),
    'https://enap.gov.br/dei-dialogos-demonstracao',
    'publicado',
    now,
  );

  await insertEvent(
    'evt-04',
    'Feira de Bem-Estar e Qualidade de Vida (PQVT)',
    'Manhã dedicada à convivência, oficinas de alongamento, orientações ergonômicas, troca de livros e espaço de escuta para a programação 2027 do PQVT.',
    '/src/assets/images/pqvt_bem_estar_1795080544676.jpg',
    'pqvt',
    'Qualidade de Vida (PQVT)',
    eventTime(16, 12),
    eventTime(16, 16),
    'Espaço de Convivência — Campus Enap',
    'Presencial',
    'Toda a comunidade Enap',
    'Programa de Qualidade de Vida no Trabalho — PQVT',
    JSON.stringify([
      '09h00 — Alongamento coletivo de abertura',
      '10h00 — Estações temáticas de ergonomia, cultura e lazer',
      '11h30 — Mural colaborativo "Fala, Enap!" para sugestões PQVT',
    ]),
    120,
    'Circulação livre de obstáculos, sinalização tátil e apoio dedicado na entrada.',
    JSON.stringify(['Programação Completa PQVT']),
    null,
    'publicado',
    now,
  );

  await db.run(
    `
    INSERT INTO event_registrations (id, event_id, user_id, status, attendance_confirmed, created_at)
    VALUES ($1, $2, $3, 'confirmada', 0, $4)
  `,
    'ereg-01', 'evt-01', 'usr-dia1', now,
  );
  await db.run(
    `
    INSERT INTO event_registrations (id, event_id, user_id, status, attendance_confirmed, created_at)
    VALUES ($1, $2, $3, 'confirmada', 0, $4)
  `,
    'ereg-02', 'evt-02', 'usr-30d', now,
  );

  // 8. Fala, Enap! (Escuta colaborativa e "Veja o que mudou")
  const insertFeedback = (...values: unknown[]) => db.run(`
    INSERT INTO feedback_submissions (
      id, user_id, category, title, description, status, institutional_reply,
      implemented_highlight, change_summary, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, ...values);

  await insertFeedback(
    'fb-01',
    'usr-integrada',
    'Sugestão de atividade PQVT',
    'Horário alternativo para alongamento às 17h',
    'Muitas pessoas chegam para reuniões matinais às 08h30. Uma turma no fim da tarde ampliaria a participação de quem trabalha presencialmente no bloco B.',
    'incorporada_plano',
    'Agradecemos a contribuição! A equipe do PQVT avaliou a demanda e incluiu uma turma piloto às quartas-feiras, 17h15, na programação do próximo trimestre.',
    1,
    'Nova turma de Alongamento e Mobilidade criada no turno vespertino (quartas, 17h15) após sugestões no Fala, Enap!.',
    '2026-10-12T14:20:00.000Z',
    '2026-11-05T16:00:00.000Z',
  );

  await insertFeedback(
    'fb-02',
    'usr-60d',
    'Proposta de melhoria',
    'Checklist único de acessos digitais antes do Dia 1',
    'No meu primeiro dia, o acesso ao SEI levou 3 dias para liberar. Um disparo automático para a CGTI 5 dias antes da entrada evitaria espera inicial.',
    'incorporada_plano',
    'Excelente ponto! Incorporamos essa melhoria ao Laboratório de Melhoria Contínua da Jornada de Ambientação como tarefa pré-embarque obrigatória (D-5).',
    1,
    'Fluxo de Pré-embarque atualizado com marco D-5 para provisionamento antecipado de rede, e-mail e SEI.',
    '2026-10-22T11:15:00.000Z',
    '2026-11-10T10:30:00.000Z',
  );

  await insertFeedback(
    'fb-03',
    'usr-30d',
    'Registro de experiência positiva',
    'Acolhimento com mentoria de pares na primeira semana',
    'Ter uma colega de referência para tirar dúvidas cotidianas sobre processos e almoçar no primeiro dia fez toda a diferença para me sentir parte da Escola.',
    'respondida',
    'Muito obrigado por compartilhar sua experiência! Esse retorno reforça a continuidade da rede de mentores de ambientação.',
    0,
    null,
    '2026-11-02T17:40:00.000Z',
    '2026-11-04T09:10:00.000Z',
  );

  await insertFeedback(
    'fb-04',
    'usr-dia1',
    'Pergunta sobre o PQVT',
    'Pessoas recém-chegadas em estágio inicial já podem participar das oficinas?',
    'Acabei de iniciar minhas atividades na Enap hoje e gostaria de saber se já posso me inscrever na oficina de leitura e no alongamento.',
    'em_analise',
    null,
    0,
    null,
    '2026-11-19T09:00:00.000Z',
    '2026-11-19T09:00:00.000Z',
  );

  // 9. Enquetes (1 Anônima com n >= 10 respostas para gráficos + 1 Confidencial com n < 10 para demonstrar supressão + 1 Identificada)
  const insertSurvey = (...values: unknown[]) => db.run(`
    INSERT INTO surveys (
      id, title, purpose, eligible_audience, opens_at, closes_at, anonymity_mode,
      allow_edit, show_results_to_users, min_aggregation_threshold, privacy_notice,
      version, questions_json, status, what_changed_summary, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
  `, ...values);

  await insertSurvey(
    'srv-01',
    'Consulta PQVT 2026/2027 — Preferências de Atividades e Horários',
    'Coletar preferências da comunidade Enap para planejar a grade de atividades físicas, esportivas, culturais e de convivência do próximo semestre.',
    'Toda a comunidade Enap',
    '2026-11-01',
    '2026-12-15',
    'anonima',
    0,
    1,
    10,
    'Pesquisa efetivamente anônima: o controle de participação é armazenado separadamente das respostas, sem vínculo com sua conta. Resultados exibidos apenas com no mínimo 10 respostas agregadas.',
    '1.0',
    JSON.stringify([
      {
        id: 'q1',
        type: 'single_choice',
        label: 'Qual categoria de atividade do PQVT mais desperta seu interesse?',
        required: true,
        options: [
          'Alongamento e mobilidade',
          'Atividades coletivas ao ar livre',
          'Oficinas culturais e leitura',
          'Bem-estar e pausas no teletrabalho',
        ],
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        label: 'Em quais formatos você prefere participar?',
        required: true,
        options: ['Presencial no Campus Enap', 'Virtual (síncrono)', 'Híbrido', 'Atividades em parques/áreas externas'],
      },
      {
        id: 'q3',
        type: 'likert',
        label: 'A divulgação atual das atividades do PQVT facilita sua participação.',
        required: true,
        options: ['Discordo totalmente', 'Discordo parcialmente', 'Neutro', 'Concordo parcialmente', 'Concordo totalmente'],
      },
      {
        id: 'q4',
        type: 'text',
        label: 'Sugestão de tema, horário ou recurso de acessibilidade (opcional):',
        required: false,
      },
    ]),
    'aberta',
    'Na consulta anterior, 68% pediram atividades híbridas e pausas curtas no PGD — o que originou o programa "Pausa Ativa no Teletrabalho".',
    now,
  );

  await insertSurvey(
    'srv-02',
    'Pulso de Experiência da Jornada de Ambientação (Coorte Piloto)',
    'Avaliar clareza dos materiais de pré-embarque e acolhimento inicial para aprimorar o protocolo institucional.',
    'Ingressantes dos últimos 90 dias',
    '2026-11-10',
    '2026-12-20',
    'confidencial',
    1,
    1,
    10,
    'Pesquisa confidencial: o acesso aos registros brutos é restrito à equipe analítica autorizada. Resultados públicos só são exibidos quando atingem o limiar mínimo de 10 respostas.',
    '1.0',
    JSON.stringify([
      {
        id: 'q1',
        type: 'rating',
        label: 'De 1 a 5, como você avalia a clareza das orientações recebidas antes do primeiro dia?',
        required: true,
        min: 1,
        max: 5,
      },
      {
        id: 'q2',
        type: 'single_choice',
        label: 'Você precisou acionar suporte técnico para acessos na primeira semana?',
        required: true,
        options: ['Sim', 'Não'],
      },
      {
        id: 'q3',
        type: 'text',
        label: 'Se respondeu Sim, qual acesso demorou mais para ser liberado?',
        required: false,
        conditionalOn: {questionId: 'q2', equals: 'Sim'},
      },
    ]),
    'aberta',
    null,
    now,
  );

  // Popular 12 respostas anônimas fictícias em srv-01 (sem user_id!) para exibir gráficos agregados
  const insertSurveyResp = (...values: unknown[]) => db.run(`
    INSERT INTO survey_responses (id, survey_id, user_id, answers_json, submitted_at)
    VALUES ($1, $2, $3, $4, $5)
  `, ...values);
  const catChoices = [
    'Alongamento e mobilidade',
    'Bem-estar e pausas no teletrabalho',
    'Oficinas culturais e leitura',
    'Atividades coletivas ao ar livre',
    'Alongamento e mobilidade',
    'Bem-estar e pausas no teletrabalho',
    'Alongamento e mobilidade',
    'Oficinas culturais e leitura',
    'Bem-estar e pausas no teletrabalho',
    'Atividades coletivas ao ar livre',
    'Alongamento e mobilidade',
    'Bem-estar e pausas no teletrabalho',
  ];
  const likertChoices = [
    'Concordo totalmente',
    'Concordo parcialmente',
    'Concordo totalmente',
    'Neutro',
    'Concordo parcialmente',
    'Concordo totalmente',
    'Concordo parcialmente',
    'Concordo totalmente',
    'Discordo parcialmente',
    'Concordo parcialmente',
    'Concordo totalmente',
    'Concordo parcialmente',
  ];
  for (let i = 0; i < 12; i++) {
    await insertSurveyResp(
      generateId(),
      'srv-01',
      null, // Anonimato efetivo: zero user_id armazenado!
      JSON.stringify({
        q1: catChoices[i],
        q2: i % 2 === 0 ? ['Híbrido', 'Virtual (síncrono)'] : ['Presencial no Campus Enap', 'Híbrido'],
        q3: likertChoices[i],
        q4: i === 0 ? 'Mais atividades no fim da tarde e opções híbridas.' : '',
      }),
      '2026-11-14T15:00:00.000Z',
    );
  }

  // Popular apenas 4 respostas em srv-02 para demonstrar o bloqueio automático de supressão (n < 10)!
  for (let i = 0; i < 4; i++) {
    await insertSurveyResp(
      generateId(),
      'srv-02',
      null,
      JSON.stringify({q1: 4 + (i % 2), q2: i % 2 === 0 ? 'Sim' : 'Não', q3: i % 2 === 0 ? 'SEI' : ''}),
      '2026-11-16T14:00:00.000Z',
    );
  }

  // 10. Repositório de Conhecimentos e Documentos
  const insertDoc = (...values: unknown[]) => db.run(`
    INSERT INTO documents (
      id, title, description, author_unit, category, subject, keywords, published_at,
      version, updated_at, authorized_audience, format, source_label, content_preview,
      versions_history_json, is_restricted, editorial_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  `, ...values);

  await insertDoc(
    'doc-01',
    'Relatório de Gestão Integrado 2025 — Enap (RGI 2025)',
    'Documento institucional que apresenta o propósito, visão, valores, marcos de atuação, estrutura organizacional, diversidade, governança e resultados da Enap em 2025.',
    'Gabinete da Presidência e Diretoria Executiva',
    'Relatórios',
    'Gestão Estratégica e Governança',
    'RGI 2025, propósito, valores, governança, iESGo, PGD, diversidade',
    '2026-03-30',
    '1.0 (Final)',
    '2026-03-30',
    'Toda a comunidade Enap',
    'PDF',
    'Documento oficial anexado ao projeto',
    'Propósito: Conhecimento e prática para a transformação do Estado. Visão: Um país democrático, justo, desenvolvido e ambientalmente sustentável, onde todas as pessoas vivam com qualidade, dignidade e respeito às diversidades. Valores: Democracia, Diversidade, Sustentabilidade, Participação social, Colaboração, Responsabilidade fiscal e social, Excelência na gestão.',
    JSON.stringify([{version: '1.0 (Final)', date: '2026-03-30', note: 'Versão oficial publicada do RGI 2025.'}]),
    0,
    'publicado',
  );

  await insertDoc(
    'doc-02',
    'A Jornada da Ambientação — Da posse ao pertencimento',
    'Referência conceitual e metodológica da Semana de Inovação sobre as dimensões Pessoas, Processos e Evidências, os cinco momentos orientadores e os indicadores propostos.',
    'Coordenação de Gestão Estratégica e Modernização (COGEM)',
    'Apresentações',
    'Jornada de Ambientação',
    'ambientação, pertencimento, pré-embarque, embarque, 30 60 90 dias, evidências',
    '2026-10-15',
    '2.0',
    '2026-10-15',
    'Toda a comunidade Enap',
    'PDF',
    'Apresentação Semana de Inovação Enap',
    'Receber é diferente de integrar. A Jornada articula Pré-embarque, Embarque, Pós-embarque (30/60/90 dias) e Gestão contínua nos cinco momentos: Preparação, Acolhimento, Aprendizagem, Integração e Pertencimento. Base científica: Bauer et al. (2007), Saks et al. (2007), Frögéli et al. (2023) e Donato et al. (2026).',
    JSON.stringify([
      {version: '1.0', date: '2026-08-10', note: 'Protocolo inicial documentado de 90 dias.'},
      {version: '2.0', date: '2026-10-15', note: 'Versão oficina Semana de Inovação com Canvas de Cocriação e indicadores.'},
    ]),
    0,
    'publicado',
  );

  await insertDoc(
    'doc-03',
    'Guia Prático de Boas-Vindas e Primeiros Passos na Enap',
    'Orientações essenciais sobre acesso ao campus (SAFS Quadra 02, Lote 04, Brasília/DF), sistemas corporativos, PGD, saúde e canais de apoio.',
    'Coordenação de Gestão de Pessoas (CGP)',
    'Guias',
    'Acolhimento e Rotina Institucional',
    'boas-vindas, primeiro dia, campus, PGD, acessos, crachá',
    '2026-09-01',
    '3.2',
    '2026-11-01',
    'Toda a comunidade Enap',
    'Guia Digital',
    'Material demonstrativo ilustrativo',
    'Contém checklist do primeiro dia, mapa de unidades, orientações de acessibilidade física e digital, informações sobre o Programa de Gestão e Desempenho (PGD) e contatos autorizados de suporte.',
    JSON.stringify([
      {version: '3.0', date: '2026-01-20', note: 'Atualização de fluxos digitais.'},
      {version: '3.2', date: '2026-11-01', note: 'Inclusão de orientações sobre sala de regulação e PQVT.'},
    ]),
    0,
    'publicado',
  );

  await insertDoc(
    'doc-04',
    'Resolução Enap nº 76/2025 — Diretrizes de Ações Afirmativas e Acessibilidade',
    'Referência citada no RGI 2025 sobre diretrizes para promoção da equidade racial, de gênero e acessibilidade nos processos formativos e espaços institucionais.',
    'Comitê de Diversidades, Equidade e Inclusão',
    'Normativos',
    'Diversidade, Equidade e Inclusão',
    'resolução 76/2025, equidade racial, gênero, acessibilidade, inclusão',
    '2025-03-18',
    '1.0',
    '2025-03-18',
    'Toda a comunidade Enap',
    'Normativo',
    'Referência citada no RGI 2025 (pág. 21)',
    'Estabelece diretrizes de promoção da equidade racial, de gênero e de acessibilidade, incorporando critérios de equidade no acesso, composição de turmas e desenho pedagógico.',
    JSON.stringify([{version: '1.0', date: '2025-03-18', note: 'Publicação institucional.'}]),
    0,
    'publicado',
  );

  await insertDoc(
    'doc-05',
    'Protocolo Interno de Tratamento de Dados do Pré-Ingresso (Acesso Restrito)',
    'Orientações operacionais para análise de formulários GAEG NS/NI, segregação de dados bancários e retenção conforme LGPD.',
    'Governança de Dados e CGP',
    'Manuais',
    'Proteção de Dados e Pré-ingresso',
    'LGPD, GAEG, cessão, cofre bancário, auditoria, acesso restrito',
    '2026-10-01',
    '1.1',
    '2026-11-10',
    'Perfis administrativos autorizados',
    'Manual Interno',
    'Documento restrito (exemplo de controle de acesso)',
    'Estabelece que dados bancários e autodeclarações sensíveis não podem ser exportados em relatórios gerenciais genéricos ou incluídos em e-mails/notificações.',
    JSON.stringify([{version: '1.1', date: '2026-11-10', note: 'Reforço de regras de mascaramento e revisão de acessos.'}]),
    1,
    'publicado',
  );

  // 11. Comunicados Institucionais
  const insertAnn = (...values: unknown[]) => db.run(`
    INSERT INTO announcements (id, title, summary, category, published_at, editorial_status)
    VALUES ($1, $2, $3, $4, $5, 'publicado')
  `, ...values);
  await insertAnn(
    'ann-01',
    'Inscrições abertas para o ciclo de atividades de novembro do PQVT',
    'Confira as turmas presenciais, híbridas e virtuais de alongamento, pausa ativa no PGD e roda de leitura.',
    'PQVT',
    '2026-11-18',
  );
  await insertAnn(
    'ann-02',
    'Semana de Inovação e legado de acessibilidade: conheça a sala de regulação',
    'Espaço de acolhimento sensorial consolidado nas atividades formativas e eventos da Enap.',
    'Comitê DEI',
    '2026-11-15',
  );
  await insertAnn(
    'ann-03',
    'Você participou. Veja o que mudou com as contribuições do Fala, Enap!',
    'Duas propostas da comunidade interna já foram incorporadas ao PQVT e ao fluxo de pré-embarque.',
    'Fala, Enap!',
    '2026-11-12',
  );

  // 12. Comitê de Diversidades, Equidade e Inclusão — Iniciativas e Planos
  const insertDei = (...values: unknown[]) => db.run(`
    INSERT INTO committee_projects (id, title, type, summary, responsible_unit, status, due_date, deliverables_json, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, ...values);

  await insertDei(
    'dei-01',
    'Expansão da Sala de Regulação e Protocolo de Acessibilidade em Eventos',
    'projeto',
    'Consolidar o serviço de acolhimento para pessoas com deficiência e neurodivergentes, com tradução em Libras, audiodescrição e sinalização acessível em todos os eventos internos.',
    'Comitê DEI e DGC',
    'em_andamento',
    '2027-03-30',
    JSON.stringify(['Checklist obrigatório de acessibilidade em eventos', 'Manual de uso da sala de regulação', 'Capacitação da equipe de recepção']),
    now,
  );
  await insertDei(
    'dei-02',
    'Campanha Permanente de Prevenção ao Assédio e Discriminação (Guia Lilás)',
    'campanha',
    'Ações formativas transversais, rodas de conversa e divulgação clara dos canais oficiais de acolhimento e da Ouvidoria (Fala.BR).',
    'Comitê DEI e CGP',
    'ativo',
    '2026-12-20',
    JSON.stringify(['Minicursos Guia Lilás na ambientação', 'Cartilha de fluxos de acolhimento e denúncia no Fala.BR']),
    now,
  );
  await insertDei(
    'dei-03',
    'GT Equidade Racial e Ações Afirmativas na Gestão Interna',
    'grupo_trabalho',
    'Monitoramento agregado das diretrizes da Resolução Enap nº 76/2025 e articulação com os programas FIF e FIAR para o público interno.',
    'Comitê DEI',
    'em_andamento',
    '2027-06-30',
    JSON.stringify(['Painel agregado anual de representatividade (sem exposição individual)', 'Ciclo de letramento racial para chefias']),
    now,
  );

  // 13. Laboratório de Melhoria Contínua (Canvas de Cocriação — Semana de Inovação Slide 13)
  const insertImp = (...values: unknown[]) => db.run(`
    INSERT INTO improvement_plans (
      id, title, journey_phase, canvas_experience, canvas_need, canvas_action,
      canvas_owner, canvas_evidence, hypothesis, priority, status,
      linked_indicator_code, pilot_criteria, learnings, due_date, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  `, ...values);

  await insertImp(
    'imp-01',
    'Provisionamento antecipado de acessos digitais (Marco D-5)',
    'Preparação',
    'No primeiro dia, a pessoa ingressante aguarda liberação de e-mail, rede e SEI, gerando ansiedade e sensação de improviso.',
    'Garantir que sistemas essenciais estejam prontos no Dia 1 sem dependência de solicitações manuais tardias.',
    'Acionar automaticamente lista de verificação integrada entre CGP e CGTI 5 dias úteis antes da data prevista de ingresso.',
    'CGP (disparo), CGTI (execução) e Chefia imediata (validação de perfis).',
    'Aumento da proporção de itens essenciais disponíveis no Dia 1 (Indicador de Preparação) e redução de chamados de acesso na 1ª semana.',
    'A ausência de gatilho padronizado após confirmação do pré-ingresso causa atrasos no provisionamento.',
    'alta',
    'implementado',
    'IND_PREPARACAO',
    'Testar na turma de novembro/2026 com meta de >= 90% dos acessos ativos até 10h do Dia 1.',
    'Reduziu o tempo médio de espera por acesso SEI de 72h para menos de 12h no piloto fictício.',
    '2026-11-15',
    now,
    now,
  );

  await insertImp(
    'imp-02',
    'Guia Rápido para Chefias: Roteiro do 1º Dia e Check-in de 30 Dias',
    'Acolhimento',
    'A qualidade da recepção varia muito entre diretorias conforme a disponibilidade e familiaridade da chefia com a jornada.',
    'Padronizar um roteiro leve, humano e prático para chefias conduzirem a apresentação da equipe e a pactuação de expectativas.',
    'Disponibilizar roteiro interativo e lembretes automáticos para chefias no painel da Jornada 48h antes da chegada e aos 25 dias.',
    'Responsável pela Ambientação (curadoria) e Chefias imediatas (aplicação).',
    'Evolução positiva nos indicadores de Clareza de Papel e Apoio e Vínculos aos 30 dias.',
    'Chefias desejam acolher bem, mas carecem de um roteiro objetivo integrado à rotina.',
    'alta',
    'piloto',
    'IND_CLAREZA_PAPEL',
    'Piloto com 8 chefias na coorte atual; avaliar adesão ao roteiro e feedback das lideranças após 30 dias.',
    'Em acompanhamento piloto — avaliação prevista para dezembro/2026.',
    '2026-12-10',
    now,
    now,
  );

  await insertImp(
    'imp-03',
    'Rede de Pares de Acolhimento para Ingressantes em Teletrabalho (PGD)',
    'Integração',
    'Pessoas que atuam em regime híbrido ou remoto relatam menos encontros espontâneos e maior dificuldade para conhecer outras diretorias.',
    'Criar pontos de conexão intencionais entre ingressantes e colegas veteranos fora da pauta estritamente operacional.',
    'Parear cada ingressante com um(a) mentor(a) voluntário(a) de outra coordenação e oferecer encontro mensal híbrido integrado ao PQVT.',
    'CGP, PQVT e Rede Voluntária de Mentores.',
    'Taxa de participação em encontros de integração e evolução longitudinal do indicador de Pertencimento.',
    'Vínculos interáreas fortalecem o senso de pertencimento em modelos de trabalho flexíveis.',
    'media',
    'em_execucao',
    'IND_PERTENCIMENTO',
    'Avaliar participação voluntária e percepção qualitativa nos ciclos de 60 e 90 dias.',
    null,
    '2027-01-30',
    now,
    now,
  );

  // 14. Notificações iniciais
  const insertNotif = (...values: unknown[]) => db.run(`
    INSERT INTO notifications (id, user_id, category, title, message, link_path, is_operational, is_read, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8)
  `, ...values);
  await insertNotif(generateId(), 'usr-dia1', 'jornada', 'Boas-vindas à Enap!', 'Seu roteiro do primeiro dia está disponível na Jornada de Ambientação.', '/app/jornada', 1, now);
  await insertNotif(generateId(), 'usr-30d', 'jornada', 'Avaliação de 30 dias disponível', 'Conte como está sendo sua adaptação e clareza de papel no primeiro mês.', '/app/jornada/avaliacoes', 1, now);
  await insertNotif(generateId(), 'usr-30d', 'enquetes', 'Nova consulta do PQVT aberta', 'Participe da consulta anônima sobre preferências de atividades e horários.', '/app/enquetes/srv-01', 0, now);
  await insertNotif(generateId(), 'usr-60d', 'jornada', 'Avaliação de 60 dias disponível', 'Sua escuta de 60 dias está aberta para registro na Jornada.', '/app/jornada/avaliacoes', 1, now);
  await insertNotif(generateId(), 'usr-90d', 'jornada', 'Fechamento do ciclo inicial (90 dias)', 'Registre sua avaliação de 90 dias e explore as ações contínuas do Enap e-Vida.', '/app/jornada/avaliacoes', 1, now);
  await insertNotif(generateId(), 'usr-chefia', 'jornada', 'Tarefas de chefia pendentes na ambientação', 'Há entregas de acolhimento sob sua responsabilidade para ingressantes da unidade.', '/app/jornada', 1, now);
  await insertNotif(generateId(), 'usr-pre-resp', 'pre_ingresso', 'Formulário de pré-ingresso recebido', 'Novo protocolo ENAP-PRE-2026-A91F3C disponível para conferência administrativa.', '/admin/pre-ingresso', 1, now);

  // 15. Eventos iniciais de auditoria
  await logAuditEvent({
    actorUserId: 'usr-admin',
    actorEmail: 'admin@demo.enap.gov.br',
    action: 'SYSTEM_DEMO_SEED',
    resourceType: 'database',
    outcome: 'sucesso',
    metadata: {note: 'Base demonstrativa inicializada exclusivamente com dados fictícios.'},
  });
  await logAuditEvent({
    actorUserId: 'usr-pre-resp',
    actorEmail: 'preingresso.gestao@demo.enap.gov.br',
    action: 'PREBOARDING_INVITE_CREATED',
    resourceType: 'invitation',
    resourceId: 'inv-ns-01',
    outcome: 'sucesso',
    metadata: {modality: 'GAEG_NS'},
  });
}
