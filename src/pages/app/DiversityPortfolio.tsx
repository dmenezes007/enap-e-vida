import {useState} from 'react';
import {CalendarDays, Users} from 'lucide-react';
import {Card, EmptyState} from '../../components/ui/Primitives';
import {ModuleTabs} from '../../components/ui/ModuleTabs';
import {diversityInitiatives, isPastInitiative} from '../../lib/deiInitiatives';

const tabs = [
  {id: 'past', label: 'Já realizadas'},
  {id: 'future', label: 'A realizar'},
] as const;

export function DiversityPortfolio() {
  const [tab, setTab] = useState<'past' | 'future'>('past');
  const initiatives = diversityInitiatives
    .filter(({date}) => isPastInitiative(date) === (tab === 'past'))
    .sort((a, b) => tab === 'past' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

  return (
    <section aria-labelledby="diversity-portfolio" className="space-y-4">
      <h2 id="diversity-portfolio" className="flex items-center gap-2 text-lg font-extrabold text-[#173640]">
        <Users className="size-5" aria-hidden="true" /> Portfolio de Iniciativas
      </h2>
      <ModuleTabs tabs={tabs} value={tab} onChange={setTab} label="Situação das iniciativas">
        {initiatives.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {initiatives.map((item, index) => (
              <Card key={item.date + '-' + item.title + '-' + index} className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#186F80]">
                  <span>{item.category}</span>
                  <time dateTime={item.date} className="inline-flex items-center gap-1.5 tabular-nums">
                    <CalendarDays className="size-4" aria-hidden="true" />{item.date.split('-').reverse().join('/')}
                  </time>
                </div>
                <h3 className="text-base font-extrabold text-[#173640]">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#4A4F52]">{item.summary}</p>
                <p className="border-t border-[#ECE7DF] pt-2 text-xs text-[#5F666A]">{item.group} · {item.kind}</p>
              </Card>
            ))}
          </div>
        ) : <EmptyState title="Nenhuma iniciativa nesta aba" description="Consulte a outra etapa do portfólio." />}
      </ModuleTabs>
    </section>
  );
}
