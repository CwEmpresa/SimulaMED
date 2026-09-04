<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reta Final ENAMED/ENARE

SaaS de treino para o ENAMED/ENARE: simulados cronometrados, banco de questões,
cadernos de erro e diagnóstico. Upsell do infoproduto "120 Mapas Visuais".
Narrativa: **"Faça a prova antes da prova."**

## Stack

Next.js (App Router) + TypeScript + Tailwind 4 · Supabase (Postgres + Auth + RLS) · Vercel.
Auth por magic link. O vínculo automático com a compra (webhook Lowify) é fase 2 —
hoje o acesso é por convite/cadastro manual.

## Supabase

Projeto `reta-final-enamed` (`jwaarcrlhvtuydepwavk`), região `sa-east-1`.
Todas as tabelas têm RLS: cada usuário só acessa as próprias tentativas, respostas e
caderno de erros; `questoes` é leitura para qualquer autenticado e escrita apenas via
`service_role` (script de importação).

`public.usuarios` espelha `auth.users` por trigger (`handle_new_user`), então o login
por magic link já cria a linha do usuário.

## Conteúdo e o rebalanceamento do gabarito

A planilha de produção (`Template_Producao_Questoes_ENAMED_ENARE.xlsx`, aba
"Simulados (300)") tem hoje as 100 questões do Simulado 1. Os Simulados 2 e 3 e o
Banco de 500 ainda serão produzidos — o schema já os suporta sem alteração.

**Importante:** o Simulado 1 saiu da produção com a alternativa correta em A em 69 das
100 questões (A=69, B=30, C=1, D=0). `scripts/import-questoes.ts` redistribui a posição
da correta para 25/25/25/25 com seed fixa (`SEED = 20260902`) e reescreve as letras
citadas em `comentario_erros` para continuarem coerentes. A planilha original nunca é
alterada; o rebalanceamento acontece só na importação.

- Não mexer na `SEED` sem reimportar tudo — mudá-la reembaralha todas as questões.
- `comentario_correta` e `enunciado` **não** são reescritos (foi verificado que nenhum
  deles referencia letras de alternativa; "Plano A:" e "39°C)" são falsos positivos).
- O formato de `comentario_erros` aceita grupos combinados ("C e D: ..."), já tratados.

```bash
npm run import:questoes -- --dry-run   # gera supabase/seed/*.json e *.sql, não escreve
npm run import:questoes                # faz upsert por id_planilha (idempotente)
```

O import exige `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` (ignora RLS).

## Formato rico de questão: três apoios visuais independentes

`questoes` tem três colunas opcionais para aproximar o formato da prova real —
cada uma liga/desliga por conta própria, uma questão pode ter nenhuma, uma, ou
as três combinadas:

- **`tabela_dados`** (jsonb) — `{ colunas: string[], linhas: string[][] }`.
  Número e nomes de coluna não são fixos: às vezes 3 ("Exame"/"Resultado"/
  "Referência"), às vezes 4 ("Parâmetro"/"Pré-BD"/"Pós-BD"/"Previsto"). **É
  `colunas`/`linhas` como arrays, não uma lista de objetos `{coluna: valor}`
  por linha** — o Postgres normaliza jsonb reordenando as chaves de um objeto
  (por tamanho, depois lexicograficamente), então um objeto por linha perderia
  a ordem das colunas silenciosamente. Só array preserva ordem de inserção no
  jsonb. Verificado na prática: inseri um objeto com chaves na ordem
  Parâmetro/Pré-BD/Pós-BD/Previsto e o Postgres devolveu Pré-BD/Pós-BD/
  Previsto/Parâmetro (6/6/8/9 caracteres).
- **`grafico_svg`** (text) — marcação SVG inline de um traçado/gráfico
  esquemático (ECG, curva de espirometria). É representação de padrão
  fisiológico, não foto de paciente real, então **pode** ser gerada com
  segurança (ao contrário de `imagens`, abaixo). Renderizado via
  `dangerouslySetInnerHTML` porque é conteúdo autoral de `questoes` (mesma
  confiança de `enunciado`), nunca entrada de usuário.
- **`imagens`** (jsonb) — lista de `{ url, legenda }`, 0 a N por questão (ex.
  sequência radiológica evolutiva "1 hora / 12 horas / 24 horas", renderizadas
  lado a lado). Substituiu os campos antigos `imagem_url`/`imagem_legenda`
  (migração `substituir_imagem_por_imagens_e_adicionar_grafico_svg`).

