"""Sub-agents read memory through a bounded snapshot and can only propose candidates."""

from types import SimpleNamespace

from agent.memory_access import (
    MemoryAccessPolicy, dedupe_candidates, extract_memory_candidates, snapshot_from_store,
)


def test_snapshot_is_budgeted_ranked_and_respects_disabled_targets():
    store = SimpleNamespace(user_entries=["User prefers Polish replies", "User uses Figma daily"],
                            memory_entries=["x" * 5000, "Repo tests run via scripts/run_tests.sh"],
                            user_profile_enabled=True, memory_enabled=True)
    snap = snapshot_from_store(store, "open figma and export", budget_chars=300)
    assert "Figma" in snap and "x" * 100 not in snap
    assert snap.index("Figma") < snap.index("Polish")  # task-relevant first
    store.user_profile_enabled = False
    assert "Figma" not in snapshot_from_store(store, "figma")
    assert snapshot_from_store(None, "figma") == ""


def test_candidates_round_trip_and_dedupe_against_existing():
    summary = "Done.\nMEMORY CANDIDATES:\n- User's editor is Zed\n- user's editor is zed\n- \nEND MEMORY CANDIDATES"
    assert extract_memory_candidates(summary) == ["User's editor is Zed"]
    assert extract_memory_candidates("no block here") == []
    assert dedupe_candidates(["User's editor is Zed"], existing=["User's editor is Zed (confirmed)"]) == []


def test_only_root_may_write():
    assert MemoryAccessPolicy.for_depth(0).write and not MemoryAccessPolicy.for_depth(1).write
    assert MemoryAccessPolicy.for_depth(2).read


def test_child_agent_gets_readonly_snapshot_but_no_memory_tool():
    import threading
    from unittest.mock import MagicMock, patch

    from tools.delegate_tool import _build_child_agent

    parent = MagicMock()
    parent.base_url, parent.api_key, parent.provider = "https://openrouter.ai/api/v1", "***", "openrouter"
    parent.api_mode, parent.model, parent.platform = "chat_completions", "m", "cli"
    parent._session_db, parent._delegate_depth, parent._print_fn = None, 0, None
    parent._active_children, parent._active_children_lock = [], threading.Lock()
    parent.enabled_toolsets, parent.disabled_toolsets = ["hermes-cli"], []
    parent._memory_store = SimpleNamespace(user_entries=["User writes commit messages in Polish"],
                                           memory_entries=[], user_profile_enabled=True, memory_enabled=True)
    with patch("run_agent.AIAgent") as MockAgent:
        MockAgent.return_value = MagicMock()
        _build_child_agent(task_index=0, goal="commit the fix", context=None, toolsets=None, model=None,
                           max_iterations=5, parent_agent=parent, task_count=1)
    _, kwargs = MockAgent.call_args
    assert "commit messages in Polish" in kwargs["ephemeral_system_prompt"]
    assert "memory" in kwargs["disabled_toolsets"] and kwargs["skip_memory"] is True
