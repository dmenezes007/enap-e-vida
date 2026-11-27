import React, {useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {
  Accessibility,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  MapPin,
  Users,
} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  SkeletonBlock,
  useToast,
} from '../../components/ui/Primitives';

const SOURCE_LABELS: Record<string, string> = {
  jornada: 'Jornada de Ambientação',
  pqvt: 'PQVT · Qualidade de Vida',
  comite_dei: 'Comitê DEI',
  institucional: 'Institucional Enap',
};

type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  source_module: string;
  category: string;
  modality: string;
  start_iso: string;
  end_iso: string;
  location: string;
  organizer: string;
  program_json: string;
  accessibility_resources: string;
  capacity: number | null;
  enrolled_count: number;
  my_status: 'confirmada' | 'lista_espera' | null;
  my_attendance_confirmed?: number | null;
};

const timeZone = 'America/Sao_Paulo';

export const EventsPage: React.FC = () => {
  const {id} = useParams();
  const {pushToast} = useToast();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [detail, setDetail] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'proximos' | 'mensal' | 'semanal' | 'meus'>('proximos');
  const [sourceFilter, setSourceFilter] = useState('todos');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const request = id
      ? apiFetch<{event: CalendarEvent}>(`/api/events/${id}`, {signal: controller.signal})
          .then((result) => { if (!controller.signal.aborted) setDetail(result.event); })
      : apiFetch<{events: CalendarEvent[]}>('/api/events', {signal: controller.signal})
          .then((result) => { if (!controller.signal.aborted) setEvents(result.events); });
    void request
      .catch((cause: Error) => {
        if (!controller.signal.aborted) setError(cause.message || 'Falha ao carregar a agenda.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, revision]);

  const changeParticipation = async (eventId: string, action: 'register' | 'cancel' | 'attendance') => {
    setBusy(true);
    try {
      const result = await apiFetch<{status?: string}>(`/api/events/${eventId}/${action}`, {method: 'POST'});
      if (action === 'cancel') pushToast('Inscrição no evento cancelada.', 'info');
      else if (action === 'attendance') pushToast('Presença registrada no evento.', 'success');
      else if (result.status === 'lista_espera') pushToast('Você entrou na lista de espera.', 'info');
      else pushToast('Inscrição confirmada no evento.', 'success');
      setRevision((value) => value + 1);
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Falha ao atualizar a participação.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;
  if (error) {
    return (
      <div className="space-y-3">
        <p role="alert">{error}</p>
        <Button onClick={() => setRevision((value) => value + 1)}>Tentar novamente</Button>
        {id && <Link to="/app/eventos" className="ml-3 underline">Voltar para a agenda</Link>}
      </div>
    );
  }

  const now = Date.now();

  // DETALHE DO EVENTO
  if (id && detail) {
    const program: string[] = detail.program_json ? JSON.parse(detail.program_json) : [];
    const isRegistered = detail.my_status === 'confirmada';
    const isWaiting = detail.my_status === 'lista_espera';
    const started = now >= Date.parse(detail.start_iso);
    const canConfirmAttendance = isRegistered && started && now <= Date.parse(detail.end_iso);

    return (
      <div className="space-y-6">
        <Link
          to="/app/eventos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#186F80] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Voltar para a Agenda Integrada</span>
        </Link>

        <Card className="p-6 sm:p-8 space-y-5">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-[#186F80]">
              {SOURCE_LABELS[detail.source_module] || detail.source_module} · {detail.modality}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#173640]">{detail.title}</h1>
            <p className="text-sm text-[#4A4F52] leading-relaxed">{detail.description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-y border-[#E2DDD5] text-sm">
            <div>
              <p className="text-xs text-[#5F666A]">Data e horário</p>
              <p className="font-bold text-[#173640] tabular-nums">
                {new Date(detail.start_iso).toLocaleDateString('pt-BR', {timeZone})} ·{' '}
                {new Date(detail.start_iso).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone,
                })}{' '}
                –{' '}
                {new Date(detail.end_iso).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#5F666A]">Local</p>
              <p className="font-bold text-[#173640]">{detail.location}</p>
            </div>
            <div>
              <p className="text-xs text-[#5F666A]">Organização</p>
              <p className="font-bold text-[#173640]">{detail.organizer}</p>
            </div>
          </div>

          {program.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-base font-extrabold text-[#173640]">Programação</h2>
              <ul className="space-y-1.5 text-sm text-[#4A4F52] list-disc list-inside">
                {program.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl bg-[#FAF8F4] border border-[#E2DDD5] p-4 text-xs text-[#4A4F52] flex items-start gap-2.5">
            <Accessibility className="w-4 h-4 text-[#285D32] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-bold text-[#173640]">Recursos de acessibilidade</p>
              <p>{detail.accessibility_resources}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {isRegistered || isWaiting ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#285D32]">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  {isWaiting ? 'Na lista de espera' : detail.my_attendance_confirmed ? 'Presença registrada' : 'Inscrição confirmada'}
                </span>
                {!started && (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => changeParticipation(detail.id, 'cancel')}>
                    {isWaiting ? 'Sair da lista de espera' : 'Cancelar inscrição'}
                  </Button>
                )}
                {canConfirmAttendance && !detail.my_attendance_confirmed && (
                  <Button variant="secondary" disabled={busy} onClick={() => changeParticipation(detail.id, 'attendance')}>
                    Registrar minha presença
                  </Button>
                )}
              </>
            ) : started ? (
              <span className="text-sm text-[#5F666A]">Inscrições encerradas</span>
            ) : (
              <Button variant="secondary" disabled={busy} onClick={() => changeParticipation(detail.id, 'register')}>
                {detail.capacity !== null && detail.enrolled_count >= detail.capacity ? 'Entrar na lista de espera' : 'Inscrever-me'}
              </Button>
            )}

            <a
              href={`/api/events/${detail.id}/ics`}
              download={`enap-evento-${detail.id}.ics`}
              className="inline-flex items-center gap-2 rounded-lg border border-[#C5BEB2] bg-white px-4 py-2 text-sm font-semibold text-[#173640] hover:bg-[#F2EFE9] whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Adicionar ao calendário (.ics)</span>
            </a>
          </div>
        </Card>
      </div>
    );
  }

  // LISTA / AGENDA INTEGRADA
  const filtered = events.filter((ev) => {
    if (viewMode === 'meus' && !ev.my_status) return false;
    if (viewMode === 'proximos' && Date.parse(ev.end_iso) < now) return false;
    if (sourceFilter !== 'todos' && ev.source_module !== sourceFilter) return false;
    if (categoryFilter && ev.category !== categoryFilter) return false;
    return true;
  });

  const groups = filtered.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const date = new Date(new Date(ev.start_iso).toLocaleDateString('sv-SE', {timeZone}) + 'T12:00:00Z');
    const calendarOptions = {timeZone: 'UTC'} as const;
    let label = date.toLocaleDateString('pt-BR', {...calendarOptions, month: 'long', year: 'numeric'});
    if (viewMode === 'semanal') {
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
      label = `Semana de ${date.toLocaleDateString('pt-BR', calendarOptions)}`;
    }
    (acc[label] ??= []).push(ev);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Agenda Institucional Integrada · Sem Duplicidade"
        title="Eventos"
        description="Acompanhe encontros da Jornada de Ambientação, ações do PQVT, rodas do Comitê DEI e eventos institucionais em um único calendário com exportação .ics."
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {([
            {id: 'proximos', label: 'Próximos eventos'},
            {id: 'mensal', label: 'Agrupado por mês'},
            {id: 'semanal', label: 'Agrupado por semana'},
            {id: 'meus', label: 'Meus eventos'},
          ] as const).map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={viewMode === m.id}
              onClick={() => setViewMode(m.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                viewMode === m.id
                  ? 'bg-[#173640] text-white'
                  : 'bg-white border border-[#E2DDD5] text-[#4A4F52]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filtrar por origem"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="rounded-lg border border-[#C5BEB2] bg-white px-3 py-2 text-sm text-[#231F20]"
          >
            <option value="todos">Todas as origens</option>
            <option value="jornada">Jornada de Ambientação</option>
            <option value="pqvt">PQVT</option>
            <option value="comite_dei">Comitê DEI</option>
            <option value="institucional">Institucional</option>
          </select>
          <select
            aria-label="Filtrar por categoria"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-[#C5BEB2] bg-white px-3 py-2 text-sm text-[#231F20]"
          >
            <option value="">Todas as categorias</option>
            {[...new Set(events.map((event) => event.category))]
              .sort((a, b) => a.localeCompare(b, 'pt-BR'))
              .map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum evento neste recorte"
          description="Experimente limpar os filtros ou confirmar sua participação nos próximos encontros."
        />
      ) : viewMode === 'mensal' || viewMode === 'semanal' ? (
        <div className="space-y-6">
          {Object.entries(groups).map(([label, items]) => (
            <div key={label} className="space-y-3">
              <h2 className="text-base font-extrabold text-[#173640] capitalize">{label}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((ev) => (
                  <EventCard key={ev.id} ev={ev} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((ev) => (
            <EventCard key={ev.id} ev={ev} />
          ))}
        </div>
      )}
    </div>
  );
};

const EventCard: React.FC<{ev: CalendarEvent}> = ({ev}) => (
  <Card className="p-5 flex flex-col justify-between gap-4">
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-[#186F80]">
          {SOURCE_LABELS[ev.source_module] || ev.source_module} · {ev.modality}
        </span>
        <span className="font-bold text-[#173640] tabular-nums">
          {new Date(ev.start_iso).toLocaleDateString('pt-BR', {timeZone})}
        </span>
      </div>
      <h3 className="text-base font-extrabold text-[#173640]">
        <Link to={`/app/eventos/${ev.id}`} className="hover:underline">
          {ev.title}
        </Link>
      </h3>
      <p className="text-xs text-[#4A4F52] line-clamp-2">{ev.description}</p>
      <div className="text-xs text-[#5F666A] space-y-1 pt-1">
        <p className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">
            {new Date(ev.start_iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', timeZone})} –{' '}
            {new Date(ev.end_iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', timeZone})}
          </span>
        </p>
        <p className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{ev.location}</span>
        </p>
        <p className="flex items-center gap-1.5 tabular-nums">
          <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            {ev.enrolled_count} participantes confirmados
            {ev.capacity ? ` (limite: ${ev.capacity})` : ''}
          </span>
        </p>
      </div>
    </div>
    <div className="flex items-center justify-between pt-3 border-t border-[#ECE7DF]">
      <a
        href={`/api/events/${ev.id}/ics`}
        download={`enap-evento-${ev.id}.ics`}
        className="text-xs font-semibold text-[#5F666A] hover:text-[#173640] inline-flex items-center gap-1"
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>.ics</span>
      </a>
      <Link
        to={`/app/eventos/${ev.id}`}
        className="text-xs font-extrabold text-[#173640] hover:text-[#186F80] underline"
      >
        {ev.my_status === 'confirmada' ? 'Confirmado · Detalhes' : ev.my_status === 'lista_espera' ? 'Na lista de espera · Detalhes' : 'Ver detalhes e participar'}
      </Link>
    </div>
  </Card>
);
