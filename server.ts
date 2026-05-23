import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { runManagedAgent } from "./scripts/lib/managed-agent.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize GoogleGenAI client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// --- API Endpoints ---

// Check if Gemini API key exists
app.get("/api/env-check", (req, res) => {
  res.json({
    hasKey: !!process.env.GEMINI_API_KEY,
  });
});

// B: Agent Edit Flow Endpoint
app.post("/api/agent/edit", async (req, res) => {
  try {
    const { slide, prompt } = req.body;
    if (!slide) {
      return res.status(400).json({ error: "No slide context provided." });
    }

    const systemInstruction = `You are a professional presentation presentation designer and slide editing assistant.
You take a slide object and a user prompt (instructions for slide edit) and output a collection of proposed edit operations.
Operate strictly within the provided schema.

The slide object has the following structure:
{
  "id": "slide-id",
  "type": "title" | "bullet" | "poll" | "qa",
  "tag": "uppercase tag header",
  "title": "slide main title",
  "subtitle": "slide subtitle",
  "bullets": [{"text": "...", "icon": "sparkles" | "target" | "check" | "book" | "star" | "lightbulb"}],
  "pollOptions": [{"text": "...", "votes": 0}],
  "footerLeft": "...",
  "footerRight": "..."
}

You must respond with a list of "proposedOps" that describe the changes. The types of operations you can return are:
1. { "type": "update_field", "field": "title" | "subtitle" | "tag" | "footerLeft" | "footerRight", "value": "new text" }
2. { "type": "update_bullet", "index": number, "text": "new text", "icon": "icon_name" }
3. { "type": "add_bullet", "text": "text for bullet", "icon": "icon_name" }
4. { "type": "remove_bullet", "index": number }
5. { "type": "update_poll", "index": number, "text": "new text" }
6. { "type": "add_poll", "text": "text for poll option" }
7. { "type": "remove_poll", "index": number }

Return your response in standard JSON. Always include an explanation of the design choices made.`;

    const contents = `Slide currently looks like: ${JSON.stringify(slide, null, 2)}
User Prompt: "${prompt}"

Return the JSON containing:
1. "proposedOps": array of edit operation objects.
2. "explanation": a human-friendly explanation of why these operations make the slide better matching the intent.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["proposedOps", "explanation"],
          properties: {
            explanation: {
              type: Type.STRING,
              description: "A summary of the design choices made to satisfy the prompt."
            },
            proposedOps: {
              type: Type.ARRAY,
              description: "List of ops to apply to the slide state.",
              items: {
                type: Type.OBJECT,
                required: ["type"],
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "Operation type"
                  },
                  field: {
                    type: Type.STRING,
                    description: "The slide state field to edit (for update_field)"
                  },
                  value: {
                    type: Type.STRING,
                    description: "The new string value"
                  },
                  index: {
                    type: Type.INTEGER,
                    description: "0-based index for bullets or polls"
                  },
                  text: {
                    type: Type.STRING,
                    description: "The bullet text or poll option text"
                  },
                  icon: {
                    type: Type.STRING,
                    description: "The icon name"
                  }
                }
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Agent Edit API Error:", error);
    res.status(500).json({ error: error.message || "Failed to resolve edits." });
  }
});

// C: Comment Resolution Flow Endpoint
app.post("/api/agent/resolve", async (req, res) => {
  try {
    const { slide, comment, targetElement } = req.body;
    if (!slide || !comment) {
      return res.status(400).json({ error: "Missing slide or comment context." });
    }

    const systemInstruction = `You are a professional slide designer resolving inline comments on specific elements of the slide.
The user has attached a public comment/ticket requesting an edit. Your job is to generate a set of slide edit operations to satisfy and resolve this feedback.

The comment targets: ${targetElement || "the whole active slide"}.
Comment Content: "${comment}"

Operations Schema:
1. { "type": "update_field", "field": "title" | "subtitle" | "tag" | "footerLeft" | "footerRight", "value": "new text" }
2. { "type": "update_bullet", "index": number, "text": "new text", "icon": "icon_name" }
3. { "type": "add_bullet", "text": "text for bullet", "icon": "icon_name" }
4. { "type": "remove_bullet", "index": number }
5. { "type": "update_poll", "index": number, "text": "new text" }
6. { "type": "add_poll", "text": "text for poll option" }
7. { "type": "remove_poll", "index": number }

Return JSON with proposedOps and explanation. Mark the resolution action clearly.`;

    const contents = `Slide state: ${JSON.stringify(slide, null, 2)}
Feedback Comment: "${comment}"

Generate the proposed operations matching the comment intent.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["proposedOps", "explanation"],
          properties: {
            explanation: {
              type: Type.STRING,
              description: "High fidelity design choice description explaining the comment resolution."
            },
            proposedOps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["type"],
                properties: {
                  type: { type: Type.STRING },
                  field: { type: Type.STRING },
                  value: { type: Type.STRING },
                  index: { type: Type.INTEGER },
                  text: { type: Type.STRING },
                  icon: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Comment Resolve API Error:", error);
    res.status(500).json({ error: error.message || "Failed to resolve comment." });
  }
});

// Interactive endpoint: runs Antigravity managed agent harness
app.post("/api/agent/cli-run", async (_req, res) => {
  try {
    const result = await runManagedAgent(process.cwd());

    if (!result.applied && result.commentsFound > 0) {
      return res.json({
        success: false,
        cliLogs: result.logs,
        applied: false,
        explanation: result.explanation,
        commentsFound: result.commentsFound,
        interactionId: result.interactionId,
      });
    }

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
    console.error("CLI Agent Harness Error:", error);
    res.status(500).json({ error: message });
  }
});

// Configure Vite as middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on port ${PORT}`);
  });
}

startServer();
