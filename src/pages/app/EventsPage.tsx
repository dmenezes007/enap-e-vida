import React, {useCallback, useEffect, useState} from 'react';
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

export const EventsPage: React.FC = () => {
  const {id} = useParams();
  const {pushToast} = useToast();

  const [events, setEvents] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'proximos' | 'mensal' | 'meus'>('proximos');
  const [sourceFilter, setSourceFilter] = useState('todos');
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    if (id) {
      apiFetch<{event: any}>(`/api/events/${id}`)
        .then((res) => setDetail(res.event))
        .finally(() => setLoading(false));
    } else {
      apiFetch<{events: any[]}>('/api/events')
        .then((res) => setEvents(res.events))
        .finally(() => setLoading(false));
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegister = async (eventId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/events/${eventId}/register`, {method: 'POST'});
      pushToast('Presença confirmada no evento!', 'success');
      loadData();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao confirmar inscrição.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (eventId: string) => {
    setBusy(true);
    try {
      await apiFetch(`/api/events/${eventId}/cancel`, {method: 'POST'});
      pushToast('Inscrição no evento cancelada.', 'info');
      loadData();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao cancelar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  // DETALHE DO EVENTO
  if (id && detail) {
    const program: string[] = detail.program_json ? JSON.parse(detail.program_json) : [];
    const isRegistered = detail.my_status === 'confirmada';

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
                {new Date(detail.start_iso).toLocaleDateString('pt-BR')} ·{' '}
                {new Date(detail.start_iso).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                –{' '}
                {new Date(detail.end_iso).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
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
              <p className="font-bold text-[#173640]">Acessibilidade garantida</p>
              <p>{detail.accessibility_resources}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {isRegistered ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#285D32]">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Presença confirmada
                </span>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => handleCancel(detail.id)}>
                  Cancelar participação
                </Button>
              </>
            ) : (
              <Button variant="secondary" disabled={busy} onClick={() => handleRegister(detail.id)}>
                Confirmar participação
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
    if (viewMode === 'meus' && ev.my_status !== 'confirmada') return false;
    if (sourceFilter !== 'todos' && ev.source_module !== sourceFilter) return false;
    return true;
  });

  // Agrupamento por mês para visão mensal limpa
  const byMonth = filtered.reduce<Record<string, any[]>>((acc, ev) => {
    const key = new Date(ev.start_iso).toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'});
    acc[key] = acc[key] || [];
    acc[key].push(ev);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Agenda Institucional Integrada · Sem Duplicidade"
        title="Eventos da Enap"
        description="Acompanhe encontros da Jornada de Ambientação, ações do PQVT, rodas do Comitê DEI e eventos institucionais em um único calendário com exportação .ics."
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            {id: 'proximos', label: 'Próximos eventos'},
            {id: 'mensal', label: 'Agrupado por mês'},
            {id: 'meus', label: 'Meus eventos'},
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setViewMode(m.id as any)}
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum evento neste recorte"
          description="Experimente limpar os filtros ou confirmar sua participação nos próximos encontros."
        />
      ) : viewMode === 'mensal' ? (
        <div className="space-y-6">
          {Object.entries(byMonth).map(([monthLabel, items]) => (
            <div key={monthLabel} className="space-y-3">
              <h2 className="text-base font-extrabold text-[#173640] capitalize">{monthLabel}</h2>
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

const EventCard: React.FC<{ev: any}> = ({ev}) => (
  <Card className="p-5 flex flex-col justify-between gap-4">
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-[#186F80]">
          {SOURCE_LABELS[ev.source_module] || ev.source_module} · {ev.modality}
        </span>
        <span className="font-bold text-[#173640] tabular-nums">
          {new Date(ev.start_iso).toLocaleDateString('pt-BR')}
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
            {new Date(ev.start_iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})} –{' '}
            {new Date(ev.end_iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
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
        {ev.my_status === 'confirmada' ? 'Confirmado · Detalhes' : 'Ver detalhes e participar'}
      </Link>
    </div>
  </Card>
);
