# Assistente Financeiro (IA) — infraestrutura do backend

> **Estado atual: infraestrutura preparada, sem fornecedor de IA ligado.**
> Esta fase não liga a OpenAI, Anthropic, Google nem nenhum outro fornecedor.
> A rota `/api/assistant/chat` já funciona de ponta a ponta (autenticação,
> plano, limites, contexto financeiro, histórico), mas devolve uma resposta
> técnica em vez de uma resposta gerada por IA.

## 1. Arquitetura

O backend do Rende+ é um servidor **Node.js + Express** simples (CommonJS,
sem TypeScript), com **Prisma** sobre PostgreSQL (Neon) e autenticação por
**JWT** (sem sessões/cookies). Não existe uma camada formal de "controllers
vs. services" no resto do projeto — as rotas em `src/routes/*.js` falam
diretamente com o Prisma. O módulo do assistente introduz uma separação um
pouco mais fina *só onde isso importa* (contexto financeiro, limites de
utilização, fornecedor de IA, prompts, ações), porque essas são
responsabilidades novas e é aí que a futura integração vai mexer.

```
src/assistant/
├── assistant.routes.js              # POST /chat (Express Router)
├── assistant.controller.js          # req/res only, chama o service
├── assistant.service.js             # orquestra o fluxo (o único ficheiro
│                                     # que vai mudar quando ligarmos IA real)
├── assistant.schemas.js             # validação do corpo do pedido
├── assistant.types.js                # JSDoc typedefs + constantes partilhadas
├── assistant.repository.js          # acesso a conversas/mensagens/feedback
├── assistant-context.service.js     # resumo financeiro do utilizador
├── assistant-usage.service.js       # contagem e limites por plano
├── assistant-response.service.js    # valida a resposta (futura) do fornecedor
├── assistant-provider.interface.js  # contrato do fornecedor de IA + stub
├── assistant-rate-limit.middleware.js
├── config.js                        # limites, tamanhos, nomes de env vars
├── prompts/
│   ├── system-prompt.js
│   └── prompt-builder.js
└── actions/
    ├── action-types.js
    └── action-validator.js
```

Todos os serviços que tocam a base de dados são **fábricas** que aceitam o
cliente Prisma por parâmetro (`function criarX(prisma = require("../db"))`),
para poderem ser testados com um Prisma falso sem tocar na base de dados
real. É o único desvio ao padrão do resto do projeto (que faz sempre
`require("../db")` diretamente) e existe só para permitir os testes do
ponto 8.

## 2. Fluxo de uma mensagem

```
Frontend
  → POST /api/assistant/chat  (Authorization: Bearer <token>)
  → exigirLogin                       (src/auth.js — igual ao resto da app)
  → limitarRajadas                    (assistant-rate-limit.middleware.js)
  → validarPedidoChat                 (assistant.schemas.js)
  → assistant.service.processarChat:
      1. carrega o utilizador autenticado (nunca um userId do body)
      2. confirma que o conversationId (se vier) é do próprio utilizador
      3. verifica o limite do plano (assistant-usage.service.js)
      4. valida o período pedido (não pode ser um mês futuro)
      5. gera o contexto financeiro (assistant-context.service.js)
      6. regista a utilização (assistant-usage.service.js)
      7. [FUTURO] constrói o prompt, chama o fornecedor de IA, valida a resposta
      8. devolve a resposta ao frontend
```

O ponto 7 está desenhado (prompt-builder, provider interface, response
service já existem e têm testes), mas **não é chamado ainda** — não faz
sentido montar um prompt ou chamar um "provider" que só lança erro. Quando
houver fornecedor, a mudança fica confinada a `assistant.service.js`.

## 3. Contrato do endpoint atual

### `POST /api/assistant/chat`

Exige `Authorization: Bearer <token>` (o mesmo JWT usado no resto da API).

**Body:**

```json
{
  "message": "Como estão as minhas finanças este mês?",
  "period": "2026-07",
  "conversationId": "opcional"
}
```

