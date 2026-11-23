import type {PermissionCode, RoleCode} from './types';

export const ROLE_LABELS: Record<RoleCode, string> = {
  pre_ingresso: 'Pessoa em pré-ingresso',
  usuario_regular: 'Usuário regular',
  chefia: 'Gestor ou chefia',
  resp_ambientacao: 'Responsável pela ambientação',
  resp_pre_ingresso: 'Responsável pelo pré-ingresso',
  gestor_pqvt: 'Gestor de atividades e eventos (PQVT)',
  gestor_conteudo: 'Gestor de conteúdo',
  resp_dei: 'Responsável pelo Comitê DEI',
  analista_estrategico: 'Analista de gestão estratégica',
  admin_tecnico: 'Administrador técnico',
  auditor_lgpd: 'Auditor / Governança de dados',
};

/**
 * Matriz de perfis e permissões baseada nos princípios de menor privilégio,
 * necessidade de conhecer e segregação de funções (§23).
 * Nota crítica: `admin_tecnico` NÃO tem `preboarding:view_restricted_vault`.
 */
export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  pre_ingresso: [],
  usuario_regular: [],
  chefia: ['journey:supervisor_tasks'],
  resp_ambientacao: [
    'admin:access',
    'journey:manage',
    'journey:supervisor_tasks',
    'indicators:view',
    'improvement:manage',
  ],
  resp_pre_ingresso: [
    'admin:access',
    'preboarding:manage',
    'preboarding:view_restricted_vault',
    'preboarding:manage_gaeg_params',
  ],
  gestor_pqvt: ['admin:access', 'activities:manage', 'events:manage', 'feedback:manage'],
  gestor_conteudo: ['admin:access', 'repository:manage', 'surveys:manage', 'events:manage'],
  resp_dei: ['admin:access', 'dei:manage', 'events:manage', 'repository:manage'],
  analista_estrategico: [
    'admin:access',
    'indicators:view',
    'indicators:export',
    'surveys:manage',
    'improvement:manage',
  ],
  admin_tecnico: [
    'admin:access',
    'users:manage',
    'roles:view',
    'preboarding:manage_gaeg_params',
    'journey:manage',
    'activities:manage',
    'events:manage',
    'surveys:manage',
    'feedback:manage',
    'repository:manage',
    'dei:manage',
    'indicators:view',
    'indicators:export',
    'improvement:manage',
    // Segregação de funções (§23): Administrador técnico NÃO recebe automaticamente `preboarding:view_restricted_vault`
  ],
  auditor_lgpd: ['admin:access', 'roles:view', 'audit:view', 'indicators:view'],
};

export function getPermissionsForRoles(roles: RoleCode[]): PermissionCode[] {
  const set = new Set<PermissionCode>();
  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    for (const p of perms) set.add(p);
  }
  return Array.from(set);
}

export function hasPermission(roles: RoleCode[], permission: PermissionCode): boolean {
  return getPermissionsForRoles(roles).includes(permission);
}

export function canAccessAdmin(roles: RoleCode[]): boolean {
  return hasPermission(roles, 'admin:access');
}

/**
 * Proteção contra injeção de fórmulas em CSV/planilhas (§31).
 * Qualquer célula iniciada por =, +, -, @, TAB ou CR recebe prefixo apóstrofo seguro.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[";\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Gera CSV UTF-8 com BOM e separador ponto e vírgula (padrão brasileiro §31).
 */
export function buildBrazilianCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(';');
  const bodyLines = rows.map((row) => row.map(sanitizeCsvCell).join(';'));
  return '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
}

/**
 * Gera arquivo iCalendar (RFC 5545 .ics) para exportação de eventos (§16).
 */
export function buildEventIcs(event: {
  id: string;
  title: string;
  description: string;
  location: string;
  startIso: string;
  endIso: string;
  organizer: string;
}): string {
  const formatIcsUtc = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
      d.getUTCHours(),
    )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };
  const escapeIcs = (text: string) =>
    text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|[\r\n]/g, '\\n');

  const now = formatIcsUtc(new Date().toISOString());
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Enap//Enap e-Vida//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:evida-event-${event.id}@enap.gov.br`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsUtc(event.startIso)}`,
    `DTEND:${formatIcsUtc(event.endIso)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    `LOCATION:${escapeIcs(event.location)}`,
    `CONTACT:${escapeIcs(event.organizer)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Lembrete do evento Enap e-Vida',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
