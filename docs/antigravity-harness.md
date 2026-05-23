# Antigravity Managed Agent Harness Integration Specification

This package exposes a production-grade, local-to-remote co-pilot harness powered by the Google GenAI SDK (`@google/genai`). It implements autonomous compiler-level file refactoring, dynamic local workspace context extraction, and integration with local rules (`AGENTS.md`) and customized capability skillbooks (`.agents/skills/*`).

---

## System integration and directory structure

For successful execution, ensure your project layout matches or contains:

```
//root
├── AGENTS.md                 # Design specifications or behavioral constraints
├── src/
│   └── App.tsx               # Target reactive UI application to inspect & edit
├── .agents/
│   ├── AGENTS.md             # Sandbox-mounted agent instructions
│   └── skills/               # Custom capabilities (SKILL.md per skill)
│       ├── code-resolver/
│       ├── slide-editor/
│       ├── visual-design/
│       └── text-changes/
└── scripts/
    ├── agent-harness.ts      # CLI entrypoint
    ├── register-agent.ts     # Optional: persist managed agent by ID
    └── lib/
        └── managed-agent.ts  # interactions.create + environment mounting
```

---

## Required dependencies

```bash
npm install @google/genai dotenv
npm install --save-dev tsx typescript @types/node
```

Or from this repo:

```bash
npm install
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google AI Studio / Gemini API key |
| `MANAGED_AGENT_ID` | No | Saved agent ID from `npm run agent:register` |
| `BETTER_SLIDO_REPO_URL` | No | Git repo mounted into remote sandbox |

Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.

---

## Usage

### Resolve an inline directive

Add a comment in `src/App.tsx`:

```tsx
// @agent: resolve: change default nickname to "Slido Host"
```

Run the harness:

```bash
npm run agent
```

### Register a saved managed agent (optional)

```bash
npm run agent:register
# Add MANAGED_AGENT_ID=better-slido-editor to .env
```

### From the dev server

`POST /api/agent/cli-run` uses the same `runManagedAgent()` path as the CLI.

---

## Runtime architecture

| Component | Value |
|-----------|--------|
| Base agent | `antigravity-preview-05-2026` |
| API | `client.interactions.create()` |
| Environment | `{ type: "remote", sources: [...] }` |
| Tools | `code_execution`, `google_search`, `url_context` |
| Timeout | 300s |

**Flow:** scan `src/App.tsx` → route directive to a skill (`visual-design` | `text-changes` | `slide-editor`) → mount `AGENTS.md`, all skills, and target file into remote sandbox → Antigravity edits → parse JSON output → write local file.

### Skills

| Skill | Use when directive involves… |
|-------|------------------------------|
| `visual-design` | themes, colors, Tailwind, layout, spacing |
| `text-changes` | copy, titles, bullets, nicknames, string state |
| `slide-editor` | new slides, polls, Q&A structure |
| `code-resolver` | always — `@agent` resolve → resolved workflow |

Skill files live under `.agents/skills/<name>/SKILL.md` and are mounted inline per [Building Managed Agents](https://ai.google.dev/gemini-api/docs/custom-agents).

---

## References

- [Building Managed Agents](https://ai.google.dev/gemini-api/docs/custom-agents)
- [Antigravity Agent](https://ai.google.dev/gemini-api/docs/antigravity-agent)
