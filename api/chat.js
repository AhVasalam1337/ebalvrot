import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send("Method not allowed");
    
    const { text, chatId, userId } = req.body;
    
    // ПРОВЕРКА ВХОДНЫХ ДАННЫХ
    if (!text || !chatId || !userId) {
        return res.status(200).json({ text: "ОШИБКА: Нет данных (text/chatId/userId)" });
    }

    try {
        // 1. ПРОВЕРКА KV (База данных)
        let settings;
        try {
            settings = await kv.hgetall(`user:${userId}:chat:${chatId}:settings`);
        } catch (kvErr) {
            console.error("KV Error:", kvErr);
            settings = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };
        }

        const s = settings || { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };
        const systemInstruction = `Ты помощник. Твои настройки: лаконичность ${s.laconic}, эмпатия ${s.empathy}, человечность ${s.human}.`;

        // 2. ВЫЗОВ GEMINI
        let aiResponse;
        try {
            aiResponse = await getGeminiResponse(systemInstruction, [
                { role: "user", parts: [{ text: String(text) }] }
            ]);
        } catch (aiErr) {
            return res.status(200).json({ text: `ОШИБКА GEMINI: ${aiErr.message}` });
        }

        // 3. СОХРАНЕНИЕ (не блокируем ответ)
        kv.rpush(`history:${chatId}`, JSON.stringify({ role: "user", text: String(text) }), JSON.stringify({ role: "model", text: aiResponse }))
          .catch(e => console.error("History save failed", e));

        return res.status(200).json({ text: aiResponse });

    } catch (globalErr) {
        return res.status(200).json({ text: `КРИТИЧЕСКАЯ ОШИБКА: ${globalErr.message}` });
    }
}
