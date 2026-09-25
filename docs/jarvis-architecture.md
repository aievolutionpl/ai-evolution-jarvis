# Jarvis architecture: voice, tasks, memory, computer control

Jarvis is a voice-first front end to **one** Hermes runtime. The live voice provider
talks and delegates; Hermes owns tools, memory, approvals, sub-agents and computer control.
This document maps the current flow and the contracts added for the upgrade plan
(P0–P8). Status per phase is at the bottom.

## Current runtime flow

| Flow | Where | Notes |
|---|---|---|
| Live voice (OpenAI Realtime, WebRTC) | `apps/desktop/src/lib/realtime-voice.ts`, `hermes_cli/web_routers/voice_realtime.py` | Backend mints a short-lived client secret; the model's only tool is `ask_jarvis`, which runs a normal Hermes turn in the current chat. |
| Classic voice | `tui_gateway/methods_voice.py`, `voice-*.ts` | STT → Hermes turn → TTS. Fallback path. |
| Turn lifecycle | `agent/turn_*.py`, `tui_gateway/prompt_turn.py` | `session.interrupt` stops the live turn. |
| Sub-agents | `tools/delegate_tool*.py`, `agent/subagent_lifecycle.py` | Children run in their own sessions, `skip_memory=True`, `memory` toolset denied. |
| Memory | `agent/memory_manager.py`, `tools/memory_tool_store.py` | Builtin MEMORY.md / USER.md + one external provider; profile-scoped. |
| Computer control | `tools/computer_use/` (cua-driver) | Hard blocks → per-session approvals → backend, per-session call lock. |

## Contracts

| Contract | Module | Invariant |
|---|---|---|
| `JarvisTask`, `TaskRegistry`, `TaskEvent`, `InterruptIntent` | `agent/task_registry.py` | Every job has a `task_id` + `revision`. A correction bumps the revision; `accept_result` / `is_current` reject stale revisions. Cancel cascades to children and runs release hooks once. |
| `task.*` RPCs | `tui_gateway/methods_tasks.py` | `task.create/status/list/progress/correct/complete/cancel`; `cancel` with `interrupt: true` also stops the session's Hermes turn. |
| Progress phases + throttle | `agent/task_progress.py` | Tools map to semantic phases (`searching`, `running_command`, `using_computer`…); spoken lines are short and localized (pl/en); repeats are throttled. Voice never reads raw logs. |
| `MemoryAccessPolicy`, snapshot, candidates | `agent/memory_access.py` | Root: read/write. Sub-agent: read-only, task-ranked snapshot (≤1200 chars) baked into its system prompt once (cache-stable). Children propose `MEMORY CANDIDATES`; the parent sees them as `memory_candidates_note` and commits with the memory tool. Toggle: `delegation.share_memory` (default on). |
| `ComputerLeaseManager` | `tools/computer_use/lease.py` | Observe (capture/list/wait) is shared. Input (click/type/key/scroll/drag/set_value/focus) needs the single-writer lease keyed by the agent's session. Lease TTL 60s, released on child finish, revoked on child interrupt, on task cancel and on session release. Checked **before** approval prompts. |
| `LiveVoiceProvider` (TS) | `apps/desktop/src/lib/live-voice/types.ts` | Provider-agnostic: `connect/disconnect/setMuted/sendTaskProgress/sendTaskResult` + event callbacks. No Hermes tool surface, short-lived credentials only. |
| `classifyInterrupt`, `isCurrentRevision` (TS) | `apps/desktop/src/lib/live-voice/interrupt-intent.ts` | "stop" ≠ "anuluj" ≠ "nie Chrome, Edge". |

## Security invariants

- Hermes owns approvals; voice cannot bypass them (the provider has no tool surface beyond delegation).
- Sub-agents cannot write global memory (`memory` toolset stays denied; `skip_memory=True`).
- Only one agent holds computer input at a time; a cancelled agent can never re-acquire it.
- Results of old task revisions are refused.
- Profile isolation: memory snapshots come from the parent's own profile-scoped store.
- Existing `computer_use` hard blocks and per-session approval scopes are unchanged.

## Phase status

| Phase | Status |
|---|---|
| P0 contracts + doc + tests | Done (this document, modules above) |
| P1 LiveVoiceProvider + OpenAI Live | Contract done; migrating `realtime-voice.ts` behind it is next (legacy stays default) |
| P2 Task Registry | Done (backend + RPC); desktop wiring of voice turns to `task.*` is next |
| P3 Read-only sub-agent memory | Done |
| P4 Computer lease | Done |
| P5 Progress events | Phase mapping + throttle done; streaming into the voice session follows P1 |
| P6 Gemini Live | Pending (implements the same `LiveVoiceProvider`) |
| P7 Onboarding v3 + health check | Pending |
| P8 Voice evals (30 scenarios) | Pending; contract tests cover correction, cancel cascade, stale results, lease contention, memory write isolation |
