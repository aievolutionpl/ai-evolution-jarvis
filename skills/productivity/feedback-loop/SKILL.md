---
name: feedback-loop
description: "Ask a few questions before a task, two after, then patch."
version: 0.1.0
author: Chris Tabasco (@ChrisTabascoAI), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Working-Style, Learning, Quality]
    related_skills: [step-beyond, vault-memory]
---

# Feedback Loop Skill

Corrections are the most valuable signal the agent gets, and they are usually thrown away
with the session. This skill captures them: a few questions before a substantial task, two
after it, and a written improvement that changes the next attempt.

## When to Use

- Before a substantial or ambiguous task (video, campaign, site, design, long document).
- After any task where the person edited, rejected, or re-explained something.
- When the same correction appears twice — that is a process bug, not a preference.

## Prerequisites

- A feedback file in the vault (see `vault-memory`) or a per-skill notes file.
- Permission to patch skills: `skill_manage` writes the improvement.

## How to Run

1. Ask the smallest set of questions that removes real ambiguity (two to four, one message).
2. Do the work.
3. Ask two questions: what to keep, what to change.
4. Record the answer, then patch the procedure that caused the miss.

## Quick Reference

- Before: format, audience, length, language, references — only what changes the output.
- After: one question about what worked, one about what missed.
- Record: date, task, correction, and the rule that follows from it.
- Patch: one rule per correction; never a pile of vague advice.

## Procedure

1. **Ask before, not after.** Two to four questions in a single message, each with a proposed
   default so a silent user still gets a sensible result.
2. **Never ask what the context already answers** — brand style, language, and established
   formats are known; asking again is noise.
3. **Ask after, briefly.** Two questions, with the person's own artifact in front of them.
4. **Write the rule, not the complaint.** "Captions must be 4:5 with the product reference"
   beats "the last image was wrong".
5. **Patch the skill that produced the miss** with `skill_manage`, in the same session, so the
   lesson survives; if the miss was a one-off, record it and do not patch.
6. **Prefer editing over adding.** Fold the rule into the existing procedure section rather
   than appending a new one, or the skill becomes a list of incidents.
7. **Confirm the change** to the user in one line: what will be different next time.

## Pitfalls

- Interrogating the user before trivial tasks — the checklist is for substantial work only.
- Recording feedback in chat, where the next session never finds it.
- Patching a skill on a preference the person has not actually stated twice.
- Turning the skill into an append-only incident log.
- Asking for feedback the person already gave in an earlier session (check the vault first).

## Verification

- The feedback file has a dated entry with the correction and the rule it produced.
- `search_files` the patched skill for the new rule: present exactly once.
- The next attempt applies it without being reminded.
