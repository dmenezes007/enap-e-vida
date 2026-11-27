import {useState} from 'react';
import {ChevronLeft, ChevronRight} from 'lucide-react';
import {Card} from '../../components/ui/Primitives';

const timeZone = 'America/Sao_Paulo';
const dateKey = (value: string | Date) => new Date(value).toLocaleDateString('sv-SE', {timeZone});
const monthFormat = new Intl.DateTimeFormat('pt-BR', {month: 'long', year: 'numeric', timeZone: 'UTC'});
const dayFormat = new Intl.DateTimeFormat('pt-BR', {dateStyle: 'full', timeZone: 'UTC'});
const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

export function MonthCalendar<T extends {id: string; start_iso: string}>({
  events,
  renderEvent,
}: {
  events: T[];
  renderEvent: (event: T) => React.ReactNode;
}) {
  const today = dateKey(new Date());
  const [month, setMonth] = useState(() => new Date(today.slice(0, 7) + '-01T12:00:00Z'));
  const [selected, setSelected] = useState<string | null>(null);
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const leading = (month.getUTCDay() + 6) % 7;
  const numDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const eventsByDay = new Map<string, T[]>();
  for (const event of events) {
    const day = dateKey(event.start_iso);
    const items = eventsByDay.get(day) ?? [];
    items.push(event);
    eventsByDay.set(day, items);
  }
  const monthItems = events.filter((event) => dateKey(event.start_iso).startsWith(dayKey(month).slice(0, 7)));
  const visible = selected ? eventsByDay.get(selected) ?? [] : monthItems;

  function changeMonth(offset: number) {
    setMonth(new Date(Date.UTC(year, monthIndex + offset, 1, 12)));
    setSelected(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="self-start p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <button type="button" aria-label="Mês anterior" onClick={() => changeMonth(-1)} className="grid size-10 place-items-center rounded-lg hover:bg-[#E7F4F7]"><ChevronLeft aria-hidden="true" className="size-5" /></button>
          <h2 aria-live="polite" className="text-center text-lg font-extrabold capitalize text-[#173640]">{monthFormat.format(month)}</h2>
          <button type="button" aria-label="Próximo mês" onClick={() => changeMonth(1)} className="grid size-10 place-items-center rounded-lg hover:bg-[#E7F4F7]"><ChevronRight aria-hidden="true" className="size-5" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((day) => <span key={day} className="pb-2 text-xs font-semibold text-[#5F666A]">{day}</span>)}
          {Array.from({length: leading}, (_, index) => <span key={'blank-' + index} aria-hidden="true" />)}
          {Array.from({length: numDays}, (_, index) => {
            const day = index + 1;
            const date = new Date(Date.UTC(year, monthIndex, day, 12));
            const key = dayKey(date);
            const count = eventsByDay.get(key)?.length ?? 0;
            return (
              <button type="button" key={key} aria-current={key === today ? 'date' : undefined}
                aria-pressed={selected === key} aria-label={dayFormat.format(date) + ' · ' + count + ' evento(s)'}
                onClick={() => setSelected(selected === key ? null : key)}
                className={'flex min-h-11 flex-col items-center justify-center rounded-lg text-sm font-bold ' +
                  (selected === key ? 'bg-[#173640] text-white' : count ? 'bg-[#E7F4F7] text-[#173640] hover:bg-[#CDE8ED]' : 'text-[#4A4F52] hover:bg-[#F2EFE9]') +
                  (key === today ? ' ring-1 ring-inset ring-[#218FA3]' : '')}>
                {day}
                {count > 0 && <span aria-hidden="true" className="text-[10px] font-semibold">{count} <span className="hidden sm:inline">evento(s)</span></span>}
              </button>
            );
          })}
        </div>
      </Card>
      <section className="space-y-3" aria-labelledby="calendar-events">
        <div className="flex items-center justify-between gap-3">
          <h2 id="calendar-events" className="font-extrabold text-[#173640]">{selected ? dayFormat.format(new Date(selected + 'T12:00:00Z')) : 'Eventos do mês'}</h2>
          {selected && <button type="button" className="text-sm font-semibold underline" onClick={() => setSelected(null)}>Ver mês todo</button>}
        </div>
        {visible.length ? visible.map(renderEvent) : <Card className="p-5 text-sm text-[#4A4F52]">Nenhum evento programado neste período.</Card>}
      </section>
    </div>
  );
}
