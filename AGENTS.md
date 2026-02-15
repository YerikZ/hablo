# AGENTS

## Conventions

- Use TypeScript strict mode; avoid `any` unless unavoidable for SDK edge cases.
- Keep route handlers thin and push shared logic into `lib/`.
- Validate all request payloads with `zod`.
- Persist only text artifacts; do not store audio blobs.
- Maintain Spain Spanish defaults in prompts and UI labels.

## Data and safety

- Respect per-user ownership checks on all session and flashcard endpoints.
- Enforce daily turn limit before running model inference.
- Keep session context bounded and update `memorySummary` periodically.
- Log latency and token estimates for every chat turn.

## UI

- Prioritize clear transcript/translation pairing and playback actions.
- Keep corrections concise and visible per turn in coach mode.
- Keep dashboard focused on quick start, recent sessions, top weaknesses, and flashcards.
