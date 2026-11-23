import crypto from 'node:crypto';

const VAULT_KEY_HEX =
  process.env.VAULT_ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.VAULT_ENCRYPTION_KEY)
    ? process.env.VAULT_ENCRYPTION_KEY
    : crypto
        .createHash('sha256')
        .update(process.env.SESSION_SECRET || 'enap-evida-demo-vault-key-only-for-dev-prototype')
        .digest('hex');

const VAULT_KEY = Buffer.from(VAULT_KEY_HEX, 'hex');

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateProtocol(prefix = 'ENAP-PRE'): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${year}-${suffix}`;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

/**
 * Cifragem autenticada AES-256-GCM para compartimento segregado
 * (dados bancários e atributos sensíveis de pré-ingresso — §8.3 e §28).
 */
export function encryptVaultJson(payload: Record<string, unknown>): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', VAULT_KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptVaultJson<T = Record<string, unknown>>(encoded: string): T {
  const parts = encoded.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Formato de cofre criptográfico inválido.');
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    VAULT_KEY,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}
