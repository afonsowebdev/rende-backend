# Rende+ — Backend (API)

API de finanças pessoais do Rende+. Feita com Node.js, Express, Prisma e PostgreSQL (Neon).

## O que tem
- Autenticação (registo, login, perfil) com palavras-passe cifradas e tokens JWT.
- Dados por utilizador: cada pessoa só vê e mexe nos seus.
- Tabelas: utilizadores, despesas, rendimentos, metas, aforros, contas, categorias.
- CORS ativo (o frontend pode comunicar com a API).

## Variáveis de ambiente (ficheiro .env)
Cria um ficheiro `.env` na raiz, com:

```
PORT=3000
DATABASE_URL="<connection string DIRETA do Neon, sem -pooler>"
JWT_SECRET="<texto longo e aleatório>"
```

Gera um JWT_SECRET com:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Correr localmente
```
npm install
npx prisma migrate reset      # (1ª vez ou após mudar tabelas; apaga dados de teste)
npx prisma migrate dev --name init
npm start
```
Servidor em http://localhost:3000

## Endpoints
Autenticação (públicos):
- POST   /api/auth/registar    { email, password, nome?, moeda? }  -> { token, user }
- POST   /api/auth/login       { email, password }                 -> { token, user }

Protegidos (enviar cabeçalho `Authorization: Bearer <token>`):
- GET/PATCH /api/auth/eu       (perfil e definições: nome, moeda, poupancaPct, orcamento)
- GET/POST/PATCH/DELETE  /api/despesas
- GET/POST/PATCH/DELETE  /api/rendimentos
- GET/POST/PATCH/DELETE  /api/metas
- GET/POST/DELETE        /api/aforros        (POST precisa de metaId)
- GET/POST/PATCH/DELETE  /api/contas
- GET/POST/PATCH/DELETE  /api/categorias

## Deploy no Render
1. Põe este backend num repositório no GitHub (sem o .env).
2. No Render: New > Web Service > liga o repositório.
3. Build Command:  `npm install && npx prisma migrate deploy`
4. Start Command:  `npm start`
5. Environment: adiciona DATABASE_URL e JWT_SECRET (os mesmos do .env).
6. Deploy. A tua API fica num endereço https://...onrender.com
