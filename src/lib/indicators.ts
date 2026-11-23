export type IndicatorDimension = 'produto' | 'resultado' | 'impacto';

export interface IndicatorMetadata {
  code: string;
  name: string;
  dimension: IndicatorDimension;
  definition: string;
  purpose: string;
  formula: string;
  numeratorLabel: string;
  denominatorLabel: string;
  unit: string;
  dataSource: string;
  periodicity: string;
  owner: string;
  methodologicalLimitations: string;
  missingDataRule: string;
  suppressionRule: string;
}

export interface ComputedIndicator extends IndicatorMetadata {
  value: number | null;
  displayValue: string;
  numerator: number | null;
  denominator: number | null;
  sampleSize: number;
  status: 'disponivel' | 'sem_dados' | 'suprimido_privacidade';
  updatedAt: string;
}

export interface IndicatorRawInputs {
  eligibleNewcomers: number;
  journeyParticipants: number;
  essentialDay1TasksTotal: number;
  essentialDay1TasksOnTime: number;
  roleClarityScores30: number[];
  roleClarityScores60: number[];
  roleClarityScores90: number[];
  supportScores30: number[];
  supportScores90: number[];
  belongingScores: number[];
  supportRequestsTotal: number;
  supportRequestsResolved: number;
  supportResolutionHours: number[];
  pqvtCapacityTotal: number;
  pqvtConfirmedRegistrations: number;
  surveysPublished: number;
  surveyResponsesTotal: number;
  improvementPlansImplemented: number;
  improvementPlansTotal: number;
  minSuppressionThreshold?: number;
}

