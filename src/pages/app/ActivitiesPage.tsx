import React, {useCallback, useEffect, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {
  Accessibility,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  QrCode,
  Star,
  User,
  Users,
} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import {PqvtCatalog} from './PqvtCatalog';
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

export const ActivitiesPage: React.FC = () => {
  const {id} = useParams();
  const {pushToast} = useToast();

  const [activities, setActivities] = useState<any[]>([]);
  const [detail, setDetail] = useState<{activity: any; myFeedback: any} | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<'todas' | 'minhas' | 'favoritas'>('todas');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [busy, setBusy] = useState(false);

  const [fbRating, setFbRating] = useState(5);
  const [fbComment, setFbComment] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    if (id) {
      apiFetch<{activity: any; myFeedback: any}>(`/api/activities/${id}`)
        .then((res) => {
          setDetail(res);
          if (res.myFeedback) {
            setFbRating(res.myFeedback.rating);
            setFbComment(res.myFeedback.comment);
          }
        })
        .finally(() => setLoading(false));
    } else {
      apiFetch<{activities: any[]}>('/api/activities')
        .then((res) => setActivities(res.activities))
        .finally(() => setLoading(false));
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegister = async (activityId: string) => {
    setBusy(true);
    try {
      const res = await apiFetch<{status: string; alreadyRegistered?: boolean}>(
        `/api/activities/${activityId}/register`,
        {method: 'POST'},
      );
      pushToast(
        res.status === 'confirmada'
          ? 'Inscrição confirmada! Código de check-in gerado.'
          : 'Vagas esgotadas no momento — você foi incluído(a) na lista de espera.',
        res.status === 'confirmada' ? 'success' : 'info',
      );
      loadData();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao inscrever.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (activityId: string) => {
    setBusy(true);
    try {
      const res = await apiFetch<{promotedWaitlist: boolean}>(
        `/api/activities/${activityId}/cancel`,
        {method: 'POST'},
      );
      pushToast(
        res.promotedWaitlist
          ? 'Inscrição cancelada. A vaga liberada promoveu automaticamente a próxima pessoa da lista de espera.'
          : 'Inscrição cancelada com sucesso.',
        'info',
      );
      loadData();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao cancelar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleFavorite = async (activityId: string) => {
    try {
      const res = await apiFetch<{favorited: boolean}>('/api/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({itemType: 'activity', itemId: activityId}),
      });
      pushToast(res.favorited ? 'Adicionada aos seus favoritos.' : 'Removida dos favoritos.', 'info');
      loadData();
    } catch {
      pushToast('Não foi possível atualizar favorito.', 'error');
    }
  };

  const handleFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    try {
      await apiFetch(`/api/activities/${id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({rating: fbRating, comment: fbComment}),
      });
      pushToast('Avaliação da atividade registrada. Obrigado por participar!', 'success');
      loadData();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao enviar avaliação.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  // VISÃO DE DETALHE DA ATIVIDADE
  if (id && detail?.activity) {
    const a = detail.activity;
    const isFull = a.enrolled_count >= a.capacity;
    const isConfirmed = a.my_status === 'confirmada';
    const isWaitlist = a.my_status === 'lista_espera';

    return (
      <div className="space-y-6">
        <Link
          to="/app/atividades"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#186F80] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Voltar para o catálogo PQVT</span>
        </Link>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-5 bg-[#FFF2DE]">
              <img
                src={a.image_url || '/src/assets/images/pqvt_bem_estar_1795080544676.jpg'}
                alt={`Ilustração da atividade ${a.title}`}
                className="w-full h-64 lg:h-full object-cover"
              />
            </div>
            <div className="lg:col-span-7 p-6 sm:p-7 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#285D32]">
                    {a.category} · {a.modality}
                  </p>
                  <h1 className="text-2xl font-extrabold text-[#173640]">{a.title}</h1>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(a.id)}
                  aria-label={a.is_favorite ? 'Remover dos favoritos' : 'Favoritar atividade'}
                  className={`p-2 rounded-lg border cursor-pointer ${
                    a.is_favorite
                      ? 'border-[#FF8500] bg-[#FFF2DE] text-[#FF8500]'
                      : 'border-[#E2DDD5] text-[#5F666A] hover:text-[#173640]'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${a.is_favorite ? 'fill-current' : ''}`} />
                </button>
              </div>

              <p className="text-sm text-[#4A4F52] leading-relaxed">{a.description}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#4A4F52] pt-2 border-t border-[#ECE7DF]">
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#186F80] shrink-0" aria-hidden="true" />
                  <span>{a.schedule_summary}</span>
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#186F80] shrink-0" aria-hidden="true" />
                  <span>{a.location}</span>
                </p>
                <p className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#186F80] shrink-0" aria-hidden="true" />
                  <span>Condução: {a.responsible_name}</span>
                </p>
                <p className="flex items-center gap-2 tabular-nums">
                  <Users className="w-4 h-4 text-[#186F80] shrink-0" aria-hidden="true" />
                  <span>
                    <strong>{a.enrolled_count}</strong> / {a.capacity} vagas ocupadas
                    {a.waitlist_count > 0 ? ` · ${a.waitlist_count} em espera` : ''}
                  </span>
                </p>
              </div>

              <div className="rounded-xl bg-[#FAF8F4] border border-[#E2DDD5] p-4 space-y-1.5 text-xs text-[#4A4F52]">
                <p className="font-bold text-[#173640] flex items-center gap-1.5">
                  <Accessibility className="w-4 h-4 text-[#285D32]" aria-hidden="true" />
                  <span>Recursos de acessibilidade</span>
                </p>
                <p>{a.accessibility_resources}</p>
                <p className="pt-1 text-[#5F666A]">
                  <strong>Orientações:</strong> {a.additional_guidelines}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {isConfirmed ? (
                  <>
                    <div className="inline-flex items-center gap-2 rounded-lg bg-[#EAF4EC] border border-[#285D32]/30 px-3.5 py-2 text-xs font-bold text-[#164A21]">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>Inscrição confirmada</span>
                    </div>
                    {a.my_checkin_code && (
                      <div className="inline-flex items-center gap-2 rounded-lg bg-[#FFF2DE] border border-[#173640]/20 px-3.5 py-2 text-xs font-mono font-bold text-[#173640]">
                        <QrCode className="w-4 h-4" aria-hidden="true" />
                        <span>Check-in: {a.my_checkin_code}</span>
                      </div>
                    )}
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => handleCancel(a.id)}>
                      Cancelar inscrição
                    </Button>
                  </>
                ) : isWaitlist ? (
                  <>
                    <div className="inline-flex items-center gap-2 rounded-lg bg-[#FEF5E6] border border-[#FF8500]/40 px-3.5 py-2 text-xs font-bold text-[#7A3E00]">
                      <span>Você está na lista de espera</span>
                    </div>
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => handleCancel(a.id)}>
                      Sair da lista de espera
                    </Button>
                  </>
                ) : (
                  <Button variant={isFull ? 'accent' : 'secondary'} disabled={busy} onClick={() => handleRegister(a.id)}>
                    <span>{isFull ? 'Entrar na lista de espera' : 'Confirmar inscrição'}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Avaliação voluntária da atividade */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-extrabold text-[#173640]">Avaliar experiência na atividade</h2>
          <p className="text-xs text-[#5F666A]">
            Sua percepção ajuda o PQVT a aprimorar horários, acessibilidade e formatos. Não coletamos
            dados clínicos, diagnósticos ou métricas biométricas.
          </p>
          <form onSubmit={handleFeedback} className="space-y-4 max-w-xl">
            <Field id="fb-rating" label="Como foi sua experiência?" required>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFbRating(n)}
                    className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-bold cursor-pointer ${
                      fbRating === n ? 'bg-[#173640] text-white' : 'bg-[#F2EFE9] text-[#4A4F52]'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{n}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field id="fb-comment" label="Comentário ou sugestão" required>
              <textarea
                id="fb-comment"
                required
                rows={3}
                value={fbComment}
                onChange={(e) => setFbComment(e.target.value)}
                placeholder="Conte o que achou da condução, espaço e acolhimento."
                className={inputBaseClass}
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {detail.myFeedback ? 'Atualizar avaliação' : 'Enviar avaliação'}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // VISÃO DE CATÁLOGO PQVT
  const categories = ['Todas', ...Array.from(new Set(activities.map((a) => a.category)))];
  const filtered = activities.filter((a) => {
    if (viewFilter === 'minhas' && !a.my_status) return false;
    if (viewFilter === 'favoritas' && !a.is_favorite) return false;
    if (categoryFilter !== 'Todas' && a.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Programa de Qualidade de Vida no Trabalho · PQVT"
        title="Atividades"
        description="Iniciativas voluntárias de bem-estar, pausa ativa, esportes coletivos, caminhadas e encontros culturais abertos à comunidade Enap."
      />

      <AlertBox tone="info" title="Convivência saudável e acessível">
        O PQVT incentiva a convivência saudável e acessível — sem rankings competitivos e sem pressão por performance.
      </AlertBox>

      <PqvtCatalog />

      <details className="space-y-4 rounded-xl border border-[#E2DDD5] bg-white p-4">
        <summary className="cursor-pointer text-sm font-bold text-[#173640]">Inscrições e favoritos do piloto</summary>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              {id: 'todas', label: 'Todas as atividades'},
              {id: 'minhas', label: 'Minhas inscrições'},
              {id: 'favoritas', label: 'Favoritas'},
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setViewFilter(v.id as any)}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                  viewFilter === v.id
                    ? 'bg-[#173640] text-white'
                    : 'bg-white border border-[#E2DDD5] text-[#4A4F52] hover:bg-[#F2EFE9]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filtrar por categoria"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-[#C5BEB2] bg-white px-3 py-2 text-sm text-[#231F20]"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="Nenhuma atividade encontrada"
            description="Ajuste os filtros selecionados para visualizar todas as atividades disponíveis no PQVT."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((a) => {
              const isFull = a.enrolled_count >= a.capacity;
              return (
                <Card key={a.id} className="overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="relative h-40 bg-[#FFF2DE]">
                      <img
                        src={a.image_url || '/src/assets/images/pqvt_bem_estar_1795080544676.jpg'}
                        alt={a.title}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(a.id)}
                        aria-label="Favoritar atividade"
                        className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/95 flex items-center justify-center text-[#173640] shadow cursor-pointer"
                      >
                        <Heart
                          className={`w-4 h-4 ${a.is_favorite ? 'fill-[#FF8500] text-[#FF8500]' : ''}`}
                        />
                      </button>
                    </div>

                    <div className="p-5 space-y-2">
                      <p className="text-xs font-bold text-[#285D32]">
                        {a.category} · {a.modality}
                      </p>
                      <h2 className="text-base font-extrabold text-[#173640]">
                        <Link to={`/app/atividades/${a.id}`} className="hover:underline">
                          {a.title}
                        </Link>
                      </h2>
                      <p className="text-xs text-[#4A4F52] line-clamp-2">{a.description}</p>
                      <div className="pt-2 space-y-1 text-xs text-[#5F666A]">
                        <p className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{a.schedule_summary}</span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">{a.location}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3.5 border-t border-[#ECE7DF] bg-[#FAF8F4] flex items-center justify-between gap-2">
                    <div className="text-xs tabular-nums">
                      <span className={`font-bold ${isFull ? 'text-[#9E4F00]' : 'text-[#285D32]'}`}>
                        {a.enrolled_count}/{a.capacity} vagas
                      </span>
                      {a.my_status && (
                        <span className="block text-[11px] font-semibold text-[#186F80]">
                          {a.my_status === 'confirmada' ? 'Você está inscrito(a)' : 'Na lista de espera'}
                        </span>
                      )}
                    </div>
                    <Link
                      to={`/app/atividades/${a.id}`}
                      className="text-xs font-extrabold text-[#173640] hover:text-[#186F80] underline whitespace-nowrap shrink-0"
                    >
                      Ver detalhes
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </details>
    </div>
  );
};
