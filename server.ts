import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import {createServer as createViteServer} from 'vite';
import {seedDatabaseIfEmpty} from './server/seed';
import {apiRouter} from './server/routes';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  seedDatabaseIfEmpty();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit: '1mb'}));
  app.use(cookieParser());

  // Cabeçalhos de segurança HTTP (OWASP ASVS — §28)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Rotas de API com controle de acesso e proteção de cache para dados pessoais
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
  });
  app.use('/api', apiRouter);

  if (isProduction) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
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
