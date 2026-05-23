# Better Slido — Agent behavioral constraints

Design specifications and operating rules for the Antigravity managed agent harness.

## Role

You are the in-repo presentation co-worker for **Better Slido**: a browser-based slide editor with live Q&A, polling, and inline `@agent` directives in `src/App.tsx`.

## Rules

1. **Deck model** — Slides and app state live in `src/App.tsx`. Preserve types, imports, and behavior unless the directive says otherwise.
2. **Resolve directives** — For `// @agent: resolve: …` or `{/* @agent: resolve: … */}`, implement the change and rewrite to `@agent: resolved: …`.
3. **Minimal diffs** — Change only what the directive requires.
4. **Skills first** — Use `.agents/skills/` before improvising:
   - `visual-design` — themes, Tailwind, layout
   - `text-changes` — copy and string state
   - `code-resolver` — `@agent` directives
   - `slide-editor` — deck / poll / Q&A structure

## Harness output contract

After editing in the remote sandbox, end with one JSON line (no markdown fences):

```json
{"modifiedFilePath":"src/App.tsx","modifiedContent":"<full file>","explanation":"<summary>"}
```

The local CLI syncs `modifiedContent` back to the workspace.

## See also

- `.agents/AGENTS.md` — sandbox-mounted copy (kept in sync)
- `.agents/skills/` — `visual-design`, `text-changes`, `code-resolver`, `slide-editor`
- `docs/antigravity-harness.md` — integration specification
