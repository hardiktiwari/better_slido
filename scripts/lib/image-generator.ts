import fs from "fs";
import path from "path";
import { createGenAIClient } from "./managed-agent.js";

export interface ImageGenerationRequest {
  prompt: string;
  filename: string;
}

export interface ImageGenerationResult {
  filename: string;
  path: string;
  bytes: number;
}

const SAFE_FILENAME = /^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i;
const IMAGEN_MODEL = "imagen-3.0-generate-002";

function sanitizeFilename(raw: string, idx: number): string {
  const base = raw.trim().replace(/[/\\]/g, "").replace(/\s+/g, "_");
  if (SAFE_FILENAME.test(base)) return base;
  return `generated_${Date.now()}_${idx}.jpg`;
}

function extractImageBytes(image: unknown): Buffer | null {
  if (!image || typeof image !== "object") return null;
  const anyImg = image as Record<string, unknown>;

  const imageBytes =
    (anyImg.imageBytes as string | undefined) ??
    ((anyImg.image as Record<string, unknown> | undefined)?.imageBytes as string | undefined);

  if (typeof imageBytes === "string" && imageBytes.length > 0) {
    return Buffer.from(imageBytes, "base64");
  }

  const data = anyImg.data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (typeof data === "string") return Buffer.from(data, "base64");

  return null;
}

export async function processImageGenerations(
  cwd: string,
  requests: ImageGenerationRequest[],
): Promise<{ results: ImageGenerationResult[]; logs: string[] }> {
  const logs: string[] = [];
  const results: ImageGenerationResult[] = [];

  if (!Array.isArray(requests) || requests.length === 0) {
    return { results, logs };
  }

  const outputDir = path.join(cwd, "public", "generated");
  fs.mkdirSync(outputDir, { recursive: true });

  const client = createGenAIClient();

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    if (!req || typeof req.prompt !== "string" || !req.prompt.trim()) {
      logs.push(`[IMAGEN] Skipped request #${i + 1}: missing prompt`);
      continue;
    }

    const filename = sanitizeFilename(req.filename ?? `generated_${i + 1}.jpg`, i + 1);
    const absolutePath = path.join(outputDir, filename);

    try {
      logs.push(`[IMAGEN] Generating ${filename} — "${req.prompt.slice(0, 80)}${req.prompt.length > 80 ? "…" : ""}"`);

      const response = await client.models.generateImages({
        model: IMAGEN_MODEL,
        prompt: req.prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
        },
      } as Parameters<typeof client.models.generateImages>[0]);

      const generated = (response as { generatedImages?: unknown[] }).generatedImages ?? [];
      const first = generated[0];
      const buffer = extractImageBytes(first);

      if (!buffer) {
        logs.push(`[IMAGEN] ✗ ${filename}: Imagen returned no image bytes`);
        continue;
      }

      fs.writeFileSync(absolutePath, buffer);
      results.push({ filename, path: `/generated/${filename}`, bytes: buffer.length });
      logs.push(`[IMAGEN] ✓ Wrote public/generated/${filename} (${buffer.length} bytes)`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logs.push(`[IMAGEN] ✗ ${filename}: ${message}`);
    }
  }

  return { results, logs };
}
