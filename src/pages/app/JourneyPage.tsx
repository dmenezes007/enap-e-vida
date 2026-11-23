import React, {useCallback, useEffect, useState} from 'react';
import {Link, useLocation} from 'react-router-dom';
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Compass,
  HelpCircle,
  LifeBuoy,
  Sparkles,
  Users,
} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import {
  AlertBox,
  Button,
  Card,
  EmptyState,
  Field,
  inputBaseClass,
  Modal,
  PageHeader,
  ProgressBar,
  SkeletonBlock,
  useToast,
} from '../../components/ui/Primitives';

const MOMENTS = [
  {
    key: 'preparacao',
    num: '01',
    title: 'Preparação',
    desc: 'Acessos, equipamentos, estação de trabalho e informações preliminares antes da chegada.',
  },
  {
    key: 'acolhimento',
    num: '02',
    title: 'Acolhimento',
    desc: 'Boas-vindas institucionais, recepção pela equipe, chefia imediata e pessoa madrinha/padrinho.',
  },
  {
    key: 'aprendizagem',
    num: '03',
    title: 'Aprendizagem',
    desc: 'Clareza de papel, entregas prioritárias, cultura, ética e normas institucionais (PGD, integridade).',
  },
  {
    key: 'integracao',
    num: '04',
    title: 'Integração',
    desc: 'Vínculos transversais, participação em iniciativas do PQVT, eventos e diálogo com outras áreas.',
  },
  {
    key: 'pertencimento',
    num: '05',
    title: 'Pertencimento',
    desc: 'Construção contínua de identificação com o propósito da Enap — não termina automaticamente aos 90 dias.',
  },
];

const SUPPORT_CATEGORIES = [
  'Acessos e sistemas',
  'Equipamentos e infraestrutura',
  'Orientações institucionais',
  'Aprendizagem e clareza de atribuições',
  'Integração e convivência',
  'Acessibilidade',
  'Outros assuntos pertinentes',
];

