import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { probeCursorAuth } from "./scripts/lib/cursor-cli.js";
import { initAgentRunStore } from "./scripts/lib/agent-run-store.js";
import { registerApiRoutes } from "./scripts/lib/register-api-routes.js";

dotenv.config();

const cwd = process.cwd();
initAgentRunStore(cwd);

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;

app.use("/generated", express.static(path.join(cwd, "public", "generated")));

registerApiRoutes(app, { cwd });

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(cwd, "dist");
    app.use(express.static(distPath));
    app.use(express.static(path.join(cwd, "public")));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const auth = await probeCursorAuth();
  const model = process.env.CURSOR_AGENT_MODEL?.trim() || "default";
  const orchestrator =
    process.env.ORCHESTRATOR_MODE?.trim().toLowerCase() || "keywords";

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Better Slido → http://localhost:${PORT}`);
    console.log(
      `[Agent] Cursor CLI ${auth.available ? "ON" : "OFF — run agent login"} · auth=${auth.mode}${auth.email ? ` · ${auth.email}` : ""} · model=${model} · orchestrator=${orchestrator}`,
    );
  });
}

startServer();
