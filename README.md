# Hablo MVP

Voice-first Spanish speaking practice tutor (Spain default) built with Next.js App Router, TypeScript, Prisma, and Postgres.

## Features

- Username/password auth with Argon2 hashing and cookie sessions
- Auth route rate limiting
- Session creation with theme/level/duration/coach mode
- STT endpoint (`/api/sessions/:id/stt`) for uploaded audio
- Streaming chat endpoint (`/api/sessions/:id/messages`) with:
  - Assistant Spanish reply deltas + final payload
  - Sentence-aligned English translation
  - User translation metadata
  - Coach analysis (when enabled)
- TTS endpoint (`/api/tts`) for assistant playback and corrected pronunciation playback
- Mistake category tracking dashboard
- Flashcards with SM-2-lite `Again` / `Good` scheduling
- Daily turn limits
- Session memory summary updates every N turns
- Per-turn latency/token estimation logging in server logs

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- OpenAI Audio API + Responses API

## Setup

1. Copy env:

```bash
cp .env.example .env
```

2. Start Postgres:

```bash
docker compose up -d db
```

3. Install dependencies:

```bash
npm install
```

4. Run Prisma migrations + generate client:

```bash
npx prisma migrate deploy
npx prisma generate
```

5. Start app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Required env vars

- `DATABASE_URL`
- `AUTH_SECRET`
- `OPENAI_API_KEY` (required for live STT/TTS/model generation)
- `DAILY_TURN_LIMIT` (default `120`)
- `MEMORY_SUMMARY_EVERY_N` (default `6`)
- `DEFAULT_TTS_VOICE` (default `alloy`)

## API overview

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/sessions`
- `GET /api/sessions`
- `GET /api/sessions/:id`
- `PATCH /api/sessions/:id`
- `POST /api/sessions/:id/end`
- `POST /api/sessions/:id/stt`
- `POST /api/sessions/:id/messages` (SSE)
- `POST /api/tts`
- `GET /api/flashcards/due`
- `POST /api/flashcards/:id/review`

## Notes

- Audio is generated/transcribed on-demand and not persisted.
- Only transcripts and text metadata are stored.
