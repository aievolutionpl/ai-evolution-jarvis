"""Jarvis Task Registry: one lifecycle for every unit of work (voice, text, pulse, cron).

A task is identified by ``task_id`` and carries a monotonically increasing ``revision``.
A correction ("open Chrome... no, Figma") bumps the revision; results and side effects
reported under an older revision are rejected (``accept_result`` returns False), so a
late answer to a superseded command can never overwrite the newer one.

Cancellation cascades to child tasks and runs the registered cancel hooks (computer
lease release, sub-agent interrupt) exactly once per task. State is in-process only:
a restart loses in-flight tasks, which is the recovery contract we want (a dead
process cannot own a running task). This is NOT a workflow engine.
"""

from __future__ import annotations

import itertools
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Callable, Dict, List, Optional

TASK_SOURCES = frozenset({"voice", "text", "pulse", "cron"})
TASK_STATUSES = ("queued", "running", "waiting_approval", "completed", "failed", "cancelled")
TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})

# InterruptIntent: four distinct user intents that voice UIs used to collapse into one "stop".
#   stop_speech   — silence TTS only; the task keeps running
#   stop_turn     — end the current model turn; the task may be resumed/corrected
#   correct       — replace the instruction; bumps revision, stale results are dropped
#   cancel_task   — terminate the task, its children and any computer input it holds
INTERRUPT_INTENTS = ("stop_speech", "stop_turn", "correct", "cancel_task")

_MAX_FINISHED = 200  # finished tasks kept for status queries before eviction


@dataclass
class JarvisTask:
    task_id: str
    session_id: str
    source: str
    instruction: str
    owner_agent_id: str = "root"
    parent_task_id: Optional[str] = None
    revision: int = 1
    status: str = "queued"
    required_capabilities: List[str] = field(default_factory=list)
    child_agent_ids: List[str] = field(default_factory=list)
    computer_lease: Optional[str] = None
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class TaskEvent:
    """Provider-agnostic event consumed by both the UI and the live voice layer."""
    seq: int
    task_id: str
    revision: int
    kind: str  # task.created|task.status|task.progress|task.corrected|task.cancelled|task.child_started|task.child_finished
    status: str
    message: str = ""
    at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return asdict(self)


class StaleRevisionError(ValueError):
    pass


