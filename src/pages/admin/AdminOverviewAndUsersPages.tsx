import React, {useCallback, useEffect, useState} from 'react';
import {Link} from 'react-router-dom';
import {
  ArrowRight,
  FileSearch,
  Plug,
  Save,
  Shield,
  Sliders,
  Users,
} from 'lucide-react';
import {apiFetch} from '../../lib/api';
import type {GaegParameter, RoleCode} from '../../lib/types';
import {
  AlertBox,
  Button,
  Card,
  Field,
  inputBaseClass,
  Modal,
  PageHeader,
  SkeletonBlock,
  useToast,
} from '../../components/ui/Primitives';

export const AdminOverviewPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/overview')
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock rows={4} />;

  const c = data?.counts || {};
  const kpis = [
    {label: 'Pré-ingressos em andamento', value: c.preboardingActive ?? 0, to: '/admin/pre-ingresso'},
    {label: 'Jornadas de Ambientação ativas', value: c.journeysActive ?? 0, to: '/admin/jornadas'},
    {label: 'Pedidos de apoio abertos', value: c.openSupport ?? 0, to: '/admin/jornadas'},
    {label: 'Atividades PQVT abertas', value: c.activitiesOpen ?? 0, to: '/admin/atividades'},
    {label: 'Enquetes em andamento', value: c.surveysOpen ?? 0, to: '/admin/enquetes'},
    {label: 'Fala, Enap! pendentes', value: c.feedbackPending ?? 0, to: '/admin/fala-enap'},
    {label: 'Planos de melhoria contínua', value: c.improvementPlans ?? 0, to: '/admin/melhoria-continua'},
    {label: 'Contas cadastradas (demo)', value: c.users ?? 0, to: '/admin/usuarios'},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Ambiente Administrativo · Gestão e Inteligência"
        title="Visão Geral da Gestão"
        description="Painel executivo consolidado com acesso controlado por papel (RBAC), segregação de funções e trilha de auditoria."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to}>
            <Card className="p-5 hover:border-[#173640]/40 transition-colors h-full flex flex-col justify-between gap-2">
              <p className="text-xs font-semibold text-[#5F666A]">{k.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-extrabold text-[#173640] tabular-nums">{k.value}</p>
                <ArrowRight className="w-4 h-4 text-[#186F80]" aria-hidden="true" />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[#173640]">Eventos recentes na trilha de auditoria</h2>
          <Link to="/admin/auditoria" className="text-xs font-bold text-[#186F80] hover:underline">
            Ver trilha completa
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E2DDD5] text-left text-[#5F666A]">
                <th className="py-2 pr-3">Data/Hora</th>
                <th className="py-2 pr-3">Ação</th>
                <th className="py-2 pr-3">Ator</th>
                <th className="py-2 pr-3">Recurso</th>
                <th className="py-2">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DF]">
              {(data?.recentAudit || []).map((ev: any) => (
                <tr key={ev.id}>
                  <td className="py-2.5 pr-3 tabular-nums text-[#5F666A] whitespace-nowrap">
                    {new Date(ev.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-2.5 pr-3 font-mono font-bold text-[#173640]">{ev.action}</td>
                  <td className="py-2.5 pr-3 text-[#4A4F52]">{ev.actor_email || 'sistema'}</td>
                  <td className="py-2.5 pr-3 text-[#4A4F52]">{ev.resource_type}</td>
                  <td className="py-2.5 font-semibold text-[#285D32]">{ev.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export const AdminUsersPage: React.FC = () => {
  const {pushToast} = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [roleLabels, setRoleLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const loadData = useCallback(() => {
    setLoading(true);
    apiFetch<{users: any[]; roleLabels: Record<string, string>}>('/api/admin/users')
      .then((res) => {
        setUsers(res.users);
        setRoleLabels(res.roleLabels);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveRoles = async () => {
    if (!editingUser) return;
    try {
      await apiFetch(`/api/admin/users/${editingUser.id}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({roles: selectedRoles}),
      });
      pushToast(`Papéis de ${editingUser.full_name} atualizados e auditados.`, 'success');
      setEditingUser(null);
      loadData();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao atualizar papéis.', 'error');
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Controle de Acesso · RBAC"
        title="Gestão de Usuários"
        description="Consulte contas cadastradas e gerencie a atribuição de papéis institucionais sob o princípio do menor privilégio."
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#FAF8F4] border-b border-[#E2DDD5] text-left text-xs text-[#5F666A]">
                <th className="py-3 px-4">Pessoa</th>
                <th className="py-3 px-4">Unidade / Vínculo</th>
                <th className="py-3 px-4">Papéis Ativos</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DF]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#FAF8F4]/70">
                  <td className="py-3 px-4">
                    <p className="font-bold text-[#173640]">{u.full_name}</p>
                    <p className="text-xs text-[#5F666A] font-mono">{u.email}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#4A4F52]">
                    <p className="font-semibold">{u.organizational_unit}</p>
                    <p>{u.employment_type}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#173640]">
                    {(u.roles || []).map((r: string) => roleLabels[r] || r).join(' · ')}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingUser(u);
                        setSelectedRoles(u.roles || []);
                      }}
                    >
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Editar papéis</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={Boolean(editingUser)}
        onClose={() => setEditingUser(null)}
        title={`Papéis RBAC — ${editingUser?.full_name || ''}`}
      >
        <div className="space-y-4">
          <AlertBox tone="warning" title="Segregação de funções">
            Atribua <strong>Responsável pelo Pré-ingresso</strong> apenas a agentes formalmente
            designados para acessar o cofre segregado de dados bancários e sensíveis.
          </AlertBox>
          <div className="space-y-2">
            {Object.entries(roleLabels).map(([code, label]) => {
              const checked = selectedRoles.includes(code);
              return (
                <label
                  key={code}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[#E2DDD5] cursor-pointer hover:bg-[#FAF8F4]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedRoles((prev) =>
                        checked ? prev.filter((x) => x !== code) : [...prev, code],
                      )
                    }
                    className="h-4 w-4 accent-[#173640]"
                  />
                  <span className="text-sm font-medium text-[#231F20]">{label}</span>
                  <span className="text-xs font-mono text-[#5F666A] ml-auto">{code}</span>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancelar
            </Button>
            <Button variant="secondary" onClick={handleSaveRoles}>
              Salvar atribuição
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export const AdminRolesPage: React.FC = () => {
  const [roles, setRoles] = useState<Array<{code: RoleCode; label: string; permissions: string[]}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{roles: any[]}>('/api/admin/roles-matrix')
      .then((res) => setRoles(res.roles))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonBlock rows={4} />;

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Governança de Acesso · Menor Privilégio"
        title="Matriz de Perfis e Permissões (11 Papéis)"
        description="Controle de acesso validado no servidor a cada requisição. Observe que o Administrador Técnico não possui acesso ao cofre segregado de pré-ingresso."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((r) => (
          <Card key={r.code} className="p-5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-[#173640] flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#285D32]" aria-hidden="true" />
                <span>{r.label}</span>
              </h2>
              <code className="text-xs font-mono text-[#5F666A]">{r.code}</code>
            </div>
            <p className="text-xs text-[#4A4F52] leading-relaxed font-mono">
              {r.permissions.join(' · ')}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const AdminAuditPage: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAudit = useCallback((actionFilter: string) => {
    setLoading(true);
    const qs = actionFilter ? `?action=${encodeURIComponent(actionFilter)}` : '';
    apiFetch<{events: any[]}>(`/api/admin/audit${qs}`)
      .then((res) => setEvents(res.events))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAudit('');
  }, [loadAudit]);

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Rastreabilidade · Segurança"
        title="Trilha de Auditoria"
        description="Registro imutável de acessos, alterações de papéis, consultas ao cofre segregado de pré-ingresso, publicações e exportações (sem gravar senhas ou contas bancárias em texto simples)."
      />

      <Card className="p-4 flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por ação (ex.: RESTRICTED_VAULT, AUTH_LOGIN, PREBOARDING)..."
          className={`${inputBaseClass} max-w-md`}
        />
        <Button onClick={() => loadAudit(filter.trim())}>
          <FileSearch className="w-4 h-4" aria-hidden="true" />
          <span>Filtrar</span>
        </Button>
      </Card>

      {loading ? (
        <SkeletonBlock rows={4} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF8F4] border-b border-[#E2DDD5] text-left text-[#5F666A]">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Ação</th>
                  <th className="py-3 px-4">Ator</th>
                  <th className="py-3 px-4">Recurso</th>
                  <th className="py-3 px-4">Resultado</th>
                  <th className="py-3 px-4">Metadados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DF]">
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-2.5 px-4 tabular-nums whitespace-nowrap text-[#5F666A]">
                      {new Date(ev.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-[#173640]">{ev.action}</td>
                    <td className="py-2.5 px-4 text-[#4A4F52]">{ev.actor_email || 'sistema'}</td>
                    <td className="py-2.5 px-4 text-[#4A4F52]">
                      {ev.resource_type} {ev.resource_id ? `(${String(ev.resource_id).slice(0, 12)})` : ''}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-[#285D32]">{ev.outcome}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#5F666A] max-w-xs truncate">
                      {ev.metadata_json}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export const AdminParamsPage: React.FC = () => {
  const {pushToast} = useToast();
  const [params, setParams] = useState<GaegParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadParams = useCallback(() => {
    setLoading(true);
    apiFetch<{parameters: GaegParameter[]}>('/api/preboarding/gaeg-parameters')
      .then((res) => setParams(res.parameters))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadParams();
  }, [loadParams]);

  const handleSave = async (p: GaegParameter) => {
    setSavingId(p.modality);
    try {
      await apiFetch(`/api/admin/gaeg-parameters/${p.modality}`, {
        method: 'PATCH',
        body: JSON.stringify({
          gaegValue: Number(p.gaegValue),
          maxTotalRemuneration: Number(p.maxTotalRemuneration),
          declarationText: p.declarationText,
          legalBasis: p.legalBasis,
          validFrom: p.validFrom,
          validUntil: p.validUntil,
          version: p.version,
          validatedBy: p.validatedBy,
        }),
      });
      pushToast(`Parâmetros ${p.label} atualizados e versionados!`, 'success');
      loadParams();
    } catch (err: any) {
      pushToast(err?.message || 'Erro ao salvar parâmetros.', 'error');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <SkeletonBlock rows={4} />;

  const futureIntegrations = [
    {system: 'Microsoft Entra ID (SSO Institucional)', scope: 'Login único corporativo Enap e provisionamento SCIM', status: 'Integração futura'},
    {system: 'Microsoft Teams / Outlook / Calendar', scope: 'Sincronização bidirecional da agenda e lembretes', status: 'Integração futura'},
    {system: 'Microsoft SharePoint', scope: 'Espelhamento controlado de acervos normativos do repositório', status: 'Integração futura'},
    {system: 'Power BI Institucional', scope: 'Exportação analítica agregada dos indicadores de gestão', status: 'Integração futura'},
    {system: 'SEI (Sistema Eletrônico de Informações)', scope: 'Abertura automatizada de processo de movimentação/pré-ingresso', status: 'Integração futura'},
    {system: 'Fala.BR / Ouvidoria CGU', scope: 'Direcionamento institucional para manifestações formais e denúncias', status: 'Link oficial externo'},
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        kicker="Parametrização Institucional · Arquitetura Expansível"
        title="Parâmetros GAEG e Integrações Futuras"
        description="Edite valores de referência, tetos remuneratórios e textos legais das declarações GAEG Nível Superior e Intermediário sem alterar código."
      />

      <div className="space-y-5">
        {params.map((p, idx) => (
          <Card key={p.modality} className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-[#173640] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#186F80]" aria-hidden="true" />
                <span>{p.label}</span>
              </h2>
              <span className="text-xs font-mono text-[#5F666A]">Versão {p.version}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field id={`gv-${idx}`} label="Valor GAEG (R$)" required>
                <input
                  id={`gv-${idx}`}
                  type="number"
                  step="0.01"
                  value={p.gaegValue}
                  onChange={(e) => {
                    const copy = [...params];
                    copy[idx] = {...p, gaegValue: Number(e.target.value)};
                    setParams(copy);
                  }}
                  className={inputBaseClass}
                />
              </Field>
              <Field id={`gt-${idx}`} label="Limite máximo total (R$)" required>
                <input
                  id={`gt-${idx}`}
                  type="number"
                  step="0.01"
                  value={p.maxTotalRemuneration}
                  onChange={(e) => {
                    const copy = [...params];
                    copy[idx] = {...p, maxTotalRemuneration: Number(e.target.value)};
                    setParams(copy);
                  }}
                  className={inputBaseClass}
                />
              </Field>
              <Field id={`ver-${idx}`} label="Versão da parametrização" required>
                <input
                  id={`ver-${idx}`}
                  value={p.version}
                  onChange={(e) => {
                    const copy = [...params];
                    copy[idx] = {...p, version: e.target.value};
                    setParams(copy);
                  }}
                  className={inputBaseClass}
                />
              </Field>
              <Field id={`lb-${idx}`} label="Base legal" required>
                <input
                  id={`lb-${idx}`}
                  value={p.legalBasis}
                  onChange={(e) => {
                    const copy = [...params];
                    copy[idx] = {...p, legalBasis: e.target.value};
                    setParams(copy);
                  }}
                  className={inputBaseClass}
                />
              </Field>
              <Field id={`vf-${idx}`} label="Vigência inicial" required>
                <input
                  id={`vf-${idx}`}
                  type="date"
                  value={p.validFrom}
                  onChange={(e) => {
                    const copy = [...params];
                    copy[idx] = {...p, validFrom: e.target.value};
                    setParams(copy);
                  }}
                  className={inputBaseClass}
                />
              </Field>
              <Field id={`vb-${idx}`} label="Validação institucional" required>
                <input
                  id={`vb-${idx}`}
                  value={p.validatedBy}
                  onChange={(e) => {
                    const copy = [...params];
                    copy[idx] = {...p, validatedBy: e.target.value};
                    setParams(copy);
                  }}
                  className={inputBaseClass}
                />
              </Field>
            </div>

            <Field id={`dt-${idx}`} label="Texto completo da declaração remuneratória" required>
              <textarea
                id={`dt-${idx}`}
                rows={4}
                value={p.declarationText}
                onChange={(e) => {
                  const copy = [...params];
                  copy[idx] = {...p, declarationText: e.target.value};
                  setParams(copy);
                }}
                className={inputBaseClass}
              />
            </Field>

            <Button
              variant="secondary"
              disabled={savingId === p.modality}
              onClick={() => handleSave(p)}
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{savingId === p.modality ? 'Salvando...' : 'Salvar parâmetros'}</span>
            </Button>
          </Card>
        ))}
      </div>

      {/* Integrações Futuras Documentadas (§27) */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Plug className="w-5 h-5 text-[#173640]" aria-hidden="true" />
          <h2 className="text-lg font-extrabold text-[#173640]">
            Arquitetura Preparada para Integrações Futuras (Contratos Documentados)
          </h2>
        </div>
        <p className="text-xs text-[#5F666A]">
          Nenhuma integração externa corporativa é fingida como ativa neste protótipo. Os adaptadores
          estão mapeados para ativação na implantação oficial junto à CGTI/Enap.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E2DDD5] text-left text-[#5F666A]">
                <th className="py-2 pr-3">Ecossistema / Sistema</th>
                <th className="py-2 pr-3">Finalidade prevista</th>
                <th className="py-2">Situação atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DF]">
              {futureIntegrations.map((fi) => (
                <tr key={fi.system}>
                  <td className="py-2.5 pr-3 font-bold text-[#173640]">{fi.system}</td>
                  <td className="py-2.5 pr-3 text-[#4A4F52]">{fi.scope}</td>
                  <td className="py-2.5 font-bold text-[#9E4F00]">{fi.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
