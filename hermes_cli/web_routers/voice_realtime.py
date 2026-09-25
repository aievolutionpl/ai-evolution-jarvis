"""Live voice (OpenAI Realtime) routes: ``GET /api/voice/realtime/status`` and
``POST /api/voice/realtime/session``.

The desktop talks to the Realtime API directly over WebRTC, but never sees the OpenAI key:
this route mints a short-lived client secret (``/v1/realtime/client_secrets``) with the
session already configured — model, voice, instructions and the ``ask_jarvis`` tool — and
hands back only that secret. The realtime model is the voice; the Hermes agent stays the
brain: anything that needs tools, files, memory or the web goes through ``ask_jarvis``,
which the desktop answers by running a normal turn in the current session — one pipeline and
one session for text and voice (docs/product/AI_EVOLUTION_JARVIS_DESIGN.md §7).

Settings live in ``voice.realtime`` (config.yaml); the key is the usual OpenAI audio key
(``VOICE_TOOLS_OPENAI_KEY`` or ``OPENAI_API_KEY``), resolved under the request's profile.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException

from hermes_cli.web_deps import late

router = APIRouter()

load_config = late("load_config", "hermes_cli.config")
_config_profile_scope = late("_config_profile_scope", "hermes_cli.web_server_profiles")

DEFAULT_REALTIME_MODEL = "gpt-realtime"
DEFAULT_REALTIME_VOICE = "marin"
DEFAULT_REALTIME_BASE_URL = "https://api.openai.com/v1"
DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe"
_MINT_TIMEOUT_S = 15.0

ASK_JARVIS_TOOL: Dict[str, Any] = {
    "type": "function",
    "name": "ask_jarvis",
    "description": (
        "Hand a request to Jarvis, the agent that can act: run tools and commands, read and "
        "edit files, browse the web, check memory, schedules and projects. Use it for every question "
        "or request that is not a greeting, thanks or confirmation. Pass the user's request in "
        "full, in their words."
    ),
    "parameters": {
        "type": "object",
        "properties": {"request": {"type": "string", "description": "The user's request, complete."}},
        "required": ["request"],
    },
}

_LANGUAGE_NAMES = {"pl": "Polish", "en": "English", "zh": "Chinese", "es": "Spanish", "de": "German"}


def realtime_settings(cfg: Optional[Dict[str, Any]]) -> Dict[str, str]:
    """Normalize ``voice.realtime``; defaults for anything unset or malformed."""
    voice = (cfg or {}).get("voice") if isinstance(cfg, dict) else None
    raw = voice.get("realtime") if isinstance(voice, dict) else None
    raw = raw if isinstance(raw, dict) else {}

    def _text(key: str, default: str) -> str:
        value = raw.get(key)
        return value.strip() if isinstance(value, str) and value.strip() else default

    return {
        "model": _text("model", DEFAULT_REALTIME_MODEL),
        "voice": _text("voice", DEFAULT_REALTIME_VOICE),
        "language": _text("language", "pl").lower(),
        "base_url": _text("base_url", DEFAULT_REALTIME_BASE_URL).rstrip("/"),
    }


def realtime_instructions(language: str) -> str:
    spoken = _LANGUAGE_NAMES.get(language, language)
    return (
        "You are Jarvis, a calm, capable personal assistant speaking out loud. "
        f"Speak {spoken} unless the user speaks another language. Keep replies short and natural: "
        "one or two sentences, no lists, no markdown, no URLs read aloud. "
        "You are only the voice: every question or request, including general knowledge, goes to "
        "ask_jarvis with the user's full request, so it runs in the user's Jarvis session with its "
        "memory and tools. Say a brief acknowledgement while it works, then tell the user the "
        "result in your own words, briefly. Answer directly only greetings, thanks and "
        "confirmations."
    )


def session_config(settings: Dict[str, str]) -> Dict[str, Any]:
    return {
        "type": "realtime",
        "model": settings["model"],
        "instructions": realtime_instructions(settings["language"]),
        "audio": {
            "input": {
                "transcription": {"model": DEFAULT_TRANSCRIPTION_MODEL, "language": settings["language"]},
                "turn_detection": {"type": "semantic_vad"},
            },
            "output": {"voice": settings["voice"]},
        },
        "tools": [ASK_JARVIS_TOOL],
        "tool_choice": "auto",
    }


def _resolve_key() -> str:
    from tools.tool_backend_helpers import resolve_openai_audio_api_key

    return resolve_openai_audio_api_key() or ""


async def _mint_client_secret(base_url: str, api_key: str, session: Dict[str, Any]) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=_MINT_TIMEOUT_S) as client:
        response = await client.post(
            f"{base_url}/realtime/client_secrets",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"session": session},
        )
    if response.status_code >= 400:
        detail = ""
        try:
            detail = str((response.json().get("error") or {}).get("message") or "")
        except ValueError:
            pass
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI Realtime rejected the session ({response.status_code}){': ' + detail if detail else ''}",
        )
    return response.json()


async def _scoped(profile: Optional[str], fn):
    def _run():
        with _config_profile_scope(profile):
            return fn()

    return await asyncio.get_running_loop().run_in_executor(None, _run)


@router.get("/api/voice/realtime/status")
async def realtime_status(profile: Optional[str] = None):
    cfg, key = await _scoped(profile, lambda: (load_config(), _resolve_key()))
    settings = realtime_settings(cfg)
    return {"available": bool(key), "model": settings["model"], "voice": settings["voice"],
            "language": settings["language"]}


@router.post("/api/voice/realtime/session")
async def realtime_session(profile: Optional[str] = None):
    cfg, key = await _scoped(profile, lambda: (load_config(), _resolve_key()))
    if not key:
        raise HTTPException(
            status_code=400,
            detail="Live voice needs an OpenAI key: set OPENAI_API_KEY (or VOICE_TOOLS_OPENAI_KEY).",
        )
    settings = realtime_settings(cfg)
    minted = await _mint_client_secret(settings["base_url"], key, session_config(settings))
    # GA shape: {"value": "ek_...", "expires_at": ...}; older previews nested it.
    secret = minted.get("value") or (minted.get("client_secret") or {}).get("value")
    if not isinstance(secret, str) or not secret:
        raise HTTPException(status_code=502, detail="OpenAI Realtime returned no client secret.")
    return {
        "client_secret": secret,
        "expires_at": minted.get("expires_at") or (minted.get("client_secret") or {}).get("expires_at"),
        "model": settings["model"],
        "voice": settings["voice"],
        "calls_url": f"{settings['base_url']}/realtime/calls",
    }
