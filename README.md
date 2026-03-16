# SEATVIO
## Product Requirements Baseline: v6.0 FINAL
### "So real, you'll get nervous."

Seatvio is an AI interview simulation platform focused on realistic, pressure-based practice tied to each user's real application context.

This repository is maintained against the **Seatvio PRD v6.0 FINAL** baseline.

---

## Core Product Modules

1. **Prepare**  
   Parse resume + JD, generate a 100–200+ personalized question bank across 10 categories, provide answer-building + analysis workflows.

2. **Perform**  
   Live audio interview simulation in a Teams-style cameras-off room with interviewer archetypes, intentional dead-air silence, and panel dynamics.

3. **Observe**  
   Perfect and Cautionary runs generated from the user's own application context and session patterns.

---

## Current Web App Stack

- Next.js (App Router)
- Prisma + PostgreSQL
- NextAuth credentials auth
- AI gateway pattern for model-backed features

---

## Database Deployment Strategy

Production deploys use migrations (non-destructive path):

```bash
npm run build
```

Current build pipeline:
- `prisma generate`
- `prisma migrate deploy`
- `next build`

---

## Branding Rules

- Product name: **Seatvio**
- Tagline: **So real, you'll get nervous.**
- Primary domain: **seatvio.app**

Forbidden names:
- Intervia
- Nerveo

