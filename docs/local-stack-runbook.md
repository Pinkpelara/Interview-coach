# Seatvio Local Service Stack Runbook

This runbook launches the current multi-service development stack:

- `web-app` (Next.js app + API routes)
- `postgres`
- `api-server` (service-oriented backend scaffold)
- `ai-engine` (async AI task scaffold)
- `media-relay` (WebSocket-first interview transport)
- `interview-conductor` (turn orchestrator scaffold)
- `ai-gateway` (centralized AI access layer)

## Start stack

```bash
docker compose up --build
```

Open:

- App: `http://localhost:3000`
- Media relay health: `http://localhost:8787/healthz`
- Conductor health: `http://localhost:8091/healthz`
- AI gateway health: `http://localhost:8095/healthz`
- AI engine health: `http://localhost:8093/healthz`
- API server health: `http://localhost:8094/healthz`
- Orchestration health: `http://localhost:3000/api/health/orchestration`

## Notes

- The web app uses `INTERVIEW_CONDUCTOR_URL` when set, and falls back safely to in-process generation.
- The perform room uses `NEXT_PUBLIC_INTERVIEW_WS_URL` when available, and falls back safely to HTTP exchange route.
- The `ai-gateway` service proxies all AI requests through OpenRouter. No other service calls OpenRouter directly.
