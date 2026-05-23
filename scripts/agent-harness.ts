import dotenv from "dotenv";
import { runManagedAgent, HARNESS_VERSION } from "./lib/managed-agent.js";

dotenv.config();

async function runCLI() {
  console.log(`\n=== Better Slido - Managed Agent CLI [v${HARNESS_VERSION}] ===\n`);

  try {
    const result = await runManagedAgent(process.cwd());

    for (const line of result.logs) {
      console.log(line);
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
