import React, {useCallback, useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  Accessibility,
  Bell,
  Check,
  CheckCheck,
  KeyRound,
  LogOut,
  ShieldCheck,
  User,
} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import {useAuth} from '../../contexts/AuthContext';
import {ROLE_LABELS} from '../../lib/security';
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

export const NotificationsPage: React.FC = () => {
  const {pushToast} = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('todas');

  const loadData = useCallback(() => {
    setLoading(true);
    apiFetch<{notifications: any[]}>('/api/notifications')
      .then((res) => setItems(res.notifications))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markRead = async (id: string) => {
    await apiFetch(`/api/notifications/${id}/read`, {method: 'PATCH'});
    loadData();
  };

  const markAllRead = async () => {
    await apiFetch('/api/notifications/read-all', {method: 'POST'});
    pushToast('Todas as notificações foram marcadas como lidas.', 'success');
    loadData();
  };

  if (loading) return <SkeletonBlock rows={4} />;

  const categories = ['todas', ...Array.from(new Set(items.map((n) => n.category)))];
  const filtered = catFilter === 'todas' ? items : items.filter((n) => n.category === catFilter);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Central de Avisos"
        title="Notificações"
        description="Avisos essenciais da sua Jornada de Ambientação, inscrições no PQVT, eventos e enquetes — sem dados bancários ou sensíveis."
        actions={
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            <span>Marcar todas como lidas</span>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
              catFilter === c
                ? 'bg-[#173640] text-white'
                : 'bg-white border border-[#E2DDD5] text-[#4A4F52]'
            }`}
          >
            {c.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma notificação por aqui"
          description="Você está em dia com todos os avisos da sua jornada e da comunidade Enap."
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((n) => (
            <Card
              key={n.id}
              warm={!n.is_read}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <Bell className="w-3.5 h-3.5 text-[#186F80]" aria-hidden="true" />
                  <span className="font-bold uppercase text-[#186F80]">
                    {String(n.category).replace('_', ' ')}
                  </span>
                  <span className="text-[#5F666A] tabular-nums">
                    {new Date(n.created_at).toLocaleString('pt-BR')}
                  </span>
                  {!n.is_read && <span className="font-extrabold text-[#9E4F00]">· Nova</span>}
                </div>
                <p className="text-sm font-bold text-[#173640]">{n.title}</p>
                <p className="text-xs sm:text-sm text-[#4A4F52]">{n.message}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {n.link_path && (
                  <Link
                    to={n.link_path}
                    onClick={() => !n.is_read && markRead(n.id)}
                    className="text-xs font-bold text-[#173640] underline px-2 py-1"
                  >
                    Abrir
                  </Link>
                )}
                {!n.is_read && (
                  <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Lida</span>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export const ProfilePage: React.FC = () => {
  const {user, refreshUser} = useAuth();
  const {pushToast} = useToast();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [preferredName, setPreferredName] = useState('');
  const [socialName, setSocialName] = useState('');
  const [a11y, setA11y] = useState({largeText: false, highContrast: false, reducedMotion: false});
  const [notifPrefs, setNotifPrefs] = useState({
    jornada: true,
    atividades: true,
    eventos: true,
    enquetes: true,
    comunicados: true,
    emailChannel: true,
    webPushChannel: false,
  });
  const [passForm, setPassForm] = useState({currentPassword: '', newPassword: ''});
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    apiFetch('/api/profile/me')
      .then((res) => {
        setData(res);
        if (res.profile) {
          setPreferredName(res.profile.preferredName || '');
          setSocialName(res.profile.socialName || '');
          setA11y(res.profile.accessibilityPrefs);
          setNotifPrefs(res.profile.notificationPrefs);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({
          preferredName,
          socialName: socialName.trim() || null,
          accessibilityPrefs: a11y,
          notificationPrefs: notifPrefs,
        }),
      });
      await refreshUser();
      pushToast('Perfil e preferências de acessibilidade atualizados!', 'success');
      loadData();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao salvar perfil.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/api/profile/change-password', {
        method: 'POST',
        body: JSON.stringify(passForm),
      });
      pushToast('Senha alterada com sucesso!', 'success');
      setPassForm({currentPassword: '', newPassword: ''});
    } catch (err: any) {
      pushToast(err?.message || 'Não foi possível alterar a senha.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    await apiFetch(`/api/profile/sessions/${sessionId}/revoke`, {method: 'POST'});
    pushToast('Sessão revogada remotamente.', 'info');
    loadData();
  };

  if (loading || !user) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Conta, Acessibilidade e Privacidade"
        title="Meu Perfil"
        description="Gerencie seu nome de preferência, recursos de acessibilidade, preferências de notificação, sessões ativas e histórico na comunidade Enap."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dados e Preferências */}
        <Card className="lg:col-span-7 p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <User className="w-5 h-5 text-[#173640]" aria-hidden="true" />
            <h2 className="text-lg font-extrabold text-[#173640]">Identificação e Preferências</h2>
          </div>

          <div className="rounded-xl bg-[#FAF8F4] border border-[#E2DDD5] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[#5F666A] block">Nome completo (validado institucionalmente)</span>
              <strong className="text-[#173640] text-sm">{user.fullName}</strong>
            </div>
            <div>
              <span className="text-[#5F666A] block">E-mail institucional</span>
              <strong className="text-[#173640] text-sm">{user.email}</strong>
            </div>
            <div>
              <span className="text-[#5F666A] block">Unidade / Vínculo</span>
              <strong className="text-[#173640]">
                {user.organizationalUnit} · {user.employmentType}
              </strong>
            </div>
            <div>
              <span className="text-[#5F666A] block">Papéis ativos (RBAC)</span>
              <strong className="text-[#173640]">
                {user.roles.map((r) => ROLE_LABELS[r] || r).join(', ')}
              </strong>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="pf-pref" label="Como prefere ser chamado(a)" required>
                <input
                  id="pf-pref"
                  required
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  className={inputBaseClass}
                />
              </Field>
              <Field id="pf-social" label="Nome social (opcional)">
                <input
                  id="pf-social"
                  value={socialName}
                  onChange={(e) => setSocialName(e.target.value)}
                  className={inputBaseClass}
                />
              </Field>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#ECE7DF]">
              <h3 className="text-sm font-extrabold text-[#173640] flex items-center gap-1.5">
                <Accessibility className="w-4 h-4 text-[#285D32]" aria-hidden="true" />
                <span>Preferências de acessibilidade</span>
              </h3>
              {[
                {key: 'largeText', label: 'Fonte ampliada para leitura mais confortável'},
                {key: 'highContrast', label: 'Modo de alto contraste (bordas e textos reforçados)'},
                {key: 'reducedMotion', label: 'Reduzir animações e transições de tela'},
              ].map((opt) => (
                <label key={opt.key} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(a11y as any)[opt.key]}
                    onChange={(e) => setA11y({...a11y, [opt.key]: e.target.checked})}
                    className="h-4 w-4 accent-[#173640]"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#ECE7DF]">
              <h3 className="text-sm font-extrabold text-[#173640]">
                Preferências de notificações (comunicados opcionais)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {[
                  {key: 'atividades', label: 'Atividades'},
                  {key: 'eventos', label: 'Eventos da agenda'},
                  {key: 'enquetes', label: 'Novas enquetes'},
                  {key: 'comunicados', label: 'Comunicados institucionais'},
                ].map((opt) => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(notifPrefs as any)[opt.key]}
                      onChange={(e) => setNotifPrefs({...notifPrefs, [opt.key]: e.target.checked})}
                      className="h-4 w-4 accent-[#285D32]"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-[#5F666A]">
                Avisos operacionais essenciais da Jornada de Ambientação e segurança permanecem ativos.
              </p>
            </div>

            <Button type="submit" variant="secondary" disabled={busy}>
              {busy ? 'Salvando...' : 'Salvar preferências'}
            </Button>
          </form>
        </Card>

        {/* Segurança, Senha e Sessões Ativas */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-extrabold text-[#173640] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#186F80]" aria-hidden="true" />
              <span>Alterar senha</span>
            </h2>
            <form onSubmit={handlePasswordChange} className="space-y-3">
              <Field id="pw-cur" label="Senha atual" required>
                <input
                  id="pw-cur"
                  type="password"
                  required
                  value={passForm.currentPassword}
                  onChange={(e) => setPassForm({...passForm, currentPassword: e.target.value})}
                  className={inputBaseClass}
                />
              </Field>
              <Field
                id="pw-new"
                label="Nova senha"
                required
                hint="Mínimo 8 caracteres, maiúscula, minúscula e número."
              >
                <input
                  id="pw-new"
                  type="password"
                  required
                  value={passForm.newPassword}
                  onChange={(e) => setPassForm({...passForm, newPassword: e.target.value})}
                  className={inputBaseClass}
                />
              </Field>
              <Button type="submit" variant="outline" disabled={busy}>
                Atualizar senha
              </Button>
            </form>
          </Card>

          <Card className="p-6 space-y-3">
            <h2 className="text-base font-extrabold text-[#173640] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#285D32]" aria-hidden="true" />
              <span>Sessões ativas ({data?.sessions?.length || 0})</span>
            </h2>
            <div className="space-y-2.5">
              {(data?.sessions || []).map((s: any) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-[#E2DDD5] p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[#173640] truncate">
                      {s.isCurrent ? 'Sessão atual neste navegador' : 'Sessão ativa'}
                    </p>
                    <p className="text-[#5F666A] truncate">{s.user_agent}</p>
                  </div>
                  {!s.isCurrent && (
                    <Button size="sm" variant="ghost" onClick={() => revokeSession(s.id)}>
                      <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Encerrar</span>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <AlertBox tone="info" title="Seus direitos como titular de dados (LGPD)">
            Você pode solicitar confirmação de tratamento, correção de dados cadastrais ou esclarecimentos
            junto à área de gestão de pessoas e à Encarregada(o) pelo Tratamento de Dados Pessoais (DPO) da
            Enap.
          </AlertBox>
        </div>
      </div>

      {/* Resumo pessoal de inscrições */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="p-5 space-y-3">
          <h2 className="text-base font-extrabold text-[#173640]">
            Minhas inscrições no PQVT ({data?.myActivities?.length || 0})
          </h2>
          {!data?.myActivities?.length ? (
            <p className="text-sm text-[#5F666A]">Nenhuma atividade inscrita no momento.</p>
          ) : (
            <ul className="divide-y divide-[#ECE7DF] text-sm">
              {data.myActivities.map((a: any) => (
                <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                  <Link to={`/app/atividades/${a.id}`} className="font-semibold text-[#173640] hover:underline">
                    {a.title}
                  </Link>
                  <span className="text-xs font-bold text-[#285D32] capitalize">{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="text-base font-extrabold text-[#173640]">
            Meus eventos confirmados ({data?.myEvents?.length || 0})
          </h2>
          {!data?.myEvents?.length ? (
            <p className="text-sm text-[#5F666A]">Nenhum evento confirmado no momento.</p>
          ) : (
            <ul className="divide-y divide-[#ECE7DF] text-sm">
              {data.myEvents.map((e: any) => (
                <li key={e.id} className="py-2 flex items-center justify-between gap-2">
                  <Link to={`/app/eventos/${e.id}`} className="font-semibold text-[#173640] hover:underline">
                    {e.title}
                  </Link>
                  <span className="text-xs text-[#5F666A] tabular-nums">
                    {new Date(e.start_iso).toLocaleDateString('pt-BR')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};
