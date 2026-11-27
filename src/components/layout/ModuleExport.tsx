import {useState} from 'react';
import {Download} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import catalog from '../../lib/pqvt-catalog.json';
import {buildBrazilianCsv} from '../../lib/security';
import {useToast} from '../ui/Primitives';

type Cell = string | number | boolean | null | undefined;
type RecordData = Record<string, Cell>;
type Data = Record<string, RecordData[] | RecordData | null>;
type Row = Cell[];
type ExportDefinition = {
  endpoint?: string;
  headers?: string[];
  rows: (data: Data) => Row[];
};

const defaultHeaders = ['Tipo', 'Título', 'Data', 'Detalhes', 'Situação'];

function records(data: Data, key: string) {
  const value = data[key];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function project(data: Data, key: string, label: string, ...columns: string[]): Row[] {
  return records(data, key).map((record) => [label, ...columns.map((column) => record[column])]);
}

const modules: Record<string, ExportDefinition> = {
  inicio: {
    endpoint: '/api/dashboard',
    rows: (d) => [
      ...project(d, 'journeySummary', 'Ambientação', 'cohortName', 'entryDate', 'currentMoment', 'status'),
      ...project(d, 'upcomingActivities', 'Atividade', 'title', 'next_session_iso', 'schedule_summary', 'my_status'),
      ...project(d, 'upcomingEvents', 'Evento', 'title', 'start_iso', 'location', 'my_status'),
      ...project(d, 'openSurveys', 'Enquete', 'title', 'closes_at', 'purpose', 'already_answered'),
      ...project(d, 'announcements', 'Comunicado', 'title', 'published_at', 'summary'),
    ],
  },
  jornada: {
    endpoint: '/api/journey/me',
    rows: (d) => [
      ...project(d, 'tasks', 'Tarefa', 'title', 'due_date', 'moment', 'status'),
      ...project(d, 'assessments', 'Avaliação', 'milestone_days', 'scheduled_date', 'scheduled_date', 'status'),
      ...project(d, 'supportRequests', 'Pedido de apoio', 'category', 'created_at', 'assigned_unit', 'status'),
      ...project(d, 'supervisorTasks', 'Tarefa de chefia', 'title', 'due_date', 'moment', 'status'),
    ],
  },
  atividades: {
    headers: ['Atividade', 'Dias', 'Horário', 'Capacidade e regra de acesso', 'Vagas disponíveis na planilha', 'Lista de espera na planilha'],
    rows: () => catalog.flatMap(({title, sessions}) =>
      sessions.map((s) => [title, s.days, s.hours, s.capacity, s.available, s.waitlist]),
    ),
  },
  'comite-dei': {
    endpoint: '/api/comite-dei',
    rows: (d) => [
      ...project(d, 'projects', 'Iniciativa', 'title', 'created_at', 'axis', 'status'),
      ...project(d, 'events', 'Evento', 'title', 'start_iso', 'location', 'status'),
      ...project(d, 'documents', 'Documento', 'title', 'published_at', 'category', 'editorial_status'),
    ],
  },
  eventos: {
    endpoint: '/api/events',
    headers: ['Evento', 'Início', 'Fim', 'Origem', 'Categoria', 'Modalidade', 'Local', 'Inscrição'],
    rows: (d) => records(d, 'events').map((e) =>
      [e.title, e.start_iso, e.end_iso, e.source_module, e.category, e.modality, e.location, e.my_status],
    ),
  },
  enquetes: {
    endpoint: '/api/surveys',
    rows: (d) => project(d, 'surveys', 'Enquete', 'title', 'closes_at', 'purpose', 'status'),
  },
  repositorio: {
    endpoint: '/api/repository',
    rows: (d) => project(d, 'documents', 'Documento', 'title', 'published_at', 'category', 'version'),
  },
  'fala-enap': {
    endpoint: '/api/fala-enap',
    rows: (d) => [
      ...project(d, 'myContributions', 'Minha contribuição', 'title', 'created_at', 'category', 'status'),
      ...project(d, 'whatChanged', 'Mudança implementada', 'title', 'updated_at', 'change_summary'),
    ],
  },
  perfil: {
    endpoint: '/api/profile/me',
    rows: (d) => [
      ...project(d, 'profile', 'Meu perfil', 'fullName', 'entryDate', 'employmentType'),
      ...project(d, 'myActivities', 'Minha atividade', 'title', 'schedule_summary', 'location', 'status'),
      ...project(d, 'myEvents', 'Meu evento', 'title', 'start_iso', 'location', 'status'),
      ...project(d, 'myContributions', 'Minha contribuição', 'title', 'created_at', 'category', 'status'),
    ],
  },
};

export function ModuleExport({module}: {module: string | undefined}) {
  const {pushToast} = useToast();
  const [busy, setBusy] = useState(false);
  const definition = module ? modules[module] : undefined;
  if (!definition) return null;

  async function download(format: 'csv' | 'xls') {
    if (!definition || busy) return;
    setBusy(true);
    try {
      const data = definition.endpoint ? await apiFetch<Data>(definition.endpoint) : {};
      const headers = definition.headers ?? defaultHeaders;
      const rows = definition.rows(data).map((row) => headers.map((_, index) => row[index] ?? ''));
      if (!rows.length) {
        pushToast('Não há dados disponíveis para exportar.', 'info');
        return;
      }
      const name = 'enap-e-vida-' + module + '.' + format;
      if (format === 'xls') {
        const {utils, writeFile} = await import('xlsx');
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, utils.aoa_to_sheet([headers, ...rows]), 'Enap e-Vida');
        writeFile(workbook, name, {bookType: 'biff8'});
        return;
      }
      const url = URL.createObjectURL(new Blob([buildBrazilianCsv(headers, rows)], {type: 'text/csv;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      pushToast('Não foi possível exportar os dados. Tente novamente.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="relative">
      <summary title="Exportar dados do módulo" aria-label="Exportar dados do módulo"
        className="grid size-9 cursor-pointer list-none place-items-center rounded-lg text-[#173640] hover:bg-[#F2EFE9] [&::-webkit-details-marker]:hidden">
        <Download className="size-5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 min-w-28 rounded-lg border border-[#E2DDD5] bg-white p-1 shadow-lg">
        <button type="button" disabled={busy} className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-[#F2EFE9]" onClick={() => void download('csv')}>CSV</button>
        <button type="button" disabled={busy} className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold hover:bg-[#F2EFE9]" onClick={() => void download('xls')}>XLS</button>
      </div>
    </details>
  );
}
