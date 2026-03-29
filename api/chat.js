import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    try {
        const { text, chatId, userId } = req.body;
        if (!text || !chatId) return res.status(200).json({ text: "Ошибка: данные не получены." });

        const key = process.env.GEMINI_API_KEY;
        const model = "gemini-3.1-flash-lite-preview";
        
        // 1. Прямой вызов Google API через встроенный fetch
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        
        const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: "Будь лаконичным." }] },
                contents: [{ role: "user", parts: [{ text: text }] }]
            })
        });

        const data = await geminiRes.json();

        if (data.error) {
            return res.status(200).json({ text: `Google API Error: ${data.error.message}` });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Пустой ответ";

        // 2. Сохранение в KV (игнорируем ошибки базы, чтобы не вешать чат)
        kv.rpush(`history:${chatId}`, JSON.stringify({ role: "model", text: aiText })).catch(() => {});

        return res.status(200).json({ text: aiText });

    } catch (err) {
        console.error("CRASH:", err);
        return res.status(200).json({ text: `Критический сбой: ${err.message}` });
    }
}
