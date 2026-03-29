import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // 1. Сразу ставим заголовки, чтобы фронт не тупил
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ text: "Метод не разрешен" });
    }

    try {
        const { text, chatId } = req.body;
        if (!text || !chatId) {
            return res.status(200).json({ text: "Ошибка: Пустой текст или ID чата." });
        }

        const key = process.env.GEMINI_API_KEY;
        if (!key) {
            return res.status(200).json({ text: "Ошибка: Ключ API не найден в системе." });
        }

        const model = "gemini-3.1-flash-lite-preview";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

        // 2. Запрос к Google (используем встроенный fetch Node.js 18+)
        const geminiRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { 
                    parts: [{ text: "Ты — Geminка. Будь живой, используй сленг, отвечай лаконично." }] 
                },
                contents: [
                    { role: "user", parts: [{ text: text }] }
                ]
            })
        });

        const data = await geminiRes.json();

        if (data.error) {
            return res.status(200).json({ text: `Google API Error: ${data.error.message}` });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Пустой ответ";

        // 3. Сохранение в KV (делаем через await для надежности)
        try {
            await kv.rpush(`history:${chatId}`, JSON.stringify({ role: "model", text: aiText }));
        } catch (kvErr) {
            console.error("KV Error:", kvErr.message);
        }

        return res.status(200).json({ text: aiText });

    } catch (err) {
        console.error("CRITICAL_ERROR:", err);
        // Возвращаем 200, но с текстом ошибки, чтобы не было 500-й
        return res.status(200).json({ text: `Критический сбой: ${err.message}` });
    }
}
