# Enap e-Vida — Protótipo Navegável e Funcional

> **Conexões que acolhem. Experiências que transformam.**
> *Sua jornada. Seu bem-estar. Nossa Enap.*

Protótipo full-stack (React + Express + PostgreSQL + PWA) da plataforma institucional **Enap e-Vida**, fundamentado no **RGI 2025**, na metodologia **A Jornada da Ambientação — Da posse ao pertencimento** e nos formulários oficiais de Pré-Embarque **GAEG Nível Superior** e **GAEG Nível Intermediário**.

## Aviso de Ambiente Demonstrativo
Todos os usuários, protocolos, respostas, jornadas e séries históricas presentes na base inicial são **fictícios**. A aplicação cria as tabelas e carrega esses registros na primeira inicialização de um banco PostgreSQL vazio e dedicado ao piloto.

## Como Executar

Use Node.js 24 e um banco PostgreSQL dedicado. Copie `.env.example` para
`.env` e configure `DATABASE_URL` com a conexão ao banco.

```bash
npm ci
npm run dev
```

A aplicação (frontend + API) será servida na porta `3000` (`http://localhost:3000`).

## GitHub Pages

A [apresentação pública](https://dmenezes007.github.io/enap-e-vida/) usa o logo
`public/enap-e-vida.png` e pode ser instalada como PWA. Login, Pré-Embarque,
painéis e persistência dependem da API Express e do PostgreSQL. Use a execução
com servidor descrita acima para acessar esses recursos.

O Pages pode publicar a raiz de `main` (**Deploy from a branch → main → / (root)**).
Nesse modo, o `index.html` da raiz e seus recursos são gerados por
`npm run build:pages`. Para atualizar a publicação por branch, copie o conteúdo
de `dist/` para a raiz e inclua os arquivos gerados no commit. O HTML usado
como entrada pelo Vite fica em `src/index.html`.

Para gerar e publicar o build pelo workflow manual, selecione
**GitHub Actions** como fonte e execute **Publicar no GitHub Pages** na
branch `main`. Para conferir o build localmente, execute `npm run build:pages` e
`npm run preview -- --mode pages`, então abra `http://localhost:4173/enap-e-vida/`.

### Testes Automatizados (Regras de Domínio, Segurança e Indicadores)
```bash
npm test
```

Para verificar o MVP por HTTP, configure `TEST_DATABASE_URL` com uma conexão
direta a um PostgreSQL de teste com permissão para criar schemas. O teste
cria um schema temporário e usa somente dados fictícios.

```bash
npm run build
npm run test:mvp
```

### Build de Produção

```bash
npm run build
npm start
```

`npm start` inicia o **piloto restrito a dados fictícios**, com o frontend e
a API na mesma origem. Defina `PILOT_ACCESS_PASSWORD` e
`VAULT_ENCRYPTION_KEY` com dois valores diferentes, gerados separadamente com
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Use as variáveis de ambiente da hospedagem ou um arquivo `.env` local.
Ao acessar o piloto, o navegador solicitará o usuário `piloto` e a senha de
acesso. Depois, use os perfis fictícios descritos abaixo para entrar no app.

### Hospedar o piloto em contêiner

O `Dockerfile` compila o frontend e o servidor a partir de `package-lock.json`.
Passe `DATABASE_URL` e os dois segredos por variáveis de ambiente. Preserve
a chave do cofre ao atualizar o serviço para manter a leitura dos dados cifrados.

```bash
docker build -t enap-e-vida .
docker run --rm --name enap-e-vida --env-file .env -e PORT=3000 \
  -p 127.0.0.1:3000:3000 enap-e-vida
```

### Publicar no Render + Neon

1. Crie um projeto no plano gratuito do Neon com um banco exclusivo para o
   piloto. No painel **Connect**, copie a URL agrupada (pooled) e configure
   `sslmode=verify-full` para verificar o certificado do servidor.
2. No Render, crie um **Blueprint** a partir deste repositório. O
   `render.yaml` define um serviço Docker **Free** e verifica a conexão
   com o banco por `/healthz`.
3. Preencha `DATABASE_URL`, `PILOT_ACCESS_PASSWORD` e
   `VAULT_ENCRYPTION_KEY` como segredos do serviço. Use dois valores
   aleatórios distintos para a senha e a chave. Distribua a senha somente
   aos participantes autorizados do piloto com dados fictícios.
4. Após a implantação, confirme `/healthz` e use os perfis abaixo para
   validar login, Pré-Embarque e painéis no endereço HTTPS do Render. Um
   serviço gratuito pode adormecer quando está ocioso. O Neon guarda os
   registros entre reinícios do Render.

## Credenciais de Demonstração (Dados Fictícios)

Senha padrão de todos os 15 perfis demonstrativos: **`EnapDemo@2026`**
Código MFA demonstrativo (quando aplicável): **`202600`**

- **Ingressante 30 dias:** `acompanhamento30@demo.enap.gov.br`
- **Chefia Imediata:** `chefia@demo.enap.gov.br`
- **Responsável Pré-Embarque (acesso exclusivo ao cofre bancário/sensível):** `preingresso.gestao@demo.enap.gov.br`
- **Gestor(a) da Ambientação:** `ambientacao@demo.enap.gov.br`
- **Analista de Indicadores:** `estrategia@demo.enap.gov.br`
- **Administrador(a) Técnico(a) (sem acesso ao cofre bancário):** `admin@demo.enap.gov.br`

### Convites e Protocolo de Pré-Embarque para Teste
- **GAEG Nível Superior:** código `ENAP-2026-NS01` · e-mail `pre.ns@demo.enap.gov.br`
- **GAEG Nível Intermediário:** código `ENAP-2026-NI02` · e-mail `pre.ni@demo.enap.gov.br`
- **Acompanhamento de protocolo já enviado:** `ENAP-PRE-2026-A91F3C` · e-mail `clara.ficticio@exemplo.gov.br`

## Documentação Técnica
- Esquema executado no piloto PostgreSQL: `/server/db.ts`.
- Esquema institucional de referência PostgreSQL 16+ (8 schemas + RLS): `/docs/database/migrations/001_initial_schema.sql`.
- Arquitetura, ERD, Matriz RBAC, Inventário LGPD e Checklists: `/docs/ARQUITETURA_E_GOVERNANCA.md`
- Escopo, testes de aceitação e pendências: `/docs/MVP.md`
