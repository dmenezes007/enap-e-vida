import {useState} from 'react';
import {CalendarDays, Clock3, Mail, Search, Users} from 'lucide-react';
import catalog from '../../lib/pqvt-catalog.json';
import {Card, EmptyState, inputBaseClass} from '../../components/ui/Primitives';

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function PqvtCatalog() {
  const [search, setSearch] = useState('');
  const query = normalize(search.trim());
  const activities = catalog.filter(({title, sessions}) =>
    normalize([title, ...sessions.map(({days}) => days)].join(' ')).includes(query),
  );

  return (
    <section aria-labelledby="pqvt-catalog" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="pqvt-catalog" className="text-xl font-extrabold text-[#173640]">Catálogo do PQVT</h2>
        <label className="relative block sm:w-72">
          <span className="sr-only">Buscar atividade ou dia</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5F666A]" aria-hidden="true" />
          <input type="search" className={inputBaseClass + ' w-full pl-10'} placeholder="Buscar atividade ou dia" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      {activities.length === 0 ? <EmptyState title="Nenhuma atividade encontrada" description="Busque outro nome ou dia." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activities.map(({title, sessions}) => (
            <Card key={title} className="h-full overflow-hidden">
              <div className="flex items-center gap-3 border-b border-[#E2DDD5] bg-[#E7F4F7] p-4">
                <span className="rounded-lg bg-white p-2 text-[#186F80]"><CalendarDays className="size-5" aria-hidden="true" /></span>
                <h3 className="text-base font-extrabold text-[#173640]">{title}</h3>
              </div>
              <ul className="divide-y divide-[#ECE7DF] px-4">
                {sessions.map((session) => (
                  <li key={session.hours} className="space-y-2 py-4 text-sm text-[#4A4F52]">
                    <p className="font-bold text-[#173640]">{session.days}</p>
                    <p className="flex items-start gap-2"><Clock3 className="mt-0.5 size-4 shrink-0 text-[#186F80]" aria-hidden="true" />{session.hours}</p>
                    <p className="flex items-start gap-2"><Users className="mt-0.5 size-4 shrink-0 text-[#186F80]" aria-hidden="true" />{session.capacity}</p>
                    {session.available !== null && (
                      <p className="rounded-md bg-[#AFF0ED] px-2 py-1 text-xs font-semibold text-[#173640]">
                        Na planilha: {session.available} vagas disponíveis · {session.waitlist} na lista de espera
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#4A4F52]">
        <Mail className="size-4 text-[#186F80]" aria-hidden="true" />
        Dúvidas e agendamentos: <a className="font-semibold underline" href="mailto:esporte@cetefe.org">esporte@cetefe.org</a>
        <span>ou</span> <a className="font-semibold underline" href="mailto:pqvt@enap.gov.br">pqvt@enap.gov.br</a>
      </p>
    </section>
  );
}
