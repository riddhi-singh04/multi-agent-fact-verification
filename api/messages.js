export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { system, messages, max_tokens } = req.body;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { maxOutputTokens: max_tokens || 1500 },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Send as a single SSE event in Anthropic format
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.write(`data: ${JSON.stringify({ type: "content_block_delta", delta: { text } })}\n\n`);
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}