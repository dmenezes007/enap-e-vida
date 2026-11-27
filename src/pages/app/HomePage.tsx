import React, {useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Compass,
  Heart,
  Megaphone,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import {useAuth} from '../../contexts/AuthContext';
import {Card, ProgressBar, SkeletonBlock} from '../../components/ui/Primitives';

const MOMENT_LABELS: Record<string, string> = {
  preparacao: '01 · Preparação',
  acolhimento: '02 · Acolhimento',
  aprendizagem: '03 · Aprendizagem',
  integracao: '04 · Integração',
  pertencimento: '05 · Pertencimento',
};

const STAGE_LABELS: Record<string, string> = {
  pre_embarque: 'Pré-embarque',
  embarque: 'Embarque',
  pos_embarque: 'Pós-embarque (30–90 dias)',
  pos_embarque_30: 'Pós-embarque (30 dias)',
  pos_embarque_60: 'Pós-embarque (60 dias)',
  pos_embarque_90: 'Pós-embarque (90 dias)',
  gestao_continua: 'Gestão contínua (ciclo concluído)',
};

export const HomePage: React.FC = () => {
  const {user, canAdmin} = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/dashboard')
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock rows={4} />
      </div>
    );
  }

  const j = data?.journeySummary;
  const supervisorTasks = data?.supervisorTasks || [];
  const upcomingActivities = data?.upcomingActivities || [];
  const upcomingEvents = data?.upcomingEvents || [];
  const openSurveys = data?.openSurveys || [];
  const announcements = data?.announcements || [];

  return (
    <div className="space-y-7">
      {/* Saudação institucional e banner de acolhimento */}
      <section className="rounded-2xl bg-[#173640] text-white overflow-hidden border border-[#173640]">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
          <div className="lg:col-span-8 p-6 sm:p-8 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#FFC400]">
              Enap e-Vida
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">
              Olá, {user?.preferredName}! Que bom ter você por aqui.
            </h1>
            <p className="text-sm sm:text-base text-[#E6EEF0] max-w-2xl leading-relaxed">
              Conexões que acolhem. Experiências que transformam. Acompanhe sua jornada, participe das
              iniciativas de qualidade de vida e contribua para uma Enap cada vez mais humana e integrada.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                to="/app/jornada"
                className="inline-flex items-center gap-2 rounded-lg bg-[#FF8500] px-4 py-2 text-sm font-bold text-[#173640] hover:bg-[#e67700] transition-colors whitespace-nowrap shrink-0"
              >
                <Compass className="w-4 h-4" aria-hidden="true" />
                <span>Acessar Minha Jornada</span>
              </Link>
              <Link
                to="/app/atividades"
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors whitespace-nowrap shrink-0"
              >
                <Heart className="w-4 h-4" aria-hidden="true" />
                <span>Explorar PQVT</span>
              </Link>
              {canAdmin && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#FFC400]/50 bg-[#FFC400]/15 px-4 py-2 text-sm font-semibold text-[#AFF0ED] hover:bg-[#FFC400]/25 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Ir para Gestão</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
          <div className="lg:col-span-4 hidden lg:block h-full">
            <img
              src="/src/assets/images/jornada_acolhimento_1795080544095.jpg"
              alt="Ilustração editorial da Jornada de Ambientação Enap"
              className="w-full h-full min-h-[210px] object-cover opacity-90"
            />
          </div>
        </div>
      </section>

      {/* Bloco contextual: Minha Jornada de Ambientação */}
      {j && (
        <section aria-labelledby="sec-jornada">
          <Card warm={!j.isCompletedCycle} className="p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#285D32]">
                  {STAGE_LABELS[j.operationalStage] || j.operationalStage} ·{' '}
                  {MOMENT_LABELS[j.currentMoment] || j.currentMoment}
                </p>
                <h2 id="sec-jornada" className="text-xl font-extrabold text-[#173640]">
                  Minha Jornada de Ambientação
                </h2>
                <p className="text-sm text-[#4A4F52]">
                  {j.isCompletedCycle
                    ? 'Seu ciclo inicial de 90 dias foi concluído. Seu histórico permanece preservado para consulta e o pertencimento segue em construção contínua.'
                    : `Turma: ${j.cohortName} · Pessoa madrinha/padrinho: ${j.mentorName || 'A definir pela CGP'}`}
                </p>
              </div>
              <Link
                to="/app/jornada"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#173640] hover:text-[#186F80] whitespace-nowrap shrink-0"
              >
                <span>Ver jornada completa</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>

            <ProgressBar
              value={j.progressPercent}
              label={`${j.completedTasks} de ${j.totalTasks} marcos e tarefas concluídos`}
            />

            {!j.isCompletedCycle && (j.nextTasks.length > 0 || j.openAssessments.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                {j.nextTasks.length > 0 && (
                  <div className="rounded-xl bg-white border border-[#E2DDD5] p-4 space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#5F666A]">
                      Próximas ações da jornada
                    </h3>
                    <ul className="space-y-2">
                      {j.nextTasks.map((t: any) => (
                        <li key={t.id} className="text-sm flex items-start justify-between gap-3">
                          <span className="font-medium text-[#231F20]">{t.title}</span>
                          <span className="text-xs text-[#5F666A] tabular-nums shrink-0">
                            {new Date(`${t.due_date}T12:00:00Z`).toLocaleDateString('pt-BR')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {j.openAssessments.length > 0 && (
                  <div className="rounded-xl bg-white border border-[#FF8500]/40 p-4 flex flex-col justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#9E4F00]">
                        Avaliação de marco disponível
                      </h3>
                      <p className="text-sm font-bold text-[#173640]">
                        Pesquisa de {j.openAssessments[0].milestone_days} dias aberta para resposta
                      </p>
                      <p className="text-xs text-[#4A4F52]">
                        Compartilhe sua percepção sobre clareza de papel, apoio da equipe e pertencimento.
                      </p>
                    </div>
                    <div>
                      <Link
                        to="/app/jornada/avaliacoes"
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#173640] underline hover:text-[#186F80]"
                      >
                        <span>Responder agora</span>
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </section>
      )}

      {/* Bloco exclusivo para chefias com tarefas pendentes */}
      {supervisorTasks.length > 0 && (
        <section aria-labelledby="sec-chefia">
          <Card className="p-5 space-y-3 border-[#218FA3]/40">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#186F80]">
                  Papel de Chefia na Ambientação
                </p>
                <h2 id="sec-chefia" className="text-lg font-extrabold text-[#173640]">
                  Ações de acolhimento sob sua responsabilidade ({supervisorTasks.length})
                </h2>
              </div>
              <Link
                to="/app/jornada/tarefas"
                className="text-xs font-bold text-[#186F80] hover:underline whitespace-nowrap shrink-0"
              >
                Gerenciar tarefas
              </Link>
            </div>
            <div className="divide-y divide-[#ECE7DF]">
              {supervisorTasks.map((st: any) => (
                <div key={st.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-semibold text-[#231F20]">{st.title}</p>
                    <p className="text-xs text-[#5F666A]">
                      Ingressante: {st.newcomer_name} · {st.organizational_unit}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#5F666A] tabular-nums shrink-0">
                    Prazo: {new Date(`${st.due_date}T12:00:00Z`).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Grid principal: PQVT + Calendário */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas atividades do PQVT */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#285D32]">
                Atividades
              </p>
              <h2 className="text-lg font-extrabold text-[#173640]">Atividades com vagas abertas</h2>
            </div>
            <Link
              to="/app/atividades"
              className="text-xs font-bold text-[#186F80] hover:underline whitespace-nowrap shrink-0"
            >
              Ver catálogo
            </Link>
          </div>
          <div className="divide-y divide-[#ECE7DF]">
            {upcomingActivities.map((act: any) => (
              <Link
                key={act.id}
                to={`/app/atividades/${act.id}`}
                className="block py-3.5 first:pt-1 last:pb-0 hover:bg-[#FAF8F4] -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold text-[#173640]">{act.title}</p>
                    <p className="text-xs text-[#5F666A]">
                      {act.category} · {act.modality} · {act.schedule_summary}
                    </p>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <p className="text-xs font-bold text-[#285D32]">
                      {act.enrolled_count}/{act.capacity} vagas
                    </p>
                    {act.my_status === 'confirmada' && (
                      <p className="text-[11px] font-semibold text-[#186F80]">Inscrito(a)</p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* Próximos eventos institucionais integrados */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#186F80]">
                Calendário
              </p>
              <h2 className="text-lg font-extrabold text-[#173640]">Próximos eventos da Enap</h2>
            </div>
            <Link
              to="/app/eventos"
              className="text-xs font-bold text-[#186F80] hover:underline whitespace-nowrap shrink-0"
            >
              Ver calendário
            </Link>
          </div>
          <div className="divide-y divide-[#ECE7DF]">
            {upcomingEvents.map((ev: any) => (
              <Link
                key={ev.id}
                to={`/app/eventos/${ev.id}`}
                className="block py-3.5 first:pt-1 last:pb-0 hover:bg-[#FAF8F4] -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold text-[#173640]">{ev.title}</p>
                    <p className="text-xs text-[#5F666A]">
                      {ev.category} · {ev.location}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#173640] tabular-nums shrink-0">
                    {new Date(ev.start_iso).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Enquetes abertas + Comunicados institucionais */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-5 p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-[#173640]">Enquetes abertas</h2>
            <Link to="/app/enquetes" className="text-xs font-bold text-[#186F80] hover:underline">
              Todas
            </Link>
          </div>
          <div className="space-y-3">
            {openSurveys.map((s: any) => (
              <Link
                key={s.id}
                to={`/app/enquetes/${s.id}`}
                className="block rounded-xl border border-[#E2DDD5] p-3.5 hover:bg-[#FAF8F4] transition-colors"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[#5F666A]">
                  <span className="font-semibold text-[#186F80] capitalize">
                    Pesquisa {s.anonymity_mode}
                  </span>
                  <span className="tabular-nums">
                    Até {new Date(`${s.closes_at}T12:00:00Z`).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <p className="text-sm font-bold text-[#173640] mt-1">{s.title}</p>
                {s.already_answered ? (
                  <p className="text-xs font-semibold text-[#285D32] mt-1.5 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Participação registrada
                  </p>
                ) : (
                  <p className="text-xs text-[#4A4F52] mt-1 line-clamp-2">{s.purpose}</p>
                )}
              </Link>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-7 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#FF8500]" aria-hidden="true" />
            <h2 className="text-lg font-extrabold text-[#173640]">Comunicados institucionais</h2>
          </div>
          <div className="divide-y divide-[#ECE7DF]">
            {announcements.map((a: any) => (
              <article key={a.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs text-[#5F666A]">
                  <span className="font-bold text-[#285D32]">{a.category}</span>
                  <span className="tabular-nums">
                    {new Date(`${a.published_at}T12:00:00Z`).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#173640]">{a.title}</h3>
                <p className="text-xs sm:text-sm text-[#4A4F52] leading-relaxed">{a.summary}</p>
              </article>
            ))}
          </div>
        </Card>
      </div>

      {/* Atalhos rápidos dos módulos */}
      <section aria-label="Atalhos da comunidade" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {to: '/app/fala-enap', label: 'Fala, Enap!', desc: 'Sugestões e devolutivas', icon: MessageSquare},
          {to: '/app/enquetes', label: 'Enquetes', desc: 'Escuta estruturada', icon: ClipboardList},
          {to: '/app/repositorio', label: 'Repositório', desc: 'Guias, normas e cartilhas', icon: BookOpen},
          {to: '/app/comite-dei', label: 'Comitê DEI', desc: 'Diversidade e inclusão', icon: Users},
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-xl border border-[#E2DDD5] bg-white p-4 hover:border-[#173640]/40 hover:bg-[#AFF0ED]/40 transition-colors space-y-1.5"
            >
              <Icon className="w-5 h-5 text-[#173640]" aria-hidden="true" />
              <p className="text-sm font-extrabold text-[#173640]">{item.label}</p>
              <p className="text-xs text-[#5F666A]">{item.desc}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
};
