import React, {useCallback, useEffect, useState} from 'react';
import {
  BarChart3,
  Calendar,
  Columns,
  Download,
  Info,
  Lightbulb,
  Plus,
  Table2,
} from 'lucide-react';
import {TimelineChart} from '../../components/ui/InstitutionalCharts';
import {apiFetch} from '../../lib/api';
import type {ComputedIndicator} from '../../lib/indicators';
import {
  AlertBox,
  Button,
  Card,
  Field,
  inputBaseClass,
  Modal,
  PageHeader,
  SkeletonBlock,
  useToast,
} from '../../components/ui/Primitives';

const longitudinalMeasures = [
  {field: 'clarezaPapel', name: 'Clareza de papel (1–5)', color: '#173640'},
  {field: 'apoioVinculos', name: 'Apoio e vínculos (1–5)', color: '#285D32'},
] as const;

export const AdminIndicatorsPage: React.FC = () => {
  const [data, setData] = useState<{
    indicators: ComputedIndicator[];
    longitudinalSeries: any[];
    methodologicalNote: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dimFilter, setDimFilter] = useState<'todos' | 'produto' | 'resultado' | 'impacto'>('todos');
  const [selectedIndicator, setSelectedIndicator] = useState<ComputedIndicator | null>(null);

  useEffect(() => {
    apiFetch<any>('/api/admin/indicators')
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <SkeletonBlock rows={4} />;

  const filtered =
    dimFilter === 'todos'
      ? data.indicators
      : data.indicators.filter((i) => i.dimension === dimFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Inteligência de Gestão · Produtos · Resultados · Impacto"
        title="Painel de Indicadores Estratégicos"
        description="Acompanhamento metodologicamente rigoroso da Jornada de Ambientação, PQVT, participação e melhoria contínua — distinguindo entregas operacionais, resultados percebidos e impacto de longo prazo."
        actions={
          <a
            href="/api/admin/indicators/export.csv"
            download="enap-evida-indicadores-demonstracao.csv"
            className="inline-flex items-center gap-2 rounded-lg bg-[#173640] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F272F] whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Exportar CSV (UTF-8 BOM)</span>
          </a>
        }
      />

      <AlertBox tone="warning" title="Nota metodológica obrigatória (integridade estatística)">
        {data.methodologicalNote}
      </AlertBox>

      {/* Filtro Produtos / Resultados / Impacto */}
      <div className="flex flex-wrap gap-2">
        {[
          {id: 'todos', label: `Todos (${data.indicators.length})`},
          {id: 'produto', label: 'Produtos (Entregas)'},
          {id: 'resultado', label: 'Resultados (Percepção e Vínculos)'},
          {id: 'impacto', label: 'Impacto (Longo Prazo)'},
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setDimFilter(f.id as any)}
            className={`px-3.5 py-2 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
              dimFilter === f.id
                ? 'bg-[#173640] text-white'
                : 'bg-white border border-[#E2DDD5] text-[#4A4F52]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cards de Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((ind) => (
          <Card key={ind.code} className="p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-extrabold uppercase text-[#186F80]">
                  {ind.dimension} · {ind.code}
                </span>
                <span className="text-[#5F666A] tabular-nums">n = {ind.sampleSize}</span>
              </div>
              <h2 className="text-base font-extrabold text-[#173640]">{ind.name}</h2>
              <p className="text-2xl font-extrabold text-[#285D32] tabular-nums">
                {ind.displayValue}
              </p>
              <p className="text-xs text-[#4A4F52] leading-relaxed">{ind.definition}</p>
            </div>

            <div className="pt-3 border-t border-[#ECE7DF] flex items-center justify-between gap-2 text-xs">
              <span className="text-[#5F666A]">{ind.periodicity}</span>
              <button
                type="button"
                onClick={() => setSelectedIndicator(ind)}
                className="inline-flex items-center gap-1 font-bold text-[#173640] hover:text-[#186F80] underline cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ficha metodológica</span>
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Série longitudinal demonstrativa */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#173640]" aria-hidden="true" />
          <div>
            <h2 className="text-base font-extrabold text-[#173640]">
              Evolução Longitudinal 30 · 60 · 90 dias (Série Demonstrativa Fictícia)
            </h2>
            <p className="text-xs text-[#5F666A]">
              Escala de 1 a 5 para Clareza de Papel e Apoio/Vínculos — referência científica: Bauer et al.
              (2007), Saks et al. (2007), Frögéli et al. (2023) e Donato et al. (2026).
            </p>
          </div>
        </div>
        <TimelineChart data={data.longitudinalSeries} measures={longitudinalMeasures} />
      </Card>

      {/* Modal Ficha Metodológica Completa */}
      <Modal
        open={Boolean(selectedIndicator)}
        onClose={() => setSelectedIndicator(null)}
        title={`Ficha Metodológica — ${selectedIndicator?.name || ''}`}
      >
        {selectedIndicator && (
          <div className="space-y-3 text-sm text-[#4A4F52]">
            <p>
              <strong>Código e Dimensão:</strong> {selectedIndicator.code} ({selectedIndicator.dimension.toUpperCase()})
            </p>
            <p>
              <strong>Fórmula de cálculo:</strong>{' '}
              <code className="text-xs bg-[#FAF8F4] px-1.5 py-0.5 rounded">{selectedIndicator.formula}</code>
            </p>
            <p>
              <strong>Fonte de dados:</strong> {selectedIndicator.dataSource}
            </p>
            <p>
              <strong>Periodicidade e Unidade:</strong> {selectedIndicator.periodicity} · {selectedIndicator.unit}
            </p>
            <p>
              <strong>Amostra atual (n):</strong> {selectedIndicator.sampleSize} · Status:{' '}
              <strong>{selectedIndicator.status}</strong>
            </p>
            <AlertBox tone="info" title="Limitações metodológicas e governança">
              {selectedIndicator.methodologicalLimitations}
            </AlertBox>
          </div>
        )}
      </Modal>
    </div>
  );
};

export const AdminImprovementLabPage: React.FC = () => {
  const {pushToast} = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'tabela' | 'calendario'>('kanban');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    journeyPhase: 'Acolhimento' as 'Preparação' | 'Acolhimento' | 'Aprendizagem' | 'Integração' | 'Pertencimento',
    canvasExperience: '',
    canvasNeed: '',
    canvasAction: '',
    canvasOwner: '',
    canvasEvidence: '',
    hypothesis: '',
    priority: 'alta' as 'alta' | 'media' | 'baixa',
    linkedIndicatorCode: 'IND-02',
    pilotCriteria: '',
    dueDate: '2026-08-30',
  });

  const loadPlans = useCallback(() => {
    setLoading(true);
    apiFetch<{plans: any[]}>('/api/admin/improvement-plans')
      .then((res) => setPlans(res.plans))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/improvement-plans', {
        method: 'POST',
        body: JSON.stringify({...form, status: 'descoberta'}),
      });
      pushToast('Plano de melhoria criado a partir do Canvas de Cocriação!', 'success');
      setModalOpen(false);
      loadPlans();
    } catch (err: any) {
      pushToast(err?.message || 'Preencha todas as 5 perguntas do Canvas.', 'error');
    }
  };

  const advancePlan = async (id: string, nextStatus: string) => {
    await apiFetch(`/api/admin/improvement-plans/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({status: nextStatus}),
    });
    pushToast('Etapa do plano atualizada!', 'success');
    loadPlans();
  };

  if (loading) return <SkeletonBlock rows={4} />;

  const statuses = [
    {key: 'descoberta', label: 'Descoberta'},
    {key: 'piloto', label: 'Piloto'},
    {key: 'em_execucao', label: 'Em execução'},
    {key: 'avaliacao', label: 'Avaliação'},
    {key: 'implementado', label: 'Implementado'},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Laboratório de Melhoria Contínua · Canvas de Cocriação (5 Perguntas)"
        title="Planos de Melhoria e Pilotos"
        description="Transforme evidências das jornadas, Fala, Enap! e enquetes em ciclos curtos de prototipagem e melhoria contínua baseados no Canvas da Semana de Inovação."
        actions={
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Novo Canvas de Cocriação</span>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          {id: 'kanban', label: 'Kanban', icon: Columns},
          {id: 'tabela', label: 'Tabela', icon: Table2},
          {id: 'calendario', label: 'Calendário de entregas', icon: Calendar},
        ].map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id as any)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold cursor-pointer ${
                view === v.id
                  ? 'bg-[#173640] text-white'
                  : 'bg-white border border-[#E2DDD5] text-[#4A4F52]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{v.label}</span>
            </button>
          );
        })}
      </div>

      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {statuses.map((st) => {
            const col = plans.filter((p) => p.status === st.key);
            return (
              <div key={st.key} className="rounded-xl bg-[#F2EFE9] p-3 space-y-3">
                <div className="flex items-center justify-between text-xs font-extrabold text-[#173640]">
                  <span>{st.label}</span>
                  <span className="tabular-nums">{col.length}</span>
                </div>
                {col.map((p) => (
                  <Card key={p.id} className="p-3.5 space-y-2">
                    <p className="text-[11px] font-bold text-[#186F80]">
                      {p.journey_phase} · {p.linked_indicator_code || 'Geral'}
                    </p>
                    <p className="text-xs font-extrabold text-[#173640]">{p.title}</p>
                    <p className="text-[11px] text-[#4A4F52] line-clamp-2">{p.canvas_action}</p>
                    <p className="text-[11px] text-[#5F666A]">Dono: {p.canvas_owner}</p>
                    <select
                      aria-label={`Mover plano ${p.title}`}
                      value={p.status}
                      onChange={(e) => advancePlan(p.id, e.target.value)}
                      className="w-full rounded border border-[#C5BEB2] bg-white px-2 py-1 text-[11px]"
                    >
                      {statuses.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {view === 'tabela' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF8F4] border-b border-[#E2DDD5] text-left text-[#5F666A]">
                  <th className="py-3 px-4">Iniciativa / Fase</th>
                  <th className="py-3 px-4">Ação concreta (Canvas)</th>
                  <th className="py-3 px-4">Evidência esperada</th>
                  <th className="py-3 px-4">Responsável</th>
                  <th className="py-3 px-4">Status / Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DF]">
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4">
                      <p className="font-bold text-[#173640]">{p.title}</p>
                      <p className="text-[#5F666A]">{p.journey_phase}</p>
                    </td>
                    <td className="py-3 px-4 text-[#4A4F52] max-w-xs">{p.canvas_action}</td>
                    <td className="py-3 px-4 text-[#4A4F52] max-w-xs">{p.canvas_evidence}</td>
                    <td className="py-3 px-4 text-[#4A4F52]">{p.canvas_owner}</td>
                    <td className="py-3 px-4 font-bold text-[#285D32] tabular-nums">
                      {p.status} · {p.due_date}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'calendario' && (
        <Card className="p-6 space-y-3">
          {plans.map((p) => (
            <div key={p.id} className="py-2.5 border-b border-[#ECE7DF] last:border-0 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#173640]">{p.title}</p>
                <p className="text-xs text-[#5F666A]">
                  {p.journey_phase} · {p.canvas_owner} · Critério: {p.pilot_criteria}
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-[#186F80] tabular-nums shrink-0">
                {p.due_date}
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Modal Canvas de Cocriação (5 perguntas do Slide 13) */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Canvas de Cocriação — 5 Perguntas da Jornada"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="cv-title" label="Título da iniciativa / piloto" required>
              <input
                id="cv-title"
                required
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                className={inputBaseClass}
              />
            </Field>
            <Field id="cv-phase" label="Momento da Jornada" required>
              <select
                id="cv-phase"
                value={form.journeyPhase}
                onChange={(e) => setForm({...form, journeyPhase: e.target.value as any})}
                className={inputBaseClass}
              >
                <option>Preparação</option>
                <option>Acolhimento</option>
                <option>Aprendizagem</option>
                <option>Integração</option>
                <option>Pertencimento</option>
              </select>
            </Field>
          </div>
          <Field id="cv-1" label="1. Que experiência queremos proporcionar?" required>
            <textarea
              id="cv-1"
              required
              rows={2}
              value={form.canvasExperience}
              onChange={(e) => setForm({...form, canvasExperience: e.target.value})}
              className={inputBaseClass}
            />
          </Field>
          <Field id="cv-2" label="2. O que a pessoa precisa neste momento?" required>
            <textarea
              id="cv-2"
              required
              rows={2}
              value={form.canvasNeed}
              onChange={(e) => setForm({...form, canvasNeed: e.target.value})}
              className={inputBaseClass}
            />
          </Field>
          <Field id="cv-3" label="3. Qual ação concreta realiza essa entrega?" required>
            <textarea
              id="cv-3"
              required
              rows={2}
              value={form.canvasAction}
              onChange={(e) => setForm({...form, canvasAction: e.target.value})}
              className={inputBaseClass}
            />
          </Field>
          <Field id="cv-4" label="4. Quem é responsável (dono da entrega)?" required>
            <input
              id="cv-4"
              required
              value={form.canvasOwner}
              onChange={(e) => setForm({...form, canvasOwner: e.target.value})}
              placeholder="Ex.: CGP + Chefias Imediatas"
              className={inputBaseClass}
            />
          </Field>
          <Field id="cv-5" label="5. Que evidência mostra que funcionou?" required>
            <textarea
              id="cv-5"
              required
              rows={2}
              value={form.canvasEvidence}
              onChange={(e) => setForm({...form, canvasEvidence: e.target.value})}
              className={inputBaseClass}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="cv-hyp" label="Hipótese de melhoria" required>
              <input
                id="cv-hyp"
                required
                value={form.hypothesis}
                onChange={(e) => setForm({...form, hypothesis: e.target.value})}
                className={inputBaseClass}
              />
            </Field>
            <Field id="cv-crit" label="Critério de sucesso do piloto" required>
              <input
                id="cv-crit"
                required
                value={form.pilotCriteria}
                onChange={(e) => setForm({...form, pilotCriteria: e.target.value})}
                className={inputBaseClass}
              />
            </Field>
            <Field id="cv-due" label="Prazo previsto" required>
              <input
                id="cv-due"
                type="date"
                required
                value={form.dueDate}
                onChange={(e) => setForm({...form, dueDate: e.target.value})}
                className={inputBaseClass}
              />
            </Field>
            <Field id="cv-ind" label="Indicador vinculado">
              <input
                id="cv-ind"
                value={form.linkedIndicatorCode}
                onChange={(e) => setForm({...form, linkedIndicatorCode: e.target.value})}
                className={inputBaseClass}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="secondary">
              <Lightbulb className="w-4 h-4" aria-hidden="true" />
              <span>Criar plano de melhoria</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
