from __future__ import annotations

import asyncio
import base64
import io
import json
import wave
from typing import Any

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field


APP_NAME = "seatvio-gpu-workers"

app = FastAPI(title=APP_NAME)


class GenerateRequest(BaseModel):
    messages: list[dict[str, str]] = Field(default_factory=list)
    system_prompt: str = Field(min_length=1)
    max_tokens: int = 220


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1)
    voice_id: str = "alloy"
    format: str = "wav"


class AnimateRequest(BaseModel):
    audio_chunk: str = Field(min_length=1)
    reference_image_id: str = Field(min_length=1)
    expression_state: str = "neutral"


def _silence_wav_bytes(duration_s: float = 2.0, sample_rate: int = 16000) -> bytes:
    frame_count = int(duration_s * sample_rate)
    with io.BytesIO() as buffer:
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(b"\x00\x00" * frame_count)
        return buffer.getvalue()


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {"ok": True, "service": APP_NAME, "mode": "mock-v6"}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)) -> dict[str, Any]:
    _ = await audio.read()
    return {
        "text": "Mock transcription of candidate speech",
        "segments": [],
    }


@app.post("/generate")
async def generate(payload: GenerateRequest) -> StreamingResponse:
    text = "Thanks. Walk me through your specific role and the measurable outcome."
    tokens = text.split(" ")

    async def token_stream():
        for token in tokens:
            data = {"token": f"{token} "}
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(0.05)
        yield f"data: {json.dumps({'done': True, 'full_text': text})}\n\n"

    return StreamingResponse(token_stream(), media_type="text/event-stream")


@app.post("/synthesize")
async def synthesize(payload: SynthesizeRequest) -> Response:
    wav_bytes = _silence_wav_bytes(duration_s=2.0)
    phoneme_mock = json.dumps(
        [
            {"phoneme": "sil", "start_ms": 0, "end_ms": 2000},
        ]
    )
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={"X-Phoneme-Timestamps": phoneme_mock},
    )


@app.post("/animate")
async def animate(payload: AnimateRequest) -> dict[str, Any]:
    return {
        "frames": [payload.reference_image_id],
        "fps": 25,
        "expression_state": payload.expression_state,
    }
