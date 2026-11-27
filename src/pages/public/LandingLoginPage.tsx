import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lock,
  UserPlus,
  Users,
} from 'lucide-react';
import {useAuth} from '../../contexts/AuthContext';
import {apiFetch} from '../../lib/api';
import {NewsTicker, EnapVidaLogo, PWAInstallButton, RgiGeometricStrip} from '../../components/ui/BrandAssets';
import {AlertBox, Button, Card, Field, inputBaseClass, Modal, useToast} from '../../components/ui/Primitives';

interface DemoPersona {
  id: string;
  email: string;
  fullName: string;
  preferredName: string;
  unit: string;
  position: string;
  journeyStage: string;
  label: string;
  mfaEnabled: boolean;
  roles: string[];
}

export const LandingLoginPage: React.FC = () => {
  const {user, login} = useAuth();
  const navigate = useNavigate();
  const {pushToast} = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showMfaField, setShowMfaField] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [personas, setPersonas] = useState<DemoPersona[]>([]);
  const [demoPassHint, setDemoPassHint] = useState('');
  const [demoOpen, setDemoOpen] = useState(false);

  const [infoModal, setInfoModal] = useState<'privacidade' | 'acessibilidade' | 'suporte' | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/app/inicio', {replace: true});
    }
  }, [user, navigate]);

  useEffect(() => {
    apiFetch<{personas: DemoPersona[]; demoPasswordHint: string}>('/api/auth/demo-personas')
      .then((res) => {
        setPersonas(res.personas);
        setDemoPassHint(res.demoPasswordHint);
      })
      .catch(() => {
        // silencioso no carregamento inicial
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const logged = await login(email.trim(), password, showMfaField ? mfaCode.trim() : undefined);
      pushToast(`Bem-vindo(a), ${logged.preferredName}!`, 'success');
      navigate('/app/inicio');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível realizar o acesso. Verifique suas credenciais.');
      if (err?.data?.mfaRequired) setShowMfaField(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (persona: DemoPersona) => {
    setError(null);
    setEmail(persona.email);
    setPassword(demoPassHint);
    setSubmitting(true);
    try {
      const logged = await login(persona.email, demoPassHint, persona.mfaEnabled ? '202600' : undefined);
      pushToast(`Acesso demonstrativo ativo: ${logged.preferredName}`, 'info');
      navigate('/app/inicio');
    } catch (err: any) {
      setError(err?.message || 'Erro no acesso demonstrativo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#231F20]">
      <a href="#main-login-content" className="skip-link">
        Pular para o conteúdo principal
      </a>
      <NewsTicker />
      <RgiGeometricStrip className="h-2.5 w-full" />

      {/* Cabeçalho institucional limpo */}
      <header className="bg-white border-b border-[#E2DDD5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <EnapVidaLogo className="max-w-32 sm:max-w-44 shrink-0" />
            <span className="h-5 w-px bg-[#D7D1C7] hidden sm:inline-block" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[11px] text-[#5F666A] hidden sm:block truncate">
                Escola Nacional de Administração Pública
              </p>
            </div>
          </div>

          <nav aria-label="Atalhos públicos" className="flex items-center gap-2 sm:gap-3">
            <PWAInstallButton compact />
            <Link
              to="/pre-ingresso/acompanhamento"
              className="text-xs sm:text-sm font-semibold text-[#173640] hover:text-[#186F80] px-2.5 py-1.5 rounded-lg hover:bg-[#F2EFE9] whitespace-nowrap shrink-0"
            >
              Acompanhar protocolo
            </Link>
            <button
              type="button"
              onClick={() => setInfoModal('suporte')}
              className="text-xs sm:text-sm font-semibold text-[#4A4F52] hover:text-[#173640] px-2.5 py-1.5 rounded-lg hover:bg-[#F2EFE9] hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" aria-hidden="true" />
              <span>Suporte</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Conteúdo principal 2 colunas desktop / empilhado mobile */}
      <main id="main-login-content" className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-9 items-start">
            {/* Coluna esquerda — Acolhimento institucional, ilustração RGI 2025 e entradas */}
            <section className="lg:col-span-7 space-y-5">
              <div className="space-y-2.5">
                <p className="text-xs font-bold tracking-wider uppercase text-[#285D32]">
                  Ambientação · Qualidade de Vida · Pertencimento
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-[#173640] leading-[1.1] tracking-tight text-balance">
                  Conexões que acolhem. Experiências que transformam.
                </h1>
                <p className="text-sm sm:text-base text-[#4A4F52] max-w-2xl leading-relaxed">
                  <strong>Sua jornada. Seu bem-estar. Nossa Enap.</strong> Um espaço integrado para apoiar pessoas em movimento para a Escola, acompanhar a sua ambientação, participar das atividades do Programa de Qualidade de Vida no Trabalho, consultar a biblioteca focada em pessoas e fortalecer o diálogo contínuo.
                </p>
              </div>

              {/* Arte editorial inspirada no RGI 2025 */}
              <div className="relative overflow-hidden rounded-2xl border border-[#E2DDD5] bg-[#FFF2DE]">
                <img
                  src="/src/assets/images/hero_enap_evida_1795080544506.jpg"
                  alt="Ilustração editorial em traço orgânico e paleta institucional do RGI 2025 representando pessoas diversas em acolhimento e diálogo cercadas por elementos da biodiversidade do Cerrado"
                  className="w-full h-48 sm:h-56 object-cover"
                />
                <div className="px-5 py-3 bg-white/95 border-t border-[#E2DDD5] flex flex-wrap items-center justify-between gap-2 text-xs text-[#4A4F52]">
                  <span className="font-semibold text-[#173640]">
                    “Conhecimento e prática para a transformação do Estado.”
                  </span>
                </div>
              </div>

              {/* Cartões de entrada rápida (Pré-Embarque e Novo cadastro) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card warm className="p-5 flex flex-col justify-between gap-4 border-[#FF8500]/35">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#173640]">
                      <Compass className="w-5 h-5 text-[#FF8500]" aria-hidden="true" />
                      <h2 className="text-base font-extrabold">A caminho da Enap?</h2>
                    </div>
                    <p className="text-sm text-[#4A4F52] leading-relaxed">
                      Está em estágio avançado de processo seletivo ou recebeu convite institucional para ingressar na Escola? Inicie aqui o envio seguro dos seus dados preliminares ou acompanhe seu protocolo.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/pre-ingresso"
                      className="inline-flex items-center gap-2 rounded-lg bg-[#FF8500] px-4 py-2.5 text-sm font-bold text-[#173640] hover:bg-[#E67700] transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Iniciar Pré-Embarque</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                    <Link
                      to="/pre-ingresso/acompanhamento"
                      className="text-xs font-semibold text-[#173640] underline hover:text-[#186F80] px-1 py-1"
                    >
                      Já enviei
                    </Link>
                  </div>
                </Card>

                <Card className="p-5 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[#173640]">
                      <UserPlus className="w-5 h-5 text-[#285D32]" aria-hidden="true" />
                      <h2 className="text-base font-extrabold">Novo por aqui?</h2>
                    </div>
                    <p className="text-sm text-[#4A4F52] leading-relaxed">
                      Já faz parte da comunidade Enap (servidores, colaboradores, bolsistas ou estagiários) e
                      ainda não ativou sua conta? Crie seu acesso seguro.
                    </p>
                  </div>
                  <div>
                    <Link
                      to="/cadastro"
                      className="inline-flex items-center gap-2 rounded-lg border border-[#173640] bg-white px-4 py-2.5 text-sm font-bold text-[#173640] hover:bg-[#F2EFE9] transition-colors whitespace-nowrap shrink-0"
                    >
                      <span>Criar minha conta</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                </Card>
              </div>

              {/* Valores institucionais */}
              <div className="pt-2 border-t border-[#E2DDD5]">
                <p className="text-xs font-semibold text-[#5F666A] mb-1.5">
                  Vamores Institucionais
                </p>
                <p className="text-xs text-[#4A4F52] leading-relaxed">
                  Democracia · Diversidade · Sustentabilidade · Participação Social · Colaboração · Foco nas Pessoas · Excelência na Gestão
                </p>
              </div>
            </section>

            {/* Coluna direita — Formulário de Acesso + Gaveta de Demonstração */}
            <section className="lg:col-span-5 space-y-5">
              <Card className="p-6 sm:p-7 shadow-sm">
                <div className="space-y-1.5 mb-5">
                  <h2 className="text-xl font-extrabold text-[#173640]">Entrar no Enap e-Vida</h2>
                </div>

                {error && (
                  <AlertBox tone="error" className="mb-4">
                    {error}
                  </AlertBox>
                )}

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <Field id="login-email" label="E-mail" required>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome.sobrenome@enap.gov.br"
                      className={inputBaseClass}
                    />
                  </Field>

                  <Field id="login-password" label="Senha" required>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Digite sua senha"
                        className={`${inputBaseClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#5F666A] hover:text-[#173640] cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>

                  {showMfaField && (
                    <Field
                      id="login-mfa"
                      label="Código multifator (MFA)"
                      hint="Código demonstrativo para perfis administrativos: 202600"
                    >
                      <input
                        id="login-mfa"
                        type="text"
                        inputMode="numeric"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        placeholder="202600"
                        className={inputBaseClass}
                      />
                    </Field>
                  )}

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setShowMfaField((v) => !v)}
                      className="text-[#4A4F52] hover:text-[#173640] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{showMfaField ? 'Ocultar campo MFA' : 'Informar código MFA'}</span>
                    </button>
                    <Link
                      to="/recuperar-senha"
                      className="font-semibold text-[#186F80] hover:text-[#173640] underline"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                    <Lock className="w-4 h-4" aria-hidden="true" />
                    <span>{submitting ? 'Validando acesso...' : 'Entrar na plataforma'}</span>
                  </Button>
                </form>
              </Card>

              {/* Gaveta de Perfis de Demonstração (§33) */}
              <Card className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setDemoOpen((v) => !v)}
                  aria-expanded={demoOpen}
                  className="w-full px-5 py-4 bg-[#FFF2DE]/70 hover:bg-[#FFF2DE] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-5 h-5 text-[#173640] shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-extrabold text-[#173640]">
                        Acessos de demonstração ({personas.length || 15} perfis fictícios)
                      </p>
                    </div>
                  </div>
                  {demoOpen ? (
                    <ChevronUp className="w-5 h-5 text-[#173640] shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#173640] shrink-0" />
                  )}
                </button>

                {demoOpen && (
                  <div className="p-4 border-t border-[#E2DDD5] space-y-3">
                    <p className="text-xs text-[#4A4F52]">
                      Senha padrão de demonstração:{' '}
                      <code className="font-mono font-bold text-[#173640] bg-[#F2EFE9] px-1.5 py-0.5 rounded">
                        {demoPassHint || 'EnapDemo@2026'}
                      </code>{' '}
                      · Código MFA admin: <code className="font-mono font-bold">202600</code>
                    </p>
                    <div className="max-h-80 overflow-y-auto divide-y divide-[#ECE7DF] border border-[#E2DDD5] rounded-lg">
                      {personas.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 bg-white hover:bg-[#FAF8F4] flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-extrabold text-[#173640] truncate">{p.label}</p>
                            <p className="text-xs text-[#4A4F52] truncate">
                              {p.fullName} · {p.unit}
                            </p>
                            <p className="text-[11px] text-[#5F666A] font-mono truncate">{p.email}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={submitting}
                            onClick={() => handleQuickDemoLogin(p)}
                          >
                            Entrar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </section>
          </div>
        </div>
      </main>

      {/* Rodapé institucional com dados oficiais do RGI 2025 */}
      <footer className="bg-white border-t border-[#E2DDD5] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-[#5F666A]">
          <a href="https://enap.gov.br/" className="font-bold text-[#173640] hover:underline">
            Escola Nacional de Administração Pública – Enap
          </a>
          <div className="flex flex-wrap items-center gap-4 font-semibold text-[#173640]">
            <button
              type="button"
              onClick={() => setInfoModal('privacidade')}
              className="hover:underline cursor-pointer"
            >
              Privacidade e LGPD
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('acessibilidade')}
              className="hover:underline cursor-pointer"
            >
              Acessibilidade
            </button>
            <button
              type="button"
              onClick={() => setInfoModal('suporte')}
              className="hover:underline cursor-pointer"
            >
              Suporte
            </button>
          </div>
        </div>
      </footer>

      {/* Modais públicos informativos */}
      <Modal
        open={infoModal !== null}
        onClose={() => setInfoModal(null)}
        title={
          infoModal === 'privacidade'
            ? 'Privacidade e LGPD'
            : infoModal === 'acessibilidade'
              ? 'Acessibilidade'
              : 'Suporte'
        }
      >
        {infoModal === 'privacidade' && (
          <div className="space-y-3 text-sm text-[#4A4F52] leading-relaxed">
            <p>
              O <strong>Enap e-Vida</strong> foi projetado sob o princípio de privacidade desde a concepção
              (<em>Privacy by Design</em>) e minimização de dados, em alinhamento à Lei nº 13.709/2018 (LGPD).
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>
                Dados sigilosos e sensíveis coletados no Pré-Embarque permanecem em bases segregadas e cifradas, com acesso restrito ao responsável autorizado.
              </li>
              <li>
                Enquetes marcadas como <strong>Anônimas</strong> separam o controle de participação das respostas
                e suprimem gráficos quando a amostra é inferior a 10 respondentes.
              </li>
            </ul>
            <AlertBox tone="warning" title="Nota de Transparência">
              Este aplicativo é regido pelos{' '}
              <Link to="/termos-de-uso" className="font-semibold underline">Termos de Uso</Link>
              {' '}e pela{' '}
              <Link to="/politica-de-privacidade" className="font-semibold underline">Política de Privacidade</Link>
              {' '}do enap e-Vida.
            </AlertBox>
          </div>
        )}

        {infoModal === 'acessibilidade' && (
          <div className="space-y-3 text-sm text-[#4A4F52] leading-relaxed">
            <p>
              Esta interface segue diretrizes de referência da <strong>WCAG 2.2 nível AA</strong> e do{' '}
              <strong>eMAG</strong>:
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Navegação integral por teclado, link “Pular para o conteúdo principal” e foco visível de alto contraste.</li>
              <li>Contraste mínimo de 4,5:1 em textos e controles, sem depender apenas de cor para comunicar estados.</li>
              <li>Preferências de fonte ampliada, alto contraste e redução de movimento disponíveis em Meu Perfil.</li>
              <li>
                Recursos de acessibilidade (Libras, audiodescrição, legendas, acessibilidade física) divulgados nas
                atividades do PQVT e eventos institucionais.
              </li>
            </ul>
          </div>
        )}

        {infoModal === 'suporte' && (
          <div className="space-y-3 text-sm text-[#4A4F52] leading-relaxed">
            <p>Para esclarecer dúvidas, faça contato com a Coordenação de Gestão Estratégica e Modernização - COGEM/CGGP/DGC.</p>
          </div>
        )}
      </Modal>
    </div>
  );
};
