import React, {useCallback, useEffect, useState} from 'react';
import {Plus, Trash2} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import {
  Button,
  Card,
  Field,
  inputBaseClass,
  Modal,
  PageHeader,
  SkeletonBlock,
  useToast,
} from '../../components/ui/Primitives';

// ============================================================================
// Gestão PQVT (/admin/atividades)
// ============================================================================
export const AdminActivitiesPage: React.FC = () => {
  const {pushToast} = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Esporte e Movimento',
    modality: 'Presencial' as 'Presencial' | 'Virtual' | 'Híbrida',
    location: 'Sede Enap — Área de Convivência',
    scheduleSummary: 'Quintas-feiras, 17h30',
    nextSessionIso: '2026-06-18T17:30:00Z',
    responsibleName: 'Equipe PQVT / CGP',
    capacity: 20,
    accessibilityResources: 'Acesso sem degraus e ritmo adaptável.',
  });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{activities: any[]}>('/api/activities')
      .then((res) => setItems(res.activities))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/activities', {
        method: 'POST',
        body: JSON.stringify({...form, capacity: Number(form.capacity)}),
      });
      pushToast('Nova atividade PQVT publicada!', 'success');
      setOpen(false);
      load();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao criar atividade.', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Gestão PQVT"
        title="Atividades"
        description="Gerencie catálogo, vagas, lista de espera e acessibilidade das ações de qualidade de vida."
        actions={
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Nova atividade</span>
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF8F4] border-b border-[#E2DDD5] text-left text-xs text-[#5F666A]">
                <th className="py-3 px-4">Atividade</th>
                <th className="py-3 px-4">Categoria / Modalidade</th>
                <th className="py-3 px-4">Horário / Local</th>
                <th className="py-3 px-4">Ocupação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DF]">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="py-3 px-4 font-bold text-[#173640]">{a.title}</td>
                  <td className="py-3 px-4 text-xs text-[#4A4F52]">
                    {a.category} · {a.modality}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#4A4F52]">
                    {a.schedule_summary} · {a.location}
                  </td>
                  <td className="py-3 px-4 text-xs font-bold tabular-nums text-[#285D32]">
                    {a.enrolled_count}/{a.capacity} (espera: {a.waitlist_count})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Publicar nova atividade PQVT">
        <form onSubmit={handleCreate} className="space-y-4">
          <Field id="aa-t" label="Título" required>
            <input id="aa-t" required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className={inputBaseClass} />
          </Field>
          <Field id="aa-d" label="Descrição" required>
            <textarea id="aa-d" required rows={3} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className={inputBaseClass} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="aa-cat" label="Categoria" required>
              <input id="aa-cat" required value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className={inputBaseClass} />
            </Field>
            <Field id="aa-mod" label="Modalidade" required>
              <select id="aa-mod" value={form.modality} onChange={(e) => setForm({...form, modality: e.target.value as any})} className={inputBaseClass}>
                <option>Presencial</option>
                <option>Virtual</option>
                <option>Híbrida</option>
              </select>
            </Field>
            <Field id="aa-loc" label="Local" required>
              <input id="aa-loc" required value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} className={inputBaseClass} />
            </Field>
            <Field id="aa-sch" label="Resumo de horário" required>
              <input id="aa-sch" required value={form.scheduleSummary} onChange={(e) => setForm({...form, scheduleSummary: e.target.value})} className={inputBaseClass} />
            </Field>
            <Field id="aa-cap" label="Capacidade (vagas)" required>
              <input id="aa-cap" type="number" min={1} required value={form.capacity} onChange={(e) => setForm({...form, capacity: Number(e.target.value)})} className={inputBaseClass} />
            </Field>
            <Field id="aa-resp" label="Responsável" required>
              <input id="aa-resp" required value={form.responsibleName} onChange={(e) => setForm({...form, responsibleName: e.target.value})} className={inputBaseClass} />
            </Field>
          </div>
          <Field id="aa-acc" label="Recursos de acessibilidade" required>
            <input id="aa-acc" required value={form.accessibilityResources} onChange={(e) => setForm({...form, accessibilityResources: e.target.value})} className={inputBaseClass} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="secondary">Publicar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Gestão Eventos (/admin/eventos)
