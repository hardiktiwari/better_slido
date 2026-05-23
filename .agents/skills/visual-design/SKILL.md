---
name: visual-design
description: Visual design, themes, layout, and Tailwind styling for Better Slido slides
---

# Visual Design

Use this skill when the directive changes **how slides look** — not the words on them.

## Scope

- `theme` state (`SlideTheme`: `editorial` | `modern-dark` | `vibrant-pastel`)
- `getThemeClasses()` return values (wrapper, title, subtitle, bulletIcon, pollBar, qaCard, footer, etc.)
- Tailwind classes on slide chrome, editor canvas, and present mode
- Spacing, contrast, motion classes, borders, shadows, gradients
- Layout structure (grid, padding, alignment) when it is visual-only

## Primary edit locations (App.tsx)

| Area | What to touch |
|------|----------------|
| `getThemeClasses()` | Theme token maps — preferred for global visual changes |
| `useState<SlideTheme>('…')` | Default theme |
| Slide JSX `className` | One-off visual tweaks on a specific block |
| Theme `<select>` options | Only if adding a new `SlideTheme` variant |

## Guidelines

1. **Prefer theme tokens** over hard-coded colors on every element.
2. **Keep all three themes coherent** when editing `getThemeClasses()` — update every branch in the switch.
3. **Preserve accessibility** — maintain readable contrast; do not rely on color alone for meaning.
4. **Minimal motion** — keep existing `transition-*` / `animate-*` patterns; do not add heavy animation unless asked.
5. **Do not change copy** — titles, bullets, and footers are handled by the `text-changes` skill.

## Examples

| Directive intent | Typical change |
|------------------|----------------|
| "Use dark theme by default" | `useState<SlideTheme>('modern-dark')` |
| "Make poll bars more vibrant" | `pollBar` / `pollBarBg` in `getThemeClasses()` |
| "Increase slide padding" | `p-[5%]` / `p-[6%]` on wrapper divs |
| "Softer bullet icons" | `bulletIcon` classes per theme |

When done, follow the AGENTS.md output JSON contract.
