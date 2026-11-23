import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GAEG_PARAMETERS,
  formatCpf,
  isValidCpf,
  maskBankAccount,
  maskCpf,
  preboardingSubmissionSchema,
} from './validators';
import {
  buildBrazilianCsv,
  buildEventIcs,
  canAccessAdmin,
  hasPermission,
  sanitizeCsvCell,
} from './security';
import {
  applySmallGroupSuppression,
  calculateMeanWithSuppression,
  computeStrategicIndicators,
} from './indicators';

test('CPF validation accepts mathematically valid synthetic CPF and rejects invalid/repeated ones', () => {
  assert.equal(isValidCpf('52998224725'), true);
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('111.111.111-11'), false);
  assert.equal(isValidCpf('52998224726'), false);
  assert.equal(formatCpf('52998224725'), '529.982.247-25');
  assert.equal(maskCpf('52998224725'), '***.982.247-**');
});

test('Bank account masking protects critical account numbers', () => {
  assert.equal(maskBankAccount('0012345-6'), '*******-6');
  assert.equal(maskBankAccount('12'), '****');
});

test('GAEG NS and NI declarations preserve exact verbatim reference figures and legal basis', () => {
  assert.equal(DEFAULT_GAEG_PARAMETERS.GAEG_NS.gaegValue, 4544.26);
  assert.equal(DEFAULT_GAEG_PARAMETERS.GAEG_NS.maxTotalRemuneration, 21454.12);
  assert.match(DEFAULT_GAEG_PARAMETERS.GAEG_NS.declarationText, /R\$ 4\.544,26/);
  assert.match(DEFAULT_GAEG_PARAMETERS.GAEG_NS.declarationText, /R\$ 21\.454,12/);
  assert.match(DEFAULT_GAEG_PARAMETERS.GAEG_NS.declarationText, /ABATE TETO/);

  assert.equal(DEFAULT_GAEG_PARAMETERS.GAEG_NI.gaegValue, 2908.64);
  assert.equal(DEFAULT_GAEG_PARAMETERS.GAEG_NI.maxTotalRemuneration, 13974.75);
  assert.match(DEFAULT_GAEG_PARAMETERS.GAEG_NI.declarationText, /R\$ 2\.908,64/);
  assert.match(DEFAULT_GAEG_PARAMETERS.GAEG_NI.declarationText, /R\$ 13\.974,75/);
  assert.match(DEFAULT_GAEG_PARAMETERS.GAEG_NI.declarationText, /MEDIDA PROVISÓRIA Nº 1\.170/);
});

test('Preboarding schema enforces conditional PGD modality when estaEmPgd is SIM', () => {
  const basePayload = {
    nome: 'Pessoa Teste Fictícia',
    cpf: '529.982.247-25',
    naturalidadeUf: 'Brasília/DF',
    racaCor: 'Parda',
    dataNascimento: '1990-04-12',
    rg: '1234567',
    orgaoExpedidor: 'SSP/DF',
    filiacao: 'Maria Teste e José Teste',
    tituloEleitor: '012345678901',
    escolaridade: 'Ensino Superior Completo',
    formacao: 'Administração Pública',
    residenciasUltimos10Anos: [{cidade: 'Brasília', uf: 'DF', periodo: '2016-2026'}],
    enderecoAtual: 'SQN 202 Bloco A, Brasília/DF',
    telefoneParticular: '(61) 99999-0000',
    orgaoOrigem: 'Ministério da Gestão e da Inovação em Serviços Públicos',
    cargoEfetivo: 'Analista Técnico-Administrativo',
    matriculaSiape: '1987654',
    ingressoServicoPublico: '2018-02-01',
    estagioProbatorioConcluido: 'SIM' as const,
    entradaPorCotas: 'NAO' as const,
    pessoaComDeficiencia: 'NAO' as const,
    estaEmPgd: 'SIM' as const,
    modalidadePgd: '',
    propostaCargoFuncaoEnap: 'Coordenação de Projetos',
    orgaoExercicioAtual: 'MGI',
    selecaoMedianteEdital: 'Sim — Edital nº 04/2026 (fictício)',
    negociacaoPreviaCedente: 'Sim — alinhamento prévio com chefia imediata',
    mudancaDomicilio: 'NAO' as const,
    tipoConta: 'CONTA_CORRENTE' as const,
    banco: '001 - Banco do Brasil',
    agenciaComDv: '1234-5',
    contaBancaria: '98765-4',
    cienteRemuneracaoMaxima: true as const,
    chefiaNome: 'Chefia Fictícia',
    chefiaEmail: 'chefia@orgao.exemplo.gov.br',
    chefiaCargo: 'Coordenadora-Geral',
    chefiaOrgao: 'MGI',
    cienteAvisoPrivacidade: true as const,
  };

  const invalid = preboardingSubmissionSchema.safeParse(basePayload);
  assert.equal(invalid.success, false);

  const valid = preboardingSubmissionSchema.safeParse({
    ...basePayload,
    modalidadePgd: 'PGD — Teletrabalho parcial',
  });
  assert.equal(valid.success, true);
});

