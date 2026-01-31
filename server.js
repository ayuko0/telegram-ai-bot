import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ENV variables (set these on Render)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!TELEGRAM_TOKEN || !OPENAI_API_KEY) {
  console.warn("Missing TELEGRAM_TOKEN or OPENAI_API_KEY env variables.");
}

app.get("/", (req, res) => {
  res.send("OK - Telegram AI Bot is running");
});

// Telegram sends updates here
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;

    // Only handle normal text messages
    const message = update.message;
    if (!message || !message.text) return res.sendStatus(200);

    const chatId = message.chat.id;
    const userText = message.text;

    // 1) Ask OpenAI
    const aiText = await askOpenAI(userText);

    // 2) Send reply back to Telegram
    await sendTelegramMessage(chatId, aiText);

    return res.sendStatus(200);
  } catch (err) {
    console.error(err);
    return res.sendStatus(200);
  }
});

async function askOpenAI(userText) {
  // Uses OpenAI Responses API (simple)
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: `Reply clearly and helpfully.\n\nUser: ${userText}`
    })
  });

  if (!resp.ok) {
    const t = await resp.text();
    return `OpenAI error: ${resp.status} ${t}`;
  }

  const data = await resp.json();

  // Extract text safely
  const out = data.output?.[0]?.content?.[0]?.text;
  return out || "Sorry, I couldn't generate a reply.";
}

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
