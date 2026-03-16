# Seatvio Interview Conductor (PRD v6 baseline)

Real-time interview orchestrator.

## Interfaces

- WebSocket: `GET /ws/interview/:session_id`
- HTTP compatibility: `POST /turn`
- Health: `GET /healthz`

The conductor coordinates:
- STT upstream (`STT_URL`)
- LLM streaming upstream (`LLM_URL`)
- TTS upstream (`TTS_URL`)

and emits real-time messages:
- `session_start`
- `interviewer_speaking`
- `expression_update`
- `session_end`

## Local run

```bash
cd services/interview-conductor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8091
```
