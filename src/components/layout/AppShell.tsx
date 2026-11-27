import React, {useEffect, useState} from 'react';
import {Link, NavLink, useLocation, useNavigate} from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Compass,
  HeartHandshake,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareHeart,
  MoreHorizontal,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {apiFetch} from '../../lib/api';
import {ModuleExport} from './ModuleExport';
import {NewsTicker, EnapVidaLogo, OfflineIndicator, PWAInstallButton} from '../ui/BrandAssets';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{className?: string}>;
  end?: boolean;
}

const COMMUNITY_NAV: NavItem[] = [
  {to: '/app/inicio', label: 'Início', icon: Home, end: true},
  {to: '/app/jornada', label: 'Ambientação', icon: Compass},
  {to: '/app/atividades', label: 'Atividades', icon: Activity},
  {to: '/app/comite-dei', label: 'Diversidades', icon: HeartHandshake},
  {to: '/app/eventos', label: 'Calendário', icon: Calendar},
  {to: '/app/enquetes', label: 'Enquetes', icon: ClipboardCheck},
  {to: '/app/repositorio', label: 'Biblioteca', icon: BookOpen},
  {to: '/app/fala-enap', label: 'Fala, Enap!', icon: MessageSquareHeart},
  {to: '/app/perfil', label: 'Meu Perfil', icon: UserCircle2},
];

