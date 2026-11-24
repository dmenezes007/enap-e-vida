import React, {useEffect} from 'react';
import {BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate} from 'react-router-dom';
import {AuthProvider, useAuth} from './contexts/AuthContext';
import type {PermissionCode} from './lib/types';
import {AppShell} from './components/layout/AppShell';
import {AlertBox, Button, SkeletonBlock, ToastProvider} from './components/ui/Primitives';

// Public pages
import {LandingLoginPage} from './pages/public/LandingLoginPage';
import {PreboardingFlowPage} from './pages/public/PreboardingFlowPage';
import {RecoverPasswordPage, RegisterPage} from './pages/public/RegisterAndRecoveryPages';

// Community pages
import {HomePage} from './pages/app/HomePage';
import {JourneyPage} from './pages/app/JourneyPage';
import {ActivitiesPage} from './pages/app/ActivitiesPage';
import {EventsPage} from './pages/app/EventsPage';
import {FalaEnapPage} from './pages/app/FalaEnapPage';
import {SurveysPage} from './pages/app/SurveysPage';
import {ComiteDeiPage, RepositoryPage} from './pages/app/RepositoryAndDeiPages';
import {NotificationsPage, ProfilePage} from './pages/app/NotificationsAndProfilePages';

// Admin pages
import {
  AdminAuditPage,
  AdminOverviewPage,
  AdminParamsPage,
  AdminRolesPage,
  AdminUsersPage,
} from './pages/admin/AdminOverviewAndUsersPages';
import {
  AdminJourneysPage,
  AdminPreboardingPage,
} from './pages/admin/AdminPreboardingAndJourneysPages';
import {
  AdminImprovementLabPage,
  AdminIndicatorsPage,
} from './pages/admin/AdminIndicatorsAndLabPages';
import {
  AdminActivitiesPage,
  AdminDeiPage,
  AdminEventsPage,
  AdminFalaEnapPage,
  AdminRepositoryPage,
  AdminSurveysPage,
} from './pages/admin/AdminModulesPages';

