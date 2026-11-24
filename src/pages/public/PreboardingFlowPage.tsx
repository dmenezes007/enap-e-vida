import React, {useEffect, useState} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  HelpCircle,
  Lock,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import {formatCpf, isValidCpf, maskBankAccount, maskCpf} from '../../lib/validators';
import type {GaegModality, GaegParameter, PreboardingStatus} from '../../lib/types';
import {DemoBanner, EnapVidaLogo, RgiGeometricStrip} from '../../components/ui/BrandAssets';
import {
  AlertBox,
  Button,
  Card,
  Field,
  inputBaseClass,
  Modal,
  ProgressBar,
  useToast,
} from '../../components/ui/Primitives';

const STATUS_LABELS: Record<PreboardingStatus, string> = {
  convite_encaminhado: 'Convite encaminhado',
  preenchimento_iniciado: 'Preenchimento iniciado',
  formulario_recebido: 'Formulário recebido',
  em_analise: 'Em análise pela área de gestão de pessoas',
  complementacao_solicitada: 'Complementação solicitada',
  complementacao_recebida: 'Complementação recebida',
  consulta_orgao_origem: 'Consulta ao órgão de origem em andamento',
  preparacao_ingresso: 'Preparação para ingresso',
  ingresso_confirmado: 'Ingresso confirmado',
  encerrado_cancelado: 'Encerrado / cancelado',
};

interface ResidenceEntry {
  cidade: string;
  uf: string;
  periodo: string;
}

interface PreboardingFormState {
  nome: string;
  filiacao: string;
  naturalidadeUf: string;
  dataNascimento: string;
  cpf: string;
  rg: string;
  orgaoExpedidor: string;
  tituloEleitor: string;
  escolaridade: string;
  formacao: string;
  residenciasUltimos10Anos: ResidenceEntry[];
  enderecoAtual: string;
  telefoneParticular: string;
  racaCor: string;
  entradaPorCotas: 'NAO' | 'RACIAL' | 'PCD';
  pessoaComDeficiencia: 'SIM' | 'NAO';
  orgaoOrigem: string;
  cargoEfetivo: string;
  matriculaSiape: string;
  ingressoServicoPublico: string;
  estagioProbatorioConcluido: 'SIM' | 'NAO';
  estaEmPgd: 'SIM' | 'NAO';
  modalidadePgd: string;
  propostaCargoFuncaoEnap: string;
  orgaoExercicioAtual: string;
  selecaoMedianteEdital: 'SIM' | 'NAO';
  negociacaoPreviaCedente: 'SIM' | 'NAO';
  mudancaDomicilio: 'SIM' | 'NAO';
  tipoConta: 'CONTA_CORRENTE' | 'CONTA_SALARIO';
  banco: string;
  agenciaComDv: string;
  contaBancaria: string;
  cienteRemuneracaoMaxima: boolean;
  chefiaNome: string;
  chefiaEmail: string;
  chefiaCargo: string;
  chefiaOrgao: string;
  cienteAvisoPrivacidade: boolean;
}

const EMPTY_FORM: PreboardingFormState = {
  nome: '',
  filiacao: '',
  naturalidadeUf: '',
  dataNascimento: '',
  cpf: '',
  rg: '',
  orgaoExpedidor: '',
  tituloEleitor: '',
  escolaridade: 'Pós-graduação / Especialização',
  formacao: '',
  residenciasUltimos10Anos: [{cidade: '', uf: '', periodo: ''}],
  enderecoAtual: '',
  telefoneParticular: '',
  racaCor: 'Prefiro não declarar',
  entradaPorCotas: 'NAO',
  pessoaComDeficiencia: 'NAO',
  orgaoOrigem: '',
  cargoEfetivo: '',
  matriculaSiape: '',
  ingressoServicoPublico: '',
  estagioProbatorioConcluido: 'SIM',
  estaEmPgd: 'NAO',
  modalidadePgd: '',
  propostaCargoFuncaoEnap: '',
  orgaoExercicioAtual: '',
  selecaoMedianteEdital: 'SIM',
  negociacaoPreviaCedente: 'SIM',
  mudancaDomicilio: 'NAO',
  tipoConta: 'CONTA_CORRENTE',
  banco: '',
  agenciaComDv: '',
  contaBancaria: '',
  cienteRemuneracaoMaxima: false,
  chefiaNome: '',
  chefiaEmail: '',
  chefiaCargo: '',
  chefiaOrgao: '',
  cienteAvisoPrivacidade: false,
};

const FORM_STEPS = [
  '1. Identificação e Dados Pessoais',
  '2. Endereços e Contato',
  '3. Autodeclaração e Inclusão',
  '4. Vínculo Funcional e Movimentação',
  '5. Dados Bancários (Segregados)',
  '6. Declaração Remuneratória GAEG',
  '7. Chefia Imediata Atual',
  '8. Revisão Final e Ciência LGPD',
];

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