export const JourneyPage: React.FC = () => {
  const location = useLocation();
  const {pushToast} = useToast();

  const initialTab = location.pathname.includes('/tarefas')
    ? 'tarefas'
    : location.pathname.includes('/avaliacoes')
      ? 'avaliacoes'
      : location.pathname.includes('/apoio')
        ? 'apoio'
        : 'visao';

  const [tab, setTab] = useState<'visao' | 'tarefas' | 'avaliacoes' | 'apoio'>(initialTab);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [momentFilter, setMomentFilter] = useState<string>('todos');

  // Modal de avaliação 30/60/90
  const [activeAssessment, setActiveAssessment] = useState<any>(null);
  const [scores, setScores] = useState({
    roleClarityScore: 4,
    teamSupportScore: 5,
    supervisorSupportScore: 5,
    belongingScore: 4,
    expectationsMetScore: 4,
    qualitativeComment: '',
  });
  const [submittingAssess, setSubmittingAssess] = useState(false);

  // Formulário "Preciso de apoio"
  const [supportForm, setSupportForm] = useState({
    category: SUPPORT_CATEGORIES[0],
    subject: '',
    description: '',
  });
  const [submittingSupport, setSubmittingSupport] = useState(false);

  const loadJourney = useCallback(() => {
    setLoading(true);
    apiFetch('/api/journey/me')
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadJourney();
  }, [loadJourney]);

  useEffect(() => {
    if (location.pathname.includes('/tarefas')) setTab('tarefas');
    else if (location.pathname.includes('/avaliacoes')) setTab('avaliacoes');
    else if (location.pathname.includes('/apoio')) setTab('apoio');
    else setTab('visao');
  }, [location.pathname]);

  const toggleTask = async (task: any) => {
    const next = task.status === 'concluida' ? 'pendente' : 'concluida';
    try {
      await apiFetch(`/api/journey/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({status: next}),
      });
      pushToast(
        next === 'concluida' ? 'Tarefa marcada como concluída!' : 'Tarefa reaberta como pendente.',
        'success',
      );
      loadJourney();
    } catch (err: any) {
      pushToast(err?.message || 'Não foi possível atualizar a tarefa.', 'error');
    }
  };

  const handleAssessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssessment) return;
    setSubmittingAssess(true);
    try {
      await apiFetch(`/api/journey/assessments/${activeAssessment.id}/submit`, {
        method: 'POST',
        body: JSON.stringify(scores),
      });
      pushToast(`Avaliação de ${activeAssessment.milestone_days} dias registrada!`, 'success');
      setActiveAssessment(null);
      loadJourney();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao enviar avaliação.', 'error');
    } finally {
      setSubmittingAssess(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSupport(true);
    try {
      const res = await apiFetch<{assignedUnit: string}>('/api/journey/support', {
        method: 'POST',
        body: JSON.stringify(supportForm),
      });
      pushToast(`Solicitação encaminhada para ${res.assignedUnit}.`, 'success');
      setSupportForm({category: SUPPORT_CATEGORIES[0], subject: '', description: ''});
      loadJourney();
    } catch (err: any) {
      pushToast(err?.message || 'Verifique os campos da solicitação.', 'error');
    } finally {
      setSubmittingSupport(false);
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  const journey = data?.journey;
  const tasks = data?.tasks || [];
  const assessments = data?.assessments || [];
  const supportRequests = data?.supportRequests || [];
  const supervisorTasks = data?.supervisorTasks || [];
  const completedCount = tasks.filter((t: any) => t.status === 'concluida').length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const filteredTasks =
    momentFilter === 'todos' ? tasks : tasks.filter((t: any) => t.moment === momentFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Da posse ao pertencimento · Pessoas · Processos · Evidências"
        title="Jornada de Ambientação"
        description="Um percurso contínuo e acolhedor que integra preparação técnica, vínculos humanos e aprendizado organizacional."
        actions={
          <Button variant="accent" onClick={() => setTab('apoio')}>
            <LifeBuoy className="w-4 h-4" aria-hidden="true" />
            <span>Preciso de apoio</span>
          </Button>
        }
      />

      {/* Navegação por abas */}
      <div className="flex flex-wrap gap-2 border-b border-[#E2DDD5] pb-3" role="tablist">
        {[
          {id: 'visao', label: 'Visão Geral e 5 Momentos', to: '/app/jornada'},
          {id: 'tarefas', label: `Marcos e Tarefas (${completedCount}/${tasks.length})`, to: '/app/jornada/tarefas'},
          {id: 'avaliacoes', label: 'Avaliações 30 · 60 · 90 dias', to: '/app/jornada/avaliacoes'},
          {id: 'apoio', label: `Preciso de Apoio (${supportRequests.length})`, to: '/app/jornada/apoio'},
        ].map((t) => (
          <Link
            key={t.id}
            to={t.to}
            role="tab"
            aria-selected={tab === t.id}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === t.id
                ? 'bg-[#173640] text-white'
                : 'bg-white border border-[#E2DDD5] text-[#4A4F52] hover:bg-[#F2EFE9]'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Visão Geral */}
      {tab === 'visao' && (
        <div className="space-y-6">
          {journey ? (
            <Card warm className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#5F666A]">Turma / Coorte</p>
                  <p className="text-base font-extrabold text-[#173640]">{journey.cohort_name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#5F666A]">Ingresso / Referência</p>
                  <p className="text-base font-extrabold text-[#173640] tabular-nums">
                    {new Date(`${journey.effective_entry_date || journey.expected_entry_date}T12:00:00Z`).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#5F666A]">Pessoa madrinha / padrinho</p>
                  <p className="text-base font-extrabold text-[#173640]">
                    {journey.mentor_name || 'Em definição'}
                  </p>
                </div>
              </div>
              <ProgressBar
                value={progress}
                label={`Progresso geral da jornada (${completedCount} de ${tasks.length} tarefas)`}
              />
            </Card>
          ) : (
            <EmptyState
              title="Nenhuma jornada individual de 90 dias ativa"
              description="Seu vínculo atual está consolidado na gestão contínua da comunidade Enap. Você pode consultar as referências da Jornada ou acompanhar tarefas de chefia."
            />
          )}

          {/* 5 Momentos Orientadores com nota de sobreposição (Slide 10) */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#173640]">
                Os 5 Momentos Orientadores da Ambientação
              </h2>
              <p className="text-sm text-[#4A4F52]">
                Os momentos não são caixas rígidas nem encerram automaticamente ao final dos 90 dias:
                eles se sobrepõem e continuam vivos na rotina da Enap.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {MOMENTS.map((m) => {
                const isCurrent = journey?.current_moment === m.key;
                return (
                  <Card
                    key={m.key}
                    className={`p-4 space-y-2 ${
                      isCurrent ? 'border-[#285D32] ring-1 ring-[#285D32] bg-[#EAF4EC]/50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#186F80] tabular-nums">{m.num}</span>
                      {isCurrent && (
                        <span className="text-[11px] font-extrabold text-[#285D32]">Momento atual</span>
                      )}
                    </div>
                    <h3 className="text-base font-extrabold text-[#173640]">{m.title}</h3>
                    <p className="text-xs text-[#4A4F52] leading-relaxed">{m.desc}</p>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* 3 Dimensões: Pessoas, Processos e Evidências */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 space-y-1.5">
              <div className="flex items-center gap-2 text-[#285D32]">
                <Users className="w-4 h-4" aria-hidden="true" />
                <h3 className="text-sm font-extrabold uppercase tracking-wide">Pessoas</h3>
              </div>
              <p className="text-sm text-[#4A4F52]">
                Acolhimento compartilhado entre CGP, chefia imediata, pessoa madrinha/padrinho e colegas da
                unidade.
              </p>
            </Card>
            <Card className="p-5 space-y-1.5">
              <div className="flex items-center gap-2 text-[#186F80]">
                <Compass className="w-4 h-4" aria-hidden="true" />
                <h3 className="text-sm font-extrabold uppercase tracking-wide">Processos</h3>
              </div>
              <p className="text-sm text-[#4A4F52]">
                Acessos, equipamentos, marcos de 30/60/90 dias e fluxos coordenados entre gestão de pessoas,
                TI e logística.
              </p>
            </Card>
            <Card className="p-5 space-y-1.5">
              <div className="flex items-center gap-2 text-[#9E4F00]">
                <Sparkles className="w-4 h-4" aria-hidden="true" />
                <h3 className="text-sm font-extrabold uppercase tracking-wide">Evidências</h3>
              </div>
              <p className="text-sm text-[#4A4F52]">
                Monitoramento contínuo de clareza de papel, apoio, vínculos e dificuldades para melhorar a
                experiência de cada turma.
              </p>
            </Card>
          </section>
        </div>
      )}

      {/* Tarefas e Marcos */}
      {tab === 'tarefas' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMomentFilter('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                momentFilter === 'todos'
                  ? 'bg-[#173640] text-white'
                  : 'bg-white border border-[#E2DDD5] text-[#4A4F52]'
              }`}
            >
              Todos os momentos
            </button>
            {MOMENTS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMomentFilter(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  momentFilter === m.key
                    ? 'bg-[#173640] text-white'
                    : 'bg-white border border-[#E2DDD5] text-[#4A4F52]'
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState
              title="Nenhuma tarefa neste recorte"
              description="Altere o filtro de momento ou consulte as tarefas sob sua responsabilidade como chefia."
            />
          ) : (
            <div className="space-y-2.5">
              {filteredTasks.map((t: any) => {
                const done = t.status === 'concluida';
                return (
                  <Card key={t.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleTask(t)}
                        aria-label={done ? `Reabrir tarefa ${t.title}` : `Concluir tarefa ${t.title}`}
                        className="mt-0.5 text-[#285D32] hover:opacity-80 cursor-pointer shrink-0"
                      >
                        {done ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5 text-[#8A9296]" />
                        )}
                      </button>
                      <div className="space-y-1 min-w-0">
                        <p
                          className={`text-sm font-bold ${
                            done ? 'line-through text-[#5F666A]' : 'text-[#173640]'
                          }`}
                        >
                          {t.title}
                        </p>
                        <p className="text-xs text-[#4A4F52]">{t.description}</p>
                        <p className="text-[11px] text-[#5F666A]">
                          Responsável: <strong>{t.responsible_unit}</strong> · Momento: {t.moment}
                          {t.is_essential_day1 ? ' · Essencial no Dia 1' : ''}
                          {t.depends_on_title ? ` · Depende de: ${t.depends_on_title}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 tabular-nums space-y-1">
                      <p className="text-xs font-semibold text-[#4A4F52]">
                        {new Date(`${t.due_date}T12:00:00Z`).toLocaleDateString('pt-BR')}
                      </p>
                      <Button size="sm" variant={done ? 'ghost' : 'outline'} onClick={() => toggleTask(t)}>
                        {done ? 'Concluída' : 'Concluir'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Lista de tarefas de chefia (se aplicável) */}
          {supervisorTasks.length > 0 && (
            <Card className="p-5 space-y-3">
              <h2 className="text-base font-extrabold text-[#173640]">
                Minhas tarefas como Chefia Imediata ({supervisorTasks.length})
              </h2>
              <div className="divide-y divide-[#ECE7DF]">
                {supervisorTasks.map((st: any) => {
                  const done = st.status === 'concluida';
                  return (
                    <div key={st.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className={`text-sm font-bold ${done ? 'line-through text-[#5F666A]' : 'text-[#173640]'}`}>
                          {st.title}
                        </p>
                        <p className="text-xs text-[#5F666A]">
                          Ingressante: {st.newcomer_name} ({st.newcomer_unit})
                        </p>
                      </div>
                      <Button size="sm" variant={done ? 'ghost' : 'secondary'} onClick={() => toggleTask(st)}>
                        {done ? 'Concluída' : 'Marcar concluída'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Avaliações 30/60/90 dias */}
      {tab === 'avaliacoes' && (
        <div className="space-y-4">
          <AlertBox tone="info" title="Avaliações como instrumento de escuta e cuidado">
            As avaliações de 30, 60 e 90 dias medem clareza de papel, apoio da equipe e da chefia,
            expectativas e pertencimento — alimentando o painel de indicadores da Jornada para melhoria
            contínua das próximas turmas.
          </AlertBox>

          {assessments.length === 0 ? (
            <EmptyState
              title="Nenhuma avaliação de ciclo registrada"
              description="As avaliações de 30, 60 e 90 dias são habilitadas automaticamente para pessoas em jornada ativa."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {assessments.map((a: any) => (
                <Card key={a.id} className="p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-extrabold text-[#173640] tabular-nums">
                        Marco {a.milestone_days} dias
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          a.status === 'respondida'
                            ? 'text-[#285D32]'
                            : a.status === 'disponivel'
                              ? 'text-[#9E4F00]'
                              : 'text-[#5F666A]'
                        }`}
                      >
                        {a.status === 'respondida'
                          ? 'Respondida'
                          : a.status === 'disponivel'
                            ? 'Disponível'
                            : 'Agendada'}
                      </span>
                    </div>
                    <p className="text-xs text-[#5F666A] tabular-nums">
                      Prevista: {new Date(`${a.scheduled_date}T12:00:00Z`).toLocaleDateString('pt-BR')}
                    </p>
                    {a.status === 'respondida' && (
                      <div className="pt-2 text-xs text-[#4A4F52] space-y-1 tabular-nums border-t border-[#ECE7DF]">
                        <p>Clareza de papel: <strong>{a.role_clarity_score}/5</strong></p>
                        <p>Apoio da equipe: <strong>{a.team_support_score}/5</strong></p>
                        <p>Apoio da chefia: <strong>{a.supervisor_support_score}/5</strong></p>
                        <p>Pertencimento: <strong>{a.belonging_score}/5</strong></p>
                        {a.qualitative_comment && (
                          <p className="pt-1 italic text-[#5F666A]">“{a.qualitative_comment}”</p>
                        )}
                      </div>
                    )}
                  </div>
                  {a.status === 'disponivel' && (
                    <Button variant="secondary" onClick={() => setActiveAssessment(a)}>
                      <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
                      <span>Responder avaliação</span>
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Canal Preciso de Apoio */}
      {tab === 'apoio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Card className="lg:col-span-6 p-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-extrabold text-[#173640]">Solicitar apoio na ambientação</h2>
              <p className="text-sm text-[#4A4F52]">
                Relate dificuldades com acessos, equipamentos, orientações ou integração. O pedido é
                direcionado automaticamente à área responsável.
              </p>
            </div>

            <AlertBox tone="warning" title="Assuntos sensíveis ou denúncias">
              Este canal é dedicado a dúvidas operacionais e dificuldades da ambientação. Para denúncias,
              relatos de assédio, conflitos graves ou manifestações formais de Ouvidoria, utilize os
              canais oficiais (<strong>ouvidoria@enap.gov.br</strong> ou <strong>falabr.cgu.gov.br</strong>).
            </AlertBox>

            <form onSubmit={handleSupportSubmit} className="space-y-4">
              <Field id="sup-cat" label="Categoria do apoio" required>
                <select
                  id="sup-cat"
                  value={supportForm.category}
                  onChange={(e) => setSupportForm({...supportForm, category: e.target.value})}
                  className={inputBaseClass}
                >
                  {SUPPORT_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field id="sup-sub" label="Assunto" required>
                <input
                  id="sup-sub"
                  required
                  value={supportForm.subject}
                  onChange={(e) => setSupportForm({...supportForm, subject: e.target.value})}
                  placeholder="Resumo objetivo da necessidade"
                  className={inputBaseClass}
                />
              </Field>
              <Field id="sup-desc" label="Descrição" required>
                <textarea
                  id="sup-desc"
                  required
                  rows={4}
                  value={supportForm.description}
                  onChange={(e) => setSupportForm({...supportForm, description: e.target.value})}
                  placeholder="Conte brevemente o que está dificultando seu início ou rotina."
                  className={inputBaseClass}
                />
              </Field>
              <Button type="submit" disabled={submittingSupport}>
                <HelpCircle className="w-4 h-4" aria-hidden="true" />
                <span>{submittingSupport ? 'Encaminhando...' : 'Enviar pedido de apoio'}</span>
              </Button>
            </form>
          </Card>

          <Card className="lg:col-span-6 p-6 space-y-4">
            <h2 className="text-lg font-extrabold text-[#173640]">
              Meus pedidos registrados ({supportRequests.length})
            </h2>
            {supportRequests.length === 0 ? (
              <EmptyState
                title="Nenhum pedido registrado"
                description="Sempre que precisar de apoio durante sua jornada, registre aqui para acompanharmos até a resolução."
              />
            ) : (
              <div className="space-y-3">
                {supportRequests.map((sr: any) => (
                  <div
                    key={sr.id}
                    className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#186F80]">{sr.category}</span>
                      <span className="font-bold capitalize text-[#285D32]">{sr.status}</span>
                    </div>
                    <p className="text-sm font-bold text-[#173640]">{sr.subject}</p>
                    <p className="text-xs text-[#4A4F52]">{sr.description}</p>
                    <p className="text-[11px] text-[#5F666A]">
                      Área responsável: {sr.assigned_unit} ·{' '}
                      {new Date(sr.created_at).toLocaleDateString('pt-BR')}
                    </p>
                    {sr.resolution_note && (
                      <p className="text-xs text-[#164A21] bg-[#EAF4EC] p-2.5 rounded-lg mt-2">
                        <strong>Encaminhamento:</strong> {sr.resolution_note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal de Avaliação 30/60/90 */}
      <Modal
        open={Boolean(activeAssessment)}
        onClose={() => setActiveAssessment(null)}
        title={`Avaliação da Jornada — Marco de ${activeAssessment?.milestone_days || ''} dias`}
      >
        <form onSubmit={handleAssessSubmit} className="space-y-4">
          <p className="text-sm text-[#4A4F52]">
            Avalie sua percepção atual em uma escala de 1 (muito baixo) a 5 (muito alto):
          </p>
          {[
            {key: 'roleClarityScore', label: 'Clareza sobre seu papel, entregas e prioridades'},
            {key: 'teamSupportScore', label: 'Apoio recebido pela equipe e colegas'},
            {key: 'supervisorSupportScore', label: 'Acompanhamento e orientação da chefia imediata'},
            {key: 'belongingScore', label: 'Sentimento de acolhimento e pertencimento à Enap'},
            {key: 'expectationsMetScore', label: 'Alinhamento entre expectativas e experiência real'},
          ].map((item) => (
            <Field key={item.key} id={item.key} label={item.label} required>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScores({...scores, [item.key]: n})}
                    className={`h-10 w-10 rounded-lg font-bold text-sm cursor-pointer transition-colors ${
                      (scores as any)[item.key] === n
                        ? 'bg-[#173640] text-white'
                        : 'bg-[#F2EFE9] text-[#4A4F52] hover:bg-[#E2DDD5]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>
          ))}
          <Field id="assess-comment" label="Comentário qualitativo (opcional)">
            <textarea
              id="assess-comment"
              rows={3}
              value={scores.qualitativeComment}
              onChange={(e) => setScores({...scores, qualitativeComment: e.target.value})}
              placeholder="O que mais ajudou até aqui e o que podemos melhorar?"
              className={inputBaseClass}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setActiveAssessment(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="secondary" disabled={submittingAssess}>
              {submittingAssess ? 'Enviando...' : 'Enviar avaliação'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