const RequireAuth: React.FC<{
  children: React.ReactNode;
  mode?: 'community' | 'admin';
  perm?: PermissionCode;
}> = ({children, mode = 'community', perm}) => {
  const {user, loading, hasPerm} = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] p-8 max-w-4xl mx-auto">
        <SkeletonBlock rows={4} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" state={{from: location.pathname}} replace />;
  }

  if (perm && !hasPerm(perm)) {
    return (
      <AppShell mode={mode === 'admin' && hasPerm('admin:access') ? 'admin' : 'community'}>
        <div className="max-w-xl mx-auto py-12 space-y-4">
          <AlertBox tone="error" title="Acesso restrito por perfil (RBAC)">
            Sua conta não possui a permissão institucional necessária (<code>{perm}</code>) para
            acessar este módulo administrativo. Essa restrição é validada também no servidor.
          </AlertBox>
          <Link to="/app/inicio">
            <Button variant="outline">Voltar para o início</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return <AppShell mode={mode}>{children}</AppShell>;
};

// Suporte a ?autostart=1 para inicialização direta de demonstração/inspeção
const AutostartHandler: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {user, login} = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('autostart') === '1' && !user) {
      login('acompanhamento30@demo.enap.gov.br', 'EnapDemo@2026')
        .then(() => navigate('/app/inicio', {replace: true}))
        .catch(() => {});
    }
  }, [location.search, user, login, navigate]);

  return null;
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AutostartHandler />
          <Routes>
            {/* Rotas públicas e de acesso */}
            <Route path="/" element={<LandingLoginPage />} />
            <Route path="/acesso" element={<LandingLoginPage />} />
            <Route path="/cadastro" element={<RegisterPage />} />
            <Route path="/recuperar-senha" element={<RecoverPasswordPage />} />

            {/* Fluxo "A caminho da Enap?" — Pré-Embarque GAEG NS/NI */}
            <Route path="/pre-ingresso" element={<PreboardingFlowPage />} />
            <Route path="/pre-ingresso/modalidade" element={<PreboardingFlowPage />} />
            <Route path="/pre-ingresso/formulario" element={<PreboardingFlowPage />} />
            <Route path="/pre-ingresso/revisao" element={<PreboardingFlowPage />} />
            <Route path="/pre-ingresso/confirmacao" element={<PreboardingFlowPage />} />
            <Route path="/pre-ingresso/acompanhamento" element={<PreboardingFlowPage />} />

            {/* Ambiente logado da comunidade Enap */}
            <Route path="/app" element={<Navigate to="/app/inicio" replace />} />
            <Route path="/app/inicio" element={<RequireAuth><HomePage /></RequireAuth>} />

            <Route path="/app/jornada" element={<RequireAuth><JourneyPage /></RequireAuth>} />
            <Route path="/app/jornada/tarefas" element={<RequireAuth><JourneyPage /></RequireAuth>} />
            <Route path="/app/jornada/avaliacoes" element={<RequireAuth><JourneyPage /></RequireAuth>} />
            <Route path="/app/jornada/apoio" element={<RequireAuth><JourneyPage /></RequireAuth>} />

            <Route path="/app/atividades" element={<RequireAuth><ActivitiesPage /></RequireAuth>} />
            <Route path="/app/atividades/:id" element={<RequireAuth><ActivitiesPage /></RequireAuth>} />

            <Route path="/app/eventos" element={<RequireAuth><EventsPage /></RequireAuth>} />
            <Route path="/app/eventos/:id" element={<RequireAuth><EventsPage /></RequireAuth>} />

            <Route path="/app/fala-enap" element={<RequireAuth><FalaEnapPage /></RequireAuth>} />

            <Route path="/app/enquetes" element={<RequireAuth><SurveysPage /></RequireAuth>} />
            <Route path="/app/enquetes/:id" element={<RequireAuth><SurveysPage /></RequireAuth>} />

            <Route path="/app/repositorio" element={<RequireAuth><RepositoryPage /></RequireAuth>} />
            <Route path="/app/comite-dei" element={<RequireAuth><ComiteDeiPage /></RequireAuth>} />
            <Route path="/app/notificacoes" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
            <Route path="/app/perfil" element={<RequireAuth><ProfilePage /></RequireAuth>} />

            {/* Ambiente administrativo e inteligência de gestão */}
            <Route
              path="/admin"
              element={
                <RequireAuth mode="admin" perm="admin:access">
                  <AdminOverviewPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <RequireAuth mode="admin" perm="users:manage">
                  <AdminUsersPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/perfis"
              element={
                <RequireAuth mode="admin" perm="roles:view">
                  <AdminRolesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/pre-ingresso"
              element={
                <RequireAuth mode="admin" perm="preboarding:manage">
                  <AdminPreboardingPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/formularios"
              element={
                <RequireAuth mode="admin" perm="preboarding:manage">
                  <AdminPreboardingPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/jornadas"
              element={
                <RequireAuth mode="admin" perm="journey:manage">
                  <AdminJourneysPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/atividades"
              element={
                <RequireAuth mode="admin" perm="activities:manage">
                  <AdminActivitiesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/eventos"
              element={
                <RequireAuth mode="admin" perm="events:manage">
                  <AdminEventsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/fala-enap"
              element={
                <RequireAuth mode="admin" perm="feedback:manage">
                  <AdminFalaEnapPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/enquetes"
              element={
                <RequireAuth mode="admin" perm="surveys:manage">
                  <AdminSurveysPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/repositorio"
              element={
                <RequireAuth mode="admin" perm="repository:manage">
                  <AdminRepositoryPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/comite-dei"
              element={
                <RequireAuth mode="admin" perm="dei:manage">
                  <AdminDeiPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/indicadores"
              element={
                <RequireAuth mode="admin" perm="indicators:view">
                  <AdminIndicatorsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/melhoria-continua"
              element={
                <RequireAuth mode="admin" perm="improvement:manage">
                  <AdminImprovementLabPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/parametros"
              element={
                <RequireAuth mode="admin" perm="preboarding:manage_gaeg_params">
                  <AdminParamsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/auditoria"
              element={
                <RequireAuth mode="admin" perm="audit:view">
                  <AdminAuditPage />
                </RequireAuth>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
