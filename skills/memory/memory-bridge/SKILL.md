---
name: memory-bridge
description: "Fold working notes into durable memory on a schedule."
version: 0.1.0
author: Chris Tabasco (@ChrisTabascoAI), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Memory, Consolidation, Cron]
    related_skills: [vault-memory, weekly-review-planning]
---

# Memory Bridge Skill

Consolidation keeps memory useful as it grows: working notes are folded into durable facts
and the noise is dropped. This skill schedules that pass and defines what survives it. It is
a maintenance job, not a second memory system.

## When to Use

- A recurring consolidation pass over notes the agent has been appending to.
- Before a long-running project gets slow because every prompt carries stale context.
- When the user says memory is messy, repetitive, or full of things already finished.

## Prerequisites

- The three-file vault convention from `vault-memory`.
- A scheduled job mechanism (`hermes cron` via `terminal`, or the `cronjob` tool).
- A quiet window: consolidation reads and rewrites files, so it must not race live work.

## How to Run

1. Read the working notes and the durable facts file.
2. Merge anything that has proven stable; drop what has expired.
3. Append a short run log, then leave the files in a readable state.

## Quick Reference

- Cadence: every second day, off-hours, one job — not a per-session sweep.
- Budget: cap files touched per run, and commit every few merges so a crash loses little.
- Output: durable facts updated, working notes archived, one log line per run.
- Never: bulk-delete unread material, or rewrite history the user quoted.

## Procedure

1. **Snapshot first.** Copy the vault files to a dated backup directory before rewriting
   anything, so a bad merge is one `terminal` copy away from undone.
2. **Classify every entry** as working (delete after it settles), durable (promote), or
   already-covered (drop). Reading is mandatory; a size-based prune is how meaning is lost.
3. **Promote by rewriting, not appending.** Fold a fact into the durable file's existing
   topic section so the file stays a document, not a log.
4. **Keep the newest working entries untouched** — the last few days are live context that
   the next session still needs.
5. **Cap the run.** Fold the oldest entries first and stop at the cap, so an interrupted run
   leaves a consistent vault rather than a half-merged one.
6. **Log the pass** in the vault: date, files read, entries promoted, entries dropped.
7. **Report, do not ask.** Summarise what changed in a few lines; the user should not have to
   audit a routine cleanup.
8. **Schedule it** with a single job (for example `hermes cron add` through `terminal`) and
   verify the first run actually executed before trusting the schedule.

## Pitfalls

- Merging without reading, which deletes the one entry that mattered.
- Rewriting the durable file into a chronological dump — it is a reference, not a journal.
- Running the pass while a session is mid-task, so the agent's own notes vanish under it.
- Scheduling more than one consolidation job; overlapping runs fight over the same files.
- Trusting the schedule without checking the first run's log.

## Verification

- The run log shows date, read count, promoted count, dropped count.
- `search_files` a fact you know was promoted: present once, in the durable file.
- `read_file` the working notes: the last few days are still there, untouched.
