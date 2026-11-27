import * as am5 from '@amcharts/amcharts5';
import ptBR from '@amcharts/amcharts5/locales/pt_BR';

export function createInstitutionalChart(element: HTMLElement) {
  const root = am5.Root.new(element);
  root.locale = ptBR;
  const theme = am5.Theme.new(root);
  theme.rule('Label').setAll({
    fontFamily: 'Georama, sans-serif',
    fill: am5.color('#173640'),
    fontSize: 12,
  });
  theme.rule('Grid').setAll({stroke: am5.color('#E2DDD5'), strokeOpacity: 0.75});
  root.setThemes([theme]);
  return root;
}
