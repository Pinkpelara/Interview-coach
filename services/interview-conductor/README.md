# Seatvio Interview Conductor (v5)

Real-time interview orchestrator.

## Interfaces

- WebSocket: `GET /ws/interview/:session_id`
- HTTP compatibility: `POST /turn`
- Health: `GET /healthz`

The conductor routes all AI requests through `AI_GATEWAY_URL` and emits real-time messages:
- `session_start`
- `interviewer_speaking`
- `session_end`

## Local run

```bash
cd services/interview-conductor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8091
```
