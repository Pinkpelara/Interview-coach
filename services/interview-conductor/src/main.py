from __future__ import annotations

import asyncio
import base64
import os
from typing import Any

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
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


class CandidateTurnMessage(BaseModel):
    type: str = "candidate_turn"
    candidate_text: str | None = None
    candidate_audio_b64: str | None = None
    character_id: str | None = None
    voice_id: str = "alloy"
    system_prompt: str
    conversation: list[dict[str, str]] = Field(default_factory=list)


async def _post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()


async def _post_audio_transcribe(audio_b64: str) -> dict[str, Any]:
    if not STT_URL:
        return {"text": "Could you repeat that?", "segments": []}
    raw = base64.b64decode(audio_b64.encode("utf-8"))
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
        response = await client.post(
            f"{STT_URL}/transcribe",
            files={"audio": ("candidate.wav", raw, "audio/wav")},
        )
        response.raise_for_status()
        return response.json()


async def _generate_text(messages: list[dict[str, str]], system_prompt: str) -> str:
    if not LLM_URL:
        return "Thanks. Walk me through your specific role and measurable outcome."

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
        async with client.stream(
            "POST",
            f"{LLM_URL}/generate",
            json={"messages": messages, "system_prompt": system_prompt, "max_tokens": 180},
        ) as response:
            response.raise_for_status()
            full_text = ""
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[len("data: ") :]
                try:
                    payload = json_loads(data)
                except Exception:
                    continue
                token = payload.get("token")
                if token:
                    full_text += token
                if payload.get("done"):
                    return payload.get("full_text", full_text).strip()
            return full_text.strip() or "Tell me more about the outcome."


async def _synthesize_wav_base64(text: str, voice_id: str) -> str:
    if not TTS_URL:
        return ""
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
        response = await client.post(
            f"{TTS_URL}/synthesize",
            json={"text": text, "voice_id": voice_id, "format": "wav"},
        )
        response.raise_for_status()
        return base64.b64encode(response.content).decode("utf-8")


def _silence_seconds_for_voice(voice_id: str) -> float:
    mapping = {
        "onyx": 3.5,
        "nova": 1.5,
        "ash": 4.5,
        "echo": 6.0,
        "shimmer": 2.5,
        "sage": 0.0,
    }
    return mapping.get(voice_id, 2.5)


def json_loads(value: str) -> dict[str, Any]:
    import json

    parsed = json.loads(value)
    if isinstance(parsed, dict):
        return parsed
    return {}


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


@app.websocket("/ws/interview/{session_id}")
async def ws_interview(websocket: WebSocket, session_id: str):
    await websocket.accept()
    await websocket.send_json({"type": "session_start", "session_id": session_id, "service": APP_NAME})
    try:
        while True:
            payload = await websocket.receive_json()
            msg = CandidateTurnMessage(**payload)
            if msg.type not in {"candidate_turn", "candidate_audio_chunk"}:
                await websocket.send_json({"type": "error", "error": f"Unsupported message type: {msg.type}"})
                continue

            transcript = (msg.candidate_text or "").strip()
            if not transcript and msg.candidate_audio_b64:
                stt_data = await _post_audio_transcribe(msg.candidate_audio_b64)
                transcript = stt_data.get("text", "").strip()
            if not transcript:
                transcript = "Could you repeat that?"

            await websocket.send_json({"type": "expression_update", "character_id": msg.character_id, "state": "thinking"})
            await asyncio.sleep(_silence_seconds_for_voice(msg.voice_id))

            generated_text = await _generate_text(
                msg.conversation + [{"role": "user", "content": transcript}],
                msg.system_prompt,
            )
            audio_base64 = await _synthesize_wav_base64(generated_text, msg.voice_id)

            await websocket.send_json(
                {
                    "type": "interviewer_speaking",
                    "character_id": msg.character_id,
                    "expression_state": "speaking",
                    "response_text": generated_text,
                    "audio_base64": audio_base64,
                }
            )
            await websocket.send_json({"type": "expression_update", "character_id": msg.character_id, "state": "listening"})
    except WebSocketDisconnect:
        return


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

    response_text = await _generate_text(
        payload.conversation + [{"role": "user", "content": transcript}],
        payload.system_prompt,
    )
    source = "llm" if LLM_URL else source

    audio_url: str | None = None
    if TTS_URL:
        _ = await _synthesize_wav_base64(response_text, payload.voice_id)
        audio_url = f"memory://{payload.session_id}/{payload.character_id}/latest.wav"
        source = "tts"

    return TurnResponse(
        transcript=transcript,
        response_text=response_text,
        audio_url=audio_url,
        latency_ms=850,
        source=source,
    )
