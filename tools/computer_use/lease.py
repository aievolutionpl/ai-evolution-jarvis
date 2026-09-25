"""Single-writer lease for desktop input.

Many agents may observe (capture, list_apps, wait); only the lease holder may click, type,
scroll, drag or focus. The owner key is the calling agent's ``session_id`` (root and every
sub-agent run in distinct sessions), optionally tagged with the ``task_id`` that holds it.

Acquisition is implicit on the first input action when the lease is free, so a lone agent
behaves exactly as before. A lease expires ``ttl_s`` after the owner's last input action,
so a crashed or wedged owner can never pin the desktop. Cancel/cleanup release it
unconditionally via ``release_lease_for_task`` / ``release_lease_for_owner``.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Callable, Optional

DEFAULT_LEASE_TTL_S = 60.0


@dataclass
class ComputerLease:
    owner: str
    task_id: Optional[str]
    acquired_at: float
    expires_at: float


class ComputerLeaseManager:
    def __init__(self, ttl_s: float = DEFAULT_LEASE_TTL_S, clock: Callable[[], float] = time.monotonic) -> None:
        self._ttl, self._clock = ttl_s, clock
        self._lease: Optional[ComputerLease] = None
        self._revoked_tasks: set = set()
        self._revoked_owners: set = set()
        self._lock = threading.Lock()

    def _current_locked(self) -> Optional[ComputerLease]:
        if self._lease is not None and self._clock() >= self._lease.expires_at:
            self._lease = None
        return self._lease

    def current(self) -> Optional[ComputerLease]:
        with self._lock:
            return self._current_locked()

    def try_acquire(self, owner: str, task_id: Optional[str] = None) -> Optional[ComputerLease]:
        """Acquire or renew for ``owner``. Returns None when another owner holds a live lease,
        or when the owner/task was revoked (a cancelled agent may never regain input)."""
        now = self._clock()
        with self._lock:
            if owner in self._revoked_owners or (task_id is not None and task_id in self._revoked_tasks):
                return None
            lease = self._current_locked()
            if lease is not None and lease.owner != owner:
                return None
            if lease is None:
                lease = self._lease = ComputerLease(owner, task_id, now, now + self._ttl)
            else:
                lease.expires_at = now + self._ttl
                lease.task_id = task_id or lease.task_id
            return lease

    def release_owner(self, owner: str) -> bool:
        with self._lock:
            if self._lease is not None and self._lease.owner == owner:
                self._lease = None
                return True
            return False

    def revoke_owner(self, owner: str) -> bool:
        """Release and bar ``owner`` for good: an interrupted agent's in-flight loop must not re-grab input."""
        with self._lock:
            self._revoked_owners.add(owner)
            if self._lease is not None and self._lease.owner == owner:
                self._lease = None
                return True
            return False

    def release_task(self, task_id: str) -> bool:
        with self._lock:
            self._revoked_tasks.add(task_id)
            if self._lease is not None and self._lease.task_id == task_id:
                self._lease = None
                return True
            return False


_manager = ComputerLeaseManager()


def get_lease_manager() -> ComputerLeaseManager:
    return _manager


def release_lease_for_task(task_id: str) -> bool:
    return _manager.release_task(task_id)


def release_lease_for_owner(owner: str) -> bool:
    return _manager.release_owner(owner)


def revoke_lease_for_owner(owner: str) -> bool:
    return _manager.revoke_owner(owner)


def reset_lease_for_tests() -> None:
    global _manager
    _manager = ComputerLeaseManager()
