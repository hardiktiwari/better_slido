import dotenv from "dotenv";
import {
  registerManagedAgent,
  DEFAULT_MANAGED_AGENT_ID,
  BASE_AGENT,
} from "./lib/managed-agent.js";

dotenv.config();

async function main() {
  const agentId = process.argv[2] || process.env.MANAGED_AGENT_ID || DEFAULT_MANAGED_AGENT_ID;

  console.log(`\n=== Register Better Slido Managed Agent ===`);
  console.log(`Base agent: ${BASE_AGENT}`);
  console.log(`Agent id:   ${agentId}\n`);

  try {
    const createdId = await registerManagedAgent(process.cwd(), agentId);
    console.log(`✓ Created managed agent: ${createdId}`);
    console.log(`\nAdd to your .env:\n  MANAGED_AGENT_ID=${createdId}\n`);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nFailed to register agent: ${message}\n`);
    process.exit(1);
  }
}

main();
