import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

export default async function handler(req, res) {
    // Включаем CORS на всякий случай
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method !== 'POST') return res.status(405).json({ error: "Only POST allowed" });

    try {
        const { text, chatId, userId } = req.body;
        
        // Проверка входных данных
        if (!text || !chatId || !userId) {
            return res.status(200).json({ text: "Система: Ошибка данных (нет текста, чата или юзера)" });
        }

        // Проверка KV
        let globalRules = [];
        try {
            globalRules = await kv.lrange('geminka:rules', 0, -1) || [];
        } catch (kvErr) {
            return res.status(200).json({ text: `Ошибка базы KV: ${kvErr.message}. Проверь подключение в Vercel Storage.` });
        }

        const systemInstruction = `Будь крутым ИИ. Правила: ${globalRules.join('. ')}`;

        // Запрос к Gemini
        const aiResponse = await getGeminiResponse(systemInstruction, [
            { role: "user", parts: [{ text: String(text) }] }
        ]);

        // Пишем в историю
        await kv.rpush(`history:${chatId}`, JSON.stringify({ role: "user", text }));
        await kv.rpush(`history:${chatId}`, JSON.stringify({ role: "model", text: aiResponse }));

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        // Вместо 500 возвращаем 200 с описанием ошибки, чтобы ты увидел её в чате
        return res.status(200).json({ text: `CRASH LOG: ${err.message}` });
    }
}