export const PreboardingFlowPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {pushToast} = useToast();

  const isTrackingRoute = location.pathname.includes('/acompanhamento');

  const [gaegParams, setGaegParams] = useState<Record<GaegModality, GaegParameter | null>>({
    GAEG_NS: null,
    GAEG_NI: null,
  });

  // Fluxo convite
  const [inviteCode, setInviteCode] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [verifiedInvite, setVerifiedInvite] = useState<{
    id: string;
    code: string;
    email: string;
    inviteeName: string;
    modality: GaegModality;
    targetUnit: string;
    proposedPosition: string;
    status: PreboardingStatus;
    protocol?: string | null;
  } | null>(null);
  const [modality, setModality] = useState<GaegModality>('GAEG_NS');
  const [stage, setStage] = useState<'invite' | 'modality' | 'form' | 'confirmation'>('invite');
  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState<PreboardingFormState>(EMPTY_FORM);
  const [stepError, setStepError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [helpModalityOpen, setHelpModalityOpen] = useState(false);

  const [receipt, setReceipt] = useState<{
    protocol: string;
    submittedAt: string;
    modality: GaegModality;
    remunerationParamVersion: string;
    receipt: {
      nome: string;
      cpfMasked: string;
      orgaoOrigem: string;
      propostaCargoFuncaoEnap: string;
      chefiaNome: string;
      bankSegregatedNotice: string;
    };
  } | null>(null);

  // Fluxo acompanhamento
  const [trackProtocol, setTrackProtocol] = useState('');
  const [trackEmail, setTrackEmail] = useState('');
  const [trackResult, setTrackResult] = useState<{
    caseInfo: {
      protocol: string;
      inviteeName: string;
      modality: GaegModality;
      targetUnit: string;
      proposedPosition: string;
      status: PreboardingStatus;
      updatedAt: string;
    };
    history: Array<{id: string; status: PreboardingStatus; note: string; actor_name: string; created_at: string}>;
  } | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{parameters: GaegParameter[]}>('/api/preboarding/gaeg-parameters')
      .then((res) => {
        const map: Record<GaegModality, GaegParameter | null> = {GAEG_NS: null, GAEG_NI: null};
        res.parameters.forEach((p) => {
          map[p.modality] = p;
        });
        setGaegParams(map);
      })
      .catch(() => {});
  }, []);

  const handleVerifyInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setStepError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{invite: any}>('/api/preboarding/verify-invite', {
        method: 'POST',
        body: JSON.stringify({code: inviteCode.trim(), email: inviteEmail.trim()}),
      });
      setVerifiedInvite(res.invite);
      setModality(res.invite.modality);
      if (res.invite.protocol) {
        pushToast('Este convite já teve formulário enviado. Consulte o acompanhamento.', 'info');
        setTrackProtocol(res.invite.protocol);
        setTrackEmail(res.invite.email);
        navigate('/pre-ingresso/acompanhamento');
        return;
      }
      setForm((prev) => ({
        ...prev,
        ...(res.invite.draft || {}),
        nome: res.invite.draft?.nome || res.invite.inviteeName || '',
        propostaCargoFuncaoEnap:
          res.invite.draft?.propostaCargoFuncaoEnap || res.invite.proposedPosition || '',
      }));
      setStage('modality');
      pushToast('Convite institucional verificado com sucesso.', 'success');
    } catch (err: any) {
      setStepError(err?.message || 'Não foi possível verificar o convite.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!verifiedInvite) return;
    setSavingDraft(true);
    try {
      // Não persiste conta bancária em texto simples no rascunho (§8.3)
      const safeDraft = {...form, agenciaComDv: '', contaBancaria: ''};
      const res = await apiFetch<{savedAt: string}>('/api/preboarding/save-draft', {
        method: 'POST',
        body: JSON.stringify({
          code: verifiedInvite.code,
          email: verifiedInvite.email,
          modality,
          draft: safeDraft,
        }),
      });
      setLastSavedAt(res.savedAt);
      pushToast('Rascunho salvo (dados bancários são inseridos apenas no envio final seguro).', 'success');
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao salvar rascunho.', 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  const validateCurrentStep = (): string | null => {
    if (stepIdx === 0) {
      if (form.nome.trim().length < 5) return 'Informe seu nome completo (mínimo 5 caracteres).';
      if (form.filiacao.trim().length < 3) return 'Informe a filiação.';
      if (form.naturalidadeUf.trim().length < 3) return 'Informe a naturalidade e UF (ex.: Goiânia / GO).';
      if (!form.dataNascimento) return 'Informe a data de nascimento.';
      if (!isValidCpf(form.cpf)) return 'CPF inválido. Verifique os 11 dígitos informados.';
      if (form.rg.trim().length < 4 || form.orgaoExpedidor.trim().length < 2)
        return 'Informe RG e órgão expedidor.';
      if (form.tituloEleitor.trim().length < 8) return 'Informe o número do título de eleitor.';
      if (form.formacao.trim().length < 2) return 'Informe sua formação acadêmica/técnica.';
    }
    if (stepIdx === 1) {
      const validRes = form.residenciasUltimos10Anos.filter(
        (r) => r.cidade.trim().length >= 2 && r.uf.trim().length === 2 && r.periodo.trim().length >= 4,
      );
      if (validRes.length === 0)
        return 'Informe ao menos um município, UF (2 letras) e período de residência nos últimos 10 anos.';
      if (form.enderecoAtual.trim().length < 8) return 'Informe seu endereço residencial atual completo.';
      if (form.telefoneParticular.trim().length < 8) return 'Informe seu telefone particular com DDD.';
    }
    if (stepIdx === 3) {
      if (form.orgaoOrigem.trim().length < 2) return 'Informe seu órgão ou entidade de origem.';
      if (form.cargoEfetivo.trim().length < 2) return 'Informe seu cargo efetivo ou emprego público.';
      if (form.matriculaSiape.trim().length < 5) return 'Informe a matrícula SIAPE (mínimo 5 dígitos).';
      if (!form.ingressoServicoPublico) return 'Informe a data de ingresso no serviço público.';
      if (form.estaEmPgd === 'SIM' && form.modalidadePgd.trim().length < 3)
        return 'Como você está em PGD, informe a modalidade atual (ex.: Teletrabalho parcial).';
      if (form.propostaCargoFuncaoEnap.trim().length < 2)
        return 'Informe a proposta de cargo, função ou gratificação na Enap.';
      if (form.orgaoExercicioAtual.trim().length < 2) return 'Informe o órgão de exercício atual.';
    }
    if (stepIdx === 4) {
      if (form.banco.trim().length < 2) return 'Informe o banco para pagamento.';
      if (form.agenciaComDv.trim().length < 2) return 'Informe a agência com dígito verificador.';
      if (form.contaBancaria.trim().length < 3) return 'Informe o número da conta com dígito.';
    }
    if (stepIdx === 5) {
      if (!form.cienteRemuneracaoMaxima)
        return 'É obrigatório declarar ciência das regras remuneratórias da GAEG antes de prosseguir.';
    }
    if (stepIdx === 6) {
      if (form.chefiaNome.trim().length < 3) return 'Informe o nome da chefia imediata atual.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.chefiaEmail.trim()))
        return 'Informe um e-mail válido da chefia imediata atual.';
      if (form.chefiaCargo.trim().length < 2) return 'Informe o cargo da chefia imediata.';
      if (form.chefiaOrgao.trim().length < 2) return 'Informe o órgão/unidade da chefia imediata.';
    }
    if (stepIdx === 7) {
      if (!form.cienteAvisoPrivacidade)
        return 'Confirme a leitura do aviso específico de privacidade e tratamento de dados (LGPD).';
    }
    return null;
  };

  const handleNextStep = () => {
    const err = validateCurrentStep();
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStepIdx((i) => Math.min(FORM_STEPS.length - 1, i + 1));
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleSubmitForm = async () => {
    const err = validateCurrentStep();
    if (err) {
      setStepError(err);
      return;
    }
    if (!verifiedInvite) return;
    setStepError(null);
    setBusy(true);
    try {
      const payload = {
        ...form,
        residenciasUltimos10Anos: form.residenciasUltimos10Anos
          .filter((r) => r.cidade.trim().length > 0 && r.uf.trim().length === 2 && r.periodo.trim().length > 0)
          .map((r) => ({
            cidade: r.cidade.trim(),
            uf: r.uf.trim().toUpperCase(),
            periodo: r.periodo.trim(),
          })),
      };
      const res = await apiFetch<any>('/api/preboarding/submit', {
        method: 'POST',
        body: JSON.stringify({
          code: verifiedInvite.code,
          email: verifiedInvite.email,
          modality,
          formData: payload,
        }),
      });
      setReceipt(res);
      setStage('confirmation');
      pushToast(`Formulário enviado! Protocolo ${res.protocol}`, 'success');
      window.scrollTo({top: 0, behavior: 'smooth'});
    } catch (e: any) {
      setStepError(e?.message || 'Erro ao enviar o formulário. Revise os campos destacados.');
    } finally {
      setBusy(false);
    }
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackError(null);
    setBusy(true);
    try {
      const res = await apiFetch<any>('/api/preboarding/track', {
        method: 'POST',
        body: JSON.stringify({protocol: trackProtocol.trim(), email: trackEmail.trim()}),
      });
      setTrackResult(res);
    } catch (err: any) {
      setTrackResult(null);
      setTrackError(err?.message || 'Protocolo não localizado.');
    } finally {
      setBusy(false);
    }
  };

  const activeGaeg = gaegParams[modality];

  const fillDemoSampleForm = () => {
    setForm({
      ...EMPTY_FORM,
      nome: verifiedInvite?.inviteeName || 'Mariana Siqueira Alencar (Fictício)',
      filiacao: 'Helena Siqueira Alencar e Carlos Eduardo Alencar (Fictício)',
      naturalidadeUf: 'Brasília / DF',
      dataNascimento: '1988-07-14',
      cpf: '529.982.247-25',
      rg: '2845910',
      orgaoExpedidor: 'SSP/DF',
      tituloEleitor: '041298762011',
      escolaridade: modality === 'GAEG_NS' ? 'Mestrado' : 'Ensino Superior Completo',
      formacao: modality === 'GAEG_NS' ? 'Administração Pública' : 'Gestão Pública',
      residenciasUltimos10Anos: [
        {cidade: 'Brasília', uf: 'DF', periodo: '2018 a 2026'},
        {cidade: 'Goiânia', uf: 'GO', periodo: '2016 a 2018'},
      ],
      enderecoAtual: 'SQN 310, Bloco E, Apto 204, Asa Norte, Brasília – DF (Fictício)',
      telefoneParticular: '(61) 99900-4411',
      racaCor: 'Parda',
      entradaPorCotas: 'NAO',
      pessoaComDeficiencia: 'NAO',
      orgaoOrigem: 'Ministério da Gestão e da Inovação em Serviços Públicos (Fictício)',
      cargoEfetivo:
        modality === 'GAEG_NS'
          ? 'Analista Técnico de Políticas Sociais'
          : 'Agente Administrativo',
      matriculaSiape: '1842903',
      ingressoServicoPublico: '2015-03-10',
      estagioProbatorioConcluido: 'SIM',
      estaEmPgd: 'SIM',
      modalidadePgd: 'Teletrabalho parcial (3 dias presenciais / 2 remotos)',
      propostaCargoFuncaoEnap:
        verifiedInvite?.proposedPosition || 'Gratificação de Atividade em Escola de Governo (GAEG)',
      orgaoExercicioAtual: 'MGI — Secretaria de Gestão (Fictício)',
      selecaoMedianteEdital: 'SIM',
      negociacaoPreviaCedente: 'SIM',
      mudancaDomicilio: 'NAO',
      tipoConta: 'CONTA_CORRENTE',
      banco: 'Banco do Brasil (001)',
      agenciaComDv: '1607-1',
      contaBancaria: '44812-9',
      cienteRemuneracaoMaxima: false,
      chefiaNome: 'Roberto Tavares Mendonça (Fictício)',
      chefiaEmail: 'roberto.chefia@orgao-origem-ficticio.gov.br',
      chefiaCargo: 'Coordenador-Geral de Inovação',
      chefiaOrgao: 'MGI (Fictício)',
      cienteAvisoPrivacidade: false,
    });
    pushToast('Dados fictícios preenchidos para avaliação do fluxo.', 'info');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#231F20]">
      <DemoBanner />
      <RgiGeometricStrip className="h-2.5 w-full" />

      <header className="bg-white border-b border-[#E2DDD5]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <EnapVidaLogo className="max-w-28 sm:max-w-44" />
          </Link>
          <div className="flex items-center gap-3">
            {isTrackingRoute ? (
              <Link to="/pre-ingresso" className="text-xs font-semibold text-[#186F80] hover:underline">
                Iniciar com convite
              </Link>
            ) : (
              <Link
                to="/pre-ingresso/acompanhamento"
                className="text-xs font-semibold text-[#186F80] hover:underline"
              >
                Acompanhar protocolo
              </Link>
            )}
            <Link to="/" className="text-xs font-semibold text-[#4A4F52] hover:text-[#173640]">
              Voltar ao acesso
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* ROTA DE ACOMPANHAMENTO */}
        {isTrackingRoute ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[#285D32]">
                A caminho da Enap?
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#173640]">
                Acompanhamento de Pré-Embarque
              </h1>
              <p className="text-sm text-[#4A4F52] max-w-2xl">
                Consulte o andamento do seu processo preliminar com o número de protocolo e o e-mail
                vinculado ao convite. Nenhuma informação bancária ou sensível é exibida nesta consulta.
              </p>
            </div>

            <Card className="p-6">
              <form onSubmit={handleTrackSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <Field id="track-protocol" label="Número de protocolo" required>
                  <input
                    id="track-protocol"
                    type="text"
                    required
                    value={trackProtocol}
                    onChange={(e) => setTrackProtocol(e.target.value)}
                    placeholder="ENAP-PRE-2026-A91F3C"
                    className={inputBaseClass}
                  />
                </Field>
                <Field id="track-email" label="E-mail do convite" required>
                  <input
                    id="track-email"
                    type="email"
                    required
                    value={trackEmail}
                    onChange={(e) => setTrackEmail(e.target.value)}
                    placeholder="seu.email@orgao.gov.br"
                    className={inputBaseClass}
                  />
                </Field>
                <Button type="submit" disabled={busy}>
                  <Search className="w-4 h-4" aria-hidden="true" />
                  <span>{busy ? 'Consultando...' : 'Consultar andamento'}</span>
                </Button>
              </form>

              <div className="mt-4 pt-3 border-t border-[#ECE7DF] flex flex-wrap items-center gap-2 text-xs text-[#5F666A]">
                <span>Exemplo demonstrativo para consulta:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTrackProtocol('ENAP-PRE-2026-A91F3C');
                    setTrackEmail('clara.ficticio@exemplo.gov.br');
                  }}
                  className="font-mono font-semibold text-[#186F80] underline cursor-pointer"
                >
                  ENAP-PRE-2026-A91F3C · clara.ficticio@exemplo.gov.br
                </button>
              </div>
            </Card>

            {trackError && <AlertBox tone="error">{trackError}</AlertBox>}

            {trackResult && (
              <Card className="p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E2DDD5]">
                  <div>
                    <p className="text-xs font-semibold text-[#186F80]">
                      Protocolo {trackResult.caseInfo.protocol}
                    </p>
                    <h2 className="text-xl font-extrabold text-[#173640]">
                      {trackResult.caseInfo.inviteeName}
                    </h2>
                    <p className="text-sm text-[#4A4F52]">
                      {trackResult.caseInfo.modality === 'GAEG_NS'
                        ? 'GAEG Nível Superior'
                        : 'GAEG Nível Intermediário'}{' '}
                      · {trackResult.caseInfo.targetUnit} · {trackResult.caseInfo.proposedPosition}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#5F666A]">Situação atual</p>
                    <p className="text-sm font-extrabold text-[#285D32]">
                      {STATUS_LABELS[trackResult.caseInfo.status]}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#173640]">Linha do tempo do processo</h3>
                  <ol className="space-y-3">
                    {trackResult.history.map((h) => (
                      <li
                        key={h.id}
                        className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#173640]">
                            {STATUS_LABELS[h.status] || h.status}
                          </p>
                          <p className="text-xs text-[#4A4F52] mt-0.5">{h.note}</p>
                        </div>
                        <div className="text-xs text-[#5F666A] sm:text-right shrink-0 tabular-nums">
                          <p>{new Date(h.created_at).toLocaleString('pt-BR')}</p>
                          <p>{h.actor_name}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </Card>
            )}
          </div>
        ) : (
          /* FLUXO DE CONVITE E FORMULÁRIO GAEG NS/NI */
          <div className="space-y-6">
            {stage === 'invite' && (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#FF8500]">
                    A caminho da Enap?
                  </p>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#173640]">
                    Boas-vindas ao Pré-Embarque na Enap
                  </h1>
                  <p className="text-sm sm:text-base text-[#4A4F52] max-w-3xl leading-relaxed">
                    Que alegria acompanhar sua chegada! Para proteger seus dados pessoais e bancários, o
                    preenchimento do formulário preliminar de movimentação (GAEG Nível Superior ou Nível
                    Intermediário) é aberto exclusivamente mediante <strong>convite institucional</strong>{' '}
                    emitido pela área de gestão de pessoas da Enap.
                  </p>
                </div>

                <AlertBox tone="info" title="Segurança e privacidade desde o primeiro passo">
                  Suas informações bancárias e autodeclarações serão armazenadas em compartimento segregado e
                  cifrado, acessado apenas pela equipe autorizada de Pré-Embarque. Nenhum dado bancário
                  aparecerá em comprovantes ou notificações.
                </AlertBox>

                <Card className="p-6 sm:p-7 space-y-5">
                  <h2 className="text-lg font-extrabold text-[#173640]">
                    Validar convite institucional
                  </h2>
                  {stepError && <AlertBox tone="error">{stepError}</AlertBox>}

                  <form onSubmit={handleVerifyInvite} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field
                      id="invite-code"
                      label="Código do convite"
                      required
                      hint="Exemplo: ENAP-2026-NS01"
                    >
                      <input
                        id="invite-code"
                        type="text"
                        required
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="ENAP-2026-NS01"
                        className={inputBaseClass}
                      />
                    </Field>
                    <Field id="invite-email" label="E-mail vinculado ao convite" required>
                      <input
                        id="invite-email"
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="nome@orgao.gov.br"
                        className={inputBaseClass}
                      />
                    </Field>
                    <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
                      <Button type="submit" size="lg" disabled={busy}>
                        <span>{busy ? 'Verificando convite...' : 'Continuar para modalidade'}</span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      <Link
                        to="/pre-ingresso/acompanhamento"
                        className="text-sm font-semibold text-[#186F80] hover:underline"
                      >
                        Já enviei meu formulário e quero acompanhar
                      </Link>
                    </div>
                  </form>

                  {/* Atalhos demonstrativos */}
                  <div className="pt-4 border-t border-[#ECE7DF] space-y-2">
                    <p className="text-xs font-semibold text-[#5F666A]">
                      Convites fictícios disponíveis para testar este protótipo:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setInviteCode('ENAP-2026-NS01');
                          setInviteEmail('pre.ns@demo.enap.gov.br');
                        }}
                        className="text-xs font-semibold text-[#173640] bg-[#FFF2DE] hover:bg-[#f6e3c2] border border-[#FF8500]/30 rounded-lg px-3 py-1.5 cursor-pointer"
                      >
                        Preencher GAEG Nível Superior (ENAP-2026-NS01)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInviteCode('ENAP-2026-NI02');
                          setInviteEmail('pre.ni@demo.enap.gov.br');
                        }}
                        className="text-xs font-semibold text-[#173640] bg-[#E7F4F7] hover:bg-[#d4ebf0] border border-[#218FA3]/30 rounded-lg px-3 py-1.5 cursor-pointer"
                      >
                        Preencher GAEG Nível Intermediário (ENAP-2026-NI02)
                      </button>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {stage === 'modality' && verifiedInvite && (
              <Card className="p-6 sm:p-7 space-y-6">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-[#285D32]">
                    Convite validado · {verifiedInvite.inviteeName} · {verifiedInvite.targetUnit}
                  </p>
                  <h1 className="text-2xl font-extrabold text-[#173640]">
                    Confirme sua modalidade de ingresso (GAEG)
                  </h1>
                  <p className="text-sm text-[#4A4F52]">
                    Seu convite foi pré-configurado para{' '}
                    <strong>
                      {verifiedInvite.modality === 'GAEG_NS'
                        ? 'GAEG Nível Superior'
                        : 'GAEG Nível Intermediário'}
                    </strong>
                    . Revise as referências abaixo antes de abrir o formulário.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(['GAEG_NS', 'GAEG_NI'] as GaegModality[]).map((mod) => {
                    const p = gaegParams[mod];
                    const selected = modality === mod;
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => setModality(mod)}
                        className={`text-left rounded-xl border-2 p-5 transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#173640] bg-[#FFF2DE]/60'
                            : 'border-[#E2DDD5] bg-white hover:bg-[#FAF8F4]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-base font-extrabold text-[#173640]">
                            {mod === 'GAEG_NS' ? 'GAEG Nível Superior' : 'GAEG Nível Intermediário'}
                          </span>
                          {selected && <CheckCircle2 className="w-5 h-5 text-[#285D32]" aria-hidden="true" />}
                        </div>
                        {p && (
                          <div className="mt-3 space-y-1 text-xs text-[#4A4F52] tabular-nums">
                            <p>
                              Valor de referência da GAEG: <strong>{formatBRL(p.gaegValue)}</strong>
                            </p>
                            <p>
                              Limite máximo de remuneração total:{' '}
                              <strong>{formatBRL(p.maxTotalRemuneration)}</strong>
                            </p>
                            <p className="text-[11px] text-[#5F666A] pt-1">
                              Base legal: {p.legalBasis} · Versão {p.version}
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <AlertBox tone="warning" title="Valores de referência sujeitos à validação vigente">
                  Os valores e tetos remuneratórios exibidos são parametrizáveis no painel administrativo e
                  reproduzem a referência documental anexa (MP nº 1.170/2023 e Lei nº 11.907/2009), devendo ser
                  confirmados pela área de gestão de pessoas conforme a tabela vigente na data de ingresso.
                </AlertBox>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setHelpModalityOpen(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#186F80] hover:underline cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4" aria-hidden="true" />
                    <span>Não sei minha modalidade</span>
                  </button>
                  <Button
                    size="lg"
                    onClick={() => {
                      setStage('form');
                      setStepIdx(0);
                    }}
                  >
                    <span>Abrir formulário preliminar</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </Card>
            )}

            {stage === 'form' && verifiedInvite && (
              <div className="space-y-5">
                <Card className="p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#186F80]">
                        {modality === 'GAEG_NS' ? 'GAEG Nível Superior' : 'GAEG Nível Intermediário'} ·
                        Convite {verifiedInvite.code}
                      </p>
                      <h1 className="text-xl font-extrabold text-[#173640]">
                        {FORM_STEPS[stepIdx]}
                      </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={fillDemoSampleForm}>
                        Preencher exemplo fictício
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingDraft}
                        onClick={handleSaveDraft}
                      >
                        <Save className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{savingDraft ? 'Salvando...' : 'Salvar rascunho'}</span>
                      </Button>
                    </div>
                  </div>
                  <ProgressBar
                    value={((stepIdx + 1) / FORM_STEPS.length) * 100}
                    label={`Etapa ${stepIdx + 1} de ${FORM_STEPS.length}`}
                    sublabel={
                      lastSavedAt
                        ? `Rascunho salvo às ${new Date(lastSavedAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}`
                        : `${Math.round(((stepIdx + 1) / FORM_STEPS.length) * 100)}%`
                    }
                  />
                </Card>

                {stepError && <AlertBox tone="error">{stepError}</AlertBox>}

                <Card className="p-6 space-y-5">
                  {/* ETAPA 1: Identificação */}
                  {stepIdx === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Field id="f-nome" label="Nome completo" required>
                          <input
                            id="f-nome"
                            value={form.nome}
                            onChange={(e) => setForm({...form, nome: e.target.value})}
                            className={inputBaseClass}
                          />
                        </Field>
                      </div>
                      <div className="md:col-span-2">
                        <Field id="f-filiacao" label="Filiação" required>
                          <input
                            id="f-filiacao"
                            value={form.filiacao}
                            onChange={(e) => setForm({...form, filiacao: e.target.value})}
                            placeholder="Nome dos pais ou responsáveis legais"
                            className={inputBaseClass}
                          />
                        </Field>
                      </div>
                      <Field id="f-nat" label="Naturalidade / UF" required>
                        <input
                          id="f-nat"
                          value={form.naturalidadeUf}
                          onChange={(e) => setForm({...form, naturalidadeUf: e.target.value})}
                          placeholder="Ex.: Brasília / DF"
                          className={inputBaseClass}
                        />
                      </Field>
                      <Field id="f-nasc" label="Data de nascimento" required>
                        <input
                          id="f-nasc"
                          type="date"
                          value={form.dataNascimento}
                          onChange={(e) => setForm({...form, dataNascimento: e.target.value})}
                          className={inputBaseClass}
                        />
                      </Field>
                      <Field
                        id="f-cpf"
                        label="CPF"
                        required
                        hint="Validado automaticamente pelos dígitos verificadores (módulo 11)."
                      >
                        <input
                          id="f-cpf"
                          value={form.cpf}
                          onChange={(e) => setForm({...form, cpf: formatCpf(e.target.value)})}
                          placeholder="000.000.000-00"
                          className={inputBaseClass}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field id="f-rg" label="RG" required>
                          <input
                            id="f-rg"
                            value={form.rg}
                            onChange={(e) => setForm({...form, rg: e.target.value})}
                            className={inputBaseClass}
                          />
                        </Field>
                        <Field id="f-orgexp" label="Órgão expedidor" required>
                          <input
                            id="f-orgexp"
                            value={form.orgaoExpedidor}
                            onChange={(e) => setForm({...form, orgaoExpedidor: e.target.value})}
                            placeholder="SSP/DF"
                            className={inputBaseClass}
                          />
                        </Field>
                      </div>
                      <Field id="f-titulo" label="Título de eleitor" required>
                        <input
                          id="f-titulo"
                          value={form.tituloEleitor}
                          onChange={(e) => setForm({...form, tituloEleitor: e.target.value})}
                          className={inputBaseClass}
                        />
                      </Field>
                      <Field id="f-esc" label="Escolaridade" required>
                        <select
                          id="f-esc"
                          value={form.escolaridade}
                          onChange={(e) => setForm({...form, escolaridade: e.target.value})}
                          className={inputBaseClass}
                        >
                          <option>Ensino Médio Completo</option>
                          <option>Ensino Superior Incompleto</option>
                          <option>Ensino Superior Completo</option>
                          <option>Pós-graduação / Especialização</option>
                          <option>Mestrado</option>
                          <option>Doutorado</option>
                        </select>
                      </Field>
                      <div className="md:col-span-2">
                        <Field id="f-formacao" label="Formação" required>
                          <input
                            id="f-formacao"
                            value={form.formacao}
                            onChange={(e) => setForm({...form, formacao: e.target.value})}
                            placeholder="Área ou curso principal"
                            className={inputBaseClass}
                          />
                        </Field>
                      </div>
                    </div>
                  )}

                  {/* ETAPA 2: Endereços e contato */}
                  {stepIdx === 1 && (
                    <div className="space-y-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h2 className="text-sm font-bold text-[#173640]">
                              Cidades/UF onde residiu nos últimos 10 anos *
                            </h2>
                            <p className="text-xs text-[#5F666A]">
                              Adicione quantos registros forem necessários para cobrir o período.
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setForm({
                                ...form,
                                residenciasUltimos10Anos: [
                                  ...form.residenciasUltimos10Anos,
                                  {cidade: '', uf: '', periodo: ''},
                                ],
                              })
                            }
                          >
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Adicionar cidade</span>
                          </Button>
                        </div>

                        {form.residenciasUltimos10Anos.map((res, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-3 rounded-lg bg-[#FAF8F4] border border-[#E2DDD5]"
                          >
                            <div className="sm:col-span-5">
                              <Field id={`res-cid-${idx}`} label="Município" required>
                                <input
                                  id={`res-cid-${idx}`}
                                  value={res.cidade}
                                  onChange={(e) => {
                                    const copy = [...form.residenciasUltimos10Anos];
                                    copy[idx] = {...copy[idx], cidade: e.target.value};
                                    setForm({...form, residenciasUltimos10Anos: copy});
                                  }}
                                  placeholder="Ex.: Brasília"
                                  className={inputBaseClass}
                                />
                              </Field>
                            </div>
                            <div className="sm:col-span-2">
                              <Field id={`res-uf-${idx}`} label="UF" required>
                                <input
                                  id={`res-uf-${idx}`}
                                  maxLength={2}
                                  value={res.uf}
                                  onChange={(e) => {
                                    const copy = [...form.residenciasUltimos10Anos];
                                    copy[idx] = {...copy[idx], uf: e.target.value.toUpperCase()};
                                    setForm({...form, residenciasUltimos10Anos: copy});
                                  }}
                                  placeholder="DF"
                                  className={inputBaseClass}
                                />
                              </Field>
                            </div>
                            <div className="sm:col-span-4">
                              <Field id={`res-per-${idx}`} label="Período" required>
                                <input
                                  id={`res-per-${idx}`}
                                  value={res.periodo}
                                  onChange={(e) => {
                                    const copy = [...form.residenciasUltimos10Anos];
                                    copy[idx] = {...copy[idx], periodo: e.target.value};
                                    setForm({...form, residenciasUltimos10Anos: copy});
                                  }}
                                  placeholder="Ex.: 2018 a 2026"
                                  className={inputBaseClass}
                                />
                              </Field>
                            </div>
                            <div className="sm:col-span-1 flex justify-end">
                              {form.residenciasUltimos10Anos.length > 1 && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  aria-label="Remover residência"
                                  onClick={() =>
                                    setForm({
                                      ...form,
                                      residenciasUltimos10Anos: form.residenciasUltimos10Anos.filter(
                                        (_, i) => i !== idx,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 className="w-4 h-4 text-[#8E1113]" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <Field id="f-end" label="Endereço atual completo" required>
                        <input
                          id="f-end"
                          value={form.enderecoAtual}
                          onChange={(e) => setForm({...form, enderecoAtual: e.target.value})}
                          placeholder="Logradouro, número, complemento, bairro, cidade/UF e CEP"
                          className={inputBaseClass}
                        />
                      </Field>

                      <Field id="f-tel" label="Telefone particular" required>
                        <input
                          id="f-tel"
                          value={form.telefoneParticular}
                          onChange={(e) => setForm({...form, telefoneParticular: e.target.value})}
                          placeholder="(61) 99999-0000"
                          className={inputBaseClass}
                        />
                      </Field>
                    </div>
                  )}

                  {/* ETAPA 3: Autodeclaração e inclusão */}
                  {stepIdx === 2 && (
                    <div className="space-y-4">
                      <AlertBox tone="info" title="Finalidade e proteção de dados sensíveis">
                        Os dados de autodeclaração e inclusão abaixo são tratados em compartimento
                        segregado para cumprimento de registros funcionais oficiais e ações de acessibilidade
                        no acolhimento. Nunca são exibidos publicamente nem compartilhados fora da equipe
                        autorizada.
                      </AlertBox>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field id="f-raca" label="Raça / Cor (autodeclaração)" required>
                          <select
                            id="f-raca"
                            value={form.racaCor}
                            onChange={(e) => setForm({...form, racaCor: e.target.value})}
                            className={inputBaseClass}
                          >
                            <option>Amarela</option>
                            <option>Branca</option>
                            <option>Indígena</option>
                            <option>Parda</option>
                            <option>Preta</option>
                            <option>Prefiro não declarar</option>
                          </select>
                        </Field>
                        <Field id="f-cotas" label="Entrada por cotas no serviço público?" required>
                          <select
                            id="f-cotas"
                            value={form.entradaPorCotas}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                entradaPorCotas: e.target.value as PreboardingFormState['entradaPorCotas'],
                              })
                            }
                            className={inputBaseClass}
                          >
                            <option value="NAO">Não</option>
                            <option value="RACIAL">Sim — Cota racial</option>
                            <option value="PCD">Sim — Cota PcD</option>
                          </select>
                        </Field>
                        <Field id="f-pcd" label="Pessoa com deficiência (PcD)?" required>
                          <select
                            id="f-pcd"
                            value={form.pessoaComDeficiencia}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                pessoaComDeficiencia: e.target
                                  .value as PreboardingFormState['pessoaComDeficiencia'],
                              })
                            }
                            className={inputBaseClass}
                          >
                            <option value="NAO">Não</option>
                            <option value="SIM">Sim</option>
                          </select>
                        </Field>
                      </div>
                    </div>
                  )}

                  {/* ETAPA 4: Vínculo funcional */}
                  {stepIdx === 3 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field id="f-orig" label="Órgão de origem" required>
                        <input
                          id="f-orig"
                          value={form.orgaoOrigem}
                          onChange={(e) => setForm({...form, orgaoOrigem: e.target.value})}
                          className={inputBaseClass}
                        />
                      </Field>
                      <Field id="f-cargo" label="Cargo efetivo" required>
                        <input
                          id="f-cargo"
                          value={form.cargoEfetivo}
                          onChange={(e) => setForm({...form, cargoEfetivo: e.target.value})}
                          className={inputBaseClass}
                        />
                      </Field>
                      <Field id="f-siape" label="Matrícula SIAPE" required>
                        <input
                          id="f-siape"
                          value={form.matriculaSiape}
                          onChange={(e) => setForm({...form, matriculaSiape: e.target.value})}
                          className={inputBaseClass}
                        />
                      </Field>
                      <Field id="f-ing" label="Ingresso no serviço público" required>
                        <input
                          id="f-ing"
                          type="date"
                          value={form.ingressoServicoPublico}
                          onChange={(e) => setForm({...form, ingressoServicoPublico: e.target.value})}
                          className={inputBaseClass}
                        />
                      </Field>
                      <Field id="f-estagio" label="Estágio probatório concluído?" required>
                        <select
                          id="f-estagio"
                          value={form.estagioProbatorioConcluido}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              estagioProbatorioConcluido: e.target.value as 'SIM' | 'NAO',
                            })
                          }
                          className={inputBaseClass}
                        >
                          <option value="SIM">Sim</option>
                          <option value="NAO">Não</option>
                        </select>
                      </Field>
                      <Field id="f-pgd" label="Está em Programa de Gestão e Desempenho (PGD)?" required>
                        <select
                          id="f-pgd"
                          value={form.estaEmPgd}
                          onChange={(e) =>
                            setForm({...form, estaEmPgd: e.target.value as 'SIM' | 'NAO'})
                          }
                          className={inputBaseClass}
                        >
                          <option value="SIM">Sim</option>
                          <option value="NAO">Não</option>
                        </select>
                      </Field>

                      {form.estaEmPgd === 'SIM' && (
                        <div className="md:col-span-2">
                          <Field id="f-modpgd" label="Qual modalidade de PGD?" required>
                            <input
                              id="f-modpgd"
                              value={form.modalidadePgd}
                              onChange={(e) => setForm({...form, modalidadePgd: e.target.value})}
                              placeholder="Ex.: Teletrabalho parcial, teletrabalho integral ou presencial"
                              className={inputBaseClass}
                            />
                          </Field>
                        </div>
                      )}

                      <Field id="f-prop" label="Proposta de cargo, função ou gratificação na Enap" required>
                        <input
                          id="f-prop"
                          value={form.propostaCargoFuncaoEnap}
                          onChange={(e) => setForm({...form, propostaCargoFuncaoEnap: e.target.value})}
                          className={inputBaseClass}
                        />
                      </Field>
                      <Field id="f-exer" label="Órgão de exercício atual" required>
                        <input
                          id="f-exer"
                          value={form.orgaoExercicioAtual}
                          onChange={(e) => setForm({...form, orgaoExercicioAtual: e.target.value})}
                          className={inputBaseClass}
                        />
                      </Field>
                      <Field id="f-edital" label="Seleção mediante edital?" required>
                        <select
                          id="f-edital"
                          value={form.selecaoMedianteEdital}
                          onChange={(e) =>
                            setForm({...form, selecaoMedianteEdital: e.target.value as 'SIM' | 'NAO'})
                          }
                          className={inputBaseClass}
                        >
                          <option value="SIM">Sim</option>
                          <option value="NAO">Não</option>
                        </select>
                      </Field>
                      <Field id="f-neg" label="Houve negociação prévia com o órgão cedente?" required>
                        <select
                          id="f-neg"
                          value={form.negociacaoPreviaCedente}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              negociacaoPreviaCedente: e.target.value as 'SIM' | 'NAO',
                            })
                          }
                          className={inputBaseClass}
                        >
                          <option value="SIM">Sim</option>
                          <option value="NAO">Não</option>
                        </select>
                      </Field>
                      <Field id="f-mud" label="Haverá mudança de domicílio?" required>
                        <select
                          id="f-mud"
                          value={form.mudancaDomicilio}
                          onChange={(e) =>
                            setForm({...form, mudancaDomicilio: e.target.value as 'SIM' | 'NAO'})
                          }
                          className={inputBaseClass}
                        >
                          <option value="SIM">Sim</option>
                          <option value="NAO">Não</option>
                        </select>
                      </Field>
                    </div>
                  )}

                  {/* ETAPA 5: Dados bancários segregados */}
                  {stepIdx === 4 && (
                    <div className="space-y-4">
                      <AlertBox tone="warning" title="Compartimento bancário segregado e cifrado">
                        Para sua proteção, os dados bancários são criptografados no servidor (AES-256-GCM)
                        em tabela separada e <strong>nunca</strong> são exibidos em comprovantes,
                        notificações ou painéis gerais. Até administradores técnicos não possuem acesso a
                        este cofre.
                      </AlertBox>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field id="f-tipoconta" label="Tipo de conta" required>
                          <select
                            id="f-tipoconta"
                            value={form.tipoConta}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                tipoConta: e.target.value as 'CONTA_CORRENTE' | 'CONTA_SALARIO',
                              })
                            }
                            className={inputBaseClass}
                          >
                            <option value="CONTA_CORRENTE">Conta-corrente</option>
                            <option value="CONTA_SALARIO">Conta-salário</option>
                          </select>
                        </Field>
                        <Field id="f-banco" label="Banco" required>
                          <input
                            id="f-banco"
                            value={form.banco}
                            onChange={(e) => setForm({...form, banco: e.target.value})}
                            placeholder="Ex.: Banco do Brasil (001)"
                            className={inputBaseClass}
                          />
                        </Field>
                        <Field id="f-ag" label="Agência com dígito verificador (DV)" required>
                          <input
                            id="f-ag"
                            value={form.agenciaComDv}
                            onChange={(e) => setForm({...form, agenciaComDv: e.target.value})}
                            placeholder="Ex.: 1607-1"
                            className={inputBaseClass}
                          />
                        </Field>
                        <Field id="f-cc" label="Número da conta bancária (com DV)" required>
                          <input
                            id="f-cc"
                            value={form.contaBancaria}
                            onChange={(e) => setForm({...form, contaBancaria: e.target.value})}
                            placeholder="Ex.: 44812-9"
                            className={inputBaseClass}
                          />
                        </Field>
                      </div>
                    </div>
                  )}

                  {/* ETAPA 6: Declaração remuneratória GAEG */}
                  {stepIdx === 5 && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-[#173640]/25 bg-[#FFF2DE]/70 p-5 space-y-3">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-[#173640]">
                          Declaração Remuneratória —{' '}
                          {modality === 'GAEG_NS' ? 'GAEG Nível Superior' : 'GAEG Nível Intermediário'}
                        </p>
                        {activeGaeg ? (
                          <>
                            <p className="text-sm text-[#231F20] leading-relaxed font-medium">
                              {activeGaeg.declarationText}
                            </p>
                            <div className="pt-2 border-t border-[#173640]/15 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[#4A4F52] tabular-nums">
                              <div>
                                <span className="block text-[#5F666A]">Valor GAEG (ref.)</span>
                                <strong className="text-[#173640]">{formatBRL(activeGaeg.gaegValue)}</strong>
                              </div>
                              <div>
                                <span className="block text-[#5F666A]">Teto total (ref.)</span>
                                <strong className="text-[#173640]">
                                  {formatBRL(activeGaeg.maxTotalRemuneration)}
                                </strong>
                              </div>
                              <div>
                                <span className="block text-[#5F666A]">Versão / Base</span>
                                <strong className="text-[#173640]">{activeGaeg.version}</strong>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-[#4A4F52]">Carregando texto oficial parametrizado...</p>
                        )}
                      </div>

                      <AlertBox tone="info" title="Atenção quanto à vigência">
                        Os valores acima correspondem aos parâmetros de referência vigentes no documento
                        institucional anexo e podem ser atualizados pela gestão de pessoas conforme ato
                        normativo vigente.
                      </AlertBox>

                      <label className="flex items-start gap-3 p-4 rounded-xl border border-[#C5BEB2] bg-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.cienteRemuneracaoMaxima}
                          onChange={(e) =>
                            setForm({...form, cienteRemuneracaoMaxima: e.target.checked})
                          }
                          className="mt-1 h-4 w-4 accent-[#285D32]"
                        />
                        <span className="text-sm text-[#231F20] font-medium leading-relaxed">
                          Declaro que li integralmente e estou ciente das regras remuneratórias, do limite
                          máximo de remuneração total e da eventual aplicação de ABATE TETO referentes à{' '}
                          <strong>
                            {modality === 'GAEG_NS' ? 'GAEG Nível Superior' : 'GAEG Nível Intermediário'}
                          </strong>
                          .
                        </span>
                      </label>
                    </div>
                  )}

                  {/* ETAPA 7: Chefia imediata */}
                  {stepIdx === 6 && (
                    <div className="space-y-4">
                      <AlertBox tone="info" title="Finalidade da coleta dos dados da chefia imediata">
                        Os contatos abaixo destinam-se exclusivamente à consulta institucional formal junto
                        ao órgão de origem no âmbito do processo de movimentação ou cessão para a Enap.
                      </AlertBox>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field id="f-chnome" label="Nome completo da chefia imediata atual" required>
                          <input
                            id="f-chnome"
                            value={form.chefiaNome}
                            onChange={(e) => setForm({...form, chefiaNome: e.target.value})}
                            className={inputBaseClass}
                          />
                        </Field>
                        <Field id="f-chemail" label="E-mail institucional da chefia imediata" required>
                          <input
                            id="f-chemail"
                            type="email"
                            value={form.chefiaEmail}
                            onChange={(e) => setForm({...form, chefiaEmail: e.target.value})}
                            className={inputBaseClass}
                          />
                        </Field>
                        <Field id="f-chcargo" label="Cargo / função da chefia imediata" required>
                          <input
                            id="f-chcargo"
                            value={form.chefiaCargo}
                            onChange={(e) => setForm({...form, chefiaCargo: e.target.value})}
                            className={inputBaseClass}
                          />
                        </Field>
                        <Field id="f-chorgao" label="Órgão / unidade da chefia imediata" required>
                          <input
                            id="f-chorgao"
                            value={form.chefiaOrgao}
                            onChange={(e) => setForm({...form, chefiaOrgao: e.target.value})}
                            className={inputBaseClass}
                          />
                        </Field>
                      </div>
                    </div>
                  )}

                  {/* ETAPA 8: Revisão final mascarada + LGPD */}
                  {stepIdx === 7 && (
                    <div className="space-y-5">
                      <p className="text-sm text-[#4A4F52]">
                        Revise suas informações antes do envio definitivo. Campos sensíveis e bancários são
                        exibidos de forma mascarada por segurança.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="rounded-xl border border-[#E2DDD5] p-4 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-[#173640]">Identificação</h3>
                            <button
                              type="button"
                              onClick={() => setStepIdx(0)}
                              className="text-xs font-semibold text-[#186F80] hover:underline cursor-pointer"
                            >
                              Editar
                            </button>
                          </div>
                          <p>{form.nome}</p>
                          <p className="text-xs text-[#5F666A]">
                            CPF: {maskCpf(form.cpf)} · Nascimento: {form.dataNascimento}
                          </p>
                          <p className="text-xs text-[#5F666A]">
                            {form.escolaridade} — {form.formacao}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#E2DDD5] p-4 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-[#173640]">Vínculo e Movimentação</h3>
                            <button
                              type="button"
                              onClick={() => setStepIdx(3)}
                              className="text-xs font-semibold text-[#186F80] hover:underline cursor-pointer"
                            >
                              Editar
                            </button>
                          </div>
                          <p>{form.orgaoOrigem}</p>
                          <p className="text-xs text-[#5F666A]">
                            {form.cargoEfetivo} · SIAPE {form.matriculaSiape}
                          </p>
                          <p className="text-xs text-[#5F666A]">
                            Proposta Enap: {form.propostaCargoFuncaoEnap}
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#E2DDD5] p-4 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-[#173640]">Dados Bancários (Mascarados)</h3>
                            <button
                              type="button"
                              onClick={() => setStepIdx(4)}
                              className="text-xs font-semibold text-[#186F80] hover:underline cursor-pointer"
                            >
                              Editar
                            </button>
                          </div>
                          <p>
                            {form.tipoConta === 'CONTA_CORRENTE' ? 'Conta-corrente' : 'Conta-salário'} ·{' '}
                            {form.banco}
                          </p>
                          <p className="text-xs text-[#5F666A] font-mono">
                            Conta: {maskBankAccount(form.contaBancaria)} (cifragem AES-256-GCM no envio)
                          </p>
                        </div>

                        <div className="rounded-xl border border-[#E2DDD5] p-4 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-[#173640]">Chefia Imediata e Ciência</h3>
                            <button
                              type="button"
                              onClick={() => setStepIdx(6)}
                              className="text-xs font-semibold text-[#186F80] hover:underline cursor-pointer"
                            >
                              Editar
                            </button>
                          </div>
                          <p>{form.chefiaNome}</p>
                          <p className="text-xs text-[#5F666A]">
                            {form.chefiaCargo} · {form.chefiaEmail}
                          </p>
                          <p className="text-xs font-semibold text-[#285D32]">
                            Ciência remuneratória {modality === 'GAEG_NS' ? 'GAEG NS' : 'GAEG NI'} confirmada
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#218FA3]/35 bg-[#E7F4F7] p-4 text-xs text-[#105563] space-y-1.5">
                        <p className="font-bold text-sm">
                          Aviso específico de privacidade e tratamento de dados pessoais (LGPD)
                        </p>
                        <p>
                          Os dados fornecidos neste formulário destinam-se exclusivamente à instrução do
                          processo preliminar de movimentação e ingresso na Enap, sob guarda da área de gestão
                          de pessoas. Dados bancários e autodeclarações são armazenados em compartimento
                          segregado com controle de acesso mínimo e trilha de auditoria.
                        </p>
                      </div>

                      <label className="flex items-start gap-3 p-4 rounded-xl border border-[#C5BEB2] bg-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.cienteAvisoPrivacidade}
                          onChange={(e) =>
                            setForm({...form, cienteAvisoPrivacidade: e.target.checked})
                          }
                          className="mt-1 h-4 w-4 accent-[#285D32]"
                        />
                        <span className="text-sm text-[#231F20] font-medium leading-relaxed">
                          Confirmo a veracidade das informações prestadas e declaro ciência do aviso
                          específico de tratamento de dados pessoais para fins de Pré-Embarque na Enap.
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Navegação das etapas */}
                  <div className="pt-4 border-t border-[#E2DDD5] flex flex-wrap items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStepError(null);
                        if (stepIdx === 0) setStage('modality');
                        else setStepIdx((i) => i - 1);
                      }}
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      <span>Etapa anterior</span>
                    </Button>

                    {stepIdx < FORM_STEPS.length - 1 ? (
                      <Button onClick={handleNextStep}>
                        <span>Próxima etapa</span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button variant="secondary" size="lg" disabled={busy} onClick={handleSubmitForm}>
                        <Lock className="w-4 h-4" aria-hidden="true" />
                        <span>{busy ? 'Registrando com segurança...' : 'Enviar formulário preliminar'}</span>
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {stage === 'confirmation' && receipt && (
              <Card className="p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-full bg-[#EAF4EC] text-[#285D32] flex items-center justify-center shrink-0">
                    <ClipboardCheck className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#285D32]">
                      Formulário recebido com sucesso
                    </p>
                    <h1 className="text-2xl font-extrabold text-[#173640]">
                      Protocolo {receipt.protocol}
                    </h1>
                    <p className="text-sm text-[#4A4F52] mt-1">
                      Registrado em {new Date(receipt.submittedAt).toLocaleString('pt-BR')} · Versão dos
                      parâmetros remuneratórios: {receipt.remunerationParamVersion}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] p-5 space-y-2 text-sm">
                  <h2 className="font-bold text-[#173640]">Comprovante resumido</h2>
                  <p>
                    <strong>Nome:</strong> {receipt.receipt.nome}
                  </p>
                  <p>
                    <strong>CPF:</strong> {receipt.receipt.cpfMasked}
                  </p>
                  <p>
                    <strong>Modalidade:</strong>{' '}
                    {receipt.modality === 'GAEG_NS' ? 'GAEG Nível Superior' : 'GAEG Nível Intermediário'}
                  </p>
                  <p>
                    <strong>Órgão de origem:</strong> {receipt.receipt.orgaoOrigem}
                  </p>
                  <p>
                    <strong>Proposta Enap:</strong> {receipt.receipt.propostaCargoFuncaoEnap}
                  </p>
                  <p>
                    <strong>Chefia imediata indicada:</strong> {receipt.receipt.chefiaNome}
                  </p>
                  <p className="pt-2 text-xs text-[#164A21] font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{receipt.receipt.bankSegregatedNotice}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => {
                      setTrackProtocol(receipt.protocol);
                      setTrackEmail(verifiedInvite?.email || '');
                      navigate('/pre-ingresso/acompanhamento');
                    }}
                  >
                    <span>Acompanhar andamento do protocolo</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Button>
                  <Link
                    to="/"
                    className="text-sm font-semibold text-[#173640] hover:underline px-3 py-2"
                  >
                    Voltar à página inicial
                  </Link>
                </div>
              </Card>
            )}
          </div>
        )}
      </main>

      <Modal
        open={helpModalityOpen}
        onClose={() => setHelpModalityOpen(false)}
        title="Como confirmar sua modalidade GAEG"
      >
        <div className="space-y-3 text-sm text-[#4A4F52] leading-relaxed">
          <p>
            A modalidade <strong>GAEG Nível Superior</strong> ou <strong>GAEG Nível Intermediário</strong>{' '}
            está vinculada ao nível de escolaridade do cargo efetivo de origem e à proposta formalizada no
            processo de seleção ou movimentação para a Enap.
          </p>
          <p>
            Em caso de dúvida, confira o e-mail de convite enviado pela Coordenação-Geral de Gestão de
            Pessoas (CGP) ou entre em contato antes de concluir o envio do formulário.
          </p>
        </div>
      </Modal>
    </div>
  );
};
