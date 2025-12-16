import "dotenv/config";
import express from "express";
import fs from "fs";
import path from "path";

const app = express();
const PORT = Number(process.env.PORT || 3001);

// ====== Startup logs ======
console.log("OPENAI_API_KEY loaded?", !!process.env.OPENAI_API_KEY);
console.log("CWD:", process.cwd());

// ====== Serve UI from /public ======
app.use(express.static("public"));

// ====== Parse SDP as raw text ======
app.use(express.text({ type: ["application/sdp", "text/plain"] }));

/**
 * Load system prompt from a Markdown (.md) file.
 * Fallback to JSON if .md doesn't exist (optional).
 *
 * Expected:
 *  - prompts/aisha-intake.md   (preferred)
 *  - prompts/aisha-intake.json (fallback)
 */
function loadSystemPrompt(promptName = "aisha-intake") {
  const mdPath = path.join(process.cwd(), "prompts", `${promptName}.md`);
  const jsonPath = path.join(process.cwd(), "prompts", `${promptName}.json`);

  // ✅ Preferred: Markdown
  if (fs.existsSync(mdPath)) {
    const md = fs.readFileSync(mdPath, "utf-8");
    if (!md.trim()) throw new Error(`Prompt MD file is empty: ${mdPath}`);
    return md; // return exact markdown text
  }

  // ✅ Optional fallback: JSON (old approach)
  if (fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    const json = JSON.parse(raw);
    if (!json?.content) {
      throw new Error(`Prompt JSON missing "content" field: ${jsonPath}`);
    }
    return json.content;
  }

  // ❌ Not found
  throw new Error(
    `Prompt not found. Create one of these:\n- ${mdPath}\n- ${jsonPath}`
  );
}

// ====== Create Realtime WebRTC session ======
app.post("/session", async (req, res) => {
  console.log("\n---- /session called ----");
  console.log("Content-Type:", req.headers["content-type"]);
  console.log("SDP length:", (req.body || "").length);

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY in .env");
    }

    // Load prompt exactly as-is (MD preferred)
    const systemPrompt = loadSystemPrompt("aisha-intake");
    console.log("Prompt length:", systemPrompt.length);

    // Allow model/voice from query if you want:
    const model = (req.query.model || "gpt-realtime").toString();
    const voice = (req.query.voice || "marin").toString();
    console.log("Using:", { model, voice });

    const sessionConfig = {
      type: "realtime",
      model,
      audio: { output: { voice } },
      instructions: systemPrompt,
    };

    const fd = new FormData();
    fd.set("sdp", req.body);
    fd.set("session", JSON.stringify(sessionConfig));

    console.log("Calling OpenAI: POST /v1/realtime/calls ...");

    const response = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: fd,
    });

    const text = await response.text();
    console.log("OpenAI status:", response.status);
    console.log("OpenAI response (first 800 chars):", text.slice(0, 800));

    if (!response.ok) {
      return res.status(500).send(`OpenAI error ${response.status}: ${text}`);
    }

    res.type("application/sdp").send(text);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).send(String(err?.stack || err));
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
