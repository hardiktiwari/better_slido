---
name: text-changes
description: Copy, labels, slide text fields, and string state edits in Better Slido
---

# Text Changes

Use this skill when the directive changes **words or string state** — not colors, layout, or theme tokens.

## Scope

- Slide fields: `tag`, `title`, `subtitle`, `footerLeft`, `footerRight`
- `bullets[].text`, `pollOptions[].text`
- Deck defaults in the initial `deck` array (`useState<Slide[]>(…)`)
- Audience / UI labels: `audienceNickname`, placeholders, button labels
- Q&A question text in `questions` state when the directive targets copy

## Primary edit locations (App.tsx)

| Area | What to touch |
|------|----------------|
| `deck` initializer | Default slide copy |
| `setDeck` / slide update handlers | Rare — prefer editing initializer or inline slide objects |
| `useState` string defaults | e.g. `audienceNickname` |
| Controlled inputs | `value` / `placeholder` only when directive asks |

## Guidelines

1. **Match tone** — presentation voice: clear, concise, title case for headlines.
2. **Parallel bullets** — same grammatical form; cap at ~5 bullets unless asked.
3. **Preserve ids and structure** — change strings only; do not remove slides or rename `id` fields unless asked.
4. **Poll options** — 3–4 options, mutually exclusive wording.
5. **Do not change styling** — Tailwind classes and `getThemeClasses()` belong to `visual-design`.

## @agent directive workflow

1. Find the directive line; read ±15 lines of context.
2. Apply the smallest text change that satisfies the instruction.
3. Rewrite `// @agent: resolve:` → `// @agent: resolved:` (or JSX comment equivalent).
4. Write the full updated file to `/workspace/repo/src/App.tsx`.
5. End with the JSON output contract from AGENTS.md.

## Examples

| Directive intent | Typical change |
|------------------|----------------|
| "Change default nickname to X" | `useState('X')` for `audienceNickname` |
| "Rename slide 2 title" | `deck[n].title` in initializer |
| "Shorten subtitle" | `subtitle` on target slide |
| "Rewrite bullets for clarity" | `bullets[].text` |

When done, follow the AGENTS.md output JSON contract.
