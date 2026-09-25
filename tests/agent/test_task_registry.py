"""Task lifecycle invariants: corrections supersede, cancel cascades, stale results never land."""

import pytest

from agent.task_registry import StaleRevisionError, TaskRegistry


def test_correction_rejects_result_from_superseded_revision():
    reg = TaskRegistry()
    task = reg.create("s1", "voice", "Otwórz Chrome")
    old_rev = task.revision
    reg.correct(task.task_id, "Nie, jednak Figma")
    assert not reg.is_current(task.task_id, old_rev)
    assert reg.accept_result(task.task_id, old_rev, result="Chrome opened") is False
    assert reg.accept_result(task.task_id, old_rev + 1, result="Figma opened") is True
    assert reg.get(task.task_id).result == "Figma opened"


def test_cancel_cascades_to_children_and_runs_release_hook_once_each():
    reg = TaskRegistry()
    released = []
    reg.add_cancel_hook(lambda t: released.append(t.task_id))
    parent = reg.create("s1", "text", "research")
    child = reg.create("s1", "text", "sub-research", parent_task_id=parent.task_id)
    assert reg.cancel(parent.task_id)
    assert {reg.get(parent.task_id).status, reg.get(child.task_id).status} == {"cancelled"}
    assert sorted(released) == sorted([parent.task_id, child.task_id])
    assert reg.cancel(parent.task_id) is False  # idempotent: no second hook run
    assert len(released) == 2
    with pytest.raises(StaleRevisionError):
        reg.correct(parent.task_id, "too late")


def test_voice_and_text_share_one_lifecycle_and_event_stream():
    reg = TaskRegistry()
    events = []
    reg.subscribe(events.append)
    for source in ("voice", "text"):
        t = reg.create("s1", source, "x")
        reg.progress(t.task_id, "searching")
        reg.accept_result(t.task_id, t.revision, result="ok")
    kinds = [(e.kind, e.status) for e in events]
    assert kinds[:3] == kinds[3:]
    assert [e.seq for e in events] == sorted(e.seq for e in events)
