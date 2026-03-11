# SEATVIO
## Complete Build Specification (Unified v4.0)
### "So real, you'll get nervous."

This repository is aligned to the **Unified Specification v4.0** as the single source of truth.

---

## Architecture (6 Services)

| Service | Runtime | GPU | Responsibility |
|---|---|---:|---|
| `services/web-app` | TypeScript / Next.js | No | Frontend pages, interview room UI, client animation |
| `services/api-server` | TypeScript (Node/Express) | No | Auth, application/session data, business APIs, queue triggers |
| `services/ai-engine` | Python / FastAPI | No | Async AI tasks (parse, questions, analysis, debrief, observe, countdown) |
| `services/interview-conductor` | Python / FastAPI + WebSocket | No | Real-time turn loop, character behavior, silence enforcement |
| `services/gpu-workers` | Python / FastAPI | Yes | STT, LLM streaming, TTS, animation inference interfaces |
| `services/media-relay` | TypeScript / Node + ws | No | Browser <-> conductor WebSocket relay for real-time interview traffic |

---

## Monorepo Layout

```txt
seatvio/
├─ docker-compose.yml
├─ docker-compose.gpu.yml
├─ packages/
│  ├─ shared/types/
│  ├─ shared/constants/
│  ├─ prompts/characters/
│  ├─ prompts/question-gen/
│  ├─ prompts/answer-analysis/
│  ├─ prompts/debrief/
│  ├─ prompts/observe/
│  └─ db/migrations/
└─ services/
   ├─ api-server/
   ├─ ai-engine/
   ├─ interview-conductor/
   ├─ gpu-workers/
   └─ media-relay/
```

---

## Database Schema

Unified v4 SQL migration:

- `packages/db/migrations/0001_unified_v4_schema.sql`

This migration defines all v4 entities:
`users`, `user_profiles`, `applications`, `parsed_resumes`, `parsed_jds`,
`alignment_analyses`, `questions`, `user_answers`, `answer_feedbacks`,
`interview_sessions`, `session_exchanges`, `session_analyses`,
`observe_sessions`, `subscriptions`, `countdown_plans`.

---

## Prompt Assets

Prompt packs are version-controlled in:

- `packages/prompts/characters/`
- `packages/prompts/question-gen/system.md`
- `packages/prompts/answer-analysis/system.md`
- `packages/prompts/debrief/system.md`
- `packages/prompts/observe/system.md`

---

## Local Dev

Start service stack:

```bash
docker compose up --build
```

GPU profile:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

---

## Naming and Brand

- Product name: **Seatvio**
- Tagline: **So real, you'll get nervous.**
- Primary domain: **seatvio.app**

Do **not** use:
- Intervia
- Nerveo

