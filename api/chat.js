import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ text: "Метод не разрешен" });
    }

    try {
        const { text, chatId, userId } = req.body;

        if (!text || !chatId) {
            return res.status(200).json({ text: "Ошибка: данные не получены." });
        }

        const key = process.env.GEMINI_API_KEY;
        if (!key) {
            return res.status(200).json({ text: "Ошибка: API ключ не настроен в Vercel." });
        }

        // Настройки персонажа
        let s = { laconic: 5, empathy: 5, human: 5 };
        try {
            const saved = await kv.hgetall(`user:${userId}:chat:${chatId}:settings`);
            if (saved) s = saved;
        } catch (e) {
            console.error("KV Error ignored");
        }

        const model = "gemini-3.1-flash-lite-preview";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

        const geminiRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { 
                    parts: [{ text: `Ты ИИ. Настройки: лаконичность ${s.laconic}, эмпатия ${s.empathy}.` }] 
                },
                contents: [{ role: "user", parts: [{ text: String(text) }] }]
            })
        });

        const data = await geminiRes.json();

        if (data.error) {
            return res.status(200).json({ text: `Google Error: ${data.error.message}` });
        }

        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Модель промолчала.";

        // Сохранение истории (не блокируем ответ)
        kv.rpush(`history:${chatId}`, JSON.stringify({ role: "model", text: aiText })).catch(() => {});

        return res.status(200).json({ text: aiText });

    } catch (err) {
        return res.status(200).json({ text: `Сбой сервера: ${err.message}` });
    }
}
