import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { system, messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 700,
      system: system || "Eres un consejero espiritual cristiano sabio y empático.",
      messages: messages.slice(-10),
    });

    const reply = response.content[0]?.text || "";
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Anthropic API error:", error.message, error.status);
    return res.status(500).json({
      error: "Error al procesar tu mensaje",
      detail: error.message,
    });
  }
}
