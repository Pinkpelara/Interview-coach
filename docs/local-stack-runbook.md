# Seatvio Local Service Stack Runbook

This runbook launches the current multi-service development stack:

- `web-app` (Next.js app + API routes)
- `postgres`
- `api-server` (service-oriented backend scaffold)
- `ai-engine` (async AI task scaffold)
- `media-relay` (WebSocket-first interview transport)
- `interview-conductor` (turn orchestrator scaffold)
- `gpu-workers` (mock interface-compatible workers)

## Start stack

```bash
docker compose up --build
```

Open:

- App: `http://localhost:3000`
- Media relay health: `http://localhost:8787/healthz`
- Conductor health: `http://localhost:8091/healthz`
- GPU workers health: `http://localhost:8092/healthz`
- AI engine health: `http://localhost:8093/healthz`
- API server health: `http://localhost:8094/healthz`
- Orchestration health: `http://localhost:3000/api/health/orchestration`

## GPU override

When a host has NVIDIA runtime configured:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

## Notes

- The web app uses `INTERVIEW_CONDUCTOR_URL` when set, and falls back safely to in-process generation.
- The perform room uses `NEXT_PUBLIC_INTERVIEW_WS_URL` when available, and falls back safely to HTTP exchange route.
- Current `gpu-workers` endpoints are mock contracts intended for phased replacement with real inference.
