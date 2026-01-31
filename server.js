import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ===============================
// ENV VARIABLES (DO NOT HARD-CODE)
// ===============================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ===============================
// PROJECT KEYWORDS (EDIT THESE)
// ===============================
const PROJECT_KEYWORDS = [
  "giants",
  "giants protocol",
  "giants token",
  "giants staking",
  "giants roadmap",
  "giants whitepaper",
  "giants community",
  "giants ecosystem"
];

// ===============================
// HELPERS
// ===============================
function isProjectQuestion(text) {
  const lower = text.toLowerCase();
  return PROJECT_KEYWORDS.some(keyword => lower.includes(keyword));
}

// ===============================
// HEALTH CHECK
// ===============================
app.get("/", (req, res) => {
  res.send("OK - Project-only Telegram AI Bot running");
});

// ===============================
// TELEGRAM WEBHOOK
// ===============================
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    const message = update.message;

    // Only handle text messages
    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const chatId = message.chat.id;
    const userText = message.text;

    // =====================================
    // BLOCK NON-PROJECT QUESTIONS (NO AI)
    // =====================================
    if (!isProjectQuestion(userText)) {
      console.log("Ignored (non-project):", userText);
      return res.sendStatus(200);
    }

    // =====================================
    // ASK OPENAI (PROJECT ONLY)
    // =====================================
    const aiText = await askOpenAI(userText);

    // AI SAFETY BLOCK
    if (!aiText || aiText.trim() === "NO_REPLY") {
      console.log("AI blocked reply:", userText);
      return res.sendStatus(200);
    }

    // =====================================
    // SEND REPLY TO TELEGRAM
    // =====================================
    await sendTelegramMessage(chatId, aiText);

    return res.sendStatus(200);

  } catch (err) {
    console.error("Webhook error:", err);
    return res.sendStatus(200);
  }
});

// ===============================
// OPENAI REQUEST
// ===============================
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
You are an OFFICIAL assistant for the Giants Protocol project.

STRICT RULES:
- Answer ONLY questions related to Giants Protocol.
- If the question is NOT related, respond with EXACTLY: NO_REPLY
- Do NOT answer general knowledge questions.
- Do NOT answer personal or unrelated topics.
- Keep answers clear, factual, and project-focused.

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

// ===============================
// TELEGRAM SEND MESSAGE
// ===============================
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

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


