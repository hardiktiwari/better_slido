import { spawn } from "child_process";
import path from "path";

export interface CursorCliStreamUpdate {
  reasoningDelta?: string;
  toolsCalled?: string[];
}

export interface CursorCliRunOptions {
  prompt: string;
  cwd: string;
  timeoutMs?: number;
  model?: string;
  authMode?: CursorAuthMode;
  /** Override output format for this run (default: stream-json, or CURSOR_AGENT_OUTPUT_FORMAT). */
  outputFormat?: "json" | "stream-json" | "text";
  /** Fired as stream-json lines arrive (thinking deltas, tool calls). */
  onStreamUpdate?: (update: CursorCliStreamUpdate) => void;
}

export interface CursorCliRunResult {
  success: boolean;
  resultText: string;
  sessionId?: string;
  durationMs?: number;
  logs: string[];
  error?: string;
  rawStdout: string;
  /** Tool names parsed from stream-json / NDJSON stdout (if any). */
  toolsCalled: string[];
}

export type CursorAuthMode = "local-login" | "api-key" | "unavailable";

export interface CursorAuthStatus {
  available: boolean;
  mode: CursorAuthMode;
  email?: string;
  logs: string[];
}

const DEFAULT_TIMEOUT_MS = 600_000;
const AUTH_CACHE_MS = 30_000;

let authCache: (CursorAuthStatus & { checkedAt: number }) | null = null;

function resolveAgentBinary(): string {
  return process.env.CURSOR_AGENT_BIN?.trim() || "agent";
}

/** Default: local `agent login` session. Set CURSOR_AGENT_AUTH=api-key to force .env key. */
export function preferredAuthMode(): CursorAuthMode {
  if (process.env.CURSOR_AGENT_AUTH?.trim() === "api-key") {
    return process.env.CURSOR_API_KEY?.trim() ? "api-key" : "unavailable";
  }
  return "local-login";
}

