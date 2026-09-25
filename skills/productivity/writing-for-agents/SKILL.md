---
name: writing-for-agents
description: "Write briefs and instruction files that agents follow."
version: 0.1.0
author: Chris Tabasco (@ChrisTabascoAI), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Writing, Instructions, Prompts, Documentation, Skills]
    related_skills: [hermes-agent-skill-authoring, weekly-review-planning]
---

# Writing for Agents Skill

Write instructions a machine follows: task briefs, `AGENTS.md` / `CLAUDE.md` context files,
runbooks and skill documents. The goal is a document where an agent with no memory of the
conversation does the right thing — and where a wrong reading is impossible rather than unlikely.

## When to Use

- "Write a brief for this task that another agent can pick up."
- "Create / update AGENTS.md, CLAUDE.md, or a runbook."
- "Turn this meeting decision into an instruction an agent can execute."
- "Why does the agent keep ignoring this instruction?"

Don't use for: prose meant for humans to enjoy reading (load a writing/editing skill instead).

## Prerequisites

- The real environment available to inspect: repo, files, commands, credentials the task depends on.
- No writing before reading — instructions invented without reading the code are the main failure source.

## How to Run

Verify every command you document by running it. An instruction that has never been executed is
a guess with confident formatting.

## Quick Reference

| Do | Don't |
|----|-------|
| Imperative, one rule per line | Paragraphs of intent |
| State the *why* in one clause | Rules with no reason (agents can't prioritise them) |
| Name the exact command or path | "run the usual checks" |
| Give the done-condition | "make it good" |
| Mark uncertainty explicitly | Assume the reader shares your context |

## Procedure

### 1. Fix the audience and the trigger

Decide who reads this (a fresh agent session, a colleague, a future you) and what event makes it
apply. The first line should tell the reader when the document is relevant.

### 2. Lead with the deliverable

State the finished artifact — file, output, observable state — before the method. Agents, like
people, skip steps when they don't know what "done" looks like.

### 3. Write rules, not vibes

One imperative per line. Include the reason in a short clause: "Use `patch`, not `sed` — the file
is edited concurrently." A rule with a reason survives re-reading; a bare rule gets rationalised away.

### 4. Pin the environment

Exact paths, exact commands, exact variable names. Replace every "the config file" with the real
path. Anything the reader must discover by guessing is a defect.

### 5. Define done and how to verify

End with a checklist whose items are commands or observable facts ("`npm test` exits 0", "the file
lists 4 entries"). If a claim cannot be checked, rewrite it or drop it.

### 6. Cut and test

Delete every sentence that does not change behaviour. Then test the way it will be used: hand it to
a fresh agent session with no context and see what it does wrong — that is your missing line.

## Pitfalls

- Instructions that only work with your memory of the conversation.
- Mixing desired outcome with implementation steps so tightly that the agent can't adapt to a changed environment.
- Burying the dangerous step; dangerous actions go last, with their approval requirement named.
- Repeating the same rule in three places — they drift apart; keep one home per rule.
- Documenting a command you never ran. The first reader discovers the typo.

## Verification

- [ ] Deliverable and done-condition stated before the method.
- [ ] Every path, command and variable name was checked against the real environment.
- [ ] Each rule carries a short reason.
- [ ] Sentence count reduced until nothing left changes behaviour.
- [ ] Read once end to end as if you had never seen the task.
