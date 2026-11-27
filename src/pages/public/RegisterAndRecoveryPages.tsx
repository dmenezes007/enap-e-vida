import React, {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {ArrowLeft, CheckCircle2, KeyRound, ShieldCheck, UserPlus} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import {useAuth} from '../../contexts/AuthContext';
import {NewsTicker, EnapVidaLogo, RgiGeometricStrip} from '../../components/ui/BrandAssets';
import {AlertBox, Button, Card, Field, inputBaseClass, useToast} from '../../components/ui/Primitives';

const EMPLOYMENT_OPTIONS = [
  'Servidor(a) efetivo(a) Enap',
  'Servidor(a) requisitado(a) / cedido(a)',
  'Comissionado(a) sem vínculo efetivo',
  'Colaborador(a) terceirizado(a)',
  'Estagiário(a)',
  'Bolsista / Pesquisador(a)',
];

const UNIT_OPTIONS = [
  'CGP — Coordenação-Geral de Gestão de Pessoas',
  'GNova — Laboratório de Inovação em Governo',
  'DDP — Diretoria de Desenvolvimento Profissional',
  'DGC — Diretoria de Gestão Corporativa',
  'CGTI — Coordenação-Geral de Tecnologia da Informação',
  'CGCOM — Coordenação-Geral de Comunicação',
  'DINT — Diretoria de Inteligência de Dados e Inovação',
];

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const {refreshUser} = useAuth();
  const {pushToast} = useToast();

  const [form, setForm] = useState({
    fullName: '',
    socialName: '',
    email: '',
    alternativeEmail: '',
    password: '',
    confirmPassword: '',
    employmentType: EMPLOYMENT_OPTIONS[0],
    organizationalUnit: UNIT_OPTIONS[0],
    positionTitle: '',
    entryDate: new Date().toISOString().slice(0, 10),
    preboardingProtocol: '',
    acceptPrivacy: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirmPassword) {
      setError('A confirmação de senha não coincide com a senha informada.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{linkedPreboarding: boolean}>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName,
          socialName: form.socialName || undefined,
          email: form.email,
          alternativeEmail: form.alternativeEmail || undefined,
          password: form.password,
          employmentType: form.employmentType,
          organizationalUnit: form.organizationalUnit,
          positionTitle: form.positionTitle,
          entryDate: form.entryDate,
          preboardingProtocol: form.preboardingProtocol || undefined,
          acceptPrivacy: form.acceptPrivacy,
        }),
      });
      await refreshUser();
      pushToast(
        res.linkedPreboarding
          ? 'Conta criada e vinculada ao seu protocolo de Pré-Embarque!'
          : 'Conta criada com sucesso! Sua Jornada de Ambientação já está disponível.',
        'success',
      );
      navigate('/app/inicio');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir o cadastro.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#231F20]">
      <NewsTicker />
      <RgiGeometricStrip className="h-2.5 w-full" />

      <header className="bg-white border-b border-[#E2DDD5]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <EnapVidaLogo />
          </Link>
          <Link to="/" className="text-xs font-semibold text-[#186F80] hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Voltar ao login</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[#285D32]">Novo por aqui?</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#173640]">
            Crie sua conta na comunidade Enap e-Vida
          </h1>
          <p className="text-sm text-[#4A4F52]">
            Coletamos apenas o mínimo necessário para personalizar seu acolhimento. Não solicitamos CPF,
            RG ou dados bancários nesta etapa, e permissões administrativas nunca são autodeclaradas.
          </p>
        </div>

        <Card className="p-6 sm:p-7">
          {error && (
            <AlertBox tone="error" className="mb-5">
              {error}
            </AlertBox>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field id="reg-name" label="Nome completo" required>
              <input
                id="reg-name"
                required
                value={form.fullName}
                onChange={(e) => setForm({...form, fullName: e.target.value})}
                className={inputBaseClass}
              />
            </Field>
            <Field
              id="reg-social"
              label="Nome social ou de preferência (opcional)"
              hint="Como você prefere ser chamado(a) na plataforma."
            >
              <input
                id="reg-social"
                value={form.socialName}
                onChange={(e) => setForm({...form, socialName: e.target.value})}
                className={inputBaseClass}
              />
            </Field>
            <Field id="reg-email" label="E-mail institucional ou principal" required>
              <input
                id="reg-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({...form, email: e.target.value})}
                placeholder="voce@enap.gov.br"
                className={inputBaseClass}
              />
            </Field>
            <Field id="reg-alt-email" label="E-mail alternativo (opcional)">
              <input
                id="reg-alt-email"
                type="email"
                value={form.alternativeEmail}
                onChange={(e) => setForm({...form, alternativeEmail: e.target.value})}
                className={inputBaseClass}
              />
            </Field>
            <Field
              id="reg-pass"
              label="Senha"
              required
              hint="Mínimo 8 caracteres, com maiúscula, minúscula e número."
            >
              <input
                id="reg-pass"
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({...form, password: e.target.value})}
                className={inputBaseClass}
              />
            </Field>
            <Field id="reg-pass2" label="Confirmar senha" required>
              <input
                id="reg-pass2"
                type="password"
                required
                value={form.confirmPassword}
                onChange={(e) => setForm({...form, confirmPassword: e.target.value})}
                className={inputBaseClass}
              />
            </Field>

            <Field id="reg-emp" label="Tipo de vínculo" required>
              <select
                id="reg-emp"
                value={form.employmentType}
                onChange={(e) => setForm({...form, employmentType: e.target.value})}
                className={inputBaseClass}
              >
                {EMPLOYMENT_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field id="reg-unit" label="Unidade de lotação / exercício" required>
              <select
                id="reg-unit"
                value={form.organizationalUnit}
                onChange={(e) => setForm({...form, organizationalUnit: e.target.value})}
                className={inputBaseClass}
              >
                {UNIT_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>

            <Field id="reg-pos" label="Cargo / função / papel" required>
              <input
                id="reg-pos"
                required
                value={form.positionTitle}
                onChange={(e) => setForm({...form, positionTitle: e.target.value})}
                placeholder="Ex.: Especialista em Políticas Públicas"
                className={inputBaseClass}
              />
            </Field>
            <Field id="reg-date" label="Data de entrada ou início previsto na Enap" required>
              <input
                id="reg-date"
                type="date"
                required
                value={form.entryDate}
                onChange={(e) => setForm({...form, entryDate: e.target.value})}
                className={inputBaseClass}
              />
            </Field>

            <div className="md:col-span-2">
              <Field
                id="reg-proto"
                label="Protocolo anterior de Pré-Embarque (opcional)"
                hint="Se você preencheu o formulário 'A caminho da Enap?' com o mesmo e-mail, informe o protocolo para vincular seu histórico."
              >
                <input
                  id="reg-proto"
                  value={form.preboardingProtocol}
                  onChange={(e) => setForm({...form, preboardingProtocol: e.target.value.toUpperCase()})}
                  placeholder="ENAP-PRE-2026-XXXXXX"
                  className={inputBaseClass}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-start gap-3 p-4 rounded-xl border border-[#C5BEB2] bg-[#FAF8F4] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acceptPrivacy}
                  onChange={(e) => setForm({...form, acceptPrivacy: e.target.checked})}
                  className="mt-1 h-4 w-4 accent-[#285D32]"
                />
                <span className="text-sm text-[#231F20]">
                  Li e estou ciente do aviso de privacidade e proteção de dados pessoais do Enap e-Vida,
                  compreendendo que minha conta inicia com perfil regular da comunidade Enap.
                </span>
              </label>
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button type="submit" size="lg" variant="secondary" disabled={busy}>
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>{busy ? 'Criando conta...' : 'Concluir cadastro e entrar'}</span>
              </Button>
              <span className="text-xs text-[#5F666A] inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#285D32]" aria-hidden="true" />
                Sem coleta de CPF ou dados bancários
              </span>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
};

export const RecoverPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{message: string}>('/api/auth/recover-password', {
        method: 'POST',
        body: JSON.stringify({email: email.trim()}),
      });
      setMessage(res.message);
    } catch (err: any) {
      setError(err?.message || 'Informe um e-mail válido.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#231F20]">
      <NewsTicker />
      <RgiGeometricStrip className="h-2.5 w-full" />

      <header className="bg-white border-b border-[#E2DDD5]">
        <div className="max-w-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <EnapVidaLogo />
          </Link>
          <Link to="/" className="text-xs font-semibold text-[#186F80] hover:underline">
            Voltar ao login
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-10">
        <Card className="p-6 sm:p-7 space-y-5">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-extrabold text-[#173640]">Recuperar senha</h1>
            <p className="text-sm text-[#4A4F52]">
              Informe seu e-mail cadastrado. Por segurança contra enumeração de contas, exibimos uma
              confirmação neutra independentemente da existência do endereço.
            </p>
          </div>

          {error && <AlertBox tone="error">{error}</AlertBox>}

          {message ? (
            <div className="space-y-4">
              <AlertBox tone="success" title="Solicitação registrada">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{message}</span>
                </div>
              </AlertBox>
              <Link to="/">
                <Button variant="outline">Voltar à tela de acesso</Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field id="rec-email" label="E-mail institucional ou cadastrado" required>
                <input
                  id="rec-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome.sobrenome@enap.gov.br"
                  className={inputBaseClass}
                />
              </Field>
              <Button type="submit" disabled={busy}>
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                <span>{busy ? 'Registrando...' : 'Solicitar instruções'}</span>
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
};
