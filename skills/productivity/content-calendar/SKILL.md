---
name: content-calendar
description: "Plan work and content weeks ahead on one calendar."
version: 0.1.0
author: Chris Tabasco (@ChrisTabascoAI), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Planning, Calendar, Scheduling, Content-Ops]
    related_skills: [weekly-review-planning, meeting-action-items]
---

# Content Calendar Skill

Turn scattered ideas and commitments into a dated plan you can actually follow: what ships,
on what day, on which channel, and what must exist before it can go out. Works for publishing
calendars, marketing schedules, release trains and any recurring work with dates.

## When to Use

- "Plan next month's posts / episodes / releases."
- "Put these 20 ideas in a calendar."
- "What do we owe this week, per channel?"
- "Rebuild the calendar after we missed three days."

Don't use for: a one-off task list with no dates (use a task tracker) or retro reviews
(`weekly-review-planning`).

## Prerequisites

- The real channels or destinations, and who publishes to each one.
- A cache of raw ideas — the calendar selects and dates them, it does not invent topics.
- The date horizon the person actually plans on (usually week + month), agreed up front.

## How to Run

One deterministic slot list per week, stored as a plain file (CSV/Markdown) so it survives
across sessions and can be re-read by any agent or person.

## Quick Reference

| Field | Meaning |
|-------|---------|
| date | publication day, not writing day |
| channel | where it lands |
| format | post, video, newsletter, release |
| status | idea / drafted / ready / published / missed |
| owner | one human or agent accountable |
| depends_on | asset or approval needed first |

## Procedure

### 1. Fix the cadence before the content

Agree how many items per channel per week. A calendar with a plausible number of slots beats a
perfect list that can't be produced. Recurring slots (e.g. Mon short, Thu long) do most of the work.

### 2. Dump, then select

Collect every candidate idea without judging. Then choose per slot, with one line of why this
topic fits this channel and this date. Keep rejected candidates in a backlog file — nothing is deleted.

### 3. Date backwards from the asset

Work back from the publication day: asset ready, reviewed, scheduled. If the asset doesn't exist
and can't be made in the lead time, the slot is not real — cut it now rather than on the day.

### 4. Publish the plan where it is read

Write the calendar to the place the user actually checks, and keep a local canonical copy. State
the plan in one short message: week, slots, items at risk.

### 5. Run the week

At the start of each week, mark reality against plan. Anything slipped moves explicitly — never
silently. Missed slots get a reason, because the reason is the fix.

### 6. Close the month

Count published vs planned, list what slipped and why, and carry the lessons into next month's
cadence. Adjust the number of slots rather than the quality bar.

## Pitfalls

- Planning themes without slots, so nothing has a date.
- Calendar written for a channel nobody publishes to.
- Lead time ignored: heavy content on the same day as the asset that must be produced.
- Items left "in progress" for weeks instead of being re-dated or dropped.
- Letting the plan live only in chat history; next week's session can't read it.

## Verification

- [ ] Every entry has date, channel, format, status and owner.
- [ ] Each dated item has an asset path or a stated production lead time.
- [ ] The plan exists as a file that survives the session, plus one message to the user.
- [ ] Slipped items were re-dated or dropped with a stated reason.
