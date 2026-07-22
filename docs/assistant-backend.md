# Rita — Assistente IA do Rende+ (infraestrutura do backend)

> **Estado atual: ligado e a funcionar.** A rota `POST /api/assistant/chat`
> autentica o pedido, aplica os limites de plano, gera o contexto financeiro
> real da conta e transmite a resposta da Rita (Claude, via Anthropic) em
> streaming (SSE) para o frontend.
>
> Este documento descreve o caminho **realmente ativo** (`assistant.chat.*` +
> `providers/anthropic.provider.js`). Existe também um segundo conjunto de
> ficheiros mais antigo (`assistant.controller.js`, `assistant.service.js`,
> `assistant.schemas.js`, `assistant-response.service.js`,
> `prompts/prompt-builder.js`, `actions/*`) de um desenho anterior, não
> streaming, baseado em respostas JSON estruturadas — não está registado em
> `assistant.routes.js` e não corre em produção. Fica documentado à parte na
> secção 9, para não ser confundido com o fluxo ativo nem apagado sem
> intenção.

## 1. Arquitetura

O backend do Rende+ é um servidor **Node.js + Express** simples (CommonJS,
sem TypeScript), com **Prisma** sobre PostgreSQL (Neon) e autenticação por
**JWT** (sem sessões/cookies).

```
src/assistant/
├── assistant.routes.js              # POST /chat (Express Router) — único caminho registado
├── assistant.chat.controller.js     # req/res do streaming SSE
├── assistant.chat.service.js        # orquestra: histórico, limites, contexto, streaming, uso
├── assistant-context.service.js     # resumo financeiro do utilizador (injetado no system prompt)
├── assistant-usage.service.js       # contagem e limites por plano
├── assistant-rate-limit.middleware.js
├── providers/
│   └── anthropic.provider.js        # streaming real com o Claude (fetch nativo, SSE)
├── config.js                        # limites, tamanhos, nomes de env vars
└── prompts/
    └── system-prompt.js             # persona e regras da Rita

# Desenho anterior, não streaming — não está ligado a nenhuma rota (ver nota acima):
├── assistant.controller.js, assistant.service.js, assistant.schemas.js,
│   assistant.repository.js, assistant.types.js, assistant-response.service.js,
│   prompts/prompt-builder.js, actions/action-types.js, actions/action-validator.js
```

Todos os serviços que tocam a base de dados são **fábricas** que aceitam o
cliente Prisma (ou outras dependências) por parâmetro
(`function criarX(prisma = require("../db"))`), para poderem ser testados com
falsos sem tocar na base de dados real.

## 2. Fluxo de uma mensagem (streaming)

```
Frontend (assets/js/api.js → API.assistenteChat)
  → POST /api/assistant/chat  (Authorization: Bearer <token>)
  → exigirLogin                       (src/auth.js — igual ao resto da app)
  → limitarRajadas                    (assistant-rate-limit.middleware.js — ~20/min)
  → assistant.chat.controller.postChatStream:
      1. chatService.prepararChat({ userId, mensagens }):
         - mapeia e corta o histórico às últimas ~10 trocas (20 mensagens)
         - carrega o utilizador autenticado (nunca um userId do body)
         - verifica o limite do plano (assistant-usage.service.js)
         - gera o contexto financeiro (assistant-context.service.js)
      2. abre a resposta SSE (Content-Type: text/event-stream)
      3. chatService.stream(...): monta o system prompt da Rita + contexto,
         pede a resposta ao provider Anthropic aos pedaços (onDelta),
         escreve cada pedaço como `data: {"delta": "..."}\n\n`
      4. em erro a meio do streaming: `data: {"error": "..."}\n\n` com a voz
         da Rita ("Perdi-me a meio da resposta — tenta outra vez?")
      5. no fim: `data: {"done": true}\n\n` e regista o uso do plano
```

## 3. Contrato do endpoint atual

### `POST /api/assistant/chat`

Exige `Authorization: Bearer <token>` (o mesmo JWT usado no resto da API).

**Body:**

```json
{ "mensagens": [{ "role": "user", "texto": "Como estão as minhas finanças este mês?" }] }
```

- `mensagens` — obrigatório, array não vazio; a última tem de ser `role: "user"`.
  Aceita `{role, texto}` (formato do frontend) ou `{role, content}`.
