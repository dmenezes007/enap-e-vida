# Enap e-Vida — Protótipo Navegável e Funcional

> **Conexões que acolhem. Experiências que transformam.**
> *Sua jornada. Seu bem-estar. Nossa Enap.*

Protótipo full-stack (React + Express + SQLite persistente + PWA) da plataforma institucional **Enap e-Vida**, fundamentado no **RGI 2025**, na metodologia **A Jornada da Ambientação — Da posse ao pertencimento** e nos formulários oficiais de pré-ingresso **GAEG Nível Superior** e **GAEG Nível Intermediário**.

## Aviso de Ambiente Demonstrativo
Todos os usuários, protocolos, respostas, jornadas e séries históricas presentes na base inicial são **fictícios**. O banco local é inicializado e populado automaticamente em `data/enap-evida.db`.

## Como Executar

```bash
npm install
npm run dev
```

A aplicação (frontend + API) será servida na porta `3000` (`http://localhost:3000`).

## GitHub Pages

A [apresentação pública](https://dmenezes007.github.io/enap-e-vida/) usa o logo
`public/enap-e-vida.png` e pode ser instalada como PWA. Login, pré-ingresso,
painéis e persistência dependem da API Express e do SQLite. Use a execução
com servidor descrita acima para acessar esses recursos.

O Pages pode publicar a raiz de `main` (**Deploy from a branch → main → / (root)**).
Nesse modo, o `index.html` da raiz e seus recursos são gerados por
`npm run build:pages`. Para atualizar a publicação por branch, copie o conteúdo
de `dist/` para a raiz e inclua os arquivos gerados no commit. O HTML usado
como entrada pelo Vite fica em `src/index.html`.

Para gerar e publicar automaticamente o build a cada push, selecione
**GitHub Actions** como fonte e execute **Publicar no GitHub Pages** na
branch `main`. Para conferir o build localmente, execute `npm run build:pages` e
`npm run preview -- --mode pages`, então abra `http://localhost:4173/enap-e-vida/`.

### Testes Automatizados (Regras de Domínio, Segurança e Indicadores)
```bash
npm test
```

### Build de Produção
```bash
npm run build
npm start
```

## Credenciais de Demonstração (Dados Fictícios)

Senha padrão de todos os 15 perfis demonstrativos: **`EnapDemo@2026`**
Código MFA demonstrativo (quando aplicável): **`202600`**

- **Ingressante 30 dias:** `acompanhamento30@demo.enap.gov.br`
- **Chefia Imediata:** `chefia@demo.enap.gov.br`
- **Responsável Pré-ingresso (acesso exclusivo ao cofre bancário/sensível):** `preingresso.gestao@demo.enap.gov.br`
- **Gestor(a) da Ambientação:** `ambientacao@demo.enap.gov.br`
- **Analista de Indicadores:** `estrategia@demo.enap.gov.br`
- **Administrador(a) Técnico(a) (sem acesso ao cofre bancário):** `admin@demo.enap.gov.br`

### Convites e Protocolo de Pré-ingresso para Teste
- **GAEG Nível Superior:** código `ENAP-2026-NS01` · e-mail `pre.ns@demo.enap.gov.br`
- **GAEG Nível Intermediário:** código `ENAP-2026-NI02` · e-mail `pre.ni@demo.enap.gov.br`
- **Acompanhamento de protocolo já enviado:** `ENAP-PRE-2026-A91F3C` · e-mail `clara.ficticio@exemplo.gov.br`

## Documentação Técnica
- Migração de referência PostgreSQL 16+ (8 schemas + RLS): `/docs/database/migrations/001_initial_schema.sql`
- Arquitetura, ERD, Matriz RBAC, Inventário LGPD e Checklists: `/docs/ARQUITETURA_E_GOVERNANCA.md`
