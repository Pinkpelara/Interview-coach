# Seatvio AI Gateway (v5)

Centralized AI access layer. Connects to OpenRouter. All AI requests from other services route through this gateway.

## Endpoints

- `POST /gateway/llm` — LLM inference (SSE stream) -> `{ token }` events + final `{ done, full_text }`
- `POST /gateway/tts` — Text-to-speech (`{ text, voice_id, instructions }`) -> `audio/wav` bytes
- `POST /gateway/stt` — Speech-to-text (multipart `audio` file) -> `{ text, segments }`
- `GET /api/gateway/health` — Gateway health and provider status
- `GET /healthz` — Basic health check

Development mode returns contract-compatible mock outputs.

## Local run

```bash
cd services/ai-gateway
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8095
```
