import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as hierarchy from '@amcharts/amcharts5/hierarchy';
import {Network} from 'lucide-react';
import {Card} from '../../components/ui/Primitives';
import {createInstitutionalChart} from '../../lib/institutionalCharts';
import training from '../../lib/cogem-training.json';

const areas = [
  {label: 'Pessoas e liderança', color: '#173640'},
  {label: 'Dados e pesquisa', color: '#186F80'},
  {label: 'IA e automação', color: '#285D32'},
  {label: 'Projetos e inovação', color: '#9E4F00'},
  {label: 'Comunicação e aprendizagem', color: '#710F10'},
  {label: 'Diversidades e bem-estar', color: '#0B3D1E'},
  {label: 'Governança e administração', color: '#4A4F52'},
  {label: 'Ferramentas de trabalho', color: '#596318'},
];
const years = Array.from(new Set(training.flatMap((item) => item.years))).sort();
const areaId = (area: string) => 'area-' + area;
type Course = typeof training[number];

export function KnowledgeNetwork() {
  const [area, setArea] = useState('');
  const [year, setYear] = useState('');
  const [selected, setSelected] = useState<Course | undefined>();
  const chartElement = useRef<HTMLDivElement>(null);
  const courses = useMemo(() => training.filter((course) =>
    (!year || course.years.includes(Number(year))) &&
    (!area || course.area === area || course.related.includes(area)),
  ), [area, year]);

  useLayoutEffect(() => {
    if (!chartElement.current || !courses.length) return;
    const root = createInstitutionalChart(chartElement.current);
    const compact = chartElement.current.clientWidth < 580;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const series = root.container.children.push(hierarchy.ForceDirected.new(root, {
      categoryField: 'name', idField: 'id', childDataField: 'children', valueField: 'value',
      fillField: 'color', linkWithField: 'links', topDepth: 1, initialDepth: 2,
      singleBranchOnly: false, minRadius: compact ? 8 : 12, maxRadius: compact ? 33 : 46,
      nodePadding: compact ? 6 : 10, manyBodyStrength: -14, centerStrength: 0.65,
      linkWithStrength: 0.18, initialFrames: 160, showOnFrame: reducedMotion ? 160 : 145,
    }));
    series.nodes.template.setAll({toggleKey: 'none', cursorOverStyle: 'pointer', tooltipText: '{category}'});
    series.labels.template.setAll({fontFamily: 'Georama, sans-serif', fill: am5.color('#FFFFFF'), fontWeight: '600',
      fontSize: compact ? 9 : 10, oversizedBehavior: 'wrap', textAlign: 'center'});
    series.labels.template.adapters.add('text', (text, target) =>
      (target.dataItem?.dataContext as {shortName?: string} | undefined)?.shortName ?? text,
    );
    series.links.template.setAll({strokeOpacity: 0.35, strokeWidth: 1.35});
    series.outerCircles.template.setAll({strokeWidth: 1.5, strokeOpacity: 0.55, fillOpacity: 0});
    const displayedAreas = areas.filter(({label}) => courses.some((item) => item.area === label || item.related.includes(label)));
    const visibleAreaIds = new Set(displayedAreas.map(({label}) => areaId(label)));
    series.data.setAll([{
      id: 'cogem', name: 'Trilha de Capacitações COGEM',
      children: displayedAreas.map(({label, color}) => {
        const matching = courses.filter((item) => item.area === label);
        // Cross-area courses take precedence in the overview so the links are visible.
        const examples = [...matching].sort((a, b) => b.related.length - a.related.length);
        return {
          id: areaId(label), name: label, shortName: label, value: 5, color: am5.color(color),
          children: (area ? examples : examples.slice(0, compact ? 2 : 3)).map((item) => ({
            id: item.id, name: item.title, shortName: '', value: 1, color: am5.color(color),
            links: item.related.map(areaId).filter((id) => visibleAreaIds.has(id)),
          })),
        };
      }),
    }]);
    series.set('selectedDataItem', series.dataItems[0]);
    series.nodes.template.events.on('click', (event) => {
      const node = event.target.dataItem?.dataContext as {id: string; name: string} | undefined;
      if (!node) return;
      if (node.id.startsWith('area-')) {
        setSelected(undefined);
        setArea(node.name);
      } else {
        setSelected(courses.find((item) => item.id === node.id));
      }
    });
    return () => root.dispose();
  }, [area, courses]);

  return (
    <Card className="space-y-5 p-4 sm:p-6">
      <header className="space-y-1">
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-[#173640]">
          <Network className="size-5 text-[#186F80]" aria-hidden="true" /> Trilha de Capacitações COGEM
        </h2>
        <p className="text-sm text-[#4A4F52]">Os círculos maiores representam áreas. Os menores mostram capacitações. Linhas entre grupos indicam temas em comum.</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#173640]">Área de conhecimento
          <select className="rounded-lg border border-[#C5BEB2] bg-white p-2 text-sm" value={area} onChange={(e) => {setArea(e.target.value); setSelected(undefined);}}>
            <option value="">Todas as áreas</option>
            {areas.map(({label}) => <option key={label}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#173640]">Ano na planilha
          <select className="rounded-lg border border-[#C5BEB2] bg-white p-2 text-sm" value={year} onChange={(e) => {setYear(e.target.value); setSelected(undefined);}}>
            <option value="">Todos os anos</option>
            {years.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      {courses.length ? (
        <>
          {!area && <p className="text-xs text-[#5F666A]">A visão geral mostra exemplos por área. Selecione uma área para ver suas capacitações.</p>}
          <div ref={chartElement} aria-label="Rede interativa de áreas de conhecimento e capacitações" className="h-[390px] w-full rounded-xl border border-[#E2DDD5] bg-[#F8F7F4] sm:h-[540px]" />
        </>
      ) : <p className="text-sm text-[#5F666A]">Nenhuma capacitação para os filtros selecionados.</p>}
      <div className="flex flex-wrap gap-2" aria-label="Áreas de conhecimento">
        {areas.map(({label, color}) => (
          <button type="button" key={label} aria-pressed={area === label}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E2DDD5] px-2.5 py-1.5 text-xs font-semibold text-[#173640] aria-pressed:bg-[#AFF0ED]"
            onClick={() => {setArea(area === label ? '' : label); setSelected(undefined);}}>
            <span className="size-2.5 rounded-full" style={{backgroundColor: color}} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      {selected && (
        <div aria-live="polite" className="rounded-xl bg-[#AFF0ED]/40 p-4 text-sm text-[#173640]">
          <p className="font-bold">{selected.title}</p>
          <p>{[selected.area, ...selected.related].join(' · ')} — {selected.years.join(', ')}</p>
        </div>
      )}
      <details className="border-t border-[#E2DDD5] pt-3 text-sm text-[#173640]">
        <summary className="cursor-pointer font-semibold">Consultar capacitações ({courses.length})</summary>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id} className="rounded-lg border border-[#E2DDD5] p-3">
              <p className="font-semibold">{course.title}</p>
              <p className="text-xs text-[#5F666A]">{[course.area, ...course.related].join(' · ')} — {course.years.join(', ')}</p>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