export const AppShell: React.FC<{
  children: React.ReactNode;
  mode?: 'community' | 'admin';
}> = ({children, mode = 'community'}) => {
  const {user, logout, canAdmin, hasPerm} = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{type: string; title: string; subtitle: string; path: string}>
  >([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setMobileMoreOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{notifications: Array<{is_read: number}>}>('/api/notifications')
      .then((d) => setUnreadCount(d.notifications.filter((n) => !n.is_read).length))
      .catch(() => {});
  }, [user, location.pathname]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<{results: Array<{type: string; title: string; subtitle: string; path: string}>}>(
        `/api/search?q=${encodeURIComponent(trimmed)}`,
      )
        .then((d) => {
          setSearchResults(d.results);
          setSearchOpen(true);
        })
        .catch(() => {});
    }, 220);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const adminNav: NavItem[] = [
    {to: '/admin', label: 'Painel geral', icon: LayoutDashboard, end: true},
    ...(hasPerm('preboarding:manage')
      ? [{to: '/admin/pre-ingresso', label: 'Pré-Embarque', icon: ClipboardCheck}]
      : []),
    ...(hasPerm('journey:manage')
      ? [{to: '/admin/jornadas', label: 'Jornadas', icon: Compass}]
      : []),
    ...(hasPerm('indicators:view')
      ? [{to: '/admin/indicadores', label: 'Indicadores', icon: BarChart3}]
      : []),
    ...(hasPerm('improvement:manage')
      ? [{to: '/admin/melhoria-continua', label: 'Melhoria Contínua', icon: Sparkles}]
      : []),
    ...(hasPerm('activities:manage')
      ? [{to: '/admin/atividades', label: 'Atividades', icon: Activity}]
      : []),
    ...(hasPerm('events:manage')
      ? [{to: '/admin/eventos', label: 'Calendário', icon: Calendar}]
      : []),
    ...(hasPerm('surveys:manage')
      ? [{to: '/admin/enquetes', label: 'Enquetes', icon: ClipboardCheck}]
      : []),
    ...(hasPerm('feedback:manage')
      ? [{to: '/admin/fala-enap', label: 'Fala, Enap!', icon: MessageSquareHeart}]
      : []),
    ...(hasPerm('repository:manage')
      ? [{to: '/admin/repositorio', label: 'Repositório', icon: BookOpen}]
      : []),
    ...(hasPerm('dei:manage')
      ? [{to: '/admin/comite-dei', label: 'Comitê DEI', icon: HeartHandshake}]
      : []),
    ...(hasPerm('users:manage')
      ? [{to: '/admin/usuarios', label: 'Usuários', icon: Users}]
      : []),
    ...(hasPerm('roles:view')
      ? [{to: '/admin/perfis', label: 'Perfis e Permissões', icon: ShieldCheck}]
      : []),
    ...(hasPerm('preboarding:manage_gaeg_params')
      ? [{to: '/admin/parametros', label: 'Parâmetros e Integrações', icon: Settings}]
      : []),
    ...(hasPerm('audit:view')
      ? [{to: '/admin/auditoria', label: 'Trilhas de Auditoria', icon: ShieldCheck}]
      : []),
  ];

  const activeNav = mode === 'admin' ? adminNav : COMMUNITY_NAV;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F4]">
      <a href="#conteudo-principal" className="skip-link">
        Pular para o conteúdo principal
      </a>
      <NewsTicker />

      <div className="flex flex-1 min-h-0">
        {/* Barra lateral desktop recolhível (§12) */}
        <aside
          aria-label={mode === 'admin' ? 'Navegação administrativa' : 'Navegação principal'}
          className={`sticky top-0 hidden h-dvh shrink-0 self-start flex-col bg-[#173640] text-white transition-[width] duration-200 md:flex ${
            collapsed ? 'w-[76px]' : 'w-[264px]'
          }`}
        >
          <div className={`h-16 shrink-0 flex items-center justify-between gap-1 border-b border-white/10 ${collapsed ? 'px-2' : 'px-4'}`}>
            <Link
              to={mode === 'admin' ? '/admin' : '/app/inicio'}
              className="flex items-center gap-2.5 overflow-hidden"
              aria-label="Página inicial do Enap e-Vida"
            >
              {!collapsed ? (
                <EnapVidaLogo className="max-w-36 shrink-0 brightness-0 invert" />
              ) : (
                <img
                  src={`${import.meta.env.BASE_URL}logo-icon-enap-e-vida.png`}
                  alt=""
                  width={416}
                  height={416}
                  className="size-7 shrink-0 object-contain brightness-0 invert"
                />
              )}
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white cursor-pointer"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {canAdmin && !collapsed && (
            <div className="px-3 pt-3">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-[#0F272F] p-1 text-xs font-semibold">
                <Link
                  to="/app/inicio"
                  className={`rounded-md py-1.5 text-center transition-colors ${
                    mode === 'community' ? 'bg-[#218FA3] text-white' : 'text-white/75 hover:text-white'
                  }`}
                >
                  Comunidade
                </Link>
                <Link
                  to="/admin"
                  className={`rounded-md py-1.5 text-center transition-colors ${
                    mode === 'admin' ? 'bg-[#939C22] text-[#173640]' : 'text-white/75 hover:text-white'
                  }`}
                >
                  Gestão
                </Link>
              </div>
            </div>
          )}

          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-4 space-y-1">
            {activeNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({isActive}) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#AFF0ED] text-[#173640] font-semibold'
                        : 'text-white/85 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </nav>

          <div className="shrink-0 p-3 border-t border-white/10">
            {!collapsed && user && (
              <div className="mb-2 px-2">
                <p className="text-xs font-semibold text-[#AFF0ED] truncate">{user.preferredName}</p>
                {location.pathname !== '/app/inicio' && (
                  <p className="text-[11px] text-white/70 truncate">{user.organizationalUnit}</p>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              {!collapsed && <span>Sair da conta</span>}
            </button>
          </div>
        </aside>

        {/* Coluna principal: Cabeçalho superior + Conteúdo */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E2DDD5] px-4 md:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Link to="/app/inicio" className="md:hidden flex min-w-0 items-center gap-2">
                <EnapVidaLogo className="w-full max-w-32" />
              </Link>

              {/* Busca integrada (§11) */}
              <div className="relative flex-1 max-w-md hidden sm:block">
                <label htmlFor="evida-global-search" className="sr-only">
                  Buscar atividades, eventos, documentos e enquetes
                </label>
                <Search
                  className="w-4 h-4 text-[#5F666A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="evida-global-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                  placeholder="Buscar atividades, eventos, documentos..."
                  className="w-full rounded-lg border border-[#E2DDD5] bg-[#FAF8F4] pl-9 pr-3 py-2 text-sm text-[#231F20] placeholder:text-[#6E7478] focus:bg-white focus:border-[#218FA3] focus:outline-none"
                />
                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-[#E2DDD5] bg-white shadow-xl py-2 z-40">
                    {searchResults.map((res, idx) => (
                      <button
                        key={`${res.path}-${idx}`}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                          navigate(res.path);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-[#FAF8F4] flex flex-col gap-0.5 cursor-pointer"
                      >
                        <span className="text-sm font-semibold text-[#173640]">{res.title}</span>
                        <span className="text-xs text-[#5F666A]">
                          {res.type} · {res.subtitle}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
              <PWAInstallButton compact />
              {mode === 'community' && (
                <ModuleExport key={location.pathname} module={location.pathname.split('/')[2]} />
              )}

              {canAdmin && (
                <Link
                  to={mode === 'admin' ? '/app/inicio' : '/admin'}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#C5BEB2] px-3 py-1.5 text-xs font-semibold text-[#173640] hover:bg-[#F2EFE9] whitespace-nowrap shrink-0"
                >
                  {mode === 'admin' ? 'Voltar à Comunidade' : 'Ambiente de Gestão'}
                </Link>
              )}

              <Link
                to="/app/notificacoes"
                aria-label={`Central de notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
                className="relative rounded-lg p-2 text-[#173640] hover:bg-[#F2EFE9] transition-colors"
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-[#ED2124] text-white text-[10px] font-bold flex items-center justify-center px-1 tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </Link>

              <Link
                to="/app/perfil"
                className="inline-flex items-center gap-2 rounded-lg border border-[#E2DDD5] px-2.5 py-1.5 text-sm font-semibold text-[#173640] hover:bg-[#FAF8F4] whitespace-nowrap shrink-0"
              >
                <span className="w-6 h-6 rounded-full bg-[#285D32] text-white text-xs font-bold flex items-center justify-center">
                  {user?.preferredName?.slice(0, 1).toUpperCase() || 'E'}
                </span>
                <span className="hidden lg:inline">{user?.preferredName}</span>
              </Link>
            </div>
          </header>

          <main
            id="conteudo-principal"
            className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-10"
          >
            {children}
          </main>
        </div>
      </div>

      {/* Barra inferior móvel com exatamente 5 destinos principais (§12) */}
      <nav
        aria-label="Navegação móvel principal"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2DDD5] h-14 grid grid-cols-5"
      >
        <NavLink
          to="/app/inicio"
          end
          className={({isActive}) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-[#173640] font-bold' : 'text-[#5F666A]'
            }`
          }
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          <span>Início</span>
        </NavLink>
        <NavLink
          to="/app/jornada"
          className={({isActive}) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-[#173640] font-bold' : 'text-[#5F666A]'
            }`
          }
        >
          <Compass className="w-4 h-4" aria-hidden="true" />
          <span>Ambientação</span>
        </NavLink>
        <NavLink
          to="/app/atividades"
          className={({isActive}) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-[#173640] font-bold' : 'text-[#5F666A]'
            }`
          }
        >
          <Activity className="w-4 h-4" aria-hidden="true" />
          <span>Atividades</span>
        </NavLink>
        <NavLink
          to="/app/eventos"
          className={({isActive}) =>
            `flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
              isActive ? 'text-[#173640] font-bold' : 'text-[#5F666A]'
            }`
          }
        >
          <Calendar className="w-4 h-4" aria-hidden="true" />
          <span>Calendário</span>
        </NavLink>
        <button
          type="button"
          onClick={() => setMobileMoreOpen(true)}
          aria-label="Mais módulos e configurações"
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[#5F666A] cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
          <span>Mais</span>
        </button>
      </nav>

      {/* Menu "Mais" no mobile */}
      {mobileMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-[#173640]/60 flex justify-end">
          <div className="w-80 max-w-[85vw] bg-white h-full flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[#E2DDD5] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Menu className="w-4 h-4 text-[#173640]" aria-hidden="true" />
                <span className="font-bold text-[#173640]">Todos os módulos</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                aria-label="Fechar menu"
                className="p-1.5 rounded-lg text-[#5F666A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {COMMUNITY_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({isActive}) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        isActive ? 'bg-[#AFF0ED] text-[#173640] font-bold' : 'text-[#231F20]'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
              {canAdmin && (
                <div className="pt-3 mt-3 border-t border-[#E2DDD5]">
                  <p className="px-3 pb-1 text-xs font-semibold text-[#5F666A]">
                    Ambiente Administrativo
                  </p>
                  {adminNav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({isActive}) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                            isActive ? 'bg-[#E7F4F7] text-[#173640] font-bold' : 'text-[#231F20]'
                          }`
                        }
                      >
                        <Icon className="w-4 h-4" aria-hidden="true" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-[#E2DDD5]">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#173640] py-2.5 text-sm font-semibold text-white"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Sair da conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />
    </div>
  );
};
