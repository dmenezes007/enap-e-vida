import {z} from 'zod';
import type {GaegModality, GaegParameter, PreboardingStatus} from './types';

export const RACA_COR_OPTIONS = [
  'Amarela',
  'Branca',
  'Indígena',
  'Parda',
  'Preta',
  'Prefiro não declarar',
] as const;

export const ESCOLARIDADE_OPTIONS = [
  'Ensino Médio Completo',
  'Ensino Superior Incompleto',
  'Ensino Superior Completo',
  'Pós-graduação / Especialização',
  'Mestrado',
  'Doutorado',
] as const;

export const PGD_MODALIDADES = [
  'PGD — Teletrabalho parcial',
  'PGD — Teletrabalho integral',
  'PGD — Presencial',
  'PGD — Teletrabalho no exterior',
] as const;

export const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const EMPLOYMENT_TYPES = [
  {code: 'servidora_efetiva', label: 'Pessoa servidora efetiva'},
  {code: 'servidora_cedida', label: 'Pessoa servidora cedida ou em movimentação'},
  {code: 'cargo_comissionado', label: 'Pessoa ocupante de cargo ou função comissionada'},
  {code: 'colaboradora_terceirizada', label: 'Pessoa colaboradora terceirizada'},
  {code: 'estagiaria', label: 'Pessoa estagiária'},
  {code: 'outro_vinculo', label: 'Outros vínculos autorizados'},
] as const;

export const PREBOARDING_STATUS_LABELS: Record<PreboardingStatus, string> = {
  convite_encaminhado: 'Convite encaminhado',
  preenchimento_iniciado: 'Preenchimento iniciado',
  formulario_recebido: 'Formulário recebido',
  em_analise: 'Em análise',
  complementacao_solicitada: 'Complementação solicitada',
  complementacao_recebida: 'Complementação recebida',
  consulta_orgao_origem: 'Consulta ao órgão de origem ou exercício',
  preparacao_ingresso: 'Preparação para ingresso',
  ingresso_confirmado: 'Ingresso confirmado',
  encerrado_cancelado: 'Encerrado ou cancelado',
};

/**
 * Textos integrais preservados fielmente do documento Formulários.docx.
 * Identificados como referências documentais sujeitas à atualização normativa.
 */
