import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ text: 'Method Not Allowed' });
  }

  try {
    const { text, chatId, userId } = req.body;
    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      return res.status(200).json({ text: 'Ошибка: API_KEY не найден.' });
    }

    // Параметры для модели
    const model = "gemini-3.1-flash-lite-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: "Ты живой помощник. Отвечай кратко." }] },
        contents: [{ role: "user", parts: [{ text: String(text) }] }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(200).json({ text: `Google API Error: ${data.error.message}` });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Пустой ответ.";

    // Сохранение (опционально, не блокирует ответ)
    kv.rpush(`history:${chatId}`, JSON.stringify({ role: "model", text: aiText })).catch(() => {});

    return res.status(200).json({ text: aiText });
  } catch (err) {
    return res.status(200).json({ text: `Server Crash: ${err.message}` });
  }
}
