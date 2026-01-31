import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// =======================================
// ENV VARIABLES (SET ON RENDER / SERVER)
// =======================================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// =======================================
// PROJECT KEYWORDS (EDIT IF NEEDED)
// =======================================
const PROJECT_KEYWORDS = [
  "giants",
  "giants protocol",
  "giantsprotocol",
  "giantsprotocol.ai",
  "2mr",
  "2mr labs",
  "rwa",
  "tokenization"
];

// =======================================
// LOAD PROJECT DOCUMENTATION (SOURCE)
// =======================================
const PROJECT_DOCS = fs.readFileSync("./project_docs.txt", "utf8");

// =======================================
// HELPERS
// =======================================
function isProjectQuestion(text) {
  const lower = text.toLowerCase();
  return PROJECT_KEYWORDS.some(keyword => lower.includes(keyword));
}

// =======================================
// HEALTH CHECK
// =======================================
app.get("/", (req, res) => {
  res.send("OK - Giants Protocol Docs Bot Running");
});

// =======================================
// TELEGRAM WEBHOOK
// =======================================
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    const message = update.message;

    // Only handle text messages
    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const userText = message.text.trim();

    // ===================================
    // BLOCK NON-PROJECT QUESTIONS (NO AI)
    // ===================================
    if (!isProjectQuestion(userText)) {
      console.log("Ignored (non-project):", userText);
      return res.sendStatus(200);
    }

    // ===================================
    // ASK OPENAI (DOCS ONLY)
    // ===================================
    const aiText = await askOpenAI(userText);

    // ===================================
    // BLOCK INVALID RESPONSES
    // ===================================
    if (!aiText || aiText.trim() === "NO_REPLY") {
      console.log("No reply (not in docs):", userText);
      return res.sendStatus(200);
    }

    // ===================================
    // SEND RESPONSE
    // ===================================
    await sendTelegramMessage(chatId, aiText);

    return res.sendStatus(200);

  } catch (err) {
    console.error("Webhook error:", err);
    return res.sendStatus(200);
  }
});

// =======================================
// OPENAI (STRICT DOCS MODE)
// =======================================
async function askOpenAI(userText) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: `
You are an OFFICIAL documentation assistant for Giants Protocol and 2MR Labs.

SOURCE OF TRUTH:
You are ONLY allowed to use the documentation below.
You must NOT use any outside knowledge.

=========================
PROJECT DOCUMENTATION
=========================
${PROJECT_DOCS}
=========================

STRICT RULES:
- Answer ONLY if the answer is clearly found in the documentation.
- If the documentation does NOT contain the answer, respond EXACTLY with: NO_REPLY
- Do NOT guess, infer, or speculate.
- Do NOT add opinions or future projections.
- Keep answers factual, concise, and neutral.

User question:
${userText}
`
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI error:", errorText);
    return null;
  }

  const data = await response.json();
  const outputText = data.output?.[0]?.content?.[0]?.text;

  return outputText || null;
}

// =======================================
// TELEGRAM SEND MESSAGE
// =======================================
async function sendTelegramMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });
}

// =======================================
// START SERVER
// =======================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
