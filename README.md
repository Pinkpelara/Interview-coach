# SEATVIO
## Complete Build Specification (v5.0 FINAL)
### "So real, you'll get nervous."

This repository is aligned to the **Specification v5.0 FINAL** as the single source of truth.

---

## Architecture (6 Services)

| Service | Runtime | Responsibility |
|---|---|---|
| `services/web-app` | TypeScript / Next.js | Frontend pages, interview room UI, Teams-style audio interface |
| `services/api-server` | TypeScript (Node/Express) | Auth, application/session data, business APIs, queue triggers |
| `services/ai-engine` | Python / FastAPI | Async AI tasks (parse, questions, analysis, debrief, observe, countdown) |
| `services/interview-conductor` | Python / FastAPI + WebSocket | Real-time turn loop, character behavior, silence enforcement |
| `services/ai-gateway` | Python / FastAPI | Centralized AI access layer. Connects to OpenRouter. |
| `services/media-relay` | TypeScript / Node + ws | Browser <-> conductor WebSocket relay for real-time interview traffic |

---

## Monorepo Layout

```txt
seatvio/
├─ docker-compose.yml
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
   ├─ ai-gateway/
   └─ media-relay/
```

---

## Database Schema

SQL migration:

- `packages/db/migrations/0001_unified_v4_schema.sql`

This migration defines all entities:
`users`, `user_profiles`, `applications`, `parsed_resumes`, `parsed_jds`,
`alignment_analyses`, `questions`, `user_answers`, `answer_feedbacks`,
`interview_sessions`, `session_exchanges`, `session_analyses`,
`observe_sessions`, `subscriptions`, `countdown_plans`, `ai_metrics`.

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

---

## Naming and Brand

- Product name: **Seatvio**
- Tagline: **So real, you'll get nervous.**
- Primary domain: **seatvio.app**

Do **not** use:
- Intervia
- Nerveo

