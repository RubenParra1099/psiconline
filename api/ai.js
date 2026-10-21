// IA opcional (Noa, resumen clínico, análisis de transcripción) con la API de Anthropic.
// Sin ANTHROPIC_API_KEY la plataforma funciona igual con respuestas de ejemplo.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(501).json({ error: "IA no configurada" });
  const { input } = req.body || {};
  let messages = null;
  if (typeof input === "string") messages = [{ role: "user", content: input }];
  else if (Array.isArray(input)) messages = input.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") }));
  if (!messages || !messages.length) return res.status(400).json({ error: "Entrada no válida" });
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (total > 24000 || messages.length > 30) return res.status(413).json({ error: "Entrada demasiado larga" });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5", max_tokens: 900, messages })
    });
    const j = await r.json();
    if (!r.ok) { console.error(j); return res.status(502).json({ error: "La IA no respondió" }); }
    const text = (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    return res.json({ text });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "La IA no respondió" });
  }
}
