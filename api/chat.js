import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { system, messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: system || "Eres un consejero espiritual cristiano sabio y empático.",
      messages: messages.slice(-10), // Keep last 10 messages for context
    });

    const reply = response.content[0]?.text || "";
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Anthropic API error:", error);
    return res.status(500).json({ error: "Error al procesar tu mensaje" });
  }
}
