import React, {useCallback, useEffect, useState} from 'react';
import {CheckCircle2, ExternalLink, MessageSquarePlus, Sparkles} from 'lucide-react';
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

const CATEGORIES = [
  'Jornada de Ambientação',
  'PQVT · Atividades e Bem-Estar',
  'Infraestrutura e Espaços de Trabalho',
  'Comunicação Interna e Repositório',
  'Diversidade, Equidade e Inclusão',
  'Eventos e Integração',
  'Outras sugestões',
];

const STATUS_LABELS: Record<string, string> = {
  recebida: 'Recebida',
  em_analise: 'Em análise',
  em_avaliacao_unidade: 'Em avaliação na unidade',
  respondida: 'Respondida',
  incorporada_plano: 'Incorporada em plano de melhoria',
  encerrada: 'Encerrada',
};

export const FalaEnapPage: React.FC = () => {
  const {pushToast} = useToast();
  const [data, setData] = useState<{myContributions: any[]; whatChanged: any[]} | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({category: CATEGORIES[0], title: '', description: ''});

  const loadData = useCallback(() => {
    setLoading(true);
    apiFetch<{myContributions: any[]; whatChanged: any[]}>('/api/fala-enap')
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/fala-enap', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      pushToast('Contribuição registrada no Fala, Enap! Obrigado por participar.', 'success');
      setForm({category: CATEGORIES[0], title: '', description: ''});
      loadData();
    } catch (err: any) {
      pushToast(err?.message || 'Verifique os campos da contribuição.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-7">
      <PageHeader
        kicker="Escuta Participativa · Diálogo Contínuo"
        title="Fala, Enap!"
        description="Sua voz ajuda a construir uma Enap cada vez melhor. Envie sugestões, ideias e percepções sobre a vida institucional e acompanhe o que mudou."
      />

      {/* Separação clara da Ouvidoria / Fala.BR (§15) */}
      <AlertBox tone="warning" title="Separação clara entre Fala, Enap! e Ouvidoria Oficial">
        O <strong>Fala, Enap!</strong> é um canal interno de sugestões, ideias e melhoria da experiência
        na Escola. <strong>Não substitui a Ouvidoria nem o canal de denúncias.</strong> Para denúncias,
        reclamações formais, relatos de assédio ou pedidos da Lei de Acesso à Informação (LAI), utilize a
        Ouvidoria da Enap (<strong>ouvidoria@enap.gov.br</strong>) ou a plataforma oficial{' '}
        <a
          href="https://falabr.cgu.gov.br"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-bold inline-flex items-center gap-1"
        >
          Fala.BR <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
        .
      </AlertBox>

      {/* Vitrine "Você participou. Veja o que mudou." */}
      <section aria-labelledby="sec-mudou" className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#FF8500]" aria-hidden="true" />
          <h2 id="sec-mudou" className="text-lg font-extrabold text-[#173640]">
            Você participou. Veja o que mudou.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data?.whatChanged || []).map((item) => (
            <Card key={item.id} warm className="p-5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#285D32]">{item.category}</span>
                <span className="text-[#5F666A] tabular-nums">
                  {new Date(item.updated_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-[#173640]">{item.title}</h3>
              <p className="text-sm text-[#231F20] leading-relaxed">{item.change_summary}</p>
              {item.institutional_reply && (
                <p className="text-xs text-[#4A4F52] pt-2 border-t border-[#E2DDD5]">
                  <strong>Devolutiva:</strong> {item.institutional_reply}
                </p>
              )}
            </Card>
          ))}
        </div>
      </section>

      {/* Formulário + Minhas contribuições */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-6 p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-[#173640]">Enviar nova contribuição</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field id="fe-cat" label="Tema da contribuição" required>
              <select
                id="fe-cat"
                value={form.category}
                onChange={(e) => setForm({...form, category: e.target.value})}
                className={inputBaseClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field id="fe-title" label="Título objetivo" required>
              <input
                id="fe-title"
                required
                value={form.title}
                onChange={(e) => setForm({...form, title: e.target.value})}
                placeholder="Ex.: Ampliar horários das oficinas de ergonomia para equipes em PGD"
                className={inputBaseClass}
              />
            </Field>
            <Field id="fe-desc" label="Detalhamento da ideia ou sugestão" required>
              <textarea
                id="fe-desc"
                required
                rows={4}
                value={form.description}
                onChange={(e) => setForm({...form, description: e.target.value})}
                placeholder="Descreva o contexto, sua proposta e como ela pode beneficiar a comunidade Enap."
                className={inputBaseClass}
              />
            </Field>
            <Button type="submit" variant="secondary" disabled={busy}>
              <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
              <span>{busy ? 'Enviando...' : 'Enviar contribuição'}</span>
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-6 p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-[#173640]">
            Minhas contribuições ({data?.myContributions?.length || 0})
          </h2>
          {!data?.myContributions?.length ? (
            <EmptyState
              title="Nenhuma contribuição enviada ainda"
              description="Quando você enviar uma sugestão ou ideia, poderá acompanhar cada etapa da análise e a devolutiva por aqui."
            />
          ) : (
            <div className="space-y-3">
              {data.myContributions.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-[#E2DDD5] bg-[#FAF8F4] p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[#186F80]">{c.category}</span>
                    <span className="font-bold text-[#285D32] inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#173640]">{c.title}</p>
                  <p className="text-xs text-[#4A4F52]">{c.description}</p>
                  {c.institutional_reply && (
                    <p className="text-xs text-[#164A21] bg-[#EAF4EC] p-2.5 rounded-lg mt-2">
                      <strong>Devolutiva institucional:</strong> {c.institutional_reply}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
