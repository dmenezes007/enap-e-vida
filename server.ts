import express from 'express';
import cookieParser from 'cookie-parser';
import {createHash, timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {seedDatabaseIfEmpty} from './server/seed';
import {apiRouter} from './server/routes';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

async function bootstrap() {
  const pilotPassword = process.env.PILOT_ACCESS_PASSWORD;
  if (isProduction) {
    if (!pilotPassword || !/^[a-f0-9]{64}$/i.test(pilotPassword)) {
      throw new Error('PILOT_ACCESS_PASSWORD deve conter 64 caracteres hexadecimais.');
    }
    if (!/^[a-f0-9]{64}$/i.test(process.env.VAULT_ENCRYPTION_KEY || '')) {
      throw new Error('VAULT_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais.');
    }
  }
  seedDatabaseIfEmpty();

  const app = express();
  app.disable('x-powered-by');

  // Cabeçalhos de segurança HTTP (OWASP ASVS — §28)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.get('/healthz', (_req, res) => res.set('Cache-Control', 'no-store').send('ok'));

  if (isProduction && pilotPassword) {
    const expected = digest(Buffer.from(`piloto:${pilotPassword}`).toString('base64'));
    app.use((req, res, next) => {
      const match = req.get('Authorization')?.match(/^Basic ([A-Za-z0-9+/]+=*)$/i);
      if (match && timingSafeEqual(digest(match[1]), expected)) {
        res.set('Cache-Control', 'private, no-store');
        return next();
      }
      res.set('Cache-Control', 'no-store');
      res.set('WWW-Authenticate', 'Basic realm="Enap e-Vida - Piloto"');
      return res.status(401).send('Acesso restrito ao piloto.');
    });
  }

  app.use(express.json({limit: '1mb'}));
  app.use(cookieParser());

  // Rotas de API com controle de acesso e proteção de cache para dados pessoais
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
  });
  app.use('/api', apiRouter);
  app.use('/api', (_req, res) => res.status(404).json({error: 'Rota de API não encontrada.'}));

  if (isProduction) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Enap e-Vida server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start Enap e-Vida server:', err);
  process.exit(1);
});