- Não há `userId` nem `period` no corpo — o utilizador vem sempre da sessão;
  o período usado no contexto é sempre o mês atual.

**Resposta:** `Content-Type: text/event-stream`, uma linha `data: {...}\n\n`
por evento:

| Evento | Formato | Significado |
|---|---|---|
| Pedaço de texto | `{"delta": "..."}` | Acrescentar ao texto já mostrado |
| Fim | `{"done": true}` | A resposta terminou |
| Erro | `{"error": "..."}` | Falhou a meio; mensagem já pronta para mostrar ao utilizador |

**Erros antes de abrir o streaming** (JSON normal, com código de estado):
`400` (mensagens inválidas), `401` (sem sessão), `404` (utilizador não
encontrado), `429` (limite de plano atingido ou rajada — `limitarRajadas`
devolve 429 independentemente do limite mensal).

## 4. A Rita — persona e system prompt

`prompts/system-prompt.js` centraliza a personalidade e as regras num único
`SYSTEM_PROMPT` (fácil de iterar sem tocar no resto do módulo):

- Fala sempre em português de Portugal, calorosa, direta e rigorosa com números.
- Baseia-se exclusivamente no contexto financeiro injetado — nunca inventa
  valores; admite quando não tem um dado.
- Formato europeu para dinheiro (`€ 1.234,56`) e percentagens (`12,5%`).
- Sem markdown decorativo (emojis, `**negrito**`, `#títulos`, tabelas,
  linhas horizontais) — só texto corrido e listas com hífen.
- Não dá conselhos de investimento específicos; remete para um profissional.
- Nunca pede nem repete dados sensíveis.

Em `assistant.chat.service.js`, o contexto financeiro (JSON) é anexado ao
fim do `SYSTEM_PROMPT` antes de cada pedido — nunca enviado como mensagem
separada, para não contar para o limite de "últimas ~10 trocas" do histórico
da conversa.

## 5. Contexto financeiro

`assistant-context.service.js` consulta **apenas** os dados do utilizador
autenticado do mês pedido (despesas, rendimentos, metas, contas, lembretes
por pagar) e devolve um resumo pensado para caber perto de ~1500 tokens:

- `summary` — receitas, despesas, saldo (`net`) e taxa de poupança do mês.
- `categories` — só as **5** categorias de despesa com mais peso (nome,
  total, percentagem) — nunca a lista inteira.
- `budgets` — orçamento global (`User.orcamento`, não há por categoria),
  com `used`, `remaining` e `percentageUsed` face ao gasto real do mês.
- `goals` — nome, valor atual, valor alvo e `progressPct`. **Sem prazo**: o
  modelo de dados (`Meta`) não tem uma data-alvo, por isso não se inventa
  uma — a Rita diz que não tem essa informação, se lhe perguntarem.
- `accounts`, `upcomingPayments`, `recurringTransactions` — como antes.
- `recentTransactions` — últimas **10** transações (despesas + rendimentos
  juntas), mais recente primeiro; períodos com mais do que isso já ficam
  representados de forma agregada em `categories`/`summary`.

Regras mantidas:

- Sem dados → `0`, `[]` ou omitido; nunca um valor inventado.
- Nunca inclui password, tokens, códigos de verificação, ids do Stripe ou
  qualquer outro campo técnico/sensível do utilizador.
- Usa sempre a moeda principal do utilizador (`User.moeda`); não converte.
- Não existe ainda um modelo de dados de "Partilha" (grupos partilhados) —
  não há dados agregados de grupo para incluir; nada é inventado.

## 6. Segurança e limites

- **Autenticação**: obrigatória (`exigirLogin`, igual ao resto da API); o
  `userId` usado no contexto e no streaming vem sempre de `req.userId`
  (token), nunca do corpo do pedido.
- **Chave da IA**: `AI_API_KEY` só existe no `.env` do servidor (e nas env
  vars do Render) — nunca chega ao frontend nem é escrita em código.
- **Limites por plano** (`config.js`, `assistant-usage.service.js`):
  Free = 5 perguntas/mês, Premium = 100 perguntas/mês.
- **Rate limiting de rajada**: `assistant-rate-limit.middleware.js` — mínimo
  3 segundos entre pedidos do mesmo utilizador (em memória), o que já limita
  a ~20 pedidos/minuto na prática. Se um dia houver várias instâncias do
  servidor, mover para Redis.
