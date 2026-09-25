"""Phone push for the desktop's notifications, over ntfy: ``/api/notify/push``.

When a turn finishes or the agent waits for an answer (approval, clarify) while the person
is away from the window, the desktop already raises a native OS notification. With "send to
my phone" on, it also POSTs here, and the same text goes to the configured ntfy topic
(https://github.com/binwiederhier/ntfy) — the phone buzzes even when the laptop is closed
in another room.

No new delivery code: this is exactly ``hermes send --to ntfy``. The ntfy platform plugin
(``plugins/platforms/ntfy``) owns the topic, server, token and markdown settings; this route
only frames the message and runs the send under the request's profile.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from hermes_cli.web_deps import late

router = APIRouter()

_config_profile_scope = late("_config_profile_scope", "hermes_cli.web_server_profiles")

PUSH_PLATFORM = "ntfy"
_MAX_BODY = 900

PushKind = Literal["approval", "input", "turnDone", "turnError", "backgroundDone", "test"]

# A glance at the lock screen should say which kind it is before any word is read.
_KIND_MARKS: Dict[str, str] = {
    "approval": "⚠️",
    "input": "❓",
    "turnDone": "✅",
    "turnError": "❌",
    "backgroundDone": "✅",
    "test": "🔔",
}


class PushNotification(BaseModel):
    kind: PushKind
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(default="", max_length=4000)


def format_push(kind: str, title: str, body: str) -> str:
    """One ntfy message: a marked title line, then the body, capped for a push."""
    text = f"{_KIND_MARKS.get(kind, '🔔')} {title.strip()}"
    body = body.strip()
    if body:
        if len(body) > _MAX_BODY:
            body = body[: _MAX_BODY - 1].rstrip() + "…"
        text = f"{text}\n\n{body}"
    return text


def _push_status() -> Dict[str, Any]:
    from gateway.config import load_gateway_config
    from tools.send_message_tool import _home_chat_id, _resolve_platform_config, prepare_send_message_platforms

    prepare_send_message_platforms()
    platform, _pconfig, _entry, err = _resolve_platform_config(PUSH_PLATFORM, load_gateway_config())
    if err:
        return {"platform": PUSH_PLATFORM, "available": False, "target": None}
    config = load_gateway_config()
    target, err = _home_chat_id(config, platform, PUSH_PLATFORM)
    return {"platform": PUSH_PLATFORM, "available": not err, "target": target}


def _push(message: str) -> Dict[str, Any]:
    from tools.send_message_tool import send_message_tool

    return json.loads(send_message_tool({"action": "send", "target": PUSH_PLATFORM, "message": message}))


async def _scoped(profile: Optional[str], fn, *args):
    def _run():
        with _config_profile_scope(profile):
            return fn(*args)

    return await asyncio.get_running_loop().run_in_executor(None, _run)


@router.get("/api/notify/push/status")
async def get_push_status(profile: Optional[str] = None):
    return await _scoped(profile, _push_status)


@router.post("/api/notify/push")
async def post_push(body: PushNotification, profile: Optional[str] = None):
    result = await _scoped(profile, _push, format_push(body.kind, body.title, body.body))
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=str(result.get("error") or "push failed"))
    return {"ok": True, "target": result.get("chat_id")}
