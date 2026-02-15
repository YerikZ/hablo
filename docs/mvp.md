# Project: Hablo (MVP Spanish Speaking Practice Tutor)

## 0) Objective

Voice-first conversational web app for practising spoken Spanish (Spain). User speaks; app transcribes to text, generates a Spanish reply with English translation, and provides “coach mode” corrections. The app tracks recurring mistake categories and creates flashcards for review. Audio is not stored; only transcripts are persisted.

## 1) MVP scope

### In-scope (must ship)

1. **Auth**

* Username + password signup/login
* Password hashed (Argon2 or bcrypt)
* Basic rate limiting for auth routes

2. **Sessions**

* Create session with:

  * `theme` (English instructions/topic)
  * `level` (A1/A2/B1/B2/C1)
  * `durationMinutes`
  * `coachMode` boolean
* Coach initiates the conversation with a greeting + first question.
* User can end session any time.
* When duration is reached: coach triggers a wrap-up warning and asks if user wants to end. If user continues, session continues.

3. **Voice input per turn (upload model)**

* User records in browser and presses upload.
* Server runs Speech-to-Text (STT) and returns transcript.
* Transcript becomes the user message content.
* If user spoke English, the coach answers appropriately (Spanish first, then English guidance).

4. **Voice output per turn (no audio storage)**

* For each assistant reply and any “correct pronunciation” playback:

  * Generate Text-to-Speech (TTS) on demand.
  * Return audio as a stream or short-lived URL.
* Do not persist audio; persist only text.

5. **Chat UI**

* Streaming assistant text response.
* For every assistant message:

  * show Spanish text
  * show English translation aligned by sentence
  * play button to hear Spanish
* For every user message:

  * show Spanish transcript (or English transcript)
  * show English translation (if Spanish) or Spanish translation (if English), aligned by sentence if multi-sentence
  * show play button “Correct pronunciation” that plays TTS of the corrected Spanish version (coachMode on) or the user transcript translated into Spanish (coachMode off)

6. **Coach feedback (toggle per session)**
   Per user turn:

* corrected Spanish version (if needed)
* highlights for mistakes (spans)
* brief explanations (1–3, English)
* natural follow-up question to keep conversation going
* (No pronunciation scoring)

7. **Mistake tracking**

* Aggregate categories per user (`count`, `lastSeenAt`)
* Dashboard shows top weaknesses

8. **Flashcards**

* Generate 0–3 flashcards from mistakes or high-value phrases
* Review page with Again/Good scheduling (SM-2-lite)
* Also provide an “Archive” view of all cards (optional; can be same page filter)

9. **Safety/cost controls**

* Per-user daily limit (turns/day, configurable)
* Summarise session memory every N turns to bound context size
* Token usage and latency logging per request

### Out of scope

* Realtime WebRTC speech streaming
* Pronunciation scoring
* Payments/subscriptions
* Multi-agent missions
* Social/sharing
* Mobile app

---

## 2) UX and screens

### Pages

1. `/` Landing: CTA “Start practising”
2. `/app` Dashboard:

* New Session
* Recent sessions
* Top weaknesses
* Flashcards link

3. `/app/session/[id]` Chat:

* Left: coach avatar + chat transcript
* Controls: Record, Stop, Upload
* Each message shows:

  * transcript text
  * translation
  * play buttons (assistant Spanish audio; user “correct pronunciation” audio)
* Right tabs:

  * Corrections (latest turn)
  * Vocabulary (saved phrases)
  * Session settings

4. `/app/flashcards` Review:

* Due cards
* Again / Good
* Optional: filter “All cards” vs “Due”

### Session settings (stored per session)

* `theme`: string (English)
* `level`: enum
* `durationMinutes`: int
* `region`: fixed `"Spain"` (not user-editable in MVP)
* `uiLanguage`: fixed `"English"`

---

## 3) Tech stack

* Next.js (App Router) + TypeScript
* Tailwind CSS + shadcn/ui (optional)
* Postgres + Prisma
* Credentials auth (Auth.js Credentials provider or custom)
* OpenAI Responses API (structured output JSON)
* OpenAI Audio API (STT + TTS)
* Server-side streaming (SSE/ReadableStream)
* Docker

---

## 4) Data model (Prisma)

### User

* `id`
* `username` (unique)
* `passwordHash`
* `createdAt`

### Session

* `id`, `userId`
* `level`
* `theme`
* `durationMinutes`
* `coachMode`
* `region` (default `"Spain"`)
* `title` (auto)
* `memorySummary` (text, optional)
* `startedAt`, `endedAt` (nullable)
* `createdAt`, `updatedAt`

### Message

* `id`, `sessionId`
* `role`: `user | assistant | system`
* `contentText` (text)
* `language`: `es | en` (detected/assigned)
* `translationJson` (json array of sentence translations; optional)
* `createdAt`
* `turnIndex`

### TurnAnalysis (1 per user message)

* `id`, `sessionId`, `userMessageId`
* `correctedTextEs` (nullable)
* `highlightsJson`: `{ start: number; end: number; label: string }[]`
* `explanationsJson`: string[]
* `alternativesJson`: `{ label: "more_natural" | "more_formal"; textEs: string }[]`
* `mistakesJson`: `{ category: string; note: string; example_fix: string }[]`
* `tagsJson`: string[]
* `createdAt`

### WeaknessStat

