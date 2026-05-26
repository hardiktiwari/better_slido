import dotenv from "dotenv";
import { runCursorAgent, CURSOR_HARNESS_VERSION } from "./lib/cursor-agent.js";
import { processImageGenerations } from "./lib/image-generator.js";

dotenv.config();

async function runCLI() {
  console.log(`\n=== Better Slido - Cursor CLI Harness [v${CURSOR_HARNESS_VERSION}] ===\n`);

  try {
    const result = await runCursorAgent(process.cwd());

    for (const line of result.logs) {
      console.log(line);
    }

    // Intercept any `imageGenerations` requests the agent attached to its
    // JSON output and run them locally through Imagen-3. Files land in
    // public/generated/ and are served by the /generated static route.
    if (result.imageGenerations && result.imageGenerations.length > 0) {
      console.log(`\n=== Image Generation (Imagen-3) ===`);
      const imageRun = await processImageGenerations(process.cwd(), result.imageGenerations);
      for (const line of imageRun.logs) {
        console.log(line);
      }
      if (imageRun.results.length > 0) {
        console.log(`\n✓ Generated ${imageRun.results.length} image(s):`);
        for (const r of imageRun.results) {
          console.log(`  - ${r.path} (${r.bytes} bytes)`);
        }
      }
    }

    if (result.applied) {
      console.log(`\n✓ Directive resolved and synced to local workspace.`);
      if (result.skill) {
        console.log(`  Skill: ${result.skill}`);
      }
      console.log("");
    } else if (result.commentsFound === 0) {
      console.log("");
    } else {
      console.log(`\n⚠ Agent finished but no local file sync occurred. Check output above.\n`);
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nError during managed agent run: ${message}\n`);
    process.exit(1);
  }
}

runCLI();
