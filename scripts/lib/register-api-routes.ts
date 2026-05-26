import type { Express, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { probeCursorAuth } from "./cursor-cli.js";
import { parseReviewBody } from "./parse-review-body.js";
import { startBackgroundAgentReview, runAgentQueued } from "./agent-queue.js";
import { readAgentTrace } from "./agent-trace.js";
import { readSlideFieldsFromApp } from "./deck-source.js";
import { getAgentRun } from "./agent-run-store.js";

export interface RegisterApiRoutesOptions {
  cwd: string;
}

function effectiveOrchestratorMode(): string {
  return process.env.ORCHESTRATOR_MODE?.trim().toLowerCase() || "keywords";
}

async function handleAgentReview(req: Request, res: Response, cwd: string): Promise<void> {
  const parsed = parseReviewBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const auth = await probeCursorAuth();
  if (!auth.available) {
    res.status(503).json({
      error: "Cursor agent unavailable: run `agent login` on this machine, then retry.",
      authMode: auth.mode,
    });
    return;
  }

  const commentIds = parsed.comments.map((c) => c.id).filter((id): id is string => !!id);
  const record = startBackgroundAgentReview(cwd, parsed, commentIds);
  console.log(
    `[AgentReview] Accepted ${record.id} · slide=${parsed.slideId} · comments=${parsed.comments.length} · phase=${record.phase}`,
  );

  res.status(202).json({
    runId: record.id,
    phase: record.phase,
    pollUrl: `/api/agent/runs/${record.id}`,
  });
}

export function registerApiRoutes(app: Express, options: RegisterApiRoutesOptions): void {
  const { cwd } = options;

  app.get("/api/env-check", async (_req, res) => {
    const auth = await probeCursorAuth();
    res.json({
      hasKey: auth.available,
      provider: "cursor-cli",
      authMode: auth.mode,
      email: auth.email,
      hasGeminiForImages: !!process.env.GEMINI_API_KEY?.trim(),
      orchestratorMode: effectiveOrchestratorMode(),
      apiBase: "same-origin",
      devUrl: "http://localhost:3000",
    });
  });

  app.get("/api/agent/skills", (_req, res) => {
    try {
      const skillsDir = path.join(cwd, ".agents", "skills");
      if (!fs.existsSync(skillsDir)) {
        res.json({ skills: [] });
        return;
      }

      const skills = fs
        .readdirSync(skillsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const skillPath = path.join(skillsDir, entry.name, "SKILL.md");
          if (!fs.existsSync(skillPath)) return null;

          const raw = fs.readFileSync(skillPath, "utf-8");
          const frontmatter = raw.match(/^---\s*\n([\s\S]*?)\n---/);
          let name = entry.name;
          let description = "";

          if (frontmatter) {
            const block = frontmatter[1];
            const nameMatch = block.match(/^name:\s*(.+)$/m);
            const descMatch = block.match(/^description:\s*(.+)$/m);
            if (nameMatch) name = nameMatch[1].trim();
            if (descMatch) description = descMatch[1].trim();
          }

          return { id: entry.name, name, description };
        })
        .filter((s): s is { id: string; name: string; description: string } => s !== null);

      res.json({ skills });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to list skills.";
      console.error("[Skills API]", error);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/agent/review", (req, res) => {
    void handleAgentReview(req, res, cwd).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to queue agent review.";
      console.error("[AgentReview]", err);
      res.status(500).json({ error: message });
    });
  });

  app.get("/api/agent/runs/:runId", (req, res) => {
    const run = getAgentRun(req.params.runId);
    if (!run) {
      res.status(404).json({
        error: "Unknown agent run. The dev server may have restarted — click Done reviewing again.",
      });
      return;
    }
    res.json(run);
  });

  app.post("/api/webhook/comment", (req, res) => {
    void handleAgentReview(req, res, cwd).catch((err: unknown) => {
      if (res.headersSent) return;
      const message = err instanceof Error ? err.message : "Webhook failed.";
      console.error("[Webhook]", err);
      res.status(500).json({ error: message });
    });
  });

  app.get("/api/agent/last-trace", (_req, res) => {
    const trace = readAgentTrace(cwd);
    if (!trace) {
      res.status(404).json({ error: "No trace yet. Run Done reviewing first." });
      return;
    }
    res.json(trace);
  });

  app.get("/api/slides/:slideId/source-fields", (req, res) => {
    const slideId = req.params.slideId;
    if (!slideId) {
      res.status(400).json({ error: "Missing slideId" });
      return;
    }
    res.json(readSlideFieldsFromApp(cwd, slideId));
  });

  app.post("/api/agent/cli-run", async (_req, res) => {
    try {
      const result = await runAgentQueued(cwd);
      res.json({
        success: result.success,
        cliLogs: result.logs,
        applied: result.applied,
        explanation: result.explanation,
        commentsFound: result.commentsFound,
        interactionId: result.interactionId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Managed agent run failed.";
      console.error("[CLI Agent]", error);
      res.status(500).json({ error: message });
    }
  });

  app.use("/api", (req, res) => {
    res.status(404).json({
      error: `Unknown API route: ${req.method} ${req.originalUrl}`,
      hint: "Start the app with npm run dev (http://localhost:3000), not vite alone.",
    });
  });
}
