export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { system, userMsg } = req.body;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.3 },
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return res.status(500).json({ error: data.error?.message || "Gemini error", text: "" });
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  res.status(200).json({ text });
}