- `message` — obrigatório, 3 a 1500 caracteres (espaços à volta são removidos).
- `period` — opcional, formato `AAAA-MM`; por omissão usa o mês atual. Não
  pode ser um mês ainda por decorrer.
- `conversationId` — opcional; se indicado, tem de pertencer ao utilizador
  autenticado (senão devolve 404).
- Qualquer outro campo (incluindo `userId`) é **rejeitado** com 400 — o
  utilizador é sempre identificado pela sessão, nunca pelo corpo do pedido.

**Resposta 200 (esta fase):**

```json
{
  "status": "ready",
  "message": "A infraestrutura do Assistente Rende+ está preparada para integração.",
  "contextSummary": {
    "period": "2026-07",
    "currency": "EUR",
    "hasIncomeData": true,
    "hasExpenseData": true,
    "hasGoals": false
  },
  "usage": { "used": 1, "limit": 5, "remaining": 4 }
}
```

Note-se que **o contexto financeiro completo nunca é devolvido** — só estas
flags/totais não sensíveis.

**Erros possíveis:** `400` (validação, período futuro), `401` (sem sessão),
`404` (utilizador ou conversa não encontrados), `429` (limite de utilização
atingido ou pedidos a rajada).

## 4. Contexto financeiro

`assistant-context.service.js` consulta **apenas** os dados do utilizador
autenticado (despesas e rendimentos do mês pedido, metas, contas e
lembretes por pagar) e devolve um resumo — nunca a lista completa de
transações. Regras seguidas:

- Sem dados → `0`, `[]` ou omitido; nunca um valor inventado.
- Nunca inclui password, tokens, códigos de verificação, ids do Stripe ou
  qualquer outro campo técnico/sensível do utilizador.
- Usa sempre a moeda principal do utilizador (`User.moeda`); não converte.
- **Orçamentos**: o schema atual só tem um orçamento global opcional
  (`User.orcamento`), não orçamentos por categoria — é isso que aparece em
  `budgets`.
- **Partilha**: não existe ainda um modelo de dados de grupos partilhados
  (só a preferência `User.partilha`, do onboarding). Por isso não há dados
  agregados de partilha para incluir — nada foi inventado para preencher
  essa lacuna.

## 5. Modelo de dados (Prisma)

Adicionadas 4 tabelas (migração
`prisma/migrations/20260713100000_assistente_infraestrutura`), todas
isoladas por `userId` e com `onDelete: Cascade` a partir de `User`:

| Tabela                   | Para quê                                              |
|--------------------------|--------------------------------------------------------|
| `AssistantConversation`  | Agrupa mensagens de uma conversa                        |
| `AssistantMessage`       | Cada mensagem (papel, conteúdo, resposta estruturada)   |
| `AssistantUsage`         | Contagem de pedidos por utilizador/período (`@@unique([userId, period])`) |
| `AssistantFeedback`      | Avaliação do utilizador a uma resposta                  |

Nesta fase só `AssistantUsage` é escrita ativamente (a cada pedido). As
outras três já têm o repositório pronto (`assistant.repository.js`), mas só
`obterConversa` é chamado (para validar a posse do `conversationId`) — a
escrita de histórico fica para quando houver respostas reais para guardar.

**Não fiz a migração na base de dados real.** O schema e o ficheiro SQL da
migração estão prontos; corre:

```bash
npx prisma migrate dev
```

para a aplicar ao Neon configurado no teu `.env` (ou `npx prisma migrate deploy`
em produção).

## 6. Segurança e limites

- **Autenticação**: obrigatória (`exigirLogin`, igual ao resto da API).
- **Autorização por utilizador**: todas as queries filtram por `userId`;
  `conversationId` de outro utilizador dá 404, não 403 (não confirma que a
  conversa existe).
- **Limites por plano** (`config.js`, `assistant-usage.service.js`):
  Free = 5 perguntas/mês, Premium = 100 perguntas/mês. Centralizados num único
  ficheiro (`LIMITES_POR_PLANO`).
