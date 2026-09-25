"""task.* RPCs drive the real registry: stale completions are refused, cancel reports the cascade."""

from types import SimpleNamespace

import pytest


@pytest.fixture
def call(monkeypatch):
    from agent import task_registry
    from tui_gateway import server

    monkeypatch.setattr(task_registry, "_registry", None)
    transport = SimpleNamespace(write=lambda frame: True)

    def _call(method, **params):
        return server.dispatch({"id": 1, "method": method, "params": params}, transport=transport)
    return _call


def test_correct_then_stale_complete_is_refused(call):
    task = call("task.create", session_id="s", source="voice", instruction="Otwórz Chrome")["result"]["task"]
    call("task.correct", task_id=task["task_id"], instruction="Edge")
    stale = call("task.complete", task_id=task["task_id"], revision=task["revision"], result="chrome")["result"]
    assert stale["accepted"] is False
    fresh = call("task.complete", task_id=task["task_id"], revision=task["revision"] + 1, result="edge")["result"]
    assert fresh["accepted"] is True and fresh["task"]["status"] == "completed"


def test_cancel_and_errors(call):
    parent = call("task.create", session_id="s", instruction="a")["result"]["task"]
    call("task.create", session_id="s", instruction="b", parent_task_id=parent["task_id"])
    res = call("task.cancel", task_id=parent["task_id"])["result"]
    assert res["cancelled"] and res["task"]["status"] == "cancelled"
    status = call("task.status", task_id=parent["task_id"])["result"]
    assert [c["status"] for c in status["children"]] == ["cancelled"]
    assert "error" in call("task.status", task_id="nope")
    assert "error" in call("task.create", session_id="s", source="fax", instruction="x")
