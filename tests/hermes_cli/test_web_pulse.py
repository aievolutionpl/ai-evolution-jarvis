"""Jarvis Pulse (``/api/pulse``): suggestions come from real state, and the owner's
dismissals teach it — a dismissed matter rests longer each time, and a kind dismissed
again and again goes quiet (Leon's suppression policy)."""
import time

import pytest

from hermes_cli.web_routers import pulse


@pytest.fixture
def client():
    try:
        from starlette.testclient import TestClient
    except ImportError:
        pytest.skip("fastapi/starlette not installed")
    from hermes_cli.web_server import app, _SESSION_HEADER_NAME, _SESSION_TOKEN

    c = TestClient(app)
    c.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN
    return c


def test_real_state_becomes_matters_and_a_dismissal_sticks_across_requests(client, monkeypatch):
    from hermes_constants import get_hermes_home
    from hermes_state import SessionDB

    db = SessionDB(db_path=get_hermes_home() / "state.db")
    try:
        db.create_session("s-long", source="desktop")
        db.set_session_title("s-long", "Plan kampanii")
        hour_ago = time.time() - 3600
        for i in range(pulse.RESUME_MIN_MESSAGES):
            db.append_message("s-long", "user" if i % 2 == 0 else "assistant", f"m{i}", timestamp=hour_ago)
        db._conn.execute("UPDATE sessions SET started_at = ? WHERE id = ?", (hour_ago - 60, "s-long"))
        db._conn.commit()
    finally:
        db.close()
    monkeypatch.setattr(pulse, "_call_cron_for_profile", lambda *_a, **_k: [
        {"id": "j1", "name": "Poranny raport", "enabled": True, "last_status": "error"},
    ])

    kinds = {m["kind"]: m for m in client.get("/api/pulse").json()["matters"]}
    assert kinds["failing_job"]["params"]["name"] == "Poranny raport"
    assert kinds["resume_session"]["params"]["title"] == "Plan kampanii"
    assert "know_owner" in kinds  # USER.md is empty in a fresh home

    resp = client.post("/api/pulse/feedback", json={"id": kinds["failing_job"]["id"], "kind": "failing_job",
                                                    "reaction": "decline"})
    assert resp.status_code == 200
    after = [m["kind"] for m in client.get("/api/pulse").json()["matters"]]
    assert "failing_job" not in after
    assert "resume_session" in after


def test_each_dismissal_rests_longer_and_repeated_dismissals_mute_the_kind():
    now = 1_000_000.0
    state: dict = {}
    rests = []
    for _ in range(3):
        pulse.record_feedback(state, "resume_session:a", "resume_session", "decline", now)
        rests.append(state["policies"]["resume_session:a"]["suppressed_until"] - now)
    assert rests == sorted(rests) and len(set(rests)) == 3

    other = {"id": "resume_session:b", "kind": "resume_session", "score": 0.7, "params": {}}
    # The kind was dismissed three times: a brand-new matter of that kind stays quiet too.
    assert pulse.select_matters([other], state, now + pulse.DAY) == []
    assert pulse.select_matters([other], state, now + pulse.KIND_MUTE + 1) == [other]


def test_accepting_rests_the_matter_briefly_and_forgives_past_dismissals():
    now = 1_000_000.0
    state: dict = {}
    pulse.record_feedback(state, "know_owner", "know_owner", "decline", now)
    pulse.record_feedback(state, "know_owner", "know_owner", "accept", now + 2 * pulse.DAY)
    matter = {"id": "know_owner", "kind": "know_owner", "score": 0.5, "params": {}}
    assert pulse.select_matters([matter], state, now + 2 * pulse.DAY + 60) == []
    assert pulse.select_matters([matter], state, now + 2 * pulse.DAY + pulse.ACCEPT_COOLDOWN + 1) == [matter]
    assert state["policies"]["know_owner"]["declines"] == 0


def test_unreadable_cron_store_is_not_mistaken_for_no_automations():
    assert pulse.plan_matters({"jobs": None, "sessions": [], "owner_profile_chars": 500}, time.time()) == []
    assert [m["kind"] for m in pulse.plan_matters({"jobs": [], "owner_profile_chars": 500}, time.time())] == \
        ["first_automation"]