- **Rate limiting de rajada**: `assistant-rate-limit.middleware.js` — no
  mínimo 3 segundos entre pedidos do mesmo utilizador (em memória; se um dia
  houver várias instâncias do servidor, mover para Redis).
- **Tamanho do body**: `express.json()` já limita a 100kb (default,
  igual ao resto da API); a mensagem em si está limitada a 1500 caracteres.
- **Sanitização/validação**: `assistant.schemas.js` rejeita campos
  desconhecidos, valores fora do formato e nunca lê `userId` do corpo.
- **Erros em produção**: erros de negócio (400/404/429) respondem com uma
  mensagem curta; qualquer erro inesperado cai no tratador central de
  `server.js`, que nunca expõe stack traces ao cliente.
- **Nunca guardados/logados**: passwords, tokens, chaves de API, o contexto
  financeiro completo, ou qualquer dado bancário sensível desnecessário.

### Variáveis de ambiente (futuro fornecedor)

Adicionadas ao `.env.example` (sem valores reais):

```
AI_PROVIDER=
AI_API_KEY=
AI_MODEL=
AI_TIMEOUT_MS=
AI_MAX_TOKENS=
```

A chave (`AI_API_KEY`) só existirá no backend (variável de ambiente do
Render), nunca no frontend nem no repositório.

## 7. Como ligar um fornecedor de IA no futuro

1. Criar `src/assistant/providers/<nome>.provider.js` que exporte um objeto
   com `generateResponse(input)`, cumprindo o contrato de
   `assistant-provider.interface.js`.
2. Em `assistant.service.js`, substituir `providerNaoConfigurado` (hoje nem
   é importado, porque não é chamado) pela nova implementação, e adicionar
   entre os passos 5 e 6 do fluxo:
   - `const prompt = construirPrompt({ mensagem: message, contexto })`
   - `const bruto = await provider.generateResponse({ ...prompt, maxTokens, timeoutMs })`
   - `const validado = validarRespostaEstruturada(bruto.raw)`
3. Guardar a mensagem do utilizador e a resposta validada com
   `assistant.repository.js` (`guardarMensagem`).
4. Instalar o SDK do fornecedor escolhido (não instalado nesta fase).

Nenhuma outra parte do módulo (rotas, controller, schemas, limites,
contexto) precisa de mudar.

## 8. Como testar

```bash
npm test
```

Corre com `node --test` (nenhuma dependência nova instalada — o projeto
ainda não tinha testes nem um test runner). Os testes usam **Prisma falso**
(objetos simples em memória) e nunca tocam a base de dados real nem chamam
nenhuma API externa. Cobrem: validação do pedido (incluindo tentativa de
enviar `userId`), limites por plano (Free/Premium, sem duplicar registos),
geração do contexto (isolamento por utilizador/período, ausência de dados
sensíveis, moeda correta, zeros em vez de valores inventados), validação de
ações e da resposta estruturada, orquestração do serviço (404/429/400) e a
exigência de autenticação ao nível HTTP real.

## 9. Endpoints

**Ativo nesta fase:**
- `POST /api/assistant/chat`

**Roadmap (não implementados ainda, arquitetura já preparada):**
- `GET    /api/assistant/conversations`
- `GET    /api/assistant/conversations/:id`
- `DELETE /api/assistant/conversations/:id`
- `POST   /api/assistant/feedback`
- `GET    /api/assistant/suggestions`
- `POST   /api/assistant/action-preview`
- `POST   /api/assistant/action-confirm`

## 10. Limitações e decisões pendentes

- A migração Prisma **não foi aplicada** à base de dados real — ver ponto 5.
- Não existe modelo de dados de "Partilha" (grupos partilhados) nem de
  orçamentos por categoria; o contexto reflete essa lacuna sem inventar
  dados.
- O rate limit de rajada é em memória (não sobrevive a reinícios nem escala
  para várias instâncias).
- Ainda não há endpoints de histórico/feedback (roadmap acima) — o
  repositório já os suporta a nível de dados, faltam as rotas/controllers.
- Nenhum fornecedor de IA foi escolhido, ligado ou instalado.