Nenhum dos três é gabarito, então ficam liberados para `authenticated` pelo
mesmo grant de coluna que libera `enunciado`/`alternativa_*` — toda coluna
nova nesta tabela precisa de um `grant select` explícito à parte, porque não
herda o grant de coluna já existente (já foi esquecido uma vez).

- Renderização em `src/components/questao/apoio-questao.tsx`
  (`TabelaDadosQuestao`, `GraficoSvgQuestao`, `ImagensQuestao`, esta última com
  lightbox por imagem), reaproveitado em Modo Prova, Banco, Gabarito e
  Cadernos — sempre entre o enunciado e as alternativas, e sempre condicional:
  a maioria das questões continua só com texto.
- **Nunca gerar imagem médica *fotográfica* sintética por IA.** Uma foto
  "quase certa" de lesão de pele/radiografia/endoscopia ensinaria errado
  exatamente o reconhecimento visual que a questão testa. `imagens` fica
  vazio até existir um banco de imagens licenciado; preencher é decisão do
  Carlos, não algo para fazer sozinho. Isso não vale para `grafico_svg` — um
  traçado esquemático não é uma foto de paciente.
- **Sem logo de terceiro na tela de prova.** O cabeçalho do Modo Prova
  (`TelaProva`) usa a marca do próprio produto e uma tarja "Modo Prova ·
  Simulado Nº X" — nunca a logo do ENAMED/ENARE/INEP, o que sugeriria
  afiliação/endosso que não existe (contradiria o aviso legal do rodapé).
- **Nenhuma pista de área/subtema perto da questão em Modo Prova.** Uma
  primeira versão mostrava a área (e um código curto tipo "CM"/"PED") ao lado
  de cada questão — foi removida porque entrega o tema antes de o aluno
  responder, o que a prova real não faz e reduz a dificuldade do treino. A
  área continua visível depois de responder (Gabarito, Cadernos, Diagnóstico),
  onde é revisão, não pista.

## Modo Prova — regras que não podem ser relaxadas

O simulado vale dinheiro e nota, então as defesas ficam no **banco**, não na UI.
Um teste ponta a ponta (`npm run testar:prova`) roda como aluno real, com chave
anon e sessão, e falha se qualquer uma destas regras cair:

- **O gabarito não é legível durante a prova.** RLS é por linha, não por coluna:
  um aluno autenticado conseguia fazer `select resposta_correta from questoes`
  direto na API. Hoje `resposta_correta`, `comentario_correta` e
  `comentario_erros` estão fora do `grant` de coluna do papel `authenticated`.
  A liberação legítima vem da view `gabaritos_liberados`, que só devolve o que o
  usuário já concluiu (simulado finalizado, ou questão do banco já respondida).
  Por isso as telas de revisão leem o gabarito da **view**, nunca de `questoes`.
- **Nada é gravado com a prova encerrada ou fora do prazo.** As políticas de
  insert/update em `respostas_simulado` exigem `status = 'em_andamento'` e
  `now() <= iniciado_em + 5 horas`. Não existe política de delete.
- **`finalizar_tentativa` é SECURITY DEFINER** justamente porque precisa corrigir
  provas cujo prazo venceu (envio automático), o que as políticas acima
  impediriam. Como o RLS não a protege, ela confere a posse com
  `auth.uid()` explicitamente. É idempotente e usa `FOR UPDATE`.
- **O tempo vem sempre de `iniciado_em`**, nunca do relógio do cliente, e é
  limitado a 5 horas no cálculo de `tempo_usado_segundos`.
- A tela de prova consulta apenas colunas seguras — ver a seleção explícita em
  `src/app/simulados/[numero]/prova/page.tsx`. Não trocar por `select('*')`.

## Conta e onboarding

`public.usuarios` tem RLS de "só a própria linha", mas isso não diz **quais
colunas**. O aluno conseguia sobrescrever o próprio `email` — justamente a chave
que liga a conta à compra na Lowify e que o webhook da fase 2 vai usar. Hoje o
papel `authenticated` só tem grant de update em `nome` e
`onboarding_concluido_em`; `email`, `id` e `criado_em` ficam de fora. A tela de
Perfil reflete isso: o e-mail é somente leitura.

A conclusão do onboarding é gravada em `usuarios.onboarding_concluido_em`, e não
no navegador, para não reaparecer em outro aparelho nem sumir por limpeza de
cache. `/dashboard` desvia para `/onboarding` enquanto a marca é nula, e
`/onboarding` desvia para `/dashboard` quando não é — condições complementares,
sem risco de pingue-pongue. Coberto por `npm run testar:conta`.

