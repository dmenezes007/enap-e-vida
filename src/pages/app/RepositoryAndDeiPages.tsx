import React, {useCallback, useEffect, useState} from 'react';
import {Link, useSearchParams} from 'react-router-dom';
import {
  Accessibility,
  BookOpen,
  ExternalLink,
  FileText,
  Heart,
  History,
  Lock,
  Search,
  Users,
} from 'lucide-react';
import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {apiFetch} from '../../lib/api';
import {
  AlertBox,
  Button,
  Card,
  EmptyState,
  inputBaseClass,
  Modal,
  PageHeader,
  SkeletonBlock,
  useToast,
} from '../../components/ui/Primitives';

export const RepositoryPage: React.FC = () => {
  const {pushToast} = useToast();
  const [searchParams] = useSearchParams();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [activeDoc, setActiveDoc] = useState<any>(null);

  const loadDocs = useCallback(() => {
    setLoading(true);
    apiFetch<{documents: any[]}>('/api/repository')
      .then((res) => {
        setDocs(res.documents);
        const paramId = searchParams.get('doc');
        if (paramId) {
          const found = res.documents.find((d) => d.id === paramId);
          if (found) setActiveDoc(found);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const toggleFav = async (docId: string) => {
    try {
      const res = await apiFetch<{favorited: boolean}>('/api/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({itemType: 'document', itemId: docId}),
      });
      pushToast(res.favorited ? 'Documento salvo nos favoritos.' : 'Removido dos favoritos.', 'info');
      loadDocs();
    } catch {
      pushToast('Erro ao atualizar favorito.', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  const categories = ['Todas', ...Array.from(new Set(docs.map((d) => d.category)))];
  const filtered = docs.filter((d) => {
    if (onlyFavs && !d.is_favorite) return false;
    if (category !== 'Todas' && d.category !== category) return false;
    if (query.trim().length >= 2) {
      const q = query.toLowerCase();
      return (
        String(d.title).toLowerCase().includes(q) ||
        String(d.description).toLowerCase().includes(q) ||
        String(d.keywords).toLowerCase().includes(q) ||
        String(d.subject).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const versions = activeDoc?.versions_history_json
    ? (JSON.parse(activeDoc.versions_history_json) as Array<{version: string; date: string; note: string}>)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Conhecimento Institucional · Normas · Manuais"
        title="Repositório de Materiais"
        description="Acesse guias de ambientação, resoluções vigentes (como o PGD Resolução Enap nº 76/2025), cartilhas de diversidade, manuais de ética e documentos de apoio com histórico de versões."
      />

      <Card className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-[#5F666A] absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, assunto ou palavra-chave (ex.: PGD, ética, diversidade)..."
            className={`${inputBaseClass} pl-9`}
          />
        </div>
        <select
          aria-label="Filtrar por categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-[#C5BEB2] bg-white px-3 py-2.5 text-sm text-[#231F20]"
        >
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button
          variant={onlyFavs ? 'primary' : 'outline'}
          onClick={() => setOnlyFavs((v) => !v)}
        >
          <Heart className={`w-4 h-4 ${onlyFavs ? 'fill-current' : ''}`} aria-hidden="true" />
          <span>Favoritos</span>
        </Button>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum documento encontrado"
          description="Tente outros termos de busca ou remova os filtros ativos."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((d) => (
            <Card key={d.id} className="p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-bold text-[#186F80]">
                    {d.category} · {d.format} · v{d.version}
                    {d.is_restricted ? ' · Acesso Restrito' : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleFav(d.id)}
                    aria-label="Favoritar documento"
                    className="p-1 text-[#5F666A] hover:text-[#FF8500] cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${d.is_favorite ? 'fill-[#FF8500] text-[#FF8500]' : ''}`}
                    />
                  </button>
                </div>
                <h2 className="text-base font-extrabold text-[#173640] flex items-start gap-2">
                  {d.is_restricted ? (
                    <Lock className="w-4 h-4 text-[#9E4F00] mt-1 shrink-0" aria-hidden="true" />
                  ) : (
                    <FileText className="w-4 h-4 text-[#285D32] mt-1 shrink-0" aria-hidden="true" />
                  )}
                  <span>{d.title}</span>
                </h2>
                <p className="text-xs sm:text-sm text-[#4A4F52]">{d.description}</p>
                <p className="text-[11px] text-[#5F666A]">
                  Unidade autora: <strong>{d.author_unit}</strong> · Atualizado em{' '}
                  {new Date(`${d.updated_at}T12:00:00Z`).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#ECE7DF]">
                <span className="text-[11px] text-[#5F666A] truncate max-w-[65%]">
                  {d.source_label}
                </span>
                <Button size="sm" variant="outline" onClick={() => setActiveDoc(d)}>
                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Abrir material</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(activeDoc)}
        onClose={() => setActiveDoc(null)}
        title={activeDoc?.title || 'Documento'}
      >
        {activeDoc && (
          <div className="space-y-4 text-sm text-[#4A4F52]">
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#FAF8F4] p-3.5 rounded-xl border border-[#E2DDD5]">
              <div>
                <span className="text-[#5F666A] block">Unidade responsável</span>
                <strong className="text-[#173640]">{activeDoc.author_unit}</strong>
              </div>
              <div>
                <span className="text-[#5F666A] block">Versão / Público</span>
                <strong className="text-[#173640]">
                  v{activeDoc.version} · {activeDoc.authorized_audience}
                </strong>
              </div>
              <div>
                <span className="text-[#5F666A] block">Assunto</span>
                <strong className="text-[#173640]">{activeDoc.subject}</strong>
              </div>
              <div>
                <span className="text-[#5F666A] block">Fonte / Referência</span>
                <strong className="text-[#173640]">{activeDoc.source_label}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="font-bold text-[#173640]">Conteúdo e Síntese de Consulta</h3>
              <p className="leading-relaxed text-[#231F20]">{activeDoc.content_preview}</p>
            </div>

            {versions.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-[#E2DDD5]">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#5F666A] flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Histórico de versões</span>
                </h3>
                <ul className="space-y-1.5 text-xs">
                  {versions.map((v, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <span>
                        <strong>v{v.version}</strong> — {v.note}
                      </span>
                      <span className="text-[#5F666A] tabular-nums shrink-0">{v.date}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export const ComiteDeiPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/comite-dei')
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock rows={4} />;

  const metrics = data?.rgi2025AggregatedMetrics;
  const projects = data?.projects || [];
  const events = data?.events || [];
  const documents = data?.documents || [];

  return (
    <div className="space-y-7">
      <PageHeader
        kicker="Diversidade · Equidade · Inclusão"
        title="Comitê de Diversidades, Equidade e Inclusão (Comitê DEI)"
        description="Espaço institucional dedicado à equidade racial, de gênero, acessibilidade, inclusão e respeito à pluralidade na Enap."
      />

      {/* Banner editorial inspirado no RGI 2025 */}
      <div className="rounded-2xl overflow-hidden border border-[#E2DDD5] bg-white">
        <img
          src="/src/assets/images/comite_dei_banner_1795080544677.jpg"
          alt="Ilustração inclusiva representando a pluralidade da comunidade Enap e a biodiversidade brasileira"
          className="w-full h-52 sm:h-64 object-cover"
        />
        <div className="p-5 sm:p-6 space-y-2">
          <h2 className="text-lg font-extrabold text-[#173640]">
            Identidade, atuação e transparência institucional
          </h2>
          <p className="text-sm text-[#4A4F52] leading-relaxed">
            A Enap adota <strong>Diversidade</strong> como valor institucional expresso no Relatório de
            Gestão Integrado 2025 (RGI 2025). Este espaço reúne projetos, campanhas, grupos de trabalho,
            eventos formativos e materiais orientadores do Comitê DEI.
          </p>
          <p className="text-xs text-[#5F666A]">
            Nota editorial: A denominação estatutária exata, composição nominal vigente e ato normativo de
            instituição do Comitê são mantidos como metadados configuráveis sujeitos à confirmação formal
            da governança da Enap.
          </p>
        </div>
      </div>

      {/* Indicadores agregados do RGI 2025 (págs. 16-17) */}
      {metrics && (
        <section aria-labelledby="sec-rgi-dei" className="space-y-4">
          <div>
            <h2 id="sec-rgi-dei" className="text-lg font-extrabold text-[#173640]">
              Retrato Agregado da Força de Trabalho e PGD (RGI 2025)
            </h2>
            <p className="text-xs text-[#5F666A]">{metrics.sourceNote}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 space-y-1">
              <p className="text-xs text-[#5F666A]">Força de trabalho ativa</p>
              <p className="text-2xl font-extrabold text-[#173640] tabular-nums">
                {metrics.workforceTotalActive}
              </p>
              <p className="text-[11px] text-[#4A4F52] tabular-nums">
                {metrics.workforceInExercise} em exercício na Enap
              </p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-xs text-[#5F666A]">Mulheres em exercício</p>
              <p className="text-2xl font-extrabold text-[#285D32] tabular-nums">59%</p>
              <p className="text-[11px] text-[#4A4F52] tabular-nums">234 mulheres · 162 homens (41%)</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-xs text-[#5F666A]">Mulheres na liderança</p>
              <p className="text-2xl font-extrabold text-[#186F80] tabular-nums">62%</p>
              <p className="text-[11px] text-[#4A4F52]">Cargos e funções de liderança (RGI 2025)</p>
            </Card>
            <Card className="p-4 space-y-1">
              <p className="text-xs text-[#5F666A]">Pessoas negras na liderança</p>
              <p className="text-2xl font-extrabold text-[#9E4F00] tabular-nums">
                {metrics.leadershipBlackPercent}%
              </p>
              <p className="text-[11px] text-[#4A4F52]">Dado institucional agregado (RGI 2025)</p>
            </Card>
          </div>

          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-extrabold text-[#173640]">
              Distribuição do Programa de Gestão e Desempenho — PGD (293 participantes · RGI 2025)
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.pgdDistribution} layout="vertical" margin={{left: 20, right: 24}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DC" />
                  <XAxis type="number" tick={{fontSize: 12}} />
                  <YAxis type="category" dataKey="label" width={175} tick={{fontSize: 12, fill: '#231F20'}} />
                  <Tooltip />
                  <Bar dataKey="count" name="Participantes" fill="#285D32" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>
      )}

      {/* Projetos, campanhas e grupos de trabalho */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#173640]" aria-hidden="true" />
          <h2 className="text-lg font-extrabold text-[#173640]">
            Iniciativas, Campanhas e Grupos de Trabalho
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.map((p: any) => {
            const deliverables: string[] = p.deliverables_json ? JSON.parse(p.deliverables_json) : [];
            return (
              <Card key={p.id} className="p-5 space-y-2.5">
                <p className="text-xs font-bold text-[#186F80] uppercase">
                  {p.type.replace('_', ' ')} · {p.status}
                </p>
                <h3 className="text-base font-extrabold text-[#173640]">{p.title}</h3>
                <p className="text-xs sm:text-sm text-[#4A4F52]">{p.summary}</p>
                {deliverables.length > 0 && (
                  <ul className="text-xs text-[#5F666A] list-disc list-inside space-y-1 pt-1">
                    {deliverables.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Eventos DEI + Materiais + Canais oficiais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 space-y-3">
          <h2 className="text-base font-extrabold text-[#173640]">Agenda do Comitê DEI</h2>
          {events.length === 0 ? (
            <p className="text-sm text-[#5F666A]">Nenhum evento agendado no momento.</p>
          ) : (
            <div className="divide-y divide-[#ECE7DF]">
              {events.map((ev: any) => (
                <Link
                  key={ev.id}
                  to={`/app/eventos/${ev.id}`}
                  className="block py-3 first:pt-0 hover:text-[#186F80]"
                >
                  <p className="text-sm font-bold text-[#173640]">{ev.title}</p>
                  <p className="text-xs text-[#5F666A] tabular-nums">
                    {new Date(ev.start_iso).toLocaleDateString('pt-BR')} · {ev.location}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Accessibility className="w-5 h-5 text-[#285D32]" aria-hidden="true" />
            <h2 className="text-base font-extrabold text-[#173640]">
              Acessibilidade, Materiais e Canais de Acolhimento
            </h2>
          </div>
          {documents.map((doc: any) => (
            <Link
              key={doc.id}
              to={`/app/repositorio?doc=${doc.id}`}
              className="block rounded-lg border border-[#E2DDD5] p-3 hover:bg-[#FAF8F4]"
            >
              <p className="text-sm font-bold text-[#173640]">{doc.title}</p>
              <p className="text-xs text-[#5F666A]">{doc.author_unit}</p>
            </Link>
          ))}
          <AlertBox tone="warning" title="Canais oficiais de prevenção e enfrentamento ao assédio">
            Situações de discriminação, assédio moral ou sexual devem ser acolhidas pelos canais formais
            da Ouvidoria (<strong>ouvidoria@enap.gov.br</strong>) e da plataforma{' '}
            <a
              href="https://falabr.cgu.gov.br"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-bold inline-flex items-center gap-1"
            >
              Fala.BR <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
            , com sigilo e respaldo normativo.
          </AlertBox>
        </Card>
      </div>
    </div>
  );
};
