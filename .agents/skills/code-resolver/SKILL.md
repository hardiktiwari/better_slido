---
name: code-resolver
description: Resolve inline @agent directives in TypeScript/JSX source files
---

# Code Resolver

Use this skill when the input references `@agent: resolve:` or `@agent: edit:` comments.

## Workflow

1. Read the target file in `/workspace/repo/` (usually `src/App.tsx`).
2. Locate the directive by line number or search for `@agent: resolve:`.
3. Read ±30 lines of context around the directive.
4. Apply the smallest change that satisfies the instruction.
5. Change the tag from `resolve`/`edit` to `resolved`.
6. Write the full updated file back to disk.
7. Emit the output JSON contract from AGENTS.md.

## Common directives

| Directive | Action |
|-----------|--------|
| Change default state | Update the `useState` initializer |
| Rename slide title | Find slide by id/index, update `title` field |
| Change theme/color | Update Tailwind classes or theme state |
| Add a slide | Insert into deck array with new id |

## Do not

- Delete unrelated slides or comments
- Change API keys or env handling
- Remove existing `@agent: resolved:` markers