function runCommand(
  bin: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ code: null, stdout, stderr, error: "timeout" });
    }, timeoutMs);

    child.stdout.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr.on("data", (c: Buffer) => {
      stderr += c.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr, error: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

/** Probe `agent status --format json` for local Cursor IDE / CLI login. */
export async function probeCursorAuth(force = false): Promise<CursorAuthStatus> {
  if (
    !force &&
    authCache &&
    Date.now() - authCache.checkedAt < AUTH_CACHE_MS
  ) {
    const { checkedAt: _c, ...rest } = authCache;
    return rest;
  }

  const logs: string[] = ["[Cursor Auth] Probing authentication…"];
  const bin = resolveAgentBinary();
  const prefer = preferredAuthMode();

  if (prefer === "api-key") {
    const ok = !!process.env.CURSOR_API_KEY?.trim();
    const status: CursorAuthStatus = {
      available: ok,
      mode: ok ? "api-key" : "unavailable",
      logs: [...logs, ok ? "[Cursor Auth] Using CURSOR_API_KEY from .env" : "[Cursor Auth] api-key mode but no key set"],
    };
    authCache = { ...status, checkedAt: Date.now() };
    return status;
  }

  const probe = await runCommand(bin, ["status", "--format", "json"], process.cwd(), 15_000);

  if (probe.error === "timeout") {
    const status: CursorAuthStatus = {
      available: false,
      mode: "unavailable",
      logs: [...logs, "[Cursor Auth] `agent status` timed out"],
    };
    authCache = { ...status, checkedAt: Date.now() };
    return status;
  }

  if (probe.error) {
    logs.push(`[Cursor Auth] Cannot run \`${bin}\`: ${probe.error}`);
    const fallback = process.env.CURSOR_API_KEY?.trim();
    const status: CursorAuthStatus = {
      available: !!fallback,
      mode: fallback ? "api-key" : "unavailable",
      logs: fallback
        ? [...logs, "[Cursor Auth] Falling back to CURSOR_API_KEY"]
        : [...logs, "[Cursor Auth] Run `agent login` on this machine"],
    };
    authCache = { ...status, checkedAt: Date.now() };
    return status;
  }

  try {
    const json = JSON.parse(probe.stdout) as {
      isAuthenticated?: boolean;
      status?: string;
      userInfo?: { email?: string };
    };
    if (json.isAuthenticated || json.status === "authenticated") {
      const email = json.userInfo?.email;
      const status: CursorAuthStatus = {
        available: true,
        mode: "local-login",
        email,
        logs: [...logs, `[Cursor Auth] Local login: ${email ?? "authenticated"}`],
      };
      authCache = { ...status, checkedAt: Date.now() };
      return status;
    }
  } catch {
    if (/authenticated|Logged in/i.test(probe.stdout + probe.stderr)) {
      const status: CursorAuthStatus = {
        available: true,
        mode: "local-login",
        logs: [...logs, "[Cursor Auth] Local login (text status)"],
      };
      authCache = { ...status, checkedAt: Date.now() };
      return status;
    }
  }

  logs.push("[Cursor Auth] Not logged in — run `agent login`");
  const status: CursorAuthStatus = {
    available: false,
    mode: "unavailable",
    logs,
  };
  authCache = { ...status, checkedAt: Date.now() };
  return status;
}

/** @deprecated Use probeCursorAuth() — kept for quick sync checks. */
export function isCursorCliAvailable(): boolean {
  if (preferredAuthMode() === "api-key") {
    return !!process.env.CURSOR_API_KEY?.trim();
  }
  if (authCache && Date.now() - authCache.checkedAt < AUTH_CACHE_MS) {
    return authCache.available;
  }
  return true;
}

function buildAgentEnv(authMode: CursorAuthMode): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (authMode === "local-login") {
    delete env.CURSOR_API_KEY;
  } else if (authMode === "api-key" && process.env.CURSOR_API_KEY?.trim()) {
    env.CURSOR_API_KEY = process.env.CURSOR_API_KEY.trim();
  }
  // Headless harness: never open a browser (avoids Intuit SSO / MCP login popups).
  env.NO_OPEN_BROWSER = "1";
  return env;
}

/** Collect tool names from NDJSON lines emitted by `agent --print`. */
/** Parse one NDJSON line from Cursor CLI stream-json output. */
export function parseStreamJsonLine(line: string): CursorCliStreamUpdate | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const type = parsed.type as string | undefined;
    if (type === "thinking") {
      const text = parsed.text;
      if (typeof text === "string" && text.length > 0) {
        return { reasoningDelta: text };
      }
    }
    const tools = new Set<string>();
    if (type === "tool_call" || type === "tool_use") {
      const name =
        (parsed.name as string) ||
        (parsed.tool_name as string) ||
        ((parsed.tool as { name?: string })?.name);
      if (name) tools.add(name);
      const tc = parsed.tool_call as Record<string, unknown> | undefined;
      if (tc) {
        for (const key of Object.keys(tc)) {
          if (key.endsWith("ToolCall")) tools.add(key.replace(/ToolCall$/, ""));
        }
      }
    }
    if (typeof parsed.tool === "string") tools.add(parsed.tool);
    if (tools.size > 0) return { toolsCalled: [...tools] };
  } catch {
    /* ignore */
  }
  return null;
}

function drainStreamLines(buffer: string, onLine: (line: string) => void): string {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  for (const line of parts) {
    if (line.trim()) onLine(line);
  }
  return rest;
}

export function extractToolsFromStdout(stdout: string): string[] {
  const tools = new Set<string>();
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const type = parsed.type as string | undefined;
      if (type === "tool_call" || type === "tool_use") {
        const name =
          (parsed.name as string) ||
          (parsed.tool_name as string) ||
          ((parsed.tool as { name?: string })?.name);
        if (name) tools.add(name);
        const tc = parsed.tool_call as Record<string, unknown> | undefined;
        if (tc) {
          for (const key of Object.keys(tc)) {
            if (key.endsWith("ToolCall")) tools.add(key.replace(/ToolCall$/, ""));
          }
        }
      }
      if (typeof parsed.tool === "string") tools.add(parsed.tool);
    } catch {
      // ignore non-JSON lines
    }
  }
  return [...tools];
}

/** Parse NDJSON / final JSON line from `agent --print --output-format json`. */
function parseAgentJsonOutput(stdout: string): {
  resultText: string;
  sessionId?: string;
  durationMs?: number;
  isError: boolean;
} {
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(line) as {
        type?: string;
        subtype?: string;
        is_error?: boolean;
        result?: string;
        session_id?: string;
        duration_ms?: number;
      };
      if (parsed.type === "result") {
        return {
          resultText: parsed.result ?? "",
          sessionId: parsed.session_id,
          durationMs: parsed.duration_ms,
          isError: parsed.is_error === true || parsed.subtype === "error",
        };
      }
    } catch {
      // keep scanning
    }
  }

  return { resultText: stdout.trim(), isError: false };
}

/**
 * Run Cursor Agent CLI in headless mode using **local `agent login` auth** by default.
 */
