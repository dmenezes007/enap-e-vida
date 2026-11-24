import React, {useCallback, useEffect, useState} from 'react';
import {
  Calendar,
  Columns,
  GitCommitHorizontal,
  KeyRound,
  Lock,
  Plus,
  Table2,
} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import {useAuth} from '../../contexts/AuthContext';
import type {PreboardingStatus} from '../../lib/types';
import {
  AlertBox,
  Button,
  Card,
  Field,
  inputBaseClass,
  Modal,
  PageHeader,
  ProgressBar,
  SkeletonBlock,
  useToast,
} from '../../components/ui/Primitives';

const PREBOARDING_STATUSES: Array<{value: PreboardingStatus; label: string}> = [
  {value: 'convite_encaminhado', label: 'Convite encaminhado'},
  {value: 'preenchimento_iniciado', label: 'Preenchimento iniciado'},
  {value: 'formulario_recebido', label: 'Formulário recebido'},
  {value: 'em_analise', label: 'Em análise'},
  {value: 'complementacao_solicitada', label: 'Complementação solicitada'},
  {value: 'complementacao_recebida', label: 'Complementação recebida'},
  {value: 'consulta_orgao_origem', label: 'Consulta ao órgão de origem'},
  {value: 'preparacao_ingresso', label: 'Preparação para ingresso'},
  {value: 'ingresso_confirmado', label: 'Ingresso confirmado'},
  {value: 'encerrado_cancelado', label: 'Encerrado / cancelado'},
];

