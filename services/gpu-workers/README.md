# Seatvio GPU Workers (PRD v6 baseline)

Inference contract service.

## Endpoints

- `POST /transcribe` (multipart `audio` file) -> `{ text, segments }`
- `POST /generate` (SSE stream) -> `{ token }` events + final `{ done, full_text }`
- `POST /synthesize` (`{ text, voice_id, format }`) -> `audio/wav` bytes
- `POST /animate` (mock frame response in dev mode)
- `GET /healthz`

Development mode returns contract-compatible mock outputs.

## Local run

```bash
cd services/gpu-workers
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8092
```
