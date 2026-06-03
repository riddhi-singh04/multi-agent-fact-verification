export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;

  // Parse body if it's a string
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const system = body?.system || "";
  const userMsg = body?.userMsg || "";

  if (!userMsg) {
    return res.status(400).json({ error: "missing userMsg", text: "" });
  }

  const makeRequest = async () => {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
  };

  try {
    let response = await makeRequest();

    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 4000));
      response = await makeRequest();
    }

    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 8000));
      response = await makeRequest();
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message, text: "" });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return res.status(200).json({ text });

  } catch (err) {
    console.error("Error:", err.message);
    return res.status(500).json({ error: err.message, text: "" });
  }
}