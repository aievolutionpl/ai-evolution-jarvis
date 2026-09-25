"""Jarvis Pulse: a few proactive suggestions for the dashboard, ``GET/POST /api/pulse``.

Adapted from Leon's pulse manager (leon-ai/leon, MIT, © Louis Grenard): a small, bounded
queue of "matters" worth raising, each with a stable fingerprint, and a suppression policy
that learns from the owner — a dismissed matter comes back after a day, then a week, then
a month; three dismissals of one kind mute that kind for a month; an accepted one rests for
twelve hours.

Unlike Leon's, this pulse never calls a model and never acts on its own. Matters come from
real state (failing cron jobs, a recent unfinished conversation, an empty owner profile, no
automations yet) and the desktop only puts the suggested request in the composer, where the
person reads it before Jarvis gets it. The backend returns a ``kind`` plus parameters; the
wording is the desktop's, in the user's language.
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from hermes_cli.web_deps import late
from hermes_cli.web_routers._common import log as _log

router = APIRouter()

_open_session_db_for_profile = late("_open_session_db_for_profile", "hermes_cli.web_server_sessions")
_call_cron_for_profile = late("_call_cron_for_profile", "hermes_cli.web_server_cron")
_cron_profile_home = late("_cron_profile_home", "hermes_cli.web_server_cron")

STATE_FILENAME = "jarvis_pulse.json"
MAX_MATTERS = 3
MAX_POLICIES = 64
DAY = 86400.0
DECLINE_COOLDOWNS = (1 * DAY, 7 * DAY, 30 * DAY)
ACCEPT_COOLDOWN = 12 * 3600.0
KIND_DECLINE_LIMIT = 3
KIND_MUTE = 30 * DAY

# A conversation worth coming back to: recent, not the one just left, long enough to matter.
RESUME_WINDOW = 3 * DAY
RESUME_QUIET = 20 * 60.0
RESUME_MIN_MESSAGES = 6
# Below this, USER.md holds nothing Jarvis could use to know its owner.
OWNER_PROFILE_MIN_CHARS = 40


Signals = Dict[str, Any]
Matter = Dict[str, Any]


def _job_matters(signals: Signals, _now: float) -> List[Matter]:
    jobs = signals.get("jobs")
    if jobs is None:
        return []
    failing = [j for j in jobs if j.get("enabled", True) and j.get("last_status") == "error"]
    return [
        {"id": f"failing_job:{j.get('id') or j.get('name')}", "kind": "failing_job", "score": 0.9,
         "params": {"name": str(j.get("name") or j.get("id"))}}
        for j in failing[:2]
    ]


def _automation_matters(signals: Signals, _now: float) -> List[Matter]:
    jobs = signals.get("jobs")
    # None means the cron store could not be read, which is not the same as "no jobs".
    if jobs is None or jobs:
        return []
    return [{"id": "first_automation", "kind": "first_automation", "score": 0.4, "params": {}}]


def _resume_matters(signals: Signals, now: float) -> List[Matter]:
    for row in signals.get("sessions") or []:
        last = float(row.get("last_active") or row.get("started_at") or 0)
        title = str(row.get("title") or "").strip()
        if (title and not row.get("archived") and int(row.get("message_count") or 0) >= RESUME_MIN_MESSAGES
                and now - RESUME_WINDOW <= last <= now - RESUME_QUIET):
            return [{"id": f"resume_session:{row['id']}", "kind": "resume_session", "score": 0.7,
                     "params": {"title": title, "session_id": str(row["id"])}}]
    return []


def _owner_matters(signals: Signals, _now: float) -> List[Matter]:
    if int(signals.get("owner_profile_chars") or 0) >= OWNER_PROFILE_MIN_CHARS:
        return []
    return [{"id": "know_owner", "kind": "know_owner", "score": 0.5, "params": {}}]


# One planner per kind of matter.
_PLANNERS: Dict[str, Callable[[Signals, float], List[Matter]]] = {
    "failing_job": _job_matters,
    "resume_session": _resume_matters,
    "know_owner": _owner_matters,
    "first_automation": _automation_matters,
}
PulseKind = Literal["failing_job", "resume_session", "know_owner", "first_automation"]


def plan_matters(signals: Signals, now: float) -> List[Matter]:
    """Every candidate matter the signals support, strongest first."""
    matters = [m for planner in _PLANNERS.values() for m in planner(signals, now)]
    return sorted(matters, key=lambda m: m["score"], reverse=True)


def _suppressed(policy: Optional[Dict[str, Any]], now: float) -> bool:
    return bool(policy) and float(policy.get("suppressed_until") or 0) > now


def select_matters(matters: List[Dict[str, Any]], state: Dict[str, Any], now: float,
                   limit: int = MAX_MATTERS) -> List[Dict[str, Any]]:
    """Drop what the owner muted (by matter or by kind) and keep the bounded head."""
    policies = state.get("policies") or {}
    kinds = state.get("kinds") or {}
    seen: set[str] = set()
    chosen = []
    for matter in matters:
        if matter["id"] in seen or _suppressed(policies.get(matter["id"]), now) \
                or _suppressed(kinds.get(matter["kind"]), now):
            continue
        seen.add(matter["id"])
        chosen.append(matter)
    return chosen[:limit]


def record_feedback(state: Dict[str, Any], matter_id: str, kind: str, reaction: str, now: float) -> Dict[str, Any]:
    """Apply one accept/decline to the state (in place) and return it."""
    policies = state.setdefault("policies", {})
    kinds = state.setdefault("kinds", {})
    policy = policies.setdefault(matter_id, {"declines": 0})
    kind_policy = kinds.setdefault(kind, {"declines": 0})
    if reaction == "decline":
        policy["declines"] = int(policy.get("declines") or 0) + 1
        step = min(policy["declines"], len(DECLINE_COOLDOWNS)) - 1
        policy["suppressed_until"] = now + DECLINE_COOLDOWNS[step]
        kind_policy["declines"] = int(kind_policy.get("declines") or 0) + 1
        if kind_policy["declines"] >= KIND_DECLINE_LIMIT:
            kind_policy["suppressed_until"] = now + KIND_MUTE
            kind_policy["declines"] = 0
    else:
        policy["declines"] = 0
        policy["suppressed_until"] = now + ACCEPT_COOLDOWN
        kind_policy["declines"] = 0
    policy["updated_at"] = now
    kind_policy["updated_at"] = now
    if len(policies) > MAX_POLICIES:
        # Forget the policies touched longest ago; expired ones would be dropped first anyway.
        keep = sorted(policies.items(), key=lambda kv: float(kv[1].get("updated_at") or 0))[-MAX_POLICIES:]
        state["policies"] = dict(keep)
    return state


def _home(profile: Optional[str]) -> Path:
    if profile:
        return Path(_cron_profile_home(profile)[1])
    from hermes_constants import get_hermes_home
    return get_hermes_home()


def load_state(home: Path) -> Dict[str, Any]:
    try:
        data = json.loads((home / STATE_FILENAME).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def save_state(home: Path, state: Dict[str, Any]) -> None:
    path = home / STATE_FILENAME
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def _signals(profile: Optional[str], home: Path) -> Dict[str, Any]:
    signals: Dict[str, Any] = {"sessions": None, "jobs": None, "owner_profile_chars": 0}
    try:
        db = _open_session_db_for_profile(profile, read_only=True)
        try:
            signals["sessions"] = db.list_sessions_rich(limit=40, offset=0, compact_rows=True,
                                                        exclude_sources=["cron"], order_by_last_active=True)
        finally:
            db.close()
    except Exception:
        _log.debug("pulse: sessions unavailable", exc_info=True)
    try:
        signals["jobs"] = _call_cron_for_profile(profile or None, "list_jobs", True)
    except Exception:
        _log.debug("pulse: cron jobs unavailable", exc_info=True)
    try:
        signals["owner_profile_chars"] = len((home / "memories" / "USER.md").read_text(encoding="utf-8").strip())
    except OSError:
        pass
    return signals


def _pulse(profile: Optional[str]) -> Dict[str, Any]:
    home = _home(profile)
    now = time.time()
    matters = select_matters(plan_matters(_signals(profile, home), now), load_state(home), now)
    return {"generated_at": now, "matters": matters}


@router.get("/api/pulse")
async def get_pulse(profile: Optional[str] = None):
    return await asyncio.to_thread(_pulse, profile)


class PulseFeedback(BaseModel):
    id: str
    kind: PulseKind
    reaction: Literal["accept", "decline"]


def _feedback(profile: Optional[str], body: PulseFeedback) -> Dict[str, Any]:
    home = _home(profile)
    save_state(home, record_feedback(load_state(home), body.id, body.kind, body.reaction, time.time()))
    return {"ok": True}


@router.post("/api/pulse/feedback")
async def post_pulse_feedback(body: PulseFeedback, profile: Optional[str] = None):
    return await asyncio.to_thread(_feedback, profile, body)