- **Histórico**: só as últimas ~10 trocas (20 mensagens) seguem para o
  modelo — acima disso, as mais antigas são cortadas (`MAX_HISTORICO_MENSAGENS`
  em `assistant.chat.service.js`).
- **max_tokens**: 1024 por omissão (`AI_ENV.MAX_TOKENS`, ajustável via
  `AI_MAX_TOKENS` no `.env`).
- **Logs**: só metadados (`userId`, período, duração, nº de pedaços
  recebidos, estado do erro) — nunca a pergunta do utilizador nem o texto da
  resposta da Rita (ver `console.log`/`console.error` em
  `assistant.chat.service.js`, prefixados com `[rita:chat]`).
- **Erros em produção**: erros de negócio (400/404/429) respondem com uma
  mensagem curta; qualquer erro inesperado cai no tratador central de
  `server.js`, que nunca expõe stack traces ao cliente. Falhas a meio do
  streaming chegam ao utilizador com a voz da Rita ("Perdi-me a meio da
  resposta — tenta outra vez?"), exceto quando a IA não está configurada
  (mensagem específica e acionável para a equipa).

### Variáveis de ambiente

```
AI_PROVIDER="anthropic"
AI_API_KEY=            # só no .env real / env vars do servidor, nunca aqui
AI_MODEL="claude-haiku-4-5"   # alias oficial; resolve para claude-haiku-4-5-20251001
AI_TIMEOUT_MS="30000"
AI_MAX_TOKENS="1024"
```

## 7. Como testar

```bash
npm test
```

Corre com `node --test`. Os testes usam **dependências falsas** (Prisma,
usage service, context service, provider) e nunca tocam a base de dados real
nem chamam a API da Anthropic. Cobrem, entre outros: validação/corte do
histórico, limites por plano, geração do contexto (isolamento por
utilizador/período, top-5 categorias, orçamento usado, últimas transações,
ausência de dados sensíveis, zeros em vez de valores inventados), a
mensagem amigável da Rita quando o streaming falha a meio, e a exigência de
autenticação ao nível HTTP real.

## 8. Modelo de dados (Prisma)

4 tabelas (migração `prisma/migrations/20260713100000_assistente_infraestrutura`),
isoladas por `userId` e com `onDelete: Cascade` a partir de `User`:
`AssistantConversation`, `AssistantMessage`, `AssistantUsage`,
`AssistantFeedback`. Nesta fase só `AssistantUsage` é escrita ativamente (a
cada pedido) — as outras existem no schema para o roadmap de histórico de
conversas (secção 9), ainda não implementado.

## 9. Desenho anterior (não ativo) e roadmap

O conjunto `assistant.controller.js` / `assistant.service.js` /
`assistant.schemas.js` / `assistant-response.service.js` /
`prompts/prompt-builder.js` / `actions/*` implementa um fluxo alternativo,
não streaming, que devolvia uma resposta JSON estruturada
(`{summary, metrics, observation, recommendedAction}`) em vez de texto livre
em streaming. Tem testes próprios e continua a passar, mas **não está
registado em nenhuma rota** — foi substituído pelo fluxo streaming
(`assistant.chat.*`) antes de ligar a um fornecedor real. Mantém-se no
repositório por agora; considerar remover ou revisitar quando/se fizer
sentido um histórico de conversas com respostas estruturadas por secções.

**Roadmap (não implementado ainda):**
- `GET    /api/assistant/conversations`
- `GET    /api/assistant/conversations/:id`
- `DELETE /api/assistant/conversations/:id`
- `POST   /api/assistant/feedback`

## 10. Limitações e decisões pendentes

- A migração Prisma do módulo do assistente — confirmar que já foi aplicada
  ao ambiente de produção (`npx prisma migrate deploy`).
- Não existe modelo de dados de "Partilha" nem de orçamentos por categoria,
  nem de prazo/data-alvo em `Meta` — o contexto reflete essas lacunas sem
  inventar dados.
- O rate limit de rajada é em memória (não sobrevive a reinícios nem escala
  para várias instâncias).
- Não há ainda histórico de conversas persistido (`AssistantMessage` não é
  escrito) nem endpoints de feedback — roadmap acima.
