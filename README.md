# SimulaMed — Reta Final ENAMED/ENARE

SaaS de treino para o ENAMED/ENARE: simulados cronometrados, banco de questões,
cadernos de erro e diagnóstico de desempenho. Narrativa do produto: **"Faça a
prova antes da prova."**

Para as regras de negócio, decisões de arquitetura e armadilhas já resolvidas
neste projeto, ver **[AGENTS.md](./AGENTS.md)** — é a fonte de verdade sobre
o schema, o RLS do Modo Prova, o formato rico de questão e o sistema visual.
Este README cobre só o "como rodar".

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind 4 · Supabase (Postgres + Auth
+ RLS) · Vercel. Sem senha, sem magic link, sem SMTP: o acesso é liberado pelo
webhook da Lowify numa compra aprovada, e o aluno só digita o e-mail em
`/login` (ver AGENTS.md, "Acesso por e-mail"). Login por senha só existe em
desenvolvimento, ver abaixo.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencher com as chaves do projeto Supabase
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O acesso real depende de
uma compra aprovada via webhook da Lowify (ver AGENTS.md, "Acesso por
e-mail") — para testar telas protegidas sem simular uma compra toda vez, use
`/dev/login`:

```bash
npm run dev:usuario -- --limpar   # cria/reseta dev@reta-final.local
npm run dev                        # depois entre em /dev/login
```

`/dev/login` só existe fora de `NODE_ENV=production` — três guardas
independentes garantem isso (ver AGENTS.md).

## Variáveis de ambiente

Ver `.env.example` para a lista completa e o que cada uma faz. Resumo:

| Variável                        | Obrigatória para           |
| -------------------------------- | --------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | tudo                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | tudo                        |
| `SUPABASE_SERVICE_ROLE_KEY`       | scripts de importação e o webhook da Lowify |
| `NEXT_PUBLIC_SITE_URL`            | Open Graph / robots.txt / sitemap.xml corretos em produção |
| `LOWIFY_WEBHOOK_SECRET`           | webhook `/api/webhooks/lowify` |
| `NEXT_PUBLIC_SENTRY_DSN`          | monitoramento de erros (Sentry) |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | upload de source maps do Sentry no build |

## Scripts

```bash
npm run dev                # servidor de desenvolvimento
npm run build               # build de produção
npm run lint                 # ESLint
npm run typecheck            # tsc --noEmit

npm run import:questoes -- --dry-run   # importa os Simulados (planilha de produção)
npm run import:questoes
npm run import:banco -- --dry-run       # importa o Banco de 500
npm run import:banco
npm run questoes:aprovar                # reaprova questões após reimportar (ver AGENTS.md)
npm run imagens:enviar <arquivo> <nome> # envia imagem clínica para o bucket privado

npm run testar:prova        # E2E do Modo Prova, como aluno real (RLS ativo)
npm run testar:banco         # E2E do Banco de Questões
npm run testar:conta         # E2E de onboarding/conta
npm run testar:acesso        # E2E do acesso por e-mail (webhook → sessão → RLS); precisa do `npm run dev` rodando
npm run testar:area-fraca    # teste unitário do diagnóstico (sem banco)
npm run dev:usuario -- --limpar   # cria/reseta o usuário de dev
```

## Deploy

GitHub → Vercel (deploy automático a cada push em `main`). Configurar em
Vercel todas as variáveis de ambiente da tabela acima (a `SUPABASE_SERVICE_ROLE_KEY`
e o `LOWIFY_WEBHOOK_SECRET` são segredos — nunca commitar, só cadastrar como
env var da Vercel).

## CI

`.github/workflows/ci.yml` roda lint + typecheck + build em todo push/PR para
`main`. Os testes E2E (`testar:*`) rodam contra o Supabase de produção e por
isso não entram no CI automático — só sob demanda (`workflow_dispatch`), com
os segredos `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` cadastrados em Settings → Secrets and variables →
Actions.
