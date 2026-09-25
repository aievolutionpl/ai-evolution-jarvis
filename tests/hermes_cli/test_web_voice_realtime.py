"""Live voice session minting (``/api/voice/realtime/*``): the OpenAI key never leaves the
backend, and the minted session carries the configured model plus the ``ask_jarvis`` bridge."""
import pytest

from hermes_cli.web_routers import voice_realtime


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


def test_session_returns_only_the_ephemeral_secret(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-live-never-leaves")
    monkeypatch.setattr(voice_realtime, "load_config", lambda: {
        "voice": {"realtime": {"model": "gpt-realtime-2.1-mini", "voice": "cedar"}}})
    sent = {}

    async def fake_mint(base_url, api_key, session):
        sent.update(base_url=base_url, api_key=api_key, session=session)
        return {"value": "ek_short_lived", "expires_at": 1_900_000_000}

    monkeypatch.setattr(voice_realtime, "_mint_client_secret", fake_mint)

    resp = client.post("/api/voice/realtime/session")
    assert resp.status_code == 200
    body = resp.json()
    assert body["client_secret"] == "ek_short_lived"
    assert "sk-live-never-leaves" not in resp.text
    # The configured model and voice are what the minted session is built with.
    assert sent["api_key"] == "sk-live-never-leaves"
    assert sent["session"]["model"] == body["model"] == "gpt-realtime-2.1-mini"
    assert sent["session"]["audio"]["output"]["voice"] == body["voice"] == "cedar"
    assert [t["name"] for t in sent["session"]["tools"]] == ["ask_jarvis"]
    assert body["calls_url"].startswith(sent["base_url"])


def test_session_without_a_key_is_a_clear_400(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("VOICE_TOOLS_OPENAI_KEY", raising=False)
    monkeypatch.setattr(voice_realtime, "_resolve_key", lambda: "")

    async def never(*_a, **_k):
        raise AssertionError("must not call OpenAI without a key")

    monkeypatch.setattr(voice_realtime, "_mint_client_secret", never)

    resp = client.post("/api/voice/realtime/session")
    assert resp.status_code == 400
    assert "OPENAI_API_KEY" in resp.json()["detail"]
    assert client.get("/api/voice/realtime/status").json()["available"] is False


def test_settings_fall_back_to_defaults_for_malformed_config():
    settings = voice_realtime.realtime_settings({"voice": {"realtime": {"model": "  ", "voice": 7}}})
    assert settings["model"] == voice_realtime.DEFAULT_REALTIME_MODEL
    assert settings["voice"] == voice_realtime.DEFAULT_REALTIME_VOICE
    assert voice_realtime.realtime_settings(None)["base_url"] == voice_realtime.DEFAULT_REALTIME_BASE_URL