export const AdminPreboardingPage: React.FC = () => {
  const {hasPerm} = useAuth();
  const {pushToast} = useToast();

  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newInviteOpen, setNewInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    inviteeName: '',
    email: '',
    modality: 'GAEG_NS' as 'GAEG_NS' | 'GAEG_NI',
    targetUnit: 'DDP — Diretoria de Desenvolvimento Profissional',
    proposedPosition: 'Gratificação de Atividade em Escola de Governo (GAEG NS)',
  });

  const [statusModal, setStatusModal] = useState<any>(null);
  const [nextStatus, setNextStatus] = useState<PreboardingStatus>('em_analise');
  const [statusNote, setStatusNote] = useState('');

  const [vaultModal, setVaultModal] = useState<{
    caseName: string;
    bankDetails: any;
    sensitiveAttributes: any;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const canDecryptVault = hasPerm('preboarding:view_restricted_vault');

  const loadCases = useCallback(() => {
    setLoading(true);
    apiFetch<{cases: any[]}>('/api/admin/preboarding')
      .then((res) => setCases(res.cases))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiFetch<{code: string}>('/api/admin/preboarding/invites', {
        method: 'POST',
        body: JSON.stringify(inviteForm),
      });
      pushToast(`Convite emitido com sucesso! Código: ${res.code}`, 'success');
      setNewInviteOpen(false);
      setInviteForm({
        inviteeName: '',
        email: '',
        modality: 'GAEG_NS',
        targetUnit: 'DDP — Diretoria de Desenvolvimento Profissional',
        proposedPosition: 'Gratificação de Atividade em Escola de Governo (GAEG NS)',
      });
      loadCases();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao emitir convite.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAdvanceStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModal) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/preboarding/${statusModal.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({status: nextStatus, note: statusNote}),
      });
      pushToast('Situação do Pré-Embarque atualizada e auditada.', 'success');
      setStatusModal(null);
      setStatusNote('');
      loadCases();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao atualizar situação.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenVault = async (c: any) => {
    try {
      const res = await apiFetch<{bankDetails: any; sensitiveAttributes: any}>(
        `/api/admin/preboarding/submissions/${c.submission_id}/vault`,
      );
      setVaultModal({
        caseName: c.invitee_name,
        bankDetails: res.bankDetails,
        sensitiveAttributes: res.sensitiveAttributes,
      });
      pushToast('Consulta ao cofre segregado registrada na trilha de auditoria.', 'info');
    } catch (err: any) {
      pushToast(err?.message || 'Acesso negado ao compartimento segregado.', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="A Caminho da Enap · Segregação de Funções"
        title="Gestão de Pré-Embarque e Formulários GAEG"
        description="Emita convites institucionais, acompanhe o fluxo de 10 estados e consulte com trilha de auditoria o compartimento cifrado de dados bancários e sensíveis."
        actions={
          <Button variant="secondary" onClick={() => setNewInviteOpen(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Emitir convite</span>
          </Button>
        }
      />

      {!canDecryptVault && (
        <AlertBox tone="warning" title="Segregação de funções ativa (cofre bancário bloqueado)">
          Seu perfil pode acompanhar a tramitação geral dos processos, mas <strong>não</strong> possui
          permissão <code>preboarding:view_restricted_vault</code> para descriptografar dados bancários e
          atributos sensíveis (acesso exclusivo ao perfil Responsável pelo Pré-Embarque).
        </AlertBox>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF8F4] border-b border-[#E2DDD5] text-left text-xs text-[#5F666A]">
                <th className="py-3 px-4">Pessoa / Convite</th>
                <th className="py-3 px-4">Modalidade / Unidade</th>
                <th className="py-3 px-4">Protocolo / Dados Mascarados</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DF]">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-[#FAF8F4]/70">
                  <td className="py-3 px-4">
                    <p className="font-bold text-[#173640]">{c.invitee_name}</p>
                    <p className="text-xs text-[#5F666A] font-mono">
                      {c.code} · {c.email}
                    </p>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#4A4F52]">
                    <p className="font-bold text-[#173640]">
                      {c.modality === 'GAEG_NS' ? 'GAEG Nível Superior' : 'GAEG Nível Intermediário'}
                    </p>
                    <p>{c.target_unit}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#4A4F52]">
                    {c.protocol ? (
                      <>
                        <p className="font-mono font-bold text-[#285D32]">{c.protocol}</p>
                        <p>
                          CPF {c.cpf_masked} · Banco {c.bank_name} ({c.account_masked})
                        </p>
                      </>
                    ) : (
                      <span className="text-[#5F666A]">Aguardando envio do formulário</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs font-bold text-[#186F80]">
                    {PREBOARDING_STATUSES.find((s) => s.value === c.status)?.label || c.status}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setStatusModal(c);
                          setNextStatus(c.status);
                        }}
                      >
                        Movimentar
                      </Button>
                      {c.submission_id && (
                        <Button
                          size="sm"
                          variant={canDecryptVault ? 'primary' : 'ghost'}
                          onClick={() => handleOpenVault(c)}
                        >
                          {canDecryptVault ? (
                            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                          <span>Cofre</span>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Novo Convite */}
      <Modal
        open={newInviteOpen}
        onClose={() => setNewInviteOpen(false)}
        title="Emitir convite institucional de Pré-Embarque"
      >
        <form onSubmit={handleCreateInvite} className="space-y-4">
          <Field id="inv-name" label="Nome da pessoa convidada" required>
            <input
              id="inv-name"
              required
              value={inviteForm.inviteeName}
              onChange={(e) => setInviteForm({...inviteForm, inviteeName: e.target.value})}
              className={inputBaseClass}
            />
          </Field>
          <Field id="inv-email" label="E-mail da pessoa convidada" required>
            <input
              id="inv-email"
              type="email"
              required
              value={inviteForm.email}
              onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
              className={inputBaseClass}
            />
          </Field>
          <Field id="inv-mod" label="Modalidade GAEG" required>
            <select
              id="inv-mod"
              value={inviteForm.modality}
              onChange={(e) =>
                setInviteForm({...inviteForm, modality: e.target.value as 'GAEG_NS' | 'GAEG_NI'})
              }
              className={inputBaseClass}
            >
              <option value="GAEG_NS">GAEG Nível Superior</option>
              <option value="GAEG_NI">GAEG Nível Intermediário</option>
            </select>
          </Field>
          <Field id="inv-unit" label="Unidade de destino na Enap" required>
            <input
              id="inv-unit"
              required
              value={inviteForm.targetUnit}
              onChange={(e) => setInviteForm({...inviteForm, targetUnit: e.target.value})}
              className={inputBaseClass}
            />
          </Field>
          <Field id="inv-pos" label="Proposta de cargo/função/gratificação" required>
            <input
              id="inv-pos"
              required
              value={inviteForm.proposedPosition}
              onChange={(e) => setInviteForm({...inviteForm, proposedPosition: e.target.value})}
              className={inputBaseClass}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setNewInviteOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" disabled={busy}>
              Emitir convite
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Avançar Status */}
      <Modal
        open={Boolean(statusModal)}
        onClose={() => setStatusModal(null)}
        title={`Movimentar processo — ${statusModal?.invitee_name || ''}`}
      >
        <form onSubmit={handleAdvanceStatus} className="space-y-4">
          <Field id="st-sel" label="Nova etapa do fluxo" required>
            <select
              id="st-sel"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as PreboardingStatus)}
              className={inputBaseClass}
            >
              {PREBOARDING_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="st-note" label="Registro / justificativa da movimentação" required>
            <textarea
              id="st-note"
              required
              rows={3}
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              placeholder="Ex.: Documentação conferida e ofício enviado ao órgão de origem."
              className={inputBaseClass}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStatusModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" disabled={busy}>
              Confirmar movimentação
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Cofre Segregado Descriptografado */}
      <Modal
        open={Boolean(vaultModal)}
        onClose={() => setVaultModal(null)}
        title={`Cofre Segregado (Auditado) — ${vaultModal?.caseName || ''}`}
      >
        {vaultModal && (
          <div className="space-y-4 text-sm">
            <AlertBox tone="warning" title="Consulta auditada em tempo real">
              Esta abertura de compartimento cifrado (AES-256-GCM) foi gravada na trilha de auditoria
              com seu usuário e timestamp. Não copie para canais não autorizados.
            </AlertBox>
            <div className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] p-4 space-y-1.5">
              <h3 className="text-xs font-extrabold uppercase text-[#173640]">Dados Bancários</h3>
              <p>Tipo: {vaultModal.bankDetails.tipoConta}</p>
              <p>Banco: {vaultModal.bankDetails.banco}</p>
              <p className="font-mono">
                Agência: {vaultModal.bankDetails.agenciaComDv} · Conta: {vaultModal.bankDetails.contaBancaria}
              </p>
            </div>
            <div className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] p-4 space-y-1.5">
              <h3 className="text-xs font-extrabold uppercase text-[#173640]">
                Documentos Civis e Atributos Sensíveis
              </h3>
              <p>CPF: {vaultModal.sensitiveAttributes.cpf}</p>
              <p>RG: {vaultModal.sensitiveAttributes.rg}</p>
              <p>Título de eleitor: {vaultModal.sensitiveAttributes.tituloEleitor}</p>
              <p>Filiação: {vaultModal.sensitiveAttributes.filiacao}</p>
              <p>
                Raça/cor: {vaultModal.sensitiveAttributes.racaCor} · Cotas:{' '}
                {vaultModal.sensitiveAttributes.entradaPorCotas} · PcD:{' '}
                {vaultModal.sensitiveAttributes.pessoaComDeficiencia}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export const AdminJourneysPage: React.FC = () => {
  const {pushToast} = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'tabela' | 'kanban' | 'timeline' | 'calendario'>('tabela');
  const [resolvingTicket, setResolvingTicket] = useState<any>(null);
  const [resStatus, setResStatus] = useState<'em_andamento' | 'resolvida'>('resolvida');
  const [resNote, setResNote] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    apiFetch('/api/admin/journeys')
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResolveSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingTicket) return;
    try {
      await apiFetch(`/api/admin/journeys/support/${resolvingTicket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({status: resStatus, resolutionNote: resNote}),
      });
      pushToast('Pedido de apoio atualizado!', 'success');
      setResolvingTicket(null);
      setResNote('');
      loadData();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao atualizar pedido.', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  const journeys = data?.journeys || [];
  const supportRequests = data?.supportRequests || [];
  const kanbanCols = [
    {key: 'pre_embarque', label: 'Pré-embarque'},
    {key: 'embarque', label: 'Embarque'},
    {key: 'pos_embarque_30', label: 'Pós-embarque 30d'},
    {key: 'pos_embarque_60', label: 'Pós-embarque 60d'},
    {key: 'pos_embarque_90', label: 'Pós-embarque 90d'},
    {key: 'gestao_continua', label: 'Gestão Contínua'},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Orquestração da Ambientação · Multi-visões"
        title="Gestão das Jornadas de Ambientação"
        description="Acompanhe turmas e ingressantes por Tabela, Kanban, Linha do Tempo e Calendário, além de encaminhar solicitações de apoio."
      />

      {/* Seletor de visões (§22) */}
      <div className="flex flex-wrap gap-2">
        {[
          {id: 'tabela', label: 'Tabela', icon: Table2},
          {id: 'kanban', label: 'Kanban por etapa', icon: Columns},
          {id: 'timeline', label: 'Linha do tempo', icon: GitCommitHorizontal},
          {id: 'calendario', label: 'Calendário de ingressos', icon: Calendar},
        ].map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id as any)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold cursor-pointer ${
                view === v.id
                  ? 'bg-[#173640] text-white'
                  : 'bg-white border border-[#E2DDD5] text-[#4A4F52]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{v.label}</span>
            </button>
          );
        })}
      </div>

      {view === 'tabela' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#FAF8F4] border-b border-[#E2DDD5] text-left text-xs text-[#5F666A]">
                  <th className="py-3 px-4">Ingressante</th>
                  <th className="py-3 px-4">Turma / Unidade</th>
                  <th className="py-3 px-4">Etapa / Momento</th>
                  <th className="py-3 px-4">Progresso</th>
                  <th className="py-3 px-4">Pendências em atraso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DF]">
                {journeys.map((j: any) => (
                  <tr key={j.id}>
                    <td className="py-3 px-4">
                      <p className="font-bold text-[#173640]">{j.full_name}</p>
                      <p className="text-xs text-[#5F666A]">{j.position_title}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-[#4A4F52]">
                      <p className="font-semibold">{j.cohort_name}</p>
                      <p>{j.organizational_unit}</p>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <p className="font-bold text-[#186F80]">{j.operational_stage}</p>
                      <p className="text-[#5F666A]">Momento: {j.current_moment}</p>
                    </td>
                    <td className="py-3 px-4 min-w-[160px]">
                      <ProgressBar value={j.progressPercent} sublabel={`${j.completedTasks}/${j.totalTasks}`} />
                    </td>
                    <td className="py-3 px-4 text-xs font-bold tabular-nums">
                      <span className={j.overdueTasks > 0 ? 'text-[#8E1113]' : 'text-[#285D32]'}>
                        {j.overdueTasks} em atraso
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kanbanCols.map((col) => {
            const colItems = journeys.filter((j: any) => j.operational_stage === col.key);
            return (
              <div key={col.key} className="rounded-xl bg-[#F2EFE9] p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-extrabold text-[#173640]">
                  <span>{col.label}</span>
                  <span className="tabular-nums">{colItems.length}</span>
                </div>
                {colItems.length === 0 ? (
                  <p className="text-xs text-[#5F666A] py-3">Sem registros</p>
                ) : (
                  colItems.map((j: any) => (
                    <Card key={j.id} className="p-3 space-y-1.5">
                      <p className="text-xs font-extrabold text-[#173640]">{j.preferred_name}</p>
                      <p className="text-[11px] text-[#5F666A] truncate">{j.organizational_unit}</p>
                      <p className="text-[11px] font-bold text-[#285D32] tabular-nums">
                        {j.progressPercent}% concluído
                      </p>
                    </Card>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'timeline' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-extrabold text-[#173640]">
            Linha do Tempo Consolidada das Turmas
          </h2>
          <div className="space-y-3">
            {journeys.map((j: any) => (
              <div
                key={j.id}
                className="rounded-xl border border-[#E2DDD5] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-bold text-[#173640]">
                    {j.full_name} · <span className="text-[#186F80]">{j.current_moment}</span>
                  </p>
                  <p className="text-xs text-[#5F666A]">
                    Ingresso: {j.effective_entry_date || j.expected_entry_date} · Padrinho/Madrinha:{' '}
                    {j.mentor_name || 'A definir'}
                  </p>
                </div>
                <div className="w-full sm:w-56">
                  <ProgressBar value={j.progressPercent} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {view === 'calendario' && (
        <Card className="p-6 space-y-3">
          <h2 className="text-base font-extrabold text-[#173640]">
            Calendário de Datas de Ingresso e Marcos
          </h2>
          <div className="divide-y divide-[#ECE7DF]">
            {journeys.map((j: any) => (
              <div key={j.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                <div>
                  <p className="font-bold text-[#173640]">{j.full_name}</p>
                  <p className="text-xs text-[#5F666A]">{j.cohort_name}</p>
                </div>
                <span className="font-mono text-xs font-bold text-[#173640] tabular-nums">
                  {j.effective_entry_date || j.expected_entry_date}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Solicitações de Apoio */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-extrabold text-[#173640]">
          Pedidos de Apoio da Ambientação ({supportRequests.length})
        </h2>
        <div className="space-y-3">
          {supportRequests.map((sr: any) => (
            <div
              key={sr.id}
              className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#186F80]">
                  {sr.category} · {sr.assigned_unit} · Status: {sr.status}
                </p>
                <p className="text-sm font-bold text-[#173640]">
                  {sr.subject} — {sr.requester_name}
                </p>
                <p className="text-xs text-[#4A4F52]">{sr.description}</p>
                {sr.resolution_note && (
                  <p className="text-xs text-[#164A21]">
                    <strong>Encaminhamento:</strong> {sr.resolution_note}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setResolvingTicket(sr);
                  setResNote(sr.resolution_note || '');
                }}
              >
                Atualizar
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        open={Boolean(resolvingTicket)}
        onClose={() => setResolvingTicket(null)}
        title={`Encaminhar pedido — ${resolvingTicket?.subject || ''}`}
      >
        <form onSubmit={handleResolveSupport} className="space-y-4">
          <Field id="rs-st" label="Status" required>
            <select
              id="rs-st"
              value={resStatus}
              onChange={(e) => setResStatus(e.target.value as any)}
              className={inputBaseClass}
            >
              <option value="em_andamento">Em andamento</option>
              <option value="resolvida">Resolvida</option>
            </select>
          </Field>
          <Field id="rs-note" label="Devolutiva / encaminhamento" required>
            <textarea
              id="rs-note"
              required
              rows={3}
              value={resNote}
              onChange={(e) => setResNote(e.target.value)}
              className={inputBaseClass}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setResolvingTicket(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="secondary">
              Salvar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
