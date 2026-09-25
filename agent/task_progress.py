"""Semantic progress for tasks: raw tool/sub-agent events -> short phases the voice layer can speak.

The voice provider must never read tool logs aloud. ``classify_tool`` maps a tool name to a
phase, and ``ProgressThrottle`` drops repeats of the same phase inside a window so a burst of
``read_file`` calls becomes one "reading files" update.
"""

from __future__ import annotations

import threading
import time
from typing import Callable, Dict, Optional, Tuple

PROGRESS_PHASES = (
    "searching", "browsing", "running_command", "reading_file", "writing_file",
    "using_computer", "waiting_approval", "child_working", "verifying",
)

_TOOL_PHASES: Dict[str, str] = {
    "web_search": "searching", "web_extract": "searching", "session_search": "searching",
    "terminal": "running_command", "execute_code": "running_command", "process": "running_command",
    "read_file": "reading_file", "search_files": "reading_file",
    "write_file": "writing_file", "patch": "writing_file",
    "computer_use": "using_computer",
    "delegate_task": "child_working",
}

# Spoken lines, kept short; the voice layer may paraphrase but never expands to raw args.
PHASE_LINES = {
    "pl": {
        "searching": "Szukam informacji.", "browsing": "Przeglądam stronę.",
        "running_command": "Uruchamiam polecenie.", "reading_file": "Czytam pliki.",
        "writing_file": "Zapisuję zmiany.", "using_computer": "Steruję komputerem.",
        "waiting_approval": "Potrzebuję twojej zgody przed wykonaniem tej akcji.",
        "child_working": "Sub-agent pracuje nad częścią zadania.", "verifying": "Sprawdzam wynik.",
    },
    "en": {
        "searching": "Searching.", "browsing": "Browsing a page.", "running_command": "Running a command.",
        "reading_file": "Reading files.", "writing_file": "Writing changes.",
        "using_computer": "Using the computer.", "waiting_approval": "I need your approval before this action.",
        "child_working": "A sub-agent is working on part of the task.", "verifying": "Verifying the result.",
    },
}


def classify_tool(tool_name: str) -> Optional[str]:
    if not tool_name:
        return None
    if tool_name.startswith("browser_"):
        return "browsing"
    return _TOOL_PHASES.get(tool_name)


def phase_line(phase: str, lang: str = "en") -> str:
    return PHASE_LINES.get(lang, PHASE_LINES["en"]).get(phase, "")


class ProgressThrottle:
    """Emit a (task, phase) at most once per ``window_s``; a phase change always passes."""

    def __init__(self, window_s: float = 8.0, clock: Callable[[], float] = time.monotonic) -> None:
        self._window, self._clock = window_s, clock
        self._last: Dict[str, Tuple[str, float]] = {}
        self._lock = threading.Lock()

    def should_emit(self, task_id: str, phase: str) -> bool:
        now = self._clock()
        with self._lock:
            prev = self._last.get(task_id)
            if prev is not None and prev[0] == phase and now - prev[1] < self._window:
                return False
            self._last[task_id] = (phase, now)
            return True

    def forget(self, task_id: str) -> None:
        with self._lock:
            self._last.pop(task_id, None)
