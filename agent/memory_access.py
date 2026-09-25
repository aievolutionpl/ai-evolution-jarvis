"""Memory access policy for delegated agents: read-only snapshot in, memory candidates out.

Root Hermes reads and writes memory. A sub-agent gets a compact, task-ranked, read-only
snapshot of the parent's builtin memory (user preferences, conventions) inside its own
system prompt, and may PROPOSE new facts in a fenced ``MEMORY CANDIDATES`` block. Only the
parent commits (via the ordinary ``memory`` tool), so parallel children never race on
MEMORY.md / USER.md. The snapshot is built once at child construction, so the child's
system prompt stays byte-stable for its whole life (prompt caching).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence

SNAPSHOT_CHAR_BUDGET = 1200
MAX_CANDIDATES = 5
MAX_CANDIDATE_CHARS = 300

_CANDIDATES_RE = re.compile(r"^\s*MEMORY CANDIDATES:\s*$(.*?)(?:^\s*END MEMORY CANDIDATES\s*$|\Z)",
                            re.MULTILINE | re.DOTALL | re.IGNORECASE)
_WORD_RE = re.compile(r"[\w'-]{3,}", re.UNICODE)


@dataclass(frozen=True)
class MemoryAccessPolicy:
    read: bool
    write: bool

    @classmethod
    def for_depth(cls, delegate_depth: int) -> "MemoryAccessPolicy":
        return cls(read=True, write=delegate_depth == 0)


def _words(text: str) -> set:
    return {w.lower() for w in _WORD_RE.findall(text or "")}


def rank_entries(entries: Sequence[str], query: str) -> List[str]:
    """Entries by keyword overlap with ``query``; ties keep store order (user profile first by caller)."""
    q = _words(query)
    scored = [(-len(q & _words(e)), i, e) for i, e in enumerate(entries) if e and e.strip()]
    return [e for _, _, e in sorted(scored)]


def build_readonly_snapshot(user_entries: Sequence[str], memory_entries: Sequence[str], goal: str,
                            budget_chars: int = SNAPSHOT_CHAR_BUDGET) -> str:
    """Task-scoped memory block for a child prompt, capped at ``budget_chars``. Empty when nothing fits."""
    picked: List[str] = []
    used = 0
    # User profile outranks agent notes at equal relevance: preferences matter to every subtask.
    for entry in rank_entries(list(user_entries) + list(memory_entries), goal):
        line = "- " + " ".join(entry.split())
        if used + len(line) + 1 > budget_chars:
            continue
        picked.append(line)
        used += len(line) + 1
    if not picked:
        return ""
    return ("\nUSER MEMORY (read-only snapshot from the parent agent):\n" + "\n".join(picked) + "\n"
            "You cannot write memory. If you learn a durable fact about the user or environment worth "
            "remembering, end your final summary with:\nMEMORY CANDIDATES:\n- <one fact per line>\n"
            "END MEMORY CANDIDATES")


def snapshot_from_store(store, goal: str, budget_chars: int = SNAPSHOT_CHAR_BUDGET) -> str:
    if store is None:
        return ""
    user = getattr(store, "user_entries", None) if getattr(store, "user_profile_enabled", True) is not False else []
    notes = getattr(store, "memory_entries", None) if getattr(store, "memory_enabled", True) is not False else []
    user = [e for e in user if isinstance(e, str)] if isinstance(user, list) else []
    notes = [e for e in notes if isinstance(e, str)] if isinstance(notes, list) else []
    return build_readonly_snapshot(user, notes, goal, budget_chars)


def extract_memory_candidates(summary: Optional[str]) -> List[str]:
    if not summary:
        return []
    match = _CANDIDATES_RE.search(summary)
    if not match:
        return []
    out: List[str] = []
    for raw in match.group(1).splitlines():
        text = raw.strip().lstrip("-*• ").strip()
        if text:
            out.append(text[:MAX_CANDIDATE_CHARS])
    return dedupe_candidates(out)[:MAX_CANDIDATES]


def dedupe_candidates(candidates: Iterable[str], existing: Iterable[str] = ()) -> List[str]:
    """Drop blanks, case/whitespace duplicates, and facts already present in ``existing``."""
    seen = {" ".join(e.lower().split()) for e in existing if e}
    out: List[str] = []
    for c in candidates:
        key = " ".join((c or "").lower().split())
        if key and key not in seen and not any(key in s for s in seen):
            seen.add(key)
            out.append(c.strip())
    return out
