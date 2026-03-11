from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field


APP_NAME = "seatvio-gpu-workers"

app = FastAPI(title=APP_NAME)


class TranscribeRequest(BaseModel):
    audio_b64: str = Field(min_length=1)


class GenerateRequest(BaseModel):
    messages: list[dict[str, str]] = Field(default_factory=list)
    system_prompt: str = Field(min_length=1)
    max_tokens: int = 200


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1)
    voice_id: str = "alloy"


class AnimateRequest(BaseModel):
    audio_chunk_b64: str = Field(min_length=1)
    reference_image_id: str = Field(min_length=1)
    expression_state: str = "neutral"


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {"ok": True, "service": APP_NAME, "mode": "mock"}


@app.post("/transcribe")
async def transcribe(payload: TranscribeRequest) -> dict[str, Any]:
    # TODO: Replace with real STT model inference.
    return {
        "text": "This is a mock transcript from gpu-workers.",
        "segments": [{"start": 0.0, "end": 1.2, "text": "This is a mock transcript."}],
    }


@app.post("/generate")
async def generate(payload: GenerateRequest) -> dict[str, Any]:
    # TODO: Replace with real LLM inference.
    return {
        "text": "Thanks. Walk me through your specific role and the measurable outcome.",
        "token_count": 18,
    }


@app.post("/synthesize")
async def synthesize(payload: SynthesizeRequest) -> dict[str, Any]:
    # TODO: Replace with real TTS synthesis.
    return {
        "audio_url": "mock://audio/interviewer-response.wav",
        "voice_id": payload.voice_id,
    }


@app.post("/animate")
async def animate(payload: AnimateRequest) -> dict[str, Any]:
    # TODO: Replace with neural face animation worker.
    return {
        "frame_urls": ["mock://frames/0001.jpg", "mock://frames/0002.jpg"],
        "fps": 25,
        "expression_state": payload.expression_state,
    }
