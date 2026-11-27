import {useLayoutEffect, useRef} from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import {createInstitutionalChart} from '../../lib/institutionalCharts';

type ChartRow = Record<string, string | number | null>;
type Measure = {field: string; name: string; color: string};

export function HorizontalBarChart({data, category, value, label, color = '#285D32'}: {
  data: ChartRow[];
  category: string;
  value: string;
  label: string;
  color?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!container.current) return;
    const root = createInstitutionalChart(container.current);
    const chart = root.container.children.push(am5xy.XYChart.new(root, {
      panX: false, panY: false, wheelX: 'none', wheelY: 'none', paddingLeft: 0, paddingRight: 10,
    }));
    const renderer = am5xy.AxisRendererY.new(root, {inversed: true, minGridDistance: 24});
    renderer.labels.template.setAll({maxWidth: Math.max(85, Math.min(175, container.current.clientWidth * 0.42)), oversizedBehavior: 'wrap', fontSize: 11});
    renderer.grid.template.set('visible', false);
    const y = chart.yAxes.push(am5xy.CategoryAxis.new(root, {categoryField: category, renderer}));
    const x = chart.xAxes.push(am5xy.ValueAxis.new(root, {
      min: 0, maxPrecision: 0, extraMax: 0.15, renderer: am5xy.AxisRendererX.new(root, {minGridDistance: 28}),
    }));
    const series = chart.series.push(am5xy.ColumnSeries.new(root, {
      name: label, xAxis: x, yAxis: y, valueXField: value, categoryYField: category,
      fill: am5.color(color), stroke: am5.color(color),
    }));
    series.columns.template.setAll({cornerRadiusTR: 6, cornerRadiusBR: 6, height: am5.percent(61), tooltipText: '{categoryY}: {valueX}'});
    series.bullets.push(() => am5.Bullet.new(root, {locationX: 1, sprite: am5.Label.new(root, {
      text: '{valueX}', populateText: true, centerY: am5.p50, paddingLeft: 6,
    })}));
    y.data.setAll(data);
    series.data.setAll(data);
    return () => root.dispose();
  }, [data, category, value, label, color]);

  return <div ref={container} role="img" aria-label={label} className="w-full" style={{height: Math.max(225, 42 * data.length + 40)}} />;
}

export function TimelineChart({data, measures}: {data: ChartRow[]; measures: readonly Measure[]}) {
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!container.current) return;
    const root = createInstitutionalChart(container.current);
    const chart = root.container.children.push(am5xy.XYChart.new(root, {
      panX: false, panY: false, wheelX: 'none', wheelY: 'none', paddingLeft: 0, paddingRight: 14,
    }));
    const x = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
      categoryField: 'periodo', renderer: am5xy.AxisRendererX.new(root, {minGridDistance: 23}),
    }));
    const y = chart.yAxes.push(am5xy.ValueAxis.new(root, {
      min: 1, max: 5, strictMinMax: true, maxPrecision: 0, renderer: am5xy.AxisRendererY.new(root, {}),
    }));
    x.data.setAll(data);
    for (const measure of measures) {
      const color = am5.color(measure.color);
      const series = chart.series.push(am5xy.LineSeries.new(root, {
        name: measure.name, xAxis: x, yAxis: y,
        valueYField: measure.field, categoryXField: 'periodo', stroke: color, fill: color,
        connect: false,
        tooltip: am5.Tooltip.new(root, {labelText: '{name}: {valueY}'}),
      }));
      series.strokes.template.setAll({strokeWidth: 3});
      series.bullets.push(() => am5.Bullet.new(root, {sprite: am5.Circle.new(root, {
        radius: 5, fill: color, stroke: am5.color('#FFFFFF'), strokeWidth: 2,
      })}));
      series.data.setAll(data);
    }
    chart.set('cursor', am5xy.XYCursor.new(root, {behavior: 'none'}));
    return () => root.dispose();
  }, [data, measures]);

  return (
    <div>
      <div ref={container} role="img" aria-label="Evolução aos 30, 60 e 90 dias, em escala de 1 a 5" className="h-60 w-full" />
      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-[#173640]">
        {measures.map((measure) => <li key={measure.field} className="flex items-center gap-2"><span aria-hidden="true" className="size-2.5 rounded-full" style={{backgroundColor: measure.color}} />{measure.name}</li>)}
      </ul>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer font-semibold text-[#173640]">Consultar os dados da série</summary>
        <table className="mt-2 w-full text-left">
          <thead><tr><th scope="col">Período</th>{measures.map(({field, name}) => <th scope="col" key={field}>{name}</th>)}</tr></thead>
          <tbody>{data.map((row) => <tr key={row.periodo}><td>{row.periodo}</td>{measures.map(({field}) => <td key={field}>{row[field] ?? '—'}</td>)}</tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
