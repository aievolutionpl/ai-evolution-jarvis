"""Jarvis task lifecycle RPCs (task.*): one registry for voice, text, pulse and cron work.

The registry (agent/task_registry.py) owns revisions and cancel cascades; these handlers only
validate params and translate. ``task.cancel`` with ``interrupt: true`` also stops the live
Hermes turn of that session, so cancel reaches parent + children + computer input together.
"""

from .method_ctx import HandlerRegistry, bind_module

_registry = HandlerRegistry()
method = _registry.method


def _task_registry():
    from agent.task_registry import get_task_registry
    return get_task_registry()


def _task_or_err(rid, params):
    task_id = _str_param(params, "task_id")
    if not task_id:
        return None, _err(rid, 4000, "task_id required")
    task = _task_registry().get(task_id)
    if task is None:
        return None, _err(rid, 4004, f"unknown task {task_id}")
    return task, None


@method("task.create")
def _task_create_rpc(rid, params):
    session_id = _str_param(params, "session_id")
    instruction = _str_param(params, "instruction")
    if not session_id or not instruction:
        return _err(rid, 4000, "session_id and instruction required")
    caps = params.get("required_capabilities") or []
    try:
        task = _task_registry().create(
            session_id, _str_param(params, "source") or "text", instruction,
            parent_task_id=_str_param(params, "parent_task_id") or None,
            required_capabilities=[str(c) for c in caps] if isinstance(caps, list) else [])
    except (ValueError, KeyError) as exc:
        return _err(rid, 4000, f"invalid task: {exc}")
    return _ok(rid, {"task": task.to_dict()})


@method("task.status")
def _task_status_rpc(rid, params):
    task, err = _task_or_err(rid, params)
    if err:
        return err
    children = [c.to_dict() for c in _task_registry().children(task.task_id)]
    return _ok(rid, {"task": task.to_dict(), "children": children})


@method("task.list")
def _task_list_rpc(rid, params):
    tasks = _task_registry().list(_str_param(params, "session_id") or None,
                                  active_only=bool(params.get("active_only")))
    return _ok(rid, {"tasks": [t.to_dict() for t in tasks]})


@method("task.progress")
def _task_progress_rpc(rid, params):
    task, err = _task_or_err(rid, params)
    if err:
        return err
    revision = params.get("revision")
    accepted = _task_registry().progress(task.task_id, _str_param(params, "message"),
                                         revision=int(revision) if revision is not None else None)
    return _ok(rid, {"accepted": accepted})


@method("task.correct")
def _task_correct_rpc(rid, params):
    task, err = _task_or_err(rid, params)
    if err:
        return err
    instruction = _str_param(params, "instruction")
    if not instruction:
        return _err(rid, 4000, "instruction required")
    from agent.task_registry import StaleRevisionError
    try:
        task = _task_registry().correct(task.task_id, instruction)
    except StaleRevisionError as exc:
        return _err(rid, 4009, str(exc))
    return _ok(rid, {"task": task.to_dict()})


@method("task.complete")
def _task_complete_rpc(rid, params):
    task, err = _task_or_err(rid, params)
    if err:
        return err
    if params.get("revision") is None:
        return _err(rid, 4000, "revision required")
    accepted = _task_registry().accept_result(
        task.task_id, int(params["revision"]), result=_str_param(params, "result") or None,
        error=_str_param(params, "error") or None)
    # accepted=False means a stale revision: the caller must drop the result and its side effects.
    return _ok(rid, {"accepted": accepted, "task": task.to_dict()})


@method("task.cancel")
def _task_cancel_rpc(rid, params):
    task, err = _task_or_err(rid, params)
    if err:
        return err
    cancelled = _task_registry().cancel(task.task_id, _str_param(params, "reason") or "cancelled by user")
    interrupted = False
    if cancelled and params.get("interrupt"):
        session = _sessions.get(task.session_id)
        if session is not None:
            try:
                _interrupt_session_turn(task.session_id, session)
                interrupted = True
            except Exception:
                logger.debug("task.cancel interrupt failed", exc_info=True)
    return _ok(rid, {"cancelled": cancelled, "interrupted": interrupted, "task": task.to_dict()})


def register(server):
    bind_module(globals(), server)
