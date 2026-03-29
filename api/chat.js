import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

export default async function handler(req, res) {
    // Форсируем JSON заголовок
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Only POST allowed" });
    }

    try {
        const { text, chatId, userId } = req.body;

        if (!text || !chatId || !userId) {
            return res.status(200).json({ text: "Системная ошибка: нет данных в теле запроса." });
        }

        // 1. Получаем настройки (с проверкой на существование базы)
        let settings = { laconic: 5, empathy: 5, human: 5, contextLimit: 5 };
        try {
            const saved = await kv.hgetall(`user:${userId}:chat:${chatId}:settings`);
            if (saved) settings = saved;
        } catch (e) {
            console.error("KV Error ignored:", e.message);
        }

        const instruction = `Ты помощник. Стиль: лаконичность ${settings.laconic}, эмпатия ${settings.empathy}.`;

        // 2. Вызов Gemini через наш метод
        const aiResponse = await getGeminiResponse(instruction, [
            { role: "user", parts: [{ text: String(text) }] }
        ]);

        // 3. Сохранение в KV (делаем через await, чтобы не убить процесс Vercel раньше времени)
        try {
            await kv.rpush(`history:${chatId}`, JSON.stringify({ role: "model", text: aiResponse }));
        } catch (e) {
            console.error("History save error:", e.message);
        }

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        // Если упало здесь — мы увидим текст ошибки прямо в чате, а не 500
        console.error("HANDLER_CRASH:", err);
        return res.status(200).json({ text: `Критическая ошибка сервера: ${err.message}` });
    }
}
