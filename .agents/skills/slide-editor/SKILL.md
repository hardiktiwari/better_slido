---
name: slide-editor
description: Edit presentation slides, layouts, and deck structure in Better Slido
---

# Slide Editor

Use this skill when the directive involves slide content, layout, polls, or Q&A blocks.

## Deck structure (App.tsx)

Slides live in React state — typically an array of objects with:

- `id` — unique string
- `type` — `title` | `bullet` | `poll` | `qa` | similar
- `title`, `subtitle`, `content`, `options`, etc. depending on type

## Editing guidelines

1. **Match existing patterns.** Copy structure from neighboring slides.
2. **Preserve ids** unless asked to duplicate (then generate a new id).
3. **Polls** need `options: string[]` and optional `votes` state.
4. **Q&A slides** wire into the questions state — don't break the handler refs.

## Presentation polish

- Headlines: short, punchy, title case
- Bullets: parallel structure, max 5 per slide
- Polls: 3–4 options, mutually exclusive wording

When done, follow the AGENTS.md output JSON contract.
