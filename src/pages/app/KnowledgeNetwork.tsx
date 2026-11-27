import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import * as am5 from '@amcharts/amcharts5';
import {Network} from 'lucide-react';
import {Card} from '../../components/ui/Primitives';
import {createInstitutionalChart} from '../../lib/institutionalCharts';
import training from '../../lib/cogem-training.json';

const areas = [
  {label: 'Pessoas e liderança', short: 'Pessoas e liderança', color: '#173640'},
  {label: 'Dados e pesquisa', short: 'Dados e pesquisa', color: '#186F80'},
  {label: 'IA e automação', short: 'IA e automação', color: '#285D32'},
  {label: 'Projetos e inovação', short: 'Projetos e inovação', color: '#9E4F00'},
  {label: 'Comunicação e aprendizagem', short: 'Comunicação', color: '#710F10'},
  {label: 'Diversidades e bem-estar', short: 'Diversidades', color: '#0B3D1E'},
  {label: 'Governança e administração', short: 'Governança', color: '#4A4F52'},
  {label: 'Ferramentas de trabalho', short: 'Ferramentas', color: '#596318'},
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
    type Node = {id: string; label: string; color: string; x: number; y: number; radius: number; hub: boolean};
    type Edge = {from: Node; to: string; secondary?: boolean};
    const palette = new Map(areas.map(({label, color}) => [label, color]));
    const tooltip = am5.Tooltip.new(root, {});
    const layer = root.container.children.push(am5.Container.new(root, {width: am5.p100, height: am5.p100}));

    function renderNetwork() {
      const width = chartElement.current?.clientWidth ?? 0;
      const height = chartElement.current?.clientHeight ?? 0;
      if (!width || !height) return;
      layer.children.clear();
      const compact = width < 620;
      const nodes = new Map<string, Node>();
      const edges: Edge[] = [];
      const hub = (label: string, x: number, y: number, radius: number) => {
        const node = {id: areaId(label), label, x, y, radius, hub: true, color: palette.get(label) ?? '#173640'};
        nodes.set(node.id, node);
        return node;
      };
      const leaf = (item: Course, parent: Node, x: number, y: number, related: string[]) => {
        const node = {id: item.id, label: item.title, color: parent.color, x, y, radius: compact ? 8 : 12, hub: false};
        nodes.set(node.id, node);
        edges.push({from: node, to: parent.id});
        for (const label of related) edges.push({from: node, to: areaId(label), secondary: true});
      };

      if (area) {
        const center = hub(area, width / 2, height / 2, compact ? 28 : 45);
        const otherAreas = areas.filter(({label}) =>
          label !== area && courses.some((item) => item.area === label || item.related.includes(label)),
        );
        otherAreas.forEach(({label}, index) => {
          const angle = index * 2 * Math.PI / otherAreas.length - Math.PI / 2;
          hub(label, width / 2 + Math.cos(angle) * (width / 2 - 35), height / 2 + Math.sin(angle) * (height / 2 - 35), compact ? 20 : 30);
        });
        const ringSizes = compact ? [10, 16, 24] : [8, 14, 24];
        let offset = 0;
        for (const [ring, size] of ringSizes.entries()) {
          const entries = courses.slice(offset, offset + size);
          const distance = [0.21, 0.29, 0.37][ring];
          entries.forEach((item, index) => {
            const angle = index * 2 * Math.PI / entries.length + ring * 0.38;
            leaf(item, center, width / 2 + Math.cos(angle) * width * distance, height / 2 + Math.sin(angle) * height * distance,
              [item.area, ...item.related].filter((label) => label !== area));
          });
          offset += size;
        }
      } else {
        const displayed = areas.filter(({label}) => courses.some((item) => item.area === label || item.related.includes(label)));
        const columns = Math.min(displayed.length, compact ? 2 : 4);
        const rows = Math.ceil(displayed.length / columns);
        const cellWidth = width / columns;
        const cellHeight = height / rows;
        displayed.forEach(({label}, index) => {
          const row = Math.floor(index / columns);
          const column = index % columns;
          const rowCount = Math.min(columns, displayed.length - row * columns);
          const x = (column + 0.5) * cellWidth + (width - rowCount * cellWidth) / 2;
          const y = (row + 0.5) * cellHeight;
          const cell = Math.min(cellWidth, cellHeight);
          const center = hub(label, x, y, Math.min(compact ? 25 : 44, cell * 0.23));
          const examples = courses.filter((item) => item.area === label)
            .sort((a, b) => b.related.length - a.related.length).slice(0, compact ? 2 : 3);
          examples.forEach((item, idx) => {
            const angle = -Math.PI / 2 + (idx + (index % 2) * 0.45) * 2 * Math.PI / examples.length;
            leaf(item, center, x + Math.cos(angle) * cell * 0.37, y + Math.sin(angle) * cell * 0.37, item.related);
          });
        });
      }

      for (const {from, to, secondary} of edges) {
        const target = nodes.get(to);
        if (!target) continue;
        layer.children.push(am5.Graphics.new(root, {
          stroke: am5.color(from.color), strokeWidth: secondary ? 1 : 1.5,
          strokeOpacity: secondary ? 0.26 : 0.58, strokeDasharray: secondary ? [4, 3] : undefined,
          draw: (display) => {display.moveTo(from.x, from.y); display.lineTo(target.x, target.y);},
        }));
      }
      for (const node of nodes.values()) {
        if (node.hub) {
          layer.children.push(am5.Circle.new(root, {
            x: node.x, y: node.y, radius: node.radius + 3, fillOpacity: 0,
            stroke: am5.color(node.color), strokeWidth: 1.5,
          }));
        }
        const circle = layer.children.push(am5.Circle.new(root, {
          x: node.x, y: node.y, radius: node.radius, fill: am5.color(node.color),
          stroke: am5.color('#FFFFFF'), strokeWidth: 1.5, interactive: true, cursorOverStyle: 'pointer',
          tooltipText: node.label,
          tooltip,
        }));
        circle.events.on('click', () => {
          if (node.hub) {
            setSelected(undefined);
            setArea(node.label);
          } else {
            setSelected(courses.find((item) => item.id === node.id));
          }
        });
        if (node.hub) {
          layer.children.push(am5.Label.new(root, {
            x: node.x, y: node.y, centerX: am5.p50, centerY: am5.p50, text: compact ? areas.find(({label}) => label === node.label)?.short ?? node.label : node.label,
            fill: am5.color('#FFFFFF'), fontSize: compact ? 8 : 10, fontWeight: '600',
            textAlign: 'center', oversizedBehavior: 'wrap', maxWidth: 2 * node.radius - 6,
            paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
          }));
        }
      }
    }

    const resize = new ResizeObserver(renderNetwork);
    resize.observe(chartElement.current);
    renderNetwork();
    return () => {
      resize.disconnect();
      root.dispose();
    };
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
          <select className="rounded-lg border border-[#C5BEB2] bg-white p-2 text-sm" aria-label="Área de conhecimento" value={area} onChange={(e) => {setArea(e.target.value); setSelected(undefined);}}>
            <option value="">Todas as áreas</option>
            {areas.map(({label}) => <option key={label}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#173640]">Ano na planilha
          <select className="rounded-lg border border-[#C5BEB2] bg-white p-2 text-sm" aria-label="Ano na planilha" value={year} onChange={(e) => {setYear(e.target.value); setSelected(undefined);}}>
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
