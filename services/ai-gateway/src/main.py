from __future__ import annotations

import asyncio
import base64
import io
import json
import wave
from typing import Any

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field


APP_NAME = "seatvio-ai-gateway"

app = FastAPI(title=APP_NAME)


class GatewayLLMRequest(BaseModel):
    messages: list[dict[str, str]] = Field(default_factory=list)
    system_prompt: str = Field(min_length=1)
    max_tokens: int = 220


class GatewayTTSRequest(BaseModel):
    text: str = Field(min_length=1)
    voice_id: str = "alloy"
    instructions: str = ""
    format: str = "wav"


class GatewaySTTRequest(BaseModel):
    pass


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
    return {"ok": True, "service": APP_NAME, "mode": "mock-v5"}


@app.get("/api/gateway/health")
async def gateway_health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": APP_NAME,
        "provider": "openrouter",
        "endpoints": ["llm", "tts", "stt"],
    }


@app.post("/gateway/llm")
async def gateway_llm(payload: GatewayLLMRequest) -> StreamingResponse:
    text = "Thanks. Walk me through your specific role and the measurable outcome."
    tokens = text.split(" ")

    async def token_stream():
        for token in tokens:
            data = {"token": f"{token} "}
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(0.05)
        yield f"data: {json.dumps({'done': True, 'full_text': text})}\n\n"

    return StreamingResponse(token_stream(), media_type="text/event-stream")


@app.post("/gateway/tts")
async def gateway_tts(payload: GatewayTTSRequest) -> Response:
    wav_bytes = _silence_wav_bytes(duration_s=2.0)
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
    )


@app.post("/gateway/stt")
async def gateway_stt(audio: UploadFile = File(...)) -> dict[str, Any]:
    _ = await audio.read()
    return {
        "text": "Mock transcription of candidate speech",
        "segments": [],
    }


# Legacy endpoints kept for backward compatibility during migration
@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)) -> dict[str, Any]:
    return await gateway_stt(audio)


@app.post("/generate")
async def generate(payload: GatewayLLMRequest) -> StreamingResponse:
    return await gateway_llm(payload)


@app.post("/synthesize")
async def synthesize(payload: GatewayTTSRequest) -> Response:
    return await gateway_tts(payload)
