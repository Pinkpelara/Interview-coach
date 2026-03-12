# Seatvio API Server (Unified v4)

Implements the v4 backend API surface:

- Auth: `/api/auth/signup|verify|signin|signout|forgot-password|reset-password|me`
- Profile: `/api/profile` (POST/PUT/GET)
- Applications: `/api/applications` (+ `/:id`, `/:id/status`)
- Questions: `/api/applications/:id/questions`, `/api/questions/:id`
- Answers: `/api/questions/:id/answers`, `/api/answers/:id`, `/api/answers/:id/analyze`
- Sessions: `/api/applications/:id/sessions`, `/api/sessions/:id`, `/api/sessions/:id/exchange(s)`, `/api/sessions/:id/complete`, `/api/sessions/:id/analysis`
- Observe: `/api/sessions/:id/observe`, `/api/sessions/:id/observe/:type`
- Subscription: `/api/subscription`, `/api/subscription/checkout`, `/api/subscription/webhook`, `/api/subscription/cancel`
- Countdown: `/api/applications/:id/countdown`, `/api/applications/:id/countdown/:day`

> Development mode currently runs with in-memory persistence and deterministic mock behavior.
> Integrate with PostgreSQL and job queue for production deployment.

## Local run

```bash
cd services/api-server
npm install
npm run dev
```
