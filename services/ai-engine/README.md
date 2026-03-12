# Seatvio AI Engine (Unified v4)

Async AI task service endpoints:

- `POST /parse/resume`
- `POST /parse/jd`
- `POST /alignment`
- `POST /questions/generate`
- `POST /answers/analyze`
- `POST /debrief/generate`
- `POST /coach/audio`
- `POST /observe/generate`
- `POST /countdown/generate`

This service is designed to run behind an LLM substitution interface (`LLM_URL`).
In development it returns schema-compatible mock outputs.

## Local run

```bash
cd services/ai-engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8093
```