// ============================================================================
export const AdminEventsPage: React.FC = () => {
  const {pushToast} = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    sourceModule: 'institucional' as 'jornada' | 'pqvt' | 'comite_dei' | 'institucional',
    category: 'Integração Institucional',
    startIso: '2026-07-10T14:00:00Z',
    endIso: '2026-07-10T16:00:00Z',
    location: 'Auditório Enap + Microsoft Teams',
    modality: 'Híbrida' as 'Presencial' | 'Virtual' | 'Híbrida',
    organizer: 'CGP / Enap',
    capacity: 120,
    accessibilityResources: 'Intérprete de Libras e legendagem ao vivo.',
  });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{events: any[]}>('/api/events')
      .then((res) => setItems(res.events))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/events', {
        method: 'POST',
        body: JSON.stringify({...form, capacity: Number(form.capacity)}),
      });
      pushToast('Evento publicado na Calendário!', 'success');
      setOpen(false);
      load();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao publicar evento.', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Gestão de Agenda"
        title="Calendário Institucional"
        description="Publique eventos unificados para Jornada, PQVT, Comitê DEI ou toda a comunidade Enap."
        actions={
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Novo evento</span>
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF8F4] border-b border-[#E2DDD5] text-left text-xs text-[#5F666A]">
                <th className="py-3 px-4">Evento</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Confirmados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DF]">
              {items.map((ev) => (
                <tr key={ev.id}>
                  <td className="py-3 px-4 font-bold text-[#173640]">{ev.title}</td>
                  <td className="py-3 px-4 text-xs text-[#4A4F52]">{ev.source_module}</td>
                  <td className="py-3 px-4 text-xs tabular-nums text-[#4A4F52]">
                    {new Date(ev.start_iso).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-xs font-bold tabular-nums text-[#285D32]">
                    {ev.enrolled_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Publicar evento na Calendário">
        <form onSubmit={handleCreate} className="space-y-4">
          <Field id="ev-t" label="Título" required>
            <input id="ev-t" required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className={inputBaseClass} />
          </Field>
          <Field id="ev-d" label="Descrição" required>
            <textarea id="ev-d" required rows={3} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className={inputBaseClass} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="ev-src" label="Módulo de origem" required>
              <select id="ev-src" value={form.sourceModule} onChange={(e) => setForm({...form, sourceModule: e.target.value as any})} className={inputBaseClass}>
                <option value="institucional">Institucional</option>
                <option value="jornada">Jornada de Ambientação</option>
                <option value="pqvt">PQVT</option>
                <option value="comite_dei">Comitê DEI</option>
              </select>
            </Field>
            <Field id="ev-mod" label="Modalidade" required>
              <select id="ev-mod" value={form.modality} onChange={(e) => setForm({...form, modality: e.target.value as any})} className={inputBaseClass}>
                <option>Presencial</option>
                <option>Virtual</option>
                <option>Híbrida</option>
              </select>
            </Field>
            <Field id="ev-loc" label="Local" required>
              <input id="ev-loc" required value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} className={inputBaseClass} />
            </Field>
            <Field id="ev-org" label="Organização" required>
              <input id="ev-org" required value={form.organizer} onChange={(e) => setForm({...form, organizer: e.target.value})} className={inputBaseClass} />
            </Field>
          </div>
          <Field id="ev-acc" label="Recursos de acessibilidade" required>
            <input id="ev-acc" required value={form.accessibilityResources} onChange={(e) => setForm({...form, accessibilityResources: e.target.value})} className={inputBaseClass} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="secondary">Publicar evento</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Construtor de Enquetes (/admin/enquetes)
// ============================================================================
export const AdminSurveysPage: React.FC = () => {
  const {pushToast} = useToast();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    purpose: '',
    eligibleAudience: 'Toda a comunidade Enap',
    opensAt: new Date().toISOString().slice(0, 10),
    closesAt: '2026-09-30',
    anonymityMode: 'anonima' as 'anonima' | 'confidencial' | 'identificada',
    minAggregationThreshold: 10,
    privacyNotice: 'Pesquisa anônima com separação técnica entre controle de elegibilidade e respostas.',
  });
  const [questions, setQuestions] = useState<Array<{id: string; label: string; type: string; optionsText: string; required: boolean}>>([
    {
      id: 'q1',
      label: 'Como você avalia a iniciativa?',
      type: 'single_choice',
      optionsText: 'Excelente, Muito boa, Regular, Precisa melhorar',
      required: true,
    },
  ]);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{surveys: any[]}>('/api/surveys')
      .then((res) => setSurveys(res.surveys))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formattedQuestions = questions.map((q, idx) => ({
        id: `q${idx + 1}`,
        label: q.label,
        type: q.type,
        required: q.required,
        options:
          q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'likert'
            ? q.optionsText.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
      }));
      await apiFetch('/api/admin/surveys', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          minAggregationThreshold: Number(form.minAggregationThreshold),
          questions: formattedQuestions,
        }),
      });
      pushToast('Enquete publicada com sucesso!', 'success');
      setOpen(false);
      load();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao publicar enquete.', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Construtor de Pesquisas · k-Anonimato"
        title="Gestão de Enquetes"
        description="Crie consultas com controle explícito de anonimato, limiar mínimo de exibição (padrão n >= 10) e múltiplos tipos de perguntas."
        actions={
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Nova enquete</span>
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF8F4] border-b border-[#E2DDD5] text-left text-xs text-[#5F666A]">
                <th className="py-3 px-4">Título</th>
                <th className="py-3 px-4">Anonimato</th>
                <th className="py-3 px-4">Respostas / Limiar</th>
                <th className="py-3 px-4">Prazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DF]">
              {surveys.map((s) => (
                <tr key={s.id}>
                  <td className="py-3 px-4 font-bold text-[#173640]">{s.title}</td>
                  <td className="py-3 px-4 text-xs capitalize text-[#186F80] font-bold">
                    {s.anonymity_mode}
                  </td>
                  <td className="py-3 px-4 text-xs tabular-nums">
                    {s.response_count} (limiar: {s.min_aggregation_threshold})
                  </td>
                  <td className="py-3 px-4 text-xs tabular-nums text-[#5F666A]">{s.closes_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Criar nova enquete">
        <form onSubmit={handlePublish} className="space-y-4">
          <Field id="sv-t" label="Título da enquete" required>
            <input id="sv-t" required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className={inputBaseClass} />
          </Field>
          <Field id="sv-p" label="Finalidade" required>
            <textarea id="sv-p" required rows={2} value={form.purpose} onChange={(e) => setForm({...form, purpose: e.target.value})} className={inputBaseClass} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field id="sv-an" label="Modo de privacidade" required>
              <select id="sv-an" value={form.anonymityMode} onChange={(e) => setForm({...form, anonymityMode: e.target.value as any})} className={inputBaseClass}>
                <option value="anonima">Anônima (separação técnica)</option>
                <option value="confidencial">Confidencial</option>
                <option value="identificada">Identificada</option>
              </select>
            </Field>
            <Field id="sv-th" label="Limiar mínimo (n)" required>
              <input id="sv-th" type="number" min={3} value={form.minAggregationThreshold} onChange={(e) => setForm({...form, minAggregationThreshold: Number(e.target.value)})} className={inputBaseClass} />
            </Field>
            <Field id="sv-cl" label="Encerramento" required>
              <input id="sv-cl" type="date" value={form.closesAt} onChange={(e) => setForm({...form, closesAt: e.target.value})} className={inputBaseClass} />
            </Field>
          </div>
          <Field id="sv-pn" label="Aviso de privacidade" required>
            <input id="sv-pn" required value={form.privacyNotice} onChange={(e) => setForm({...form, privacyNotice: e.target.value})} className={inputBaseClass} />
          </Field>

          <div className="space-y-3 pt-2 border-t border-[#E2DDD5]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#173640]">Perguntas ({questions.length})</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setQuestions([
                    ...questions,
                    {id: `q${Date.now()}`, label: '', type: 'text', optionsText: '', required: false},
                  ])
                }
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Adicionar pergunta</span>
              </Button>
            </div>
            {questions.map((q, idx) => (
              <div key={q.id} className="p-3 rounded-lg bg-[#FAF8F4] border border-[#E2DDD5] space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    required
                    placeholder={`Texto da pergunta ${idx + 1}`}
                    value={q.label}
                    onChange={(e) => {
                      const copy = [...questions];
                      copy[idx] = {...q, label: e.target.value};
                      setQuestions(copy);
                    }}
                    className={inputBaseClass}
                  />
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions(questions.filter((_, i) => i !== idx))}
                      className="p-2 text-[#8E1113] cursor-pointer"
                      aria-label="Remover pergunta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={q.type}
                    onChange={(e) => {
                      const copy = [...questions];
                      copy[idx] = {...q, type: e.target.value};
                      setQuestions(copy);
                    }}
                    className={inputBaseClass}
                  >
                    <option value="single_choice">Escolha única</option>
                    <option value="multiple_choice">Múltipla escolha</option>
                    <option value="likert">Escala Likert</option>
                    <option value="rating">Nota (1 a 5)</option>
                    <option value="text">Texto livre</option>
                  </select>
                  {(q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'likert') && (
                    <input
                      placeholder="Opções separadas por vírgula"
                      value={q.optionsText}
                      onChange={(e) => {
                        const copy = [...questions];
                        copy[idx] = {...q, optionsText: e.target.value};
                        setQuestions(copy);
                      }}
                      className={inputBaseClass}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="secondary">Publicar enquete</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Gestão Fala, Enap! (/admin/fala-enap)
// ============================================================================
export const AdminFalaEnapPage: React.FC = () => {
  const {pushToast} = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any>(null);
  const [replyForm, setReplyForm] = useState({
    status: 'respondida',
    institutionalReply: '',
    implementedHighlight: false,
    changeSummary: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{contributions: any[]}>('/api/admin/fala-enap')
      .then((res) => setItems(res.contributions))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    try {
      await apiFetch(`/api/admin/fala-enap/${active.id}`, {
        method: 'PATCH',
        body: JSON.stringify(replyForm),
      });
      pushToast('Devolutiva salva no Fala, Enap!', 'success');
      setActive(null);
      load();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao responder.', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Gestão de Escuta Ativa"
        title="Fala, Enap! — Análise e Devolutivas"
        description="Responda contribuições da comunidade e destaque ações concluídas na vitrine 'Você participou. Veja o que mudou.'."
      />

      <div className="space-y-3">
        {items.map((c) => (
          <Card key={c.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#186F80]">
                {c.category} · Status: {c.status} · {c.preferred_name} ({c.organizational_unit})
              </p>
              <p className="text-base font-extrabold text-[#173640]">{c.title}</p>
              <p className="text-sm text-[#4A4F52]">{c.description}</p>
              {c.institutional_reply && (
                <p className="text-xs text-[#164A21] bg-[#EAF4EC] p-2.5 rounded-lg mt-2">
                  <strong>Devolutiva:</strong> {c.institutional_reply}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActive(c);
                setReplyForm({
                  status: c.status,
                  institutionalReply: c.institutional_reply || '',
                  implementedHighlight: Boolean(c.implemented_highlight),
                  changeSummary: c.change_summary || '',
                });
              }}
            >
              Responder / Destacar
            </Button>
          </Card>
        ))}
      </div>

      <Modal open={Boolean(active)} onClose={() => setActive(null)} title={`Devolutiva — ${active?.title || ''}`}>
        <form onSubmit={handleReply} className="space-y-4">
          <Field id="fr-st" label="Status" required>
            <select
              id="fr-st"
              value={replyForm.status}
              onChange={(e) => setReplyForm({...replyForm, status: e.target.value})}
              className={inputBaseClass}
            >
              <option value="em_analise">Em análise</option>
              <option value="em_avaliacao_unidade">Em avaliação na unidade</option>
              <option value="respondida">Respondida</option>
              <option value="incorporada_plano">Incorporada em plano de melhoria</option>
              <option value="encerrada">Encerrada</option>
            </select>
          </Field>
          <Field id="fr-rep" label="Devolutiva institucional" required>
            <textarea
              id="fr-rep"
              required
              rows={3}
              value={replyForm.institutionalReply}
              onChange={(e) => setReplyForm({...replyForm, institutionalReply: e.target.value})}
              className={inputBaseClass}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={replyForm.implementedHighlight}
              onChange={(e) => setReplyForm({...replyForm, implementedHighlight: e.target.checked})}
              className="h-4 w-4 accent-[#285D32]"
            />
            <span>Destacar na vitrine “Você participou. Veja o que mudou.”</span>
          </label>
          {replyForm.implementedHighlight && (
            <Field id="fr-chg" label="Resumo da mudança implementada">
              <textarea
                id="fr-chg"
                rows={2}
                value={replyForm.changeSummary}
                onChange={(e) => setReplyForm({...replyForm, changeSummary: e.target.value})}
                className={inputBaseClass}
              />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActive(null)}>Cancelar</Button>
            <Button type="submit" variant="secondary">Salvar devolutiva</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Gestão Repositório (/admin/repositorio) e Comitê DEI (/admin/comite-dei)
// ============================================================================
export const AdminRepositoryPage: React.FC = () => {
  const {pushToast} = useToast();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    authorUnit: 'CGP — Coordenação-Geral de Gestão de Pessoas',
    category: 'Guias e Manuais',
    subject: 'Ambientação e Vida Funcional',
    keywords: 'enap, guia, boas-vindas',
    format: 'Guia Digital',
    contentPreview: '',
    isRestricted: false,
  });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{documents: any[]}>('/api/repository')
      .then((res) => setDocs(res.documents))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/repository', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      pushToast('Documento publicado no Repositório Institucional!', 'success');
      setOpen(false);
      load();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao publicar documento.', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Curadoria Editorial"
        title="Gestão do Repositório"
        description="Publique materiais orientadores, normas e guias com controle de público autorizado e versionamento."
        actions={
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Publicar material</span>
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF8F4] border-b border-[#E2DDD5] text-left text-xs text-[#5F666A]">
                <th className="py-3 px-4">Título</th>
                <th className="py-3 px-4">Categoria / Unidade</th>
                <th className="py-3 px-4">Acesso</th>
                <th className="py-3 px-4">Versão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DF]">
              {docs.map((d) => (
                <tr key={d.id}>
                  <td className="py-3 px-4 font-bold text-[#173640]">{d.title}</td>
                  <td className="py-3 px-4 text-xs text-[#4A4F52]">
                    {d.category} · {d.author_unit}
                  </td>
                  <td className="py-3 px-4 text-xs font-bold text-[#186F80]">
                    {d.is_restricted ? 'Restrito' : 'Comunidade'}
                  </td>
                  <td className="py-3 px-4 text-xs tabular-nums">v{d.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Publicar material no Repositório">
        <form onSubmit={handlePublish} className="space-y-4">
          <Field id="rp-t" label="Título" required>
            <input id="rp-t" required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className={inputBaseClass} />
          </Field>
          <Field id="rp-d" label="Descrição resumida" required>
            <textarea id="rp-d" required rows={2} value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className={inputBaseClass} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="rp-cat" label="Categoria" required>
              <input id="rp-cat" required value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className={inputBaseClass} />
            </Field>
            <Field id="rp-unit" label="Unidade autora" required>
              <input id="rp-unit" required value={form.authorUnit} onChange={(e) => setForm({...form, authorUnit: e.target.value})} className={inputBaseClass} />
            </Field>
          </div>
          <Field id="rp-prev" label="Conteúdo / síntese do documento" required>
            <textarea id="rp-prev" required rows={4} value={form.contentPreview} onChange={(e) => setForm({...form, contentPreview: e.target.value})} className={inputBaseClass} />
          </Field>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRestricted}
              onChange={(e) => setForm({...form, isRestricted: e.target.checked})}
              className="h-4 w-4 accent-[#173640]"
            />
            <span>Restringir visualização a perfis administrativos autorizados</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="secondary">Publicar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const AdminDeiPage: React.FC = () => {
  const {pushToast} = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    type: 'projeto' as 'projeto' | 'campanha' | 'grupo_trabalho' | 'plano_acao',
    summary: '',
    responsibleUnit: 'Comitê DEI / CGP',
    status: 'Em execução',
    dueDate: '2026-10-30',
  });

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{projects: any[]}>('/api/comite-dei')
      .then((res) => setProjects(res.projects))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/comite-dei/projects', {
        method: 'POST',
        body: JSON.stringify({...form, deliverables: ['Entrega institucional em acompanhamento']}),
      });
      pushToast('Iniciativa DEI cadastrada!', 'success');
      setOpen(false);
      load();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao cadastrar iniciativa.', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Governança DEI"
        title="Gestão do Comitê DEI"
        description="Gerencie projetos, campanhas, grupos de trabalho e planos de ação de Diversidade, Equidade e Inclusão."
        actions={
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Nova iniciativa DEI</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <Card key={p.id} className="p-5 space-y-2">
            <p className="text-xs font-bold uppercase text-[#186F80]">
              {p.type.replace('_', ' ')} · {p.status}
            </p>
            <h2 className="text-base font-extrabold text-[#173640]">{p.title}</h2>
            <p className="text-sm text-[#4A4F52]">{p.summary}</p>
            <p className="text-xs text-[#5F666A]">Responsável: {p.responsible_unit}</p>
          </Card>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Cadastrar iniciativa do Comitê DEI">
        <form onSubmit={handleCreate} className="space-y-4">
          <Field id="dei-t" label="Título da iniciativa" required>
            <input id="dei-t" required value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className={inputBaseClass} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="dei-tp" label="Tipo" required>
              <select id="dei-tp" value={form.type} onChange={(e) => setForm({...form, type: e.target.value as any})} className={inputBaseClass}>
                <option value="projeto">Projeto</option>
                <option value="campanha">Campanha</option>
                <option value="grupo_trabalho">Grupo de Trabalho</option>
                <option value="plano_acao">Plano de Ação</option>
              </select>
            </Field>
            <Field id="dei-st" label="Situação" required>
              <input id="dei-st" required value={form.status} onChange={(e) => setForm({...form, status: e.target.value})} className={inputBaseClass} />
            </Field>
          </div>
          <Field id="dei-s" label="Síntese" required>
            <textarea id="dei-s" required rows={3} value={form.summary} onChange={(e) => setForm({...form, summary: e.target.value})} className={inputBaseClass} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="secondary">Cadastrar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