## Armadilha: nunca usar `select('*')` em `questoes`

O papel `authenticated` não tem privilégio sobre `resposta_correta`,
`comentario_correta` e `comentario_erros`. Como `select('*')` pede todas as
colunas, ele **falha em silêncio**: `count` volta nulo e nenhum erro é levantado.
Isso já produziu um dashboard afirmando "nenhuma questão importada" com as 100
questões no banco. Sempre listar colunas explicitamente — inclusive em
contagens, onde `select('id', { count: 'exact', head: true })` é a forma
correta. Há teste de regressão em `npm run testar:prova`.

## Banco de Questões

Modo oposto ao da prova: corrige na hora. Como o aluno não pode ler
`resposta_correta` (privilégio de coluna), quem compara é o Postgres —
`responder_banco(questao_id, alternativa)` registra a resposta e devolve na
mesma chamada se acertou, a alternativa correta e os dois comentários. É
`SECURITY DEFINER`, então valida `auth.uid()` e recusa questão de outro tipo.

- **Favoritar não pode liberar gabarito.** Favoritar cria linha em
  `respostas_banco` antes de responder; como a view `gabaritos_liberados`
  liberava pela existência da linha, isso vazaria a resposta. A view agora exige
  `alternativa_escolhida is not null`. Ao mexer nessa view, refazer esse teste.
- Refazer uma questão atualiza a linha (não duplica) e **não** apaga o favorito.
- A correção é restaurada ao reabrir a tela, lida de `gabaritos_liberados` — sem
  isso uma questão respondida reaparecia "em branco" e o comentário se perdia.
- Filtros ficam na URL (formulário GET), então o estado é compartilhável,
  sobrevive ao refresh e funciona sem JavaScript.
- A tabela ainda não tem questões `tipo = 'banco'`; a tela cai no estado vazio
  "Banco de questões em produção". `npm run testar:banco` semeia questões
  descartáveis, exercita o fluxo e apaga tudo no fim.

## Limite de envio de e-mail do Supabase (bloqueio conhecido)

O magic link real usa o serviço de e-mail **embutido** do Supabase, que tem uma
cota conjunta e muito baixa por hora para todo o projeto (`/auth/v1/signup`,
`/auth/v1/recover`, envio de OTP/magic link somados) — confirmado batendo
direto na API: `error.code = over_email_send_rate_limit`, HTTP 429. Não é
configurável pelo dashboard nem por código; só aumenta configurando **SMTP
próprio**. Testar o login algumas vezes seguidas já é o suficiente pra estourar.

- **Durante o desenvolvimento:** usar `/dev/login` (ver seção abaixo) em vez do
  magic link real — não depende de e-mail.
- **Antes de qualquer lançamento real:** configurar SMTP próprio em Supabase
  Dashboard → Authentication → Emails → SMTP Settings (Resend, SendGrid, AWS
  SES, Postmark...). É recomendação da própria checklist de produção do
  Supabase, tanto pelo limite quanto pela entregabilidade (domínio confiável).
  Isso exige criar conta num provedor e colar credenciais — decisão do Carlos,
  não algo para fazer sozinho.

## Login por senha (somente desenvolvimento)

O acesso real é por magic link, o que inviabiliza testar telas protegidas sem
uma caixa de e-mail. Para isso existe `/dev/login`, com **três guardas
independentes** — se qualquer uma sozinha falhar, a rota vira um bypass de
autenticação em produção:

1. a página chama `notFound()` quando `NODE_ENV === 'production'`;
2. a server action recusa com erro na mesma condição;
3. `/dev` só entra em `ROTAS_PUBLICAS` do proxy fora de produção.

Verificado contra um build de produção real (`next start`): sem sessão dá 307
para `/login`, com sessão dá 404, e o HTML com o campo de senha nunca é servido.
Ao mexer nessa rota, repetir esse teste.

```bash
npm run dev:usuario -- --limpar   # cria/reseta dev@reta-final.local
npm run dev                        # depois entre em /dev/login
```

## Sistema visual

Direção: precisão, calma sob pressão, confiança. Estilo base **Soft UI
Evolution** — profundidade por sombra suave em vez de borda dura, contraste
WCAG AA, nada de neon nem gradiente decorativo. O acento teal é o "10" da
proporção 60-30-10: reservado para ação e progresso.

- **Tokens em `src/app/globals.css`.** Usar as variáveis (`bg-superficie`,
  `text-texto-suave`, `border-borda`, `shadow-[var(--sombra-2)]`), nunca hex
  solto. Há escala de elevação (`--sombra-1/2/3`) e de z-index declarada.