test('RBAC enforces segregation of duties and blocks unauthorized roles', () => {
  // Regular user cannot access admin or vault
  assert.equal(canAccessAdmin(['usuario_regular']), false);
  assert.equal(hasPermission(['usuario_regular'], 'preboarding:view_restricted_vault'), false);

  // Supervisor (chefia) has supervisor tasks only, not confidential preboarding vault
  assert.equal(hasPermission(['chefia'], 'journey:supervisor_tasks'), true);
  assert.equal(hasPermission(['chefia'], 'preboarding:view_restricted_vault'), false);
  assert.equal(canAccessAdmin(['chefia']), false);

  // Technical admin has admin access, but NO automatic access to segregated bank/sensitive vault (§23)
  assert.equal(canAccessAdmin(['admin_tecnico']), true);
  assert.equal(hasPermission(['admin_tecnico'], 'preboarding:view_restricted_vault'), false);

  // Pre-ingresso specialist has restricted vault access
  assert.equal(hasPermission(['resp_pre_ingresso'], 'preboarding:view_restricted_vault'), true);

  // Auditor can view audit trail but not alter users or view bank vault
  assert.equal(hasPermission(['auditor_lgpd'], 'audit:view'), true);
  assert.equal(hasPermission(['auditor_lgpd'], 'users:manage'), false);
  assert.equal(hasPermission(['auditor_lgpd'], 'preboarding:view_restricted_vault'), false);
});

test('CSV export neutralizes formula injection and uses semicolon delimiter with UTF-8 BOM', () => {
  assert.equal(sanitizeCsvCell('=CMD("calc")'), `"'=CMD(""calc"")"`);
  assert.equal(sanitizeCsvCell('+1+1'), `'+1+1`);
  assert.equal(sanitizeCsvCell('-SUM(A1)'), `'-SUM(A1)`);
  assert.equal(sanitizeCsvCell('@HYPERLINK'), `'@HYPERLINK`);

  const csv = buildBrazilianCsv(['Indicador', 'Valor'], [['Cobertura', '85%'], ['=INJ', '10']]);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.match(csv, /Indicador;Valor/);
  assert.match(csv, /'=INJ;10/);
});

test('ICS generator outputs valid VCALENDAR with VEVENT fields', () => {
  const ics = buildEventIcs({
    id: 'evt-1',
    title: 'Boas-vindas Enap',
    description: 'Encontro inicial',
    location: 'Auditório Enap',
    startIso: '2026-11-25T13:00:00.000Z',
    endIso: '2026-11-25T15:00:00.000Z',
    organizer: 'CGP Enap',
  });
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /SUMMARY:Boas-vindas Enap/);
  assert.match(ics, /END:VCALENDAR/);
});

test('Indicators never show missing data as zero and enforce n < 10 privacy suppression', () => {
  const emptyMean = calculateMeanWithSuppression([], 10);
  assert.equal(emptyMean.value, null);
  assert.equal(emptyMean.status, 'sem_dados');

  const smallSample = calculateMeanWithSuppression([4, 5, 4, 5, 5], 10);
  assert.equal(smallSample.value, null);
  assert.equal(smallSample.status, 'suprimido_privacidade');

  const validSample = calculateMeanWithSuppression([4, 5, 4, 5, 5, 4, 4, 5, 4, 5], 10);
  assert.equal(validSample.status, 'disponivel');
  assert.equal(validSample.value, 4.5);

  // Complementary suppression when a single breakdown group falls below threshold
  const groups = applySmallGroupSuppression(
    [
      {label: 'Diretoria A', count: 18},
      {label: 'Diretoria B', count: 12},
      {label: 'Diretoria C', count: 4},
    ],
    10,
  );
  assert.equal(groups.find((g) => g.label === 'Diretoria C')?.suppressed, true);
  assert.equal(groups.find((g) => g.label === 'Diretoria B')?.suppressed, true);
  assert.equal(groups.find((g) => g.label === 'Diretoria A')?.suppressed, false);

  const computed = computeStrategicIndicators({
    eligibleNewcomers: 0,
    journeyParticipants: 0,
    essentialDay1TasksTotal: 10,
    essentialDay1TasksOnTime: 8,
    roleClarityScores30: [4, 5, 4],
    roleClarityScores60: [],
    roleClarityScores90: [],
    supportScores30: [5, 4, 5, 4, 5, 4, 5, 4, 5, 4],
    supportScores90: [],
    belongingScores: [],
    supportRequestsTotal: 4,
    supportRequestsResolved: 3,
    supportResolutionHours: [12, 24, 18],
    pqvtCapacityTotal: 100,
    pqvtConfirmedRegistrations: 75,
    surveysPublished: 3,
    surveyResponsesTotal: 25,
    improvementPlansImplemented: 2,
    improvementPlansTotal: 5,
  });

  const cobertura = computed.find((i) => i.code === 'IND_COBERTURA');
  assert.equal(cobertura?.status, 'sem_dados');
  assert.equal(cobertura?.displayValue, 'Sem dados');

  const clareza = computed.find((i) => i.code === 'IND_CLAREZA_PAPEL');
  assert.equal(clareza?.status, 'suprimido_privacidade');

  const apoio = computed.find((i) => i.code === 'IND_APOIO_VINCULOS');
  assert.equal(apoio?.status, 'disponivel');
  assert.equal(apoio?.value, 4.5);
});
