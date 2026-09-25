---
name: brand-post-system
description: "Build a brand post as problem, solution, then visual."
version: 0.1.0
author: Chris Tabasco (@ChrisTabascoAI), Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Content, Social, Copywriting]
    related_skills: [social-media-content-calendar, content-calendar, i-have-adhd]
---

# Brand Post System Skill

One repeatable shape turns a brand brief into a post that sells: a problem the reader
recognises, a solution they can act on, and a visual that carries the same message. This is
the copy and structure layer — image generation lives in its own skill.

## When to Use

- The user asks for a post, caption, or campaign content for one of their brands.
- A content calendar entry needs its text and visual brief filled in.
- An existing post underperforms and needs the shape fixed rather than the words polished.

## Prerequisites

- The brand's config or notes: voice, language, colors, logo, and hero imagery — read it
  before writing a word so the post sounds like the brand, not like the agent.
- A real product, location, or service to reference; invented details are not acceptable.

## How to Run

1. `read_file` the brand's config and any previous posts.
2. Write three hook variants, then pick one.
3. Body: problem, proof, one call to action.
4. Hand over a visual brief that matches the copy.

## Quick Reference

- **Hook:** the reader's own problem in their words, first line only.
- **Proof:** something concrete — a result, a detail of the work, a location, a number.
- **CTA:** one action, one channel, no menu of options.
- **Length:** the platform's ceiling minus a third; short beats complete.
- **Visual:** real product/location references, the brand's own colors, legible type in the
  reader's language, correct diacritics.

## Procedure

1. **Read the brand first.** Voice, language, offer, and visual rules come from the brand file;
   never from generic marketing instinct.
2. **Write the hook three ways** — a question, a claim, a concrete scene — and pick the one
   that survives being read in one second on a phone.
3. **Structure the body** as problem → proof → offer → CTA, without headings in the final copy.
4. **Use the reader's language, correctly.** Full diacritics, real sentences, no machine
   translation that reads like a manual.
5. **Add the visual brief** as a prompt paragraph: subject, setting, light, mood, framing, and
   the reference images that must be used. For ads, state the aspect ratio (product ads 4:5).
6. **Never redraw the logo or the founder.** Reference the original asset; if a clean asset is
   missing, ask for it instead of generating a lookalike.
7. **Offer one next post** built on the same shape, so the calendar keeps moving.
8. **Keep the promise honest.** No invented reviews, no numbers the brand cannot back.

## Pitfalls

- Copy that describes the brand instead of the reader's problem.
- A visual that ignores the actual product or venue, or a logo redrawn by a model.
- Missing or broken diacritics in Polish copy — it reads as fake to any native speaker.
- Three CTAs in one post, so the reader does none of them.
- Reusing one hook for a whole week of posts.

## Verification

- The hook names a problem the brand's customer actually has, in one line.
- The visual brief specifies subject, light, framing, references, and aspect ratio.
- The copy renders correctly in the target language, diacritics included.
- Exactly one CTA, one next step, one suggested follow-up post.
