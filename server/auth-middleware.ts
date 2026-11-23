import type {NextFunction, Request, Response} from 'express';
import {db, logAuditEvent} from './db';
import {generateId, generateSessionToken, hashToken} from './crypto';
import {getPermissionsForRoles, hasPermission} from '../src/lib/security';
import type {PermissionCode, RoleCode, UserProfile} from '../src/lib/types';

export const SESSION_COOKIE_NAME = 'evida_sid';
const IDLE_TIMEOUT_MS = 1000 * 60 * 60 * 4; // 4h em demonstração (configurável por política institucional)
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
  sessionId?: string;
}

// Rate limiter em memória para proteção contra força bruta e enumeração (§10 e §28)
const rateBuckets = new Map<string, {count: number; resetAt: number}>();

export function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'local'}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, {count: 1, resetAt: now + windowMs});
      return next();
    }
    bucket.count += 1;
    if (bucket.count > maxRequests) {
      return res.status(429).json({
        error: 'Muitas tentativas em curto intervalo. Aguarde alguns instantes e tente novamente.',
      });
    }
    return next();
  };
}

export function hydrateUser(userId: string, mfaVerified = true): UserProfile | null {
  const row = db
    .prepare(
      `SELECT id, email, full_name, preferred_name, social_name, employment_type,
              organizational_unit, position_title, entry_date, journey_stage,
              is_active, mfa_enabled, accessibility_prefs_json, notification_prefs_json
       FROM users WHERE id = ?`,
    )
    .get(userId) as Record<string, unknown> | undefined;

  if (!row || !row.is_active) return null;

  const roleRows = db
    .prepare('SELECT role_code FROM user_roles WHERE user_id = ?')
    .all(userId) as Array<{role_code: RoleCode}>;
  const roles = roleRows.map((r) => r.role_code);

  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name),
    preferredName: String(row.preferred_name),
    socialName: row.social_name ? String(row.social_name) : null,
    employmentType: String(row.employment_type),
    organizationalUnit: String(row.organizational_unit),
    positionTitle: String(row.position_title),
    entryDate: row.entry_date ? String(row.entry_date) : null,
    journeyStage: row.journey_stage ? String(row.journey_stage) : null,
    roles,
    permissions: getPermissionsForRoles(roles),
    mfaEnabled: Boolean(row.mfa_enabled),
    mfaVerified,
    accessibilityPrefs: JSON.parse(String(row.accessibility_prefs_json)),
    notificationPrefs: JSON.parse(String(row.notification_prefs_json)),
  };
}

export function createSessionForUser(
  req: Request,
  res: Response,
  userId: string,
  mfaVerified = true,
): string {
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const id = generateId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, mfa_verified, last_activity_at, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    tokenHash,
    req.headers['user-agent']?.slice(0, 180) || 'Navegador Web',
    req.ip || '127.0.0.1',
    mfaVerified ? 1 : 0,
    now.toISOString(),
    expiresAt.toISOString(),
    now.toISOString(),
  );

  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });

  return id;
}

export function attachSession(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (!rawToken || typeof rawToken !== 'string') {
    return next();
  }
  const tokenHash = hashToken(rawToken);
  const session = db
    .prepare(
      `SELECT id, user_id, mfa_verified, last_activity_at, expires_at, revoked_at
       FROM sessions WHERE token_hash = ?`,
    )
    .get(tokenHash) as
    | {
        id: string;
        user_id: string;
        mfa_verified: number;
        last_activity_at: string;
        expires_at: string;
        revoked_at: string | null;
      }
    | undefined;

  if (!session || session.revoked_at) return next();

  const now = Date.now();
  const expired = new Date(session.expires_at).getTime() < now;
  const idleExpired = now - new Date(session.last_activity_at).getTime() > IDLE_TIMEOUT_MS;
  if (expired || idleExpired) {
    db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      session.id,
    );
    return next();
  }

  const user = hydrateUser(session.user_id, Boolean(session.mfa_verified));
  if (!user) return next();

  db.prepare('UPDATE sessions SET last_activity_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    session.id,
  );
  req.user = user;
  req.sessionId = session.id;
  return next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Autenticação necessária para acessar este recurso.',
    });
  }
  return next();
}

export function requirePermission(permission: PermissionCode) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({error: 'Autenticação necessária.'});
    }
    if (!hasPermission(req.user.roles, permission)) {
      logAuditEvent({
        actorUserId: req.user.id,
        actorEmail: req.user.email,
        action: 'ACCESS_DENIED',
        resourceType: req.path,
        outcome: 'negado',
        metadata: {requiredPermission: permission, userRoles: req.user.roles},
      });
      return res.status(403).json({
        error: 'Acesso negado. Seu perfil não possui permissão para esta operação.',
      });
    }
    return next();
  };
}
