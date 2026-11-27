import React, {useCallback, useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {ArrowLeft, BarChart3, CheckCircle2, Lock, ShieldCheck} from 'lucide-react';
import {HorizontalBarChart} from '../../components/ui/InstitutionalCharts';
import {apiFetch} from '../../lib/api';
import {
  AlertBox,
  Button,
  Card,
  EmptyState,
  Field,
  inputBaseClass,
  PageHeader,
  SkeletonBlock,
  useToast,
} from '../../components/ui/Primitives';

const ANONYMITY_LABELS: Record<string, {label: string; note: string}> = {
  anonima: {
    label: 'Efetivamente Anônima',
    note: 'O registro de participação (anti-duplicidade) é gravado em tabela separada das respostas, sem vínculo com seu usuário.',
  },
  confidencial: {
    label: 'Confidencial',
    note: 'Acesso restrito à equipe autorizada de análise; resultados divulgados apenas de forma agregada.',
  },
  identificada: {
    label: 'Identificada',
    note: 'Respostas vinculadas à conta participante para fins de organização de ações.',
  },
};

export const SurveysPage: React.FC = () => {
  const {id} = useParams();
  const {pushToast} = useToast();

  const [surveys, setSurveys] = useState<any[]>([]);
  const [detail, setDetail] = useState<{survey: any; aggregates: any} | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    if (id) {
      apiFetch<{survey: any; aggregates: any}>(`/api/surveys/${id}`)
        .then((res) => setDetail(res))
        .finally(() => setLoading(false));
    } else {
      apiFetch<{surveys: any[]}>('/api/surveys')
        .then((res) => setSurveys(res.surveys))
        .finally(() => setLoading(false));
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !detail?.survey) return;

    // Validar perguntas obrigatórias visíveis
    for (const q of detail.survey.questions || []) {
      if (q.conditionalOn) {
        const triggerVal = answers[q.conditionalOn.questionId];
        if (triggerVal !== q.conditionalOn.equals) continue;
      }
      if (q.required) {
        const v = answers[q.id];
        if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) {
          pushToast(`Responda a pergunta obrigatória: "${q.label}"`, 'error');
          return;
        }
      }
    }

    setBusy(true);
    try {
      await apiFetch(`/api/surveys/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({answers}),
      });
      pushToast('Participação registrada com sucesso! Obrigado por contribuir.', 'success');
      loadData();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao registrar resposta.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  // DETALHE / RESPONDER / RESULTADOS AGREGADOS
  if (id && detail?.survey) {
    const s = detail.survey;
    const agg = detail.aggregates;
    const modeInfo = ANONYMITY_LABELS[s.anonymity_mode] || ANONYMITY_LABELS.confidencial;

    return (
      <div className="space-y-6">
        <Link
          to="/app/enquetes"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#186F80] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Voltar para todas as enquetes</span>
        </Link>

        <Card className="p-6 sm:p-7 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#186F80]">
              {modeInfo.label} · Versão {s.version} · Encerramento:{' '}
              {new Date(`${s.closes_at}T12:00:00Z`).toLocaleDateString('pt-BR')}
            </p>
            <h1 className="text-2xl font-extrabold text-[#173640]">{s.title}</h1>
            <p className="text-sm text-[#4A4F52]">{s.purpose}</p>
          </div>

          <AlertBox tone="info" title={`Aviso de privacidade — Modo ${modeInfo.label}`}>
            <p>{s.privacy_notice}</p>
            <p className="text-xs mt-1 opacity-90">{modeInfo.note}</p>
          </AlertBox>

          {s.alreadyAnswered ? (
            <AlertBox tone="success" title="Sua participação já foi registrada">
              Obrigado por contribuir! Confira abaixo os resultados agregados (sujeitos ao limiar mínimo
              de privacidade).
            </AlertBox>
          ) : s.status !== 'aberta' ? (
            <AlertBox tone="warning" title="Enquete encerrada">
              O prazo de respostas foi finalizado. Consulte abaixo os resultados consolidados.
            </AlertBox>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              {(s.questions || []).map((q: any, idx: number) => {
                if (q.conditionalOn && answers[q.conditionalOn.questionId] !== q.conditionalOn.equals) {
                  return null;
                }
                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] p-4 space-y-3"
                  >
                    <p className="text-sm font-bold text-[#173640]">
                      {idx + 1}. {q.label}
                      {q.required && <span className="text-[#8E1113] ml-1">*</span>}
                    </p>

                    {(q.type === 'single_choice' || q.type === 'likert') && (
                      <div className="space-y-2">
                        {(q.options || []).map((opt: string) => (
                          <label
                            key={opt}
                            className="flex items-center gap-2.5 text-sm text-[#231F20] cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={q.id}
                              checked={answers[q.id] === opt}
                              onChange={() => setAnswers({...answers, [q.id]: opt})}
                              className="h-4 w-4 accent-[#173640]"
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {q.type === 'multiple_choice' && (
                      <div className="space-y-2">
                        {(q.options || []).map((opt: string) => {
                          const current: string[] = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                          const checked = current.includes(opt);
                          return (
                            <label
                              key={opt}
                              className="flex items-center gap-2.5 text-sm text-[#231F20] cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? current.filter((x) => x !== opt)
                                    : [...current, opt];
                                  setAnswers({...answers, [q.id]: next});
                                }}
                                className="h-4 w-4 accent-[#285D32]"
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {q.type === 'rating' && (
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAnswers({...answers, [q.id]: n})}
                            className={`h-10 w-10 rounded-lg font-bold text-sm cursor-pointer ${
                              answers[q.id] === n
                                ? 'bg-[#173640] text-white'
                                : 'bg-white border border-[#C5BEB2] text-[#4A4F52]'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}

                    {q.type === 'numeric' && (
                      <input
                        type="number"
                        value={answers[q.id] ?? ''}
                        onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                        className={`${inputBaseClass} max-w-xs`}
                      />
                    )}

                    {q.type === 'text' && (
                      <Field id={`q-${q.id}`} label="Sua resposta">
                        <textarea
                          id={`q-${q.id}`}
                          rows={3}
                          value={answers[q.id] || ''}
                          onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                          placeholder="Escreva sua percepção ou sugestão..."
                          className={inputBaseClass}
                        />
                      </Field>
                    )}
                  </div>
                );
              })}

              <Button type="submit" size="lg" variant="secondary" disabled={busy}>
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>{busy ? 'Enviando resposta...' : 'Enviar participação'}</span>
              </Button>
            </form>
          )}
        </Card>

        {/* Resultados Agregados com Supressão k-Anonimato (n < 10) */}
        {agg && (
          <Card className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#173640]" aria-hidden="true" />
                <h2 className="text-lg font-extrabold text-[#173640]">Resultados Agregados</h2>
              </div>
              <span className="text-xs font-bold text-[#5F666A] tabular-nums">
                Total de respostas: {agg.totalResponses} · Limiar mínimo: {agg.threshold}
              </span>
            </div>

            {agg.suppressed ? (
              <AlertBox tone="warning" title="Proteção contra reidentificação ativa (k-anonimato)">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{agg.suppressionReason}</span>
                </div>
              </AlertBox>
            ) : (
              <div className="space-y-6">
                {(agg.questionSummaries || []).map((qs: any) => (
                  <div key={qs.questionId} className="space-y-3 pb-5 border-b border-[#ECE7DF] last:border-0">
                    <h3 className="text-sm font-bold text-[#173640]">{qs.label}</h3>
                    {qs.data ? (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                        <div className="lg:col-span-7 min-w-0">
                          <HorizontalBarChart data={qs.data} category="name" value="value"
                            label={'Respostas — ' + qs.label} color="#173640" />
                        </div>
                        <div className="lg:col-span-5">
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-[#E2DDD5] text-left text-[#5F666A]">
                                <th className="py-1.5">Opção</th>
                                <th className="py-1.5 text-right">n</th>
                                <th className="py-1.5 text-right">%</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#ECE7DF] tabular-nums">
                              {qs.data.map((row: any) => (
                                <tr key={row.name}>
                                  <td className="py-1.5 pr-2 text-[#231F20]">{row.name}</td>
                                  <td className="py-1.5 text-right font-semibold">{row.value}</td>
                                  <td className="py-1.5 text-right font-bold text-[#173640]">
                                    {row.percent}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : qs.average !== undefined ? (
                      <p className="text-sm font-bold text-[#285D32] tabular-nums">
                        Média agregada: {qs.average ?? 'Sem respostas suficientes'} ({qs.responsesCount}{' '}
                        respostas)
                      </p>
                    ) : (
                      <p className="text-xs text-[#5F666A]">
                        {qs.textResponsesCount} respostas abertas registradas · {qs.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    );
  }

  // LISTA DE ENQUETES
  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Escuta Estruturada · Privacidade Garantida"
        title="Enquetes"
        description="Participe de consultas rápidas sobre bem-estar, ambientação, eventos e políticas internas. Pesquisas anônimas separam tecnicamente sua conta das respostas e suprimem recortes abaixo de 10 participantes."
      />

      {surveys.length === 0 ? (
        <EmptyState
          title="Nenhuma enquete publicada"
          description="Novas consultas serão anunciadas nesta página e na central de notificações."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {surveys.map((s) => (
            <Card key={s.id} className="p-6 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[#186F80] capitalize">
                    Pesquisa {s.anonymity_mode} · {s.status}
                  </span>
                  <span className="text-[#5F666A] tabular-nums">
                    {s.response_count} respostas (limiar: {s.min_aggregation_threshold})
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-[#173640]">
                  <Link to={`/app/enquetes/${s.id}`} className="hover:underline">
                    {s.title}
                  </Link>
                </h2>
                <p className="text-sm text-[#4A4F52]">{s.purpose}</p>
                <p className="text-xs text-[#5F666A] tabular-nums">
                  Público: {s.eligible_audience} · Encerra em{' '}
                  {new Date(`${s.closes_at}T12:00:00Z`).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#ECE7DF]">
                {s.already_answered ? (
                  <span className="text-xs font-bold text-[#285D32] inline-flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    Você já respondeu
                  </span>
                ) : (
                  <span className="text-xs text-[#5F666A]">Participação aberta</span>
                )}
                <Link
                  to={`/app/enquetes/${s.id}`}
                  className="text-sm font-extrabold text-[#173640] hover:text-[#186F80] underline"
                >
                  {s.already_answered ? 'Ver resultados' : 'Responder agora'}
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
