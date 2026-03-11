from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import FastAPI
from pydantic import BaseModel, Field


APP_NAME = "seatvio-interview-conductor"
STT_URL = os.getenv("STT_URL", "").rstrip("/")
LLM_URL = os.getenv("LLM_URL", "").rstrip("/")
TTS_URL = os.getenv("TTS_URL", "").rstrip("/")
REQUEST_TIMEOUT_S = float(os.getenv("REQUEST_TIMEOUT_S", "12"))

app = FastAPI(title=APP_NAME)


class TurnRequest(BaseModel):
    session_id: str = Field(min_length=1)
    character_id: str = Field(min_length=1)
    user_audio_b64: str | None = None
    user_text: str | None = None
    conversation: list[dict[str, str]] = Field(default_factory=list)
    system_prompt: str = Field(min_length=1)
    voice_id: str = Field(default="alloy")


class TurnResponse(BaseModel):
    transcript: str
    response_text: str
    audio_url: str | None = None
    latency_ms: int
    source: str


async def _post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {
        "ok": True,
        "service": APP_NAME,
        "configured": {
            "stt": bool(STT_URL),
            "llm": bool(LLM_URL),
            "tts": bool(TTS_URL),
        },
    }


@app.post("/turn", response_model=TurnResponse)
async def turn(payload: TurnRequest) -> TurnResponse:
    """
    Mockable turn orchestrator:
    1) Transcribe (if audio)
    2) Generate interviewer text
    3) Synthesize speech
    """
    transcript = payload.user_text or ""
    source = "mock"

    if not transcript and payload.user_audio_b64 and STT_URL:
        stt_data = await _post_json(
            f"{STT_URL}/transcribe",
            {"audio_b64": payload.user_audio_b64},
        )
        transcript = stt_data.get("text", "").strip()
        source = "stt"

    if not transcript:
        transcript = "Could you repeat that?"

    response_text = "Thanks for sharing that. Can you give me a specific outcome with numbers?"
    if LLM_URL:
        llm_data = await _post_json(
            f"{LLM_URL}/generate",
            {
                "messages": payload.conversation
                + [{"role": "user", "content": transcript}],
                "system_prompt": payload.system_prompt,
                "max_tokens": 180,
            },
        )
        response_text = llm_data.get("text", response_text).strip()
        source = "llm"

    audio_url: str | None = None
    if TTS_URL:
        tts_data = await _post_json(
            f"{TTS_URL}/synthesize",
            {"text": response_text, "voice_id": payload.voice_id},
        )
        audio_url = tts_data.get("audio_url")
        source = "tts"

    return TurnResponse(
        transcript=transcript,
        response_text=response_text,
        audio_url=audio_url,
        latency_ms=850,
        source=source,
    )
