# Seatvio GPU Workers

Mock GPU worker service with interface-compatible endpoints:

- `POST /transcribe`
- `POST /generate`
- `POST /synthesize`
- `POST /animate`

These are placeholder endpoints for development and contract testing.
Replace TODO blocks with real model inference on GPU infrastructure.

## Local run

```bash
cd services/gpu-workers
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8092
```