class TaskRegistry:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._tasks: Dict[str, JarvisTask] = {}
        self._listeners: List[Callable[[TaskEvent], None]] = []
        self._cancel_hooks: List[Callable[[JarvisTask], None]] = []
        self._seq = itertools.count(1)

    # -- subscriptions ---------------------------------------------------------------
    def subscribe(self, listener: Callable[[TaskEvent], None]) -> Callable[[], None]:
        with self._lock:
            self._listeners.append(listener)

        def _unsubscribe() -> None:
            with self._lock:
                if listener in self._listeners:
                    self._listeners.remove(listener)
        return _unsubscribe

    def add_cancel_hook(self, hook: Callable[[JarvisTask], None]) -> None:
        with self._lock:
            if hook not in self._cancel_hooks:
                self._cancel_hooks.append(hook)

    def _emit(self, task: JarvisTask, kind: str, message: str = "") -> TaskEvent:
        event = TaskEvent(next(self._seq), task.task_id, task.revision, kind, task.status, message)
        for listener in list(self._listeners):
            try:
                listener(event)
            except Exception:  # a broken UI listener must never break the task lifecycle
                import logging
                logging.getLogger(__name__).debug("task listener failed", exc_info=True)
        return event

    # -- lifecycle -------------------------------------------------------------------
    def create(self, session_id: str, source: str, instruction: str, *, owner_agent_id: str = "root",
               parent_task_id: Optional[str] = None, required_capabilities: Optional[List[str]] = None) -> JarvisTask:
        if source not in TASK_SOURCES:
            raise ValueError(f"unknown task source {source!r}")
        task = JarvisTask(task_id=f"task-{uuid.uuid4().hex[:12]}", session_id=session_id, source=source,
                          instruction=instruction, owner_agent_id=owner_agent_id, parent_task_id=parent_task_id,
                          required_capabilities=list(required_capabilities or []))
        with self._lock:
            if parent_task_id is not None and parent_task_id not in self._tasks:
                raise KeyError(parent_task_id)
            self._tasks[task.task_id] = task
            self._evict_finished()
            self._emit(task, "task.created", instruction)
        return task

    def get(self, task_id: str) -> Optional[JarvisTask]:
        with self._lock:
            return self._tasks.get(task_id)

    def list(self, session_id: Optional[str] = None, *, active_only: bool = False) -> List[JarvisTask]:
        with self._lock:
            return [t for t in self._tasks.values()
                    if (session_id is None or t.session_id == session_id)
                    and not (active_only and t.status in TERMINAL_STATUSES)]

    def children(self, task_id: str) -> List[JarvisTask]:
        with self._lock:
            return [t for t in self._tasks.values() if t.parent_task_id == task_id]

    def _require(self, task_id: str) -> JarvisTask:
        task = self._tasks.get(task_id)
        if task is None:
            raise KeyError(task_id)
        return task

    def set_status(self, task_id: str, status: str, *, revision: Optional[int] = None, message: str = "") -> bool:
        """Move a task to ``status``. Returns False (no-op) for stale revisions or finished tasks."""
        if status not in TASK_STATUSES:
            raise ValueError(f"unknown status {status!r}")
        with self._lock:
            task = self._require(task_id)
            if task.status in TERMINAL_STATUSES or (revision is not None and revision != task.revision):
                return False
            task.status, task.updated_at = status, time.time()
            self._emit(task, "task.status", message)
            return True

    def progress(self, task_id: str, message: str, *, revision: Optional[int] = None) -> bool:
        with self._lock:
            task = self._require(task_id)
            if task.status in TERMINAL_STATUSES or (revision is not None and revision != task.revision):
                return False
            if task.status == "queued":
                task.status = "running"
            task.updated_at = time.time()
            self._emit(task, "task.progress", message)
            return True

    def correct(self, task_id: str, instruction: str) -> JarvisTask:
        """Replace the instruction and bump the revision. Children of the old revision are cancelled."""
        with self._lock:
            task = self._require(task_id)
            if task.status in TERMINAL_STATUSES:
                raise StaleRevisionError(f"task {task_id} already {task.status}")
            for child in self.children(task_id):
                self._cancel_locked(child, "superseded by correction")
            task.instruction, task.revision = instruction, task.revision + 1
            task.status, task.result, task.error, task.updated_at = "queued", None, None, time.time()
            task.child_agent_ids = []
            self._emit(task, "task.corrected", instruction)
            return task

    def accept_result(self, task_id: str, revision: int, *, result: Optional[str] = None,
                      error: Optional[str] = None) -> bool:
        """Record the outcome of ``revision``. Stale revisions and finished tasks are rejected."""
        with self._lock:
            task = self._tasks.get(task_id)
            if task is None or task.status in TERMINAL_STATUSES or revision != task.revision:
                return False
            task.result, task.error = result, error
            task.status, task.updated_at = ("failed" if error else "completed"), time.time()
            self._emit(task, "task.status", error or "")
            self._release(task)
            return True

    def is_current(self, task_id: str, revision: int) -> bool:
        """Side-effect gate: callers check this right before acting on behalf of a revision."""
        with self._lock:
            task = self._tasks.get(task_id)
            return task is not None and task.status not in TERMINAL_STATUSES and task.revision == revision

    def cancel(self, task_id: str, reason: str = "cancelled") -> bool:
        with self._lock:
            task = self._require(task_id)
            if task.status in TERMINAL_STATUSES:
                return False
            self._cancel_locked(task, reason)
            return True

    def cancel_session(self, session_id: str, reason: str = "session closed") -> int:
        with self._lock:
            roots = [t for t in self.list(session_id, active_only=True) if t.parent_task_id is None]
            for task in roots:
                self._cancel_locked(task, reason)
            return len(roots)

    def _cancel_locked(self, task: JarvisTask, reason: str) -> None:
        for child in self.children(task.task_id):
            if child.status not in TERMINAL_STATUSES:
                self._cancel_locked(child, reason)
        task.status, task.updated_at = "cancelled", time.time()
        self._emit(task, "task.cancelled", reason)
        self._release(task)

    def _release(self, task: JarvisTask) -> None:
        for hook in list(self._cancel_hooks):
            try:
                hook(task)
            except Exception:
                import logging
                logging.getLogger(__name__).warning("task release hook failed", exc_info=True)

    # -- children --------------------------------------------------------------------
    def child_started(self, task_id: str, agent_id: str) -> None:
        with self._lock:
            task = self._require(task_id)
            if agent_id not in task.child_agent_ids:
                task.child_agent_ids.append(agent_id)
            self._emit(task, "task.child_started", agent_id)

    def child_finished(self, task_id: str, agent_id: str, status: str = "completed") -> None:
        with self._lock:
            task = self._require(task_id)
            if agent_id in task.child_agent_ids:
                task.child_agent_ids.remove(agent_id)
            self._emit(task, "task.child_finished", f"{agent_id}:{status}")

    def _evict_finished(self) -> None:
        finished = sorted((t for t in self._tasks.values() if t.status in TERMINAL_STATUSES),
                          key=lambda t: t.updated_at)
        for task in finished[:max(0, len(finished) - _MAX_FINISHED)]:
            self._tasks.pop(task.task_id, None)


_registry: Optional[TaskRegistry] = None
_registry_lock = threading.Lock()


def get_task_registry() -> TaskRegistry:
    """Process-wide registry; the computer lease release hook is wired on first use."""
    global _registry
    with _registry_lock:
        if _registry is None:
            _registry = TaskRegistry()
            from tools.computer_use.lease import release_lease_for_task
            _registry.add_cancel_hook(lambda task: release_lease_for_task(task.task_id))
        return _registry
