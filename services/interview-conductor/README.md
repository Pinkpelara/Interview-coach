# Seatvio Interview Conductor

Real-time turn orchestrator service.

This service coordinates:
- STT (`/transcribe`)
- LLM (`/generate`)
- TTS (`/synthesize`)

and exposes one higher-level endpoint:
- `POST /turn`

## Local run

```bash
cd services/interview-conductor
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8091
```

## Environment

- `STT_URL` - base URL of STT worker
- `LLM_URL` - base URL of LLM worker
- `TTS_URL` - base URL of TTS worker
- `REQUEST_TIMEOUT_S` - upstream request timeout