* `id`, `userId`
* `category`
* `count`
* `lastSeenAt`

### Flashcard

* `id`, `userId`, `sessionId` (nullable)
* `front` (text), `back` (text)
* `tagsJson` (string[])
* `dueAt`, `intervalDays`, `ease`
* `createdAt`, `updatedAt`

---

## 5) API routes (Next.js route handlers)

### Auth

* `POST /api/auth/signup` `{ username, password }`
* `POST /api/auth/login` `{ username, password }`
* (Implementation choice: session cookie / JWT)

### Sessions

* `POST /api/sessions` create `{ theme, level, durationMinutes, coachMode }`
* `GET /api/sessions`
* `GET /api/sessions/:id` (metadata + last N messages)
* `PATCH /api/sessions/:id` (coachMode, level, durationMinutes, theme)
* `POST /api/sessions/:id/end`

### Audio (STT)

* `POST /api/sessions/:id/stt`

  * input: multipart audio blob
  * output: `{ transcriptText: string, detectedLanguage: "es" | "en" }`
  * server: calls STT

### Chat (streaming text + analysis)

* `POST /api/sessions/:id/messages` (SSE/stream)

  * input: `{ contentText: string }` (from STT or typed fallback)
  * output events:

    * `assistant_delta` (text chunks)
    * `assistant_final`:

      * `{ assistant_reply_es, assistant_reply_en_sentences: string[], wrapup_triggered: boolean }`
    * `turn_analysis` (if coachMode)
  * server responsibilities:

    * persist user message immediately
    * include session “time elapsed” and trigger wrap-up behaviour
    * call model to generate assistant reply + translations + analysis
    * persist assistant message + analysis
    * update weakness stats + flashcards
    * update memory summary every N turns

### Audio (TTS, ephemeral)

* `POST /api/tts`

  * input: `{ textEs: string, voice?: string }`
  * output: audio stream or short-lived URL
  * used for:

    * assistant reply playback
    * “correct pronunciation” playback (correctedTextEs or translated-to-Spanish user text)

### Flashcards

* `GET /api/flashcards/due`
* `POST /api/flashcards/:id/review` `{ rating: "again" | "good" }`

---

## 6) Model interaction design (single structured response per turn)

### Inputs to the model

* `theme`, `level`, fixed region Spain
* last ~12 messages + `memorySummary`
* `elapsedMinutes` and `durationMinutes` to decide wrap-up prompting

### Structured output JSON schema

Top-level:

* `assistant_reply_es`: string (1–4 sentences)
* `assistant_reply_en_sentences`: string[] (aligned with Spanish sentences)
* `wrapup_triggered`: boolean
* `user_translation`:

  * `user_text_language`: `"es" | "en"`
  * `user_translation_sentences`: string[] (translate user text to the other language, aligned)
* `analysis` (only if coachMode):

  * `corrected_user_text_es`: string | null
  * `highlights`: `{ start: number; end: number; label: string }[]`
  * `explanations_en`: string[] (1–3)
  * `alternatives`: `{ label: "more_natural" | "more_formal"; text_es: string }[]`
  * `mistakes`: `{ category: string; note: string; example_fix: string }[]`
  * `flashcards_suggestions`: `{ front: string; back: string; tags: string[] }[] (0–3)`
  * `session_memory_update`: string | null (only every N turns)

### System prompt requirements

* Spanish (Spain) defaults: vocabulary and register appropriate to level
* If user uses English: respond in Spanish first, then concise English guidance
* Keep feedback concise (max 3 explanations)
* When `wrapup_triggered=true`: ask whether to end, but allow continuation if user says continue

---

## 7) Weakness tracking rules

* For each `mistakes[]`, increment `WeaknessStat.count` for `category`
* Update `lastSeenAt`
* Dashboard shows top 5 categories by count

Categories:

* `verb_tense`, `conjugation`, `ser_estar`, `gender_agreement`, `prepositions`, `word_order`, `register`, `vocabulary_choice`, `accentuation`, `articles`

---

## 8) Flashcard scheduling (SM-2-lite)

(Keep your existing rules unchanged.)

---

## 9) Acceptance criteria (definition of done)

1. User can sign up/login with username+password.
2. User can create a session with theme/level/duration and coachMode.
3. User can record and upload audio; transcript appears as the user message.
4. Assistant replies stream in Spanish; English translation appears sentence-by-sentence.
5. Play button speaks the assistant Spanish reply (TTS, no audio stored).
6. User message shows translation; “correct pronunciation” play button speaks corrected Spanish (coachMode) or translated Spanish (coachMode off).
7. Coach mode shows corrections with highlighted spans and brief explanations.
8. Weakness dashboard updates from mistakes.
9. Flashcards are created and review scheduling works.
10. Daily limit enforced with clear error message.

---

## 10) Updated Codex handoff prompt (paste verbatim)

**Task:** Implement Hablo MVP as specified (voice-first, Spain default).
**Constraints:** Next.js App Router + TypeScript, Prisma + Postgres, username+password auth with hashed passwords, per-turn audio upload STT, streaming chat endpoint returning structured JSON, TTS endpoint for playback (no audio persistence), show translations for both user and assistant, coachMode corrections with highlights, minimal UI (Tailwind ok), Docker for local dev.
**Deliverables:** Working app, README with setup, `AGENTS.md` with conventions, Prisma migrations, and example env vars.