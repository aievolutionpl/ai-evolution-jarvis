"""Single-writer desktop input: observe is shared, act needs the lease, cancel revokes it."""

import json

from tools.computer_use.lease import ComputerLeaseManager


class _Clock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t


def test_lease_exclusive_expires_and_revocation_sticks():
    clock = _Clock()
    m = ComputerLeaseManager(ttl_s=10, clock=clock)
    assert m.try_acquire("agent-a", task_id="t1")
    assert m.try_acquire("agent-b") is None
    clock.t = 11  # crashed owner never pins the desktop
    assert m.try_acquire("agent-b")
    m.release_task("t1")
    assert m.try_acquire("agent-a", task_id="t1") is None
    m.revoke_owner("agent-b")
    assert m.current() is None and m.try_acquire("agent-b") is None


def test_second_agent_input_blocked_but_capture_allowed(monkeypatch):
    from tools.computer_use import tool as cu_tool
    from tools.computer_use.backend import ActionResult, CaptureResult

    class _Backend:
        def __init__(self):
            self.calls = []

        def start(self): pass
        def stop(self): pass
        def is_available(self): return True

        def click(self, **kw):
            self.calls.append("click")
            return ActionResult(ok=True, action="click")

        def capture(self, mode="som", app=None, **_):
            self.calls.append("capture")
            return CaptureResult(mode=mode, width=1, height=1, png_b64=None, elements=[], app="X", window_title="")

    backend = _Backend()
    cu_tool.reset_backend_for_tests()
    monkeypatch.setattr(cu_tool, "_get_backend", lambda session_id="": backend)
    try:
        cu_tool.handle_computer_use({"action": "click", "coordinate": [1, 1]}, session_id="child-a")
        blocked = json.loads(cu_tool.handle_computer_use({"action": "click", "coordinate": [1, 1]}, session_id="child-b"))
        assert blocked["code"] == "computer_lease_held"
        cu_tool.handle_computer_use({"action": "capture", "mode": "ax"}, session_id="child-b")
        assert backend.calls.count("click") == 1 and "capture" in backend.calls
        cu_tool.release_computer_use_session("child-a")
        cu_tool.handle_computer_use({"action": "click", "coordinate": [1, 1]}, session_id="child-b")
        assert backend.calls.count("click") == 2
    finally:
        cu_tool.reset_backend_for_tests()
