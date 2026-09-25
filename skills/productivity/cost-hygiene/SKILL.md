---
name: cost-hygiene
description: "Spend the cheapest model that still does the job well."
version: 0.1.0
author: Chris Tabasco (@ChrisTabascoAI), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Cost, Routing, Operations]
    related_skills: [vault-memory, weekly-review-planning]
---

# Cost Hygiene Skill

Every task has a cheapest model that does it well, and most work does not need the expensive
one. This skill routes work by difficulty, keeps context small, and makes spending visible —
without degrading the result the user actually sees.

## When to Use

- Starting a session or a long task on a metered provider.
- Choosing between the session model, a delegated subagent, and a local model.
- A bill, quota, or token count surprised the user.

## Prerequisites

- Awareness of which providers are subscription-backed and which bill per token.
- The `hermes` CLI for quotas and usage (`terminal`).

## How to Run

1. Classify the task: mechanical, standard, or hard reasoning.
2. Route it to the cheapest model that class is known to handle.
3. Keep the context the model sees proportional to the task.
4. Report spend when it was non-trivial.

## Quick Reference

- **Mechanical** (rename, convert, extract, format): local or cheapest model, or a script.
- **Standard** (draft, summarise, answer, small fix): mid-tier session model.
- **Hard** (architecture, diagnosis, long-horizon plan): strong model, once, with a written plan.
- **Subscription rails** (flat-fee CLI subscriptions): use freely; never route the same call
  to a per-token provider by accident.
- **Delegation:** `delegate_task` for context isolation, not to "use a better model" by default.

## Procedure

1. **Ask what the task actually is** before picking a model; most "hard" requests are standard
   once the ambiguity is removed by two questions.
2. **Plan with the strong model, execute with the cheap one.** A short plan from a strong model
   is cheaper than a strong model doing the whole loop.
3. **Keep the loop cheap.** Long conversations on a per-token provider cost more than fresh
   sessions with a compact briefing from the vault.
4. **Compress context deliberately.** Summarise or restart rather than dragging an enormous
   transcript through every call.
5. **Batch independent reads and commands** into one turn instead of one call per step.
6. **Guard paid rails explicitly.** Never let a bare model id auto-route to a paid provider when
   a subscription rail was intended; state the provider, not just the model name.
7. **Make it visible.** When a task cost real money, say roughly how much and what drove it.
8. **Cap the blast radius.** For long autonomous work, set a budget and stop at it rather than
   discovering the ceiling on the invoice.

## Pitfalls

- Reaching for the strongest model to be safe — that is the most expensive habit.
- Delegating everything "in parallel" so a cheap task pays setup cost several times.
- Feeding whole files into the prompt when `search_files` would answer the question.
- Silent spending: the user finds out from a bill, not from the agent.
- Treating a flat-fee subscription as if it were metered (or the reverse).

## Verification

- State which model ran the task and why that class was chosen.
- For metered work, quote the cost or token count when it was material.
- Confirm the result quality did not drop: the artifact meets the same bar as before.
