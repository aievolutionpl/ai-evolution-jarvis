---
name: vault-memory
description: "Keep durable state in a three-file vault read before work."
version: 0.1.0
author: Chris Tabasco (@ChrisTabascoAI), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Memory, Continuity, Working-Style]
    related_skills: [memory-bridge, weekly-review-planning]
---

# Vault Memory Skill

A three-file vault is the agent's working memory: what is happening now, what is durably
true, and where to route next. The vault is plain markdown in the user's own workspace, so
the person can read and edit every word the agent remembers.

## When to Use

- The first turn of a session, before answering anything that references past work.
- After completing any task worth remembering: a deliverable, a decision, a client fact.
- When the user says "pamiętaj", "zapisz to", "gdzie skończyliśmy", or asks for a status.

## Prerequisites

- A vault directory the user owns (any path; ask once and reuse it).
- No extra packages. `read_file`, `patch`, and `search_files` are enough.

## How to Run

1. Resolve the vault path once and keep it for the session.
2. `read_file` the live-context file first; it is the cheapest possible briefing.
3. Do the work.
4. Append one entry to the live-context file and add an index line if a new task opened.

## Quick Reference

| File | Holds | Read when | Write when |
|---|---|---|---|
| `ACTIVE_CONTEXT.md` | What is happening now, newest entry on top | Session start, any "where were we" | After every completed action |
| `CORE_MEMORY.md` | Durable facts: people, brands, decisions, preferences | Before any client-specific work | Only when a fact outlives the task |
| `TASKS.md` | One-line routing index into the canonical entries | Planning, "what is open" | When a task opens or closes |

## Procedure

1. **Brief before speaking.** `read_file` the live-context file and scan the newest entry
   rather than asking the user to repeat context they already gave.
2. **Right file, right fact.** Task progress goes to the live-context file; a durable fact
   (a brand's colors, a client's address, a standing preference) goes to the durable-facts
   file. Never write task progress into the durable file.
3. **Entry shape.** Date and time, one-line headline, what was produced with its exact path,
   what was verified and how, and the next step. Four lines beat four paragraphs.
4. **Newest on top.** `patch` the entry in above older entries so the newest state is the
   first thing either of you reads.
5. **Route, do not duplicate.** A closed task gets one line in the index pointing at its
   canonical entry; copy the body once, never twice.
6. **Cap the files.** When the live-context file passes a few hundred kilobytes, move settled
   entries into a dated archive file and leave a pointer behind.
7. **No secrets.** Never write API keys, tokens, card numbers, or health data into the vault —
   even when the user pastes them.
8. **Answer in the user's language.** The vault may be written in the user's language; keep
   file and section names stable so the agent can find them again.

## Pitfalls

- Treating the vault as a diary: long prose pushes the signal out of the first screen.
- Writing "done" without the artifact path — the next session cannot verify anything.
- Duplicating entries across files, so the two copies drift apart.
- Storing a token "for convenience". Vault files are usually synced and backed up.
- Reading the vault but never writing it, which makes the next session start from zero again.

## Verification

- `read_file` the live-context file: the newest entry is first and carries an artifact path.
- `search_files` the vault for the task headline: exactly one canonical entry, not three.
- Confirm no secret-shaped string (key prefix, long token) appears in any vault file.