export const DEFAULT_GAEG_PARAMETERS: Record<GaegModality, Omit<GaegParameter, 'id'>> = {
  GAEG_NS: {
    modality: 'GAEG_NS',
    label: 'GAEG — Nível Superior',
    gaegValue: 4544.26,
    maxTotalRemuneration: 21454.12,
    declarationText:
      'ESTOU CIENTE DE QUE O VALOR DA GAEG NS É R$ 4.544,26 E O MÁXIMO DA SOMA DA GAEG COM A REMUNERAÇÃO DO SERVIDOR É DE R$ 21.454,12 PARA NÍVEL SUPERIOR (excluídas as vantagens pessoais e a retribuição pelo exercício de cargo ou função comissionada), CONFORME DISPOSTO NO ANEXO CCVIII DA MEDIDA PROVISÓRIA Nº 1.170, DE 28 DE ABRIL DE 2023 E ANEXO CLXIII DA LEI Nº 11.907, DE 2009. O VALOR QUE ULTRAPASSAR O LIMITE SERÁ DEDUZIDO EM FOLHA, MEDIANTE RUBRICA DE “ABATE TETO”.',
    legalBasis:
      'Anexo CCVIII da Medida Provisória nº 1.170, de 28 de abril de 2023 e Anexo CLXIII da Lei nº 11.907, de 2009',
    validFrom: '2023-05-01',
    validUntil: null,
    version: '1.0-doc-ref',
    validatedBy: 'Referência documental — pendente de validação de vigência pela CGP/Enap',
    isReferencePrototypeValue: true,
  },
  GAEG_NI: {
    modality: 'GAEG_NI',
    label: 'GAEG — Nível Intermediário',
    gaegValue: 2908.64,
    maxTotalRemuneration: 13974.75,
    declarationText:
      'ESTOU CIENTE DE QUE O VALOR DA GAEG NI É R$ 2.908,64 E O MÁXIMO DA SOMA DA GAEG COM A REMUNERAÇÃO DO SERVIDOR É DE R$ 13.974,75 PARA NÍVEL INTERMEDIÁRIO (excluídas as vantagens pessoais e a retribuição pelo exercício de cargo ou função comissionada), CONFORME DISPOSTO NO ANEXO CCVIII DA MEDIDA PROVISÓRIA Nº 1.170, DE 28 DE ABRIL DE 2023 E ANEXO CLXIII DA LEI Nº 11.907, DE 2009. O VALOR QUE ULTRAPASSAR O LIMITE SERÁ DEDUZIDO EM FOLHA, MEDIANTE RUBRICA DE “ABATE TETO”.',
    legalBasis:
      'Anexo CCVIII da Medida Provisória nº 1.170, de 28 de abril de 2023 e Anexo CLXIII da Lei nº 11.907, de 2009',
    validFrom: '2023-05-01',
    validUntil: null,
    version: '1.0-doc-ref',
    validatedBy: 'Referência documental — pendente de validação de vigência pela CGP/Enap',
    isReferencePrototypeValue: true,
  },
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Validação formal algorítmica (módulo 11) do CPF.
 * Atenção (§8.3): validação formal não equivale à comprovação de identidade.
 */
export function isValidCpf(input: string): boolean {
  const digits = digitsOnly(input);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === Number(digits[10]);
}

export function formatCpf(input: string): string {
  const d = digitsOnly(input).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function maskCpf(input: string): string {
  const d = digitsOnly(input);
  if (d.length !== 11) return '***.***.***-**';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function maskBankAccount(account: string): string {
  const clean = account.trim();
  if (clean.length <= 2) return '****';
  return `${'*'.repeat(Math.max(4, clean.length - 2))}${clean.slice(-2)}`;
}

export function formatPhoneBr(input: string): string {
  const d = digitsOnly(input).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return 'Não informado';
  // Se for YYYY-MM-DD simples, formata sem deslocamento de fuso
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return 'Não informado';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export const preboardingSubmissionSchema = z
  .object({
    nome: z.string().trim().min(3, 'Informe o nome completo.'),
    cpf: z
      .string()
      .trim()
      .refine((v) => isValidCpf(v), 'Informe um CPF formalmente válido (11 dígitos).'),
    naturalidadeUf: z.string().trim().min(2, 'Informe a naturalidade e UF.'),
    racaCor: z.string().trim().min(2, 'Selecione a opção de autodeclaração de raça/cor.'),
    dataNascimento: z.string().trim().min(8, 'Informe a data de nascimento.'),
    rg: z.string().trim().min(3, 'Informe o número do RG.'),
    orgaoExpedidor: z.string().trim().min(2, 'Informe o órgão expedidor do RG.'),
    filiacao: z.string().trim().min(3, 'Informe a filiação.'),
    tituloEleitor: z.string().trim().min(5, 'Informe o título de eleitor.'),
    escolaridade: z.string().trim().min(2, 'Selecione a escolaridade.'),
    formacao: z.string().trim().min(2, 'Informe a formação.'),
    residenciasUltimos10Anos: z
      .array(
        z.object({
          cidade: z.string().trim().min(2, 'Informe a cidade.'),
          uf: z.string().trim().length(2, 'Informe a UF (2 letras).'),
          periodo: z.string().trim().min(2, 'Informe o período aproximado.'),
        }),
      )
      .min(1, 'Adicione ao menos um registro de cidade/UF de residência nos últimos 10 anos.'),
    enderecoAtual: z.string().trim().min(5, 'Informe o endereço atual.'),
    telefoneParticular: z
      .string()
      .trim()
      .refine((v) => digitsOnly(v).length >= 10, 'Informe um telefone particular válido com DDD.'),
    orgaoOrigem: z.string().trim().min(2, 'Informe o órgão de origem.'),
    cargoEfetivo: z.string().trim().min(2, 'Informe o cargo efetivo.'),
    matriculaSiape: z
      .string()
      .trim()
      .refine((v) => digitsOnly(v).length >= 5, 'Informe a matrícula SIAPE.'),
    ingressoServicoPublico: z.string().trim().min(8, 'Informe a data de ingresso no serviço público.'),
    estagioProbatorioConcluido: z.enum(['SIM', 'NAO']),
    entradaPorCotas: z.enum(['NAO', 'RACIAL', 'PCD']),
    pessoaComDeficiencia: z.enum(['SIM', 'NAO']),
    estaEmPgd: z.enum(['SIM', 'NAO']),
    modalidadePgd: z.string().trim().optional().default(''),
    propostaCargoFuncaoEnap: z.string().trim().min(2, 'Informe a proposta de cargo ou função na Enap.'),
    orgaoExercicioAtual: z.string().trim().min(2, 'Informe o órgão de exercício atual.'),
    selecaoMedianteEdital: z.string().trim().min(2, 'Informe se a seleção ocorreu mediante publicação de edital.'),
    negociacaoPreviaCedente: z.string().trim().min(2, 'Informe se houve negociação prévia com o órgão cedente.'),
    mudancaDomicilio: z.enum(['SIM', 'NAO']),
    tipoConta: z.enum(['CONTA_SALARIO', 'CONTA_CORRENTE']),
    banco: z.string().trim().min(2, 'Informe o banco.'),
    agenciaComDv: z.string().trim().min(2, 'Informe a agência com dígito verificador.'),
    contaBancaria: z.string().trim().min(3, 'Informe o número da conta bancária.'),
    cienteRemuneracaoMaxima: z.literal(true, {
      message: 'É necessário registrar ciência e concordância com a remuneração máxima.',
    }),
    chefiaNome: z.string().trim().min(3, 'Informe o nome da chefia imediata.'),
    chefiaEmail: z.string().trim().email('Informe um e-mail válido para a chefia imediata.'),
    chefiaCargo: z.string().trim().min(2, 'Informe o cargo da chefia imediata.'),
    chefiaOrgao: z.string().trim().min(2, 'Informe o órgão da chefia imediata.'),
    cienteAvisoPrivacidade: z.literal(true, {
      message: 'Confirme a leitura do aviso de privacidade específico do formulário.',
    }),
  })
  .superRefine((data, ctx) => {
    if (data.estaEmPgd === 'SIM' && (!data.modalidadePgd || data.modalidadePgd.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modalidadePgd'],
        message: 'Informe a modalidade do PGD quando a resposta for SIM.',
      });
    }
  });

export const registerAccountSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Informe seu nome completo.'),
    socialName: z.string().trim().optional().default(''),
    email: z.string().trim().email('Informe um e-mail institucional ou válido.'),
    alternativeEmail: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Informe um e-mail alternativo válido.'),
    employmentType: z.string().trim().min(2, 'Selecione o tipo de vínculo com a Enap.'),
    organizationalUnit: z.string().trim().min(2, 'Informe sua unidade organizacional.'),
    positionTitle: z.string().trim().min(2, 'Informe seu cargo ou função.'),
    entryDate: z.string().trim().min(8, 'Informe a data de ingresso ou início das atividades na Enap.'),
    password: z
      .string()
      .min(8, 'A senha deve ter no mínimo 8 caracteres.')
      .refine((v) => /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v), 'Use letras maiúsculas, minúsculas e números.'),
    confirmPassword: z.string(),
    preboardingProtocol: z.string().trim().optional().default(''),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'A confirmação de senha não confere.',
  });
