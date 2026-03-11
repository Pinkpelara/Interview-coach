# Seatvio AI Engine

Async/offline AI task service scaffold.

Endpoints included:

- `POST /parse/resume`
- `POST /parse/jd`
- `POST /alignment`
- `POST /questions/generate`
- `POST /answers/analyze`
- `POST /debrief/generate`
- `POST /observe/generate`

All endpoints currently return interface-compatible mock payloads for phased integration.

## Local run

```bash
cd services/ai-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8093
```
