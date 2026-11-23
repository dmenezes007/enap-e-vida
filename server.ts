import express from 'express';
import type {ErrorRequestHandler} from 'express';
import cookieParser from 'cookie-parser';
import {createHash, timingSafeEqual} from 'node:crypto';
import path from 'node:path';
import {seedDatabaseIfEmpty} from './server/seed';
import {apiRouter} from './server/routes';
import {db, initSchema} from './server/db';

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
  await db.transaction(async () => {
    await db.run('SELECT pg_advisory_xact_lock(360283463)');
    await initSchema();
    await seedDatabaseIfEmpty();
  });

  const app = express();
  app.disable('x-powered-by');

  // Cabeçalhos de segurança HTTP (OWASP ASVS — §28)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.get('/healthz', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      await db.one('SELECT 1');
      res.send('ok');
    } catch {
      res.status(503).send('Banco de dados indisponível.');
    }
  });

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
  const handleApiError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({error: 'O corpo da solicitação deve conter JSON válido.'});
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({error: 'O corpo da solicitação excede o limite permitido.'});
    }
    console.error('Falha ao processar solicitação da API.', error.code ?? '');
    return res.status(500).json({error: 'Erro interno ao processar a solicitação.'});
  };
  app.use('/api', handleApiError);

  if (isProduction) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (_req, res) => {
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
  console.error('Falha ao iniciar o servidor Enap e-Vida:', (err as Error).message);
  process.exit(1);
});