- **Tipografia:** Figtree (`font-display`) em títulos e números, Geist no corpo
  — enunciado clínico longo pede a fonte mais neutra.
- **Ícones:** SVG inline em `src/components/ui/icones.tsx`, traço 1.75 e
  `currentColor`. **Emoji nunca é ícone** — foi um erro corrigido nesta fase.
- **Primitivos** em `src/components/ui/primitivos.tsx`: `CartaoMetrica`,
  `BarraArea`, `EstadoVazio`, `TituloSecao`, `botaoPrimario`/`botaoSecundario`.
  Preferir compor com eles a reescrever classes soltas.
- **Casca:** `CascaApp` dá barra superior no desktop e barra inferior no celular.
  **Não é aplicada no Modo Prova** de propósito: durante as 5 horas a tela é um
  ambiente fechado, sem atalho para sair sem querer.
- **Movimento:** entradas de 0.5s com `[0.22, 1, 0.36, 1]`, reações de 200ms,
  nada em laço exceto o pulso do cronômetro na faixa crítica. Hover muda sombra
  e cor, nunca escala — transformar o cartão desloca o que está ao redor.
  `prefers-reduced-motion` é respeitado token a token e em cada componente.

Um Server Component **não pode passar a função de um componente** para um Client
Component (`icone={IconeX}` quebra em runtime). Passar o elemento já renderizado:
`icone={<IconeX className="size-5" />}`.

## Caderno de Erros, Gabarito e área mais fraca

- **Caderno de Erros só recebe questão respondida E errada.** `finalizar_tentativa`
  exigia apenas `coalesce(r.correta, false) = false`, o que também é verdade
  para uma questão nunca tocada (a linha nem existe em `respostas_simulado`) —
  ou seja, em branco entrava como "erro". A condição agora exige
  `r.alternativa_escolhida is not null and r.correta = false`. Uma migração de
  limpeza removeu as entradas antigas que só existiam por causa disso.
- **`respostas_simulado_detalhadas`** (view, `security_invoker`) expõe
  `usuario_id`/`alternativa_escolhida` por resposta de simulado. Existe porque
  `caderno_erros` é deduplicado por `(usuario_id, questao_id, origem)` — não
  guarda qual tentativa gerou a entrada nem qual alternativa foi marcada — e a
  tela de Cadernos precisa disso pra mostrar "sua resposta" em cada erro.
- **`DetalheQuestao`** (`src/components/revisao/detalhe-questao.tsx`) é o
  componente único para "alternativas + resposta marcada + resposta correta +
  comentário", reaproveitado em Cadernos e no Gabarito — nunca duplicar essa
  marcação em outro lugar.
- **Ver Gabarito** (`/simulados/resultado/[id]/gabarito`) mostra as 100
  questões coloridas por resultado (verde/vermelho/cinza), reaproveitando a
  divisão grade+detalhe do Modo Prova. Nunca assumir uma resposta correta
  "default" quando o gabarito não resolve para uma questão (já foi um bug real
  aqui: caía silenciosamente em `'A'`) — filtrar a questão fora é preferível a
  mostrar um resultado errado numa tela cujo propósito é ser a fonte confiável
  do que o aluno acertou ou errou.
- **`analisarAreaMaisFraca`** (`src/lib/diagnostico.ts`) ordena o array por
  conta própria antes de ler `[0]`/`[length-1]` — não confia que quem chama já
  mandou ordenado. Ela existe para eliminar exatamente o tipo de bug de "pegar
  uma posição de array como se fosse a resposta certa"; ficar frágil a isso
  internamente seria irônico. Retorna um dos quatro tipos (`sem_dados`,
  `tudo_bem`, `empatado`, `ok`) — `empatado` cobre tanto "ninguém respondeu
  nada" quanto qualquer empate genuíno no pior percentual, e `ok.areas` traz
  TODAS as áreas empatadas na pior posição, nunca só a primeira do array.
  Coberta por `npm run testar:area-fraca` (função pura, sem banco).

## Convenções

- Schema, colunas e nomes de domínio em **português** (`questoes`, `tentativas_simulado`).
- Tokens de design em `src/app/globals.css` — usar as variáveis (`bg-superficie`,
  `text-texto-suave`, `border-borda`), nunca hex solto.
- Sempre `supabase.auth.getUser()` no servidor, nunca `getSession()` (o cookie é forjável).
- Motion.dev para microinterações; `prefers-reduced-motion` já está tratado no globals.css.
