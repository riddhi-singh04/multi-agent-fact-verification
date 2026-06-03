export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
 
  const { system, userMsg } = req.body;
 
  const makeRequest = async () => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
    return response;
  };
 
  try {
    let response = await makeRequest();
 
    // If rate limited, wait 3 seconds and retry once
    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 3000));
      response = await makeRequest();
    }
 
    // If still rate limited, wait 6 more seconds and retry
    if (response.status === 429) {
      await new Promise(r => setTimeout(r, 6000));
      response = await makeRequest();
    }
 
    const data = await response.json();
 
    if (!response.ok) {
      console.error("Gemini error:", JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || "Gemini error", text: "" });
    }
 
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    res.status(200).json({ text });
 
  } catch (err) {
    console.error("Handler error:", err.message);
    res.status(500).json({ error: err.message, text: "" });
  }
}