"""Phone push over ntfy (``/api/notify/push``): the real ntfy plugin and the real
``hermes send`` path deliver to a local fake ntfy server; without ntfy set up the
desktop is told so instead of a silent drop."""
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from hermes_cli.web_routers import push_notify


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


@pytest.fixture
def fake_ntfy():
    received = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802 — http.server API
            length = int(self.headers.get("Content-Length") or 0)
            received.append((self.path, self.rfile.read(length).decode("utf-8")))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"id":"m1"}')

        def log_message(self, *_args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_port}", received
    server.shutdown()


def test_waiting_for_an_answer_reaches_the_ntfy_topic(client, fake_ntfy, monkeypatch):
    server_url, received = fake_ntfy
    monkeypatch.setenv("NTFY_TOPIC", "jarvis-phone-test")
    monkeypatch.setenv("NTFY_SERVER_URL", server_url)

    status = client.get("/api/notify/push/status").json()
    assert status["available"] is True
    assert status["target"] == "jarvis-phone-test"

    resp = client.post("/api/notify/push", json={"kind": "input", "title": "Jarvis czeka na odpowiedź",
                                                 "body": "Który plik mam otworzyć?"})
    assert resp.status_code == 200, resp.text
    assert len(received) == 1
    path, body = received[0]
    assert path == "/jarvis-phone-test"
    assert body.startswith("❓ Jarvis czeka na odpowiedź")
    assert "Który plik mam otworzyć?" in body


def test_without_ntfy_the_desktop_is_told_instead_of_a_silent_drop(client, monkeypatch):
    monkeypatch.delenv("NTFY_TOPIC", raising=False)
    assert client.get("/api/notify/push/status").json()["available"] is False
    resp = client.post("/api/notify/push", json={"kind": "turnDone", "title": "Gotowe"})
    assert resp.status_code == 502


def test_long_bodies_are_capped_for_a_lock_screen():
    text = push_notify.format_push("turnDone", "Gotowe", "x" * 5000)
    assert text.startswith("✅ Gotowe\n\n")
    assert len(text) < 1000
