# Dental Clinic AI — Backend

Express + TypeScript + Prisma backend. One conversation engine (LLM + function-calling tools)
serves three channels: web chat, WhatsApp, and voice (Retell). See
[`../docs/03_ARCHITECTURE.md`](../docs/03_ARCHITECTURE.md) for how it all fits together.

## Setup

1. `cp .env.example .env` and fill in the values (see **Environment** below).
2. `npm install`
3. `npm run prisma:generate`
4. `npm run prisma:migrate` — applies the schema (Clinic / Service / Dentist).
5. `npm run prisma:seed` — loads clinic info, services, and dentists.
6. `npm run dev` — starts the API on `PORT` (default 4000). `GET /api/health` returns ok.

> No `pgvector` / vector extension is required — RAG uses local sentence-transformer embeddings
> (`@xenova/transformers`), which download a small model once on first run and cache it. Works offline
> after that, and falls back to lexical search if the model can't be loaded.

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Use Claude as the primary LLM when set (model default `claude-sonnet-4-6`) |
| `GROQ_API_KEY` / `GROQ_MODEL` | Free fallback LLM when no Anthropic key is set |
| `EMBEDDING_MODEL` | Local embedding model id (default `Xenova/all-MiniLM-L6-v2`) |
| `KB_PDF_PATH` | Optional knowledge-base PDF; falls back to `docs/knowledge-base-content.md` |
| `CALCOM_API_KEY` / `CALCOM_BASE_URL` / `DENTIST_CALCOM_CONFIGS` | Cal.com booking (default key + per-dentist JSON) |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_VERIFY_TOKEN` | WhatsApp (Meta Cloud API) |
| `RETELL_API_KEY` | Voice (Retell) |
| `CORS_ORIGIN` | Comma-separated allowed origins |

**Provider behavior:** Claude is used if `ANTHROPIC_API_KEY` is set, otherwise Groq, otherwise a
safe canned reply. **Secrets:** `.env` is gitignored — never commit real keys; keep `.env.example`
as the template. If any real key was ever committed, rotate it.

## Structure

```
src/
├── config/           env (Zod-validated), Prisma client, constants
├── modules/
│   ├── clinic/       read APIs for the website (info, services, dentists)
│   ├── rag/          local-embedding knowledge base (ingest + search)
│   ├── booking/      Cal.com wrapper + shared name→id resolver
│   ├── conversation/ THE engine: agent loop + tools + system prompt
│   ├── chat/         web channel adapter
│   ├── whatsapp/     WhatsApp adapter (verify + webhook + client)
│   └── voice/        Retell function endpoints
└── shared/           llm (anthropic/groq), middleware, errors, utils, types
```

Every module follows `routes → controller → service → schema → types`. Controllers only handle
HTTP; services hold the logic and own all DB / external-API calls; all input is Zod-validated;
errors are thrown as `AppError` and formatted by one global middleware.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot reload (tsx) |
| `npm run build` | Type-check + compile to `dist/` |
| `npm start` | Run the compiled server from `dist/src/server.js` |
| `npm run prisma:migrate` | Apply migrations |
| `npm run prisma:seed` | Seed clinic data |

## Render

Use an LTS Node version on Render (`20` or `22`), not the current default `24`.

- Build command: `npm install && npx prisma generate && npm run build`
- Start command: `npx prisma migrate deploy && npm run seed && npm start`

If your database is hosted on Neon, make sure the Render `DATABASE_URL` is the real runtime connection string from Neon and includes `sslmode=require`.