export async function runCursorAgentCli(options: CursorCliRunOptions): Promise<CursorCliRunResult> {
  const logs: string[] = [];
  const bin = resolveAgentBinary();
  const cwd = path.resolve(options.cwd);
  const timeoutMs =
    options.timeoutMs ?? (Number(process.env.CURSOR_AGENT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);

  const auth =
    options.authMode && options.authMode !== "unavailable"
      ? { available: true, mode: options.authMode, logs: [] as string[] }
      : await probeCursorAuth();

  if (!auth.available) {
    return {
      success: false,
      resultText: "",
      logs: [...logs, ...auth.logs, "[Cursor CLI] No auth — run `agent login`"],
      error: "Cursor CLI not authenticated. Run `agent login` in a terminal.",
      rawStdout: "",
      toolsCalled: [],
    };
  }

  logs.push(...auth.logs);

  const outputFormat =
    options.outputFormat ??
    ((process.env.CURSOR_AGENT_OUTPUT_FORMAT?.trim() as CursorCliRunOptions["outputFormat"]) ||
      "stream-json");

  const args = [
    "--print",
    "--output-format",
    outputFormat,
    "--trust",
    "--workspace",
    cwd,
    "-p",
    options.prompt,
  ];

  if (options.model?.trim()) {
    args.push("--model", options.model.trim());
  } else if (process.env.CURSOR_AGENT_MODEL?.trim()) {
    args.push("--model", process.env.CURSOR_AGENT_MODEL.trim());
  }

  logs.push(
    `[Cursor CLI] ${bin} --print --output-format ${outputFormat} --trust (auth=${auth.mode}, timeout ${timeoutMs / 1000}s)`,
  );
  logs.push(`[Cursor CLI] workspace: ${cwd}`);

  const env = buildAgentEnv(auth.mode);

  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let lineBuffer = "";

    const emitStreamLine = (line: string) => {
      if (!options.onStreamUpdate) return;
      const update = parseStreamJsonLine(line);
      if (update) options.onStreamUpdate(update);
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      logs.push(`[Cursor CLI] Timed out after ${timeoutMs / 1000}s`);
      resolve({
        success: false,
        resultText: "",
        logs,
        error: `Cursor agent CLI timed out after ${timeoutMs / 1000}s`,
        rawStdout: stdout,
        toolsCalled: extractToolsFromStdout(stdout),
      });
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (options.onStreamUpdate) {
        lineBuffer = drainStreamLines(lineBuffer + text, emitStreamLine);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      logs.push(`[Cursor CLI] Spawn error: ${err.message}`);
      resolve({
        success: false,
        resultText: "",
        logs,
        error: err.message,
        rawStdout: stdout,
        toolsCalled: extractToolsFromStdout(stdout),
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (lineBuffer.trim()) emitStreamLine(lineBuffer);
      const toolsCalled = extractToolsFromStdout(stdout);
      if (toolsCalled.length) {
        logs.push(`[Cursor CLI] Tools: ${toolsCalled.join(", ")}`);
      }
      if (stderr.trim()) {
        logs.push(
          `[Cursor CLI] stderr: ${stderr.trim().slice(0, 400)}${stderr.length > 400 ? "…" : ""}`,
        );
      }

      const parsed = parseAgentJsonOutput(stdout);
      if (code !== 0 && !parsed.resultText) {
        resolve({
          success: false,
          resultText: "",
          sessionId: parsed.sessionId,
          durationMs: parsed.durationMs,
          logs: [...logs, `[Cursor CLI] Exit code ${code ?? "unknown"}`],
          error: stderr.trim() || `Cursor agent CLI exited with code ${code}`,
          rawStdout: stdout,
          toolsCalled,
        });
        return;
      }

      if (parsed.isError) {
        resolve({
          success: false,
          resultText: parsed.resultText,
          sessionId: parsed.sessionId,
          durationMs: parsed.durationMs,
          logs: [...logs, `[Cursor CLI] Run reported error`],
          error: parsed.resultText || "Cursor agent run failed",
          rawStdout: stdout,
          toolsCalled,
        });
        return;
      }

      logs.push(
        `[Cursor CLI] Complete${parsed.sessionId ? ` (session ${parsed.sessionId})` : ""}${
          parsed.durationMs ? ` in ${Math.round(parsed.durationMs / 1000)}s` : ""
        }`,
      );

      resolve({
        success: true,
        resultText: parsed.resultText,
        sessionId: parsed.sessionId,
        durationMs: parsed.durationMs,
        logs,
        rawStdout: stdout,
        toolsCalled,
      });
    });
  });
}