export function calculatePercentage(
  numerator: number,
  denominator: number,
): number | null {
  if (denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

export function calculateMeanWithSuppression(
  scores: number[],
  minThreshold = 10,
): {
  value: number | null;
  status: 'disponivel' | 'sem_dados' | 'suprimido_privacidade';
  sampleSize: number;
} {
  if (scores.length === 0) {
    return {value: null, status: 'sem_dados', sampleSize: 0};
  }
  if (scores.length < minThreshold) {
    return {value: null, status: 'suprimido_privacidade', sampleSize: scores.length};
  }
  const avg = scores.reduce((acc, n) => acc + n, 0) / scores.length;
  return {
    value: Number(avg.toFixed(2)),
    status: 'disponivel',
    sampleSize: scores.length,
  };
}

/**
 * Aplica supressão de pequenos grupos (k-anonimato com limiar configurável, padrão n < 10)
 * e supressão complementar se exatamente uma categoria ficar abaixo do limiar para evitar
 * reconstrução por subtração do total (§17 e §24).
 */
export function applySmallGroupSuppression<T extends {label: string; count: number}>(
  groups: T[],
  threshold = 10,
): Array<T & {suppressed: boolean; displayCount: string}> {
  const below = groups.filter((g) => g.count > 0 && g.count < threshold);
  let complementaryLabel: string | null = null;
  if (below.length === 1) {
    const eligibleForComplementary = groups
      .filter((g) => g.count >= threshold)
      .sort((a, b) => a.count - b.count);
    if (eligibleForComplementary.length > 0) {
      complementaryLabel = eligibleForComplementary[0].label;
    }
  }

  return groups.map((g) => {
    const isSuppressed =
      (g.count > 0 && g.count < threshold) || g.label === complementaryLabel;
    return {
      ...g,
      suppressed: isSuppressed,
      displayCount: isSuppressed ? `Suprimido (n < ${threshold} ou proteção complementar)` : String(g.count),
    };
  });
}

export function computeStrategicIndicators(inputs: IndicatorRawInputs): ComputedIndicator[] {
  const threshold = inputs.minSuppressionThreshold ?? 10;
  const now = new Date().toISOString();

  const coberturaVal = calculatePercentage(
    inputs.journeyParticipants,
    inputs.eligibleNewcomers,
  );
  const preparacaoVal = calculatePercentage(
    inputs.essentialDay1TasksOnTime,
    inputs.essentialDay1TasksTotal,
  );

  const allClarity = [
    ...inputs.roleClarityScores30,
    ...inputs.roleClarityScores60,
    ...inputs.roleClarityScores90,
  ];
  const clarityRes = calculateMeanWithSuppression(allClarity, threshold);

  const allSupport = [...inputs.supportScores30, ...inputs.supportScores90];
  const supportRes = calculateMeanWithSuppression(allSupport, threshold);

  const belongingRes = calculateMeanWithSuppression(inputs.belongingScores, threshold);

  const resolutionRate = calculatePercentage(
    inputs.supportRequestsResolved,
    inputs.supportRequestsTotal,
  );
  const avgResolutionHours =
    inputs.supportResolutionHours.length > 0
      ? Number(
          (
            inputs.supportResolutionHours.reduce((a, b) => a + b, 0) /
            inputs.supportResolutionHours.length
          ).toFixed(1),
        )
      : null;

  const pqvtOccupancy = calculatePercentage(
    inputs.pqvtConfirmedRegistrations,
    inputs.pqvtCapacityTotal,
  );

  const improvementRate = calculatePercentage(
    inputs.improvementPlansImplemented,
    inputs.improvementPlansTotal,
  );

  return [
    {
      code: 'IND_COBERTURA',
      name: 'Cobertura da Jornada de Ambientação',
      dimension: 'produto',
      definition: 'Proporção de pessoas ingressantes elegíveis efetivamente participantes da Jornada de Ambientação.',
      purpose: 'Monitorar o alcance operacional da jornada frente ao total de ingressos na Enap.',
      formula: '(Participantes da jornada / Ingressantes elegíveis) × 100',
      numeratorLabel: 'Participantes da jornada',
      denominatorLabel: 'Ingressantes elegíveis',
      unit: '%',
      dataSource: 'Módulo Jornada de Ambientação (dados demonstrativos fictícios)',
      periodicity: 'Mensal',
      owner: 'Coordenação de Gestão Estratégica e Modernização / CGP',
      methodologicalLimitations:
        'Mede adesão operacional (produto); não mensura isoladamente qualidade da experiência ou adaptação.',
      missingDataRule: 'Quando não há ingressantes elegíveis no período, exibir "Sem dados" (nunca 0%).',
      suppressionRule: 'Aplicar supressão em recortes por unidade com menos de 10 ingressantes.',
      value: coberturaVal,
      displayValue: coberturaVal === null ? 'Sem dados' : `${coberturaVal}%`,
      numerator: inputs.journeyParticipants,
      denominator: inputs.eligibleNewcomers,
      sampleSize: inputs.eligibleNewcomers,
      status: coberturaVal === null ? 'sem_dados' : 'disponivel',
      updatedAt: now,
    },
    {
      code: 'IND_PREPARACAO',
      name: 'Preparação para o Primeiro Dia',
      dimension: 'produto',
      definition: 'Proporção de itens essenciais aplicáveis disponibilizados dentro do prazo estabelecido para o Dia 1.',
      purpose: 'Avaliar prontidão institucional (acessos, estação de trabalho, acolhimento) na chegada.',
      formula: '(Itens essenciais concluídos no prazo / Total de itens essenciais aplicáveis) × 100',
      numeratorLabel: 'Itens essenciais no prazo',
      denominatorLabel: 'Itens essenciais aplicáveis',
      unit: '%',
      dataSource: 'Checklist institucional de Pré-embarque e Embarque (dados fictícios)',
      periodicity: 'Dia 1 / Contínuo',
      owner: 'CGP, CGTI e Unidades de destino',
      methodologicalLimitations:
        'Depende do registro tempestivo das entregas pelas unidades responsáveis.',
      missingDataRule: 'Sem tarefas essenciais registradas, exibir "Sem dados".',
      suppressionRule: 'Agrupar entregas por diretoria quando n < 10.',
      value: preparacaoVal,
      displayValue: preparacaoVal === null ? 'Sem dados' : `${preparacaoVal}%`,
      numerator: inputs.essentialDay1TasksOnTime,
      denominator: inputs.essentialDay1TasksTotal,
      sampleSize: inputs.essentialDay1TasksTotal,
      status: preparacaoVal === null ? 'sem_dados' : 'disponivel',
      updatedAt: now,
    },
    {
      code: 'IND_CLAREZA_PAPEL',
      name: 'Clareza de Papel Institucional (30/60/90 dias)',
      dimension: 'resultado',
      definition: 'Média da percepção de clareza sobre atribuições, expectativas e contribuição institucional (escala 1 a 5).',
      purpose: 'Acompanhar evolução da adaptação cognitiva segundo literatura (Bauer et al., 2007).',
      formula: 'Média aritmética das respostas válidas na escala contextualizada (1–5)',
      numeratorLabel: 'Soma das pontuações válidas',
      denominatorLabel: 'Total de avaliações respondidas',
      unit: 'pontos (1–5)',
      dataSource: 'Avaliações longitudinais de 30, 60 e 90 dias (dados fictícios)',
      periodicity: '30, 60 e 90 dias',
      owner: 'Gestão Estratégica e Pessoas',
      methodologicalLimitations:
        'Percepção autorrelatada sujeita a viés de resposta; não deve ser usada como avaliação de desempenho individual.',
      missingDataRule: 'Ausência de respostas exibida como "Sem dados", nunca como zero.',
      suppressionRule: `Resultados suprimidos quando amostra < ${threshold} respostas.`,
      value: clarityRes.value,
      displayValue:
        clarityRes.status === 'disponivel' && clarityRes.value !== null
          ? `${clarityRes.value} / 5,0`
          : clarityRes.status === 'suprimido_privacidade'
            ? `Suprimido (n = ${clarityRes.sampleSize} < ${threshold})`
            : 'Sem dados',
      numerator: null,
      denominator: clarityRes.sampleSize,
      sampleSize: clarityRes.sampleSize,
      status: clarityRes.status,
      updatedAt: now,
    },
    {
      code: 'IND_APOIO_VINCULOS',
      name: 'Apoio e Vínculos (Equipe e Chefia)',
      dimension: 'resultado',
      definition: 'Percepção de apoio recebido da equipe e da chefia imediata aos 30 e 90 dias (escala 1 a 5).',
      purpose: 'Monitorar socialização e suporte relacional (Saks, Uggerslev e Fassina, 2007).',
      formula: 'Média das respostas de percepção de apoio aos 30 e 90 dias',
      numeratorLabel: 'Soma das pontuações de apoio',
      denominatorLabel: 'Total de respostas (30 e 90 dias)',
      unit: 'pontos (1–5)',
      dataSource: 'Avaliações de 30 e 90 dias (dados fictícios)',
      periodicity: '30 e 90 dias',
      owner: 'Gestão de Pessoas e Lideranças',
      methodologicalLimitations:
        'Não permite inferência causal isolada sem controle de contexto de equipe.',
      missingDataRule: 'Ausência de coleta exibida como "Sem dados".',
      suppressionRule: `Ocultar agregados de grupos com n < ${threshold}.`,
      value: supportRes.value,
      displayValue:
        supportRes.status === 'disponivel' && supportRes.value !== null
          ? `${supportRes.value} / 5,0`
          : supportRes.status === 'suprimido_privacidade'
            ? `Suprimido (n = ${supportRes.sampleSize} < ${threshold})`
            : 'Sem dados',
      numerator: null,
      denominator: supportRes.sampleSize,
      sampleSize: supportRes.sampleSize,
      status: supportRes.status,
      updatedAt: now,
    },
    {
      code: 'IND_PERTENCIMENTO',
      name: 'Pertencimento Institucional (Longitudinal)',
      dimension: 'impacto',
      definition: 'Acompanhamento longitudinal de identificação e vínculo institucional por instrumento validado (escala 1 a 5).',
      purpose: 'Subsidiar avaliação de efeitos sustentáveis em ciclos longitudinais.',
      formula: 'Média longitudinal em instrumento validado de identificação/vínculo',
      numeratorLabel: 'Soma das pontuações longitudinais',
      denominatorLabel: 'Respondentes no ciclo longitudinal',
      unit: 'pontos (1–5)',
      dataSource: 'Ciclo longitudinal pós-90 dias (dados fictícios)',
      periodicity: 'Longitudinal (semestral/anual)',
      owner: 'Coordenação de Gestão Estratégica e Modernização',
      methodologicalLimitations:
        'Pertencimento é processo contínuo (não resultado automático de 90 dias); pesquisas de satisfação isoladas não comprovam impacto causal.',
      missingDataRule: 'Sem amostra válida, apresentar "Sem dados".',
      suppressionRule: `Exibição condicionada a n ≥ ${threshold} respondentes.`,
      value: belongingRes.value,
      displayValue:
        belongingRes.status === 'disponivel' && belongingRes.value !== null
          ? `${belongingRes.value} / 5,0`
          : belongingRes.status === 'suprimido_privacidade'
            ? `Suprimido (n = ${belongingRes.sampleSize} < ${threshold})`
            : 'Sem dados',
      numerator: null,
      denominator: belongingRes.sampleSize,
      sampleSize: belongingRes.sampleSize,
      status: belongingRes.status,
      updatedAt: now,
    },
    {
      code: 'IND_DIFICULDADES',
      name: 'Taxa e Tempo Médio de Resolução de Dificuldades',
      dimension: 'produto',
      definition: 'Proporção de solicitações de apoio resolvidas e tempo médio de atendimento no canal "Preciso de apoio".',
      purpose: 'Identificar gargalos recorrentes de acessos, infraestrutura e integração.',
      formula: '(Dificuldades resolvidas / Total registradas) × 100 | Tempo médio em horas',
      numeratorLabel: 'Dificuldades resolvidas',
      denominatorLabel: 'Dificuldades registradas',
      unit: '% / horas',
      dataSource: 'Registro de dificuldades da Jornada (dados fictícios)',
      periodicity: 'Contínuo',
      owner: 'Responsável pela Ambientação',
      methodologicalLimitations:
        'Baixo volume de registros pode refletir subnotificação, não ausência de dificuldades.',
      missingDataRule: 'Sem registros no período, indicar "Sem dados".',
      suppressionRule: 'Relatórios agregados por categoria, sem expor solicitantes individuais.',
      value: resolutionRate,
      displayValue:
        resolutionRate === null
          ? 'Sem dados'
          : `${resolutionRate}%${avgResolutionHours !== null ? ` · ${avgResolutionHours}h média` : ''}`,
      numerator: inputs.supportRequestsResolved,
      denominator: inputs.supportRequestsTotal,
      sampleSize: inputs.supportRequestsTotal,
      status: resolutionRate === null ? 'sem_dados' : 'disponivel',
      updatedAt: now,
    },
    {
      code: 'IND_OCUPACAO_PQVT',
      name: 'Taxa de Ocupação das Atividades PQVT',
      dimension: 'produto',
      definition: 'Proporção de vagas efetivamente ocupadas nas atividades físicas, esportivas e de lazer do PQVT.',
      purpose: 'Apoiar o dimensionamento de turmas, horários e modalidades ofertadas.',
      formula: '(Inscrições confirmadas / Total de vagas ofertadas) × 100',
      numeratorLabel: 'Inscrições confirmadas',
      denominatorLabel: 'Vagas ofertadas',
      unit: '%',
      dataSource: 'Módulo PQVT (dados fictícios)',
      periodicity: 'Mensal',
      owner: 'Gestor do PQVT',
      methodologicalLimitations: 'Não mede desfechos clínicos ou biométricos individuais.',
      missingDataRule: 'Sem atividades no período, indicar "Sem dados".',
      suppressionRule: 'Dados sempre agregados por atividade ou categoria.',
      value: pqvtOccupancy,
      displayValue: pqvtOccupancy === null ? 'Sem dados' : `${pqvtOccupancy}%`,
      numerator: inputs.pqvtConfirmedRegistrations,
      denominator: inputs.pqvtCapacityTotal,
      sampleSize: inputs.pqvtCapacityTotal,
      status: pqvtOccupancy === null ? 'sem_dados' : 'disponivel',
      updatedAt: now,
    },
    {
      code: 'IND_MELHORIAS_IMPL',
      name: 'Planos de Melhoria Implementados',
      dimension: 'resultado',
      definition: 'Proporção de planos de ação do Laboratório de Melhoria Contínua concluídos ou incorporados.',
      purpose: 'Acompanhar o fechamento do ciclo entre escuta, evidências e mudanças concretas.',
      formula: '(Planos implementados / Total de planos priorizados) × 100',
      numeratorLabel: 'Planos implementados',
      denominatorLabel: 'Planos cadastrados',
      unit: '%',
      dataSource: 'Laboratório de Melhoria Contínua (dados fictícios)',
      periodicity: 'Trimestral',
      owner: 'Coordenação de Gestão Estratégica e Modernização',
      methodologicalLimitations: 'A conclusão de uma ação exige avaliação posterior de efetividade.',
      missingDataRule: 'Sem planos cadastrados, exibir "Sem dados".',
      suppressionRule: 'Não aplicável (dados institucionais sem identificação pessoal).',
      value: improvementRate,
      displayValue: improvementRate === null ? 'Sem dados' : `${improvementRate}%`,
      numerator: inputs.improvementPlansImplemented,
      denominator: inputs.improvementPlansTotal,
      sampleSize: inputs.improvementPlansTotal,
      status: improvementRate === null ? 'sem_dados' : 'disponivel',
      updatedAt: now,
    },
  ];
}
