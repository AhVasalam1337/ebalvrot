import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    if (!chatId || !userId) return res.status(400).json({ error: "Missing ID" });

    try {
        // 1. ГЛОБАЛЬНЫЕ ПРАВИЛА (Общие для всех чатов)
        const globalRules = await redis.lrange('geminka:rules', 0, -1) || [];

        // 2. ИНДИВИДУАЛЬНЫЕ НАСТРОЙКИ (Только для этого chatId)
        const settingsKey = `user:${userId}:chat:${chatId}:settings`;
        const settings = await redis.hgetall(settingsKey) || {
            laconic: 5, empathy: 5, human: 5, contextLimit: 20
        };

        const limit = parseInt(settings.contextLimit);

        // 3. КОНТЕКСТ (Только для этого chatId)
        let history = [];
        if (limit > 0) {
            const range = limit >= 51 ? 0 : -(limit * 2);
            // Берем историю именно этого чата
            const rawHistory = await redis.lrange(`history:${chatId}`, range, -1) || [];
            history = rawHistory.map(item => typeof item === 'string' ? JSON.parse(item) : item);
        }

        // Формируем системную инструкцию
        const systemInstruction = `
        SYSTEM RULES (GLOBAL):
        ${globalRules.join('\n')}

        CHAT STYLE (LOCAL):
        - LACONICISM: ${settings.laconic}/10
        - EMPATHY: ${settings.empathy}/10
        - HUMANITY: ${settings.human}/10
        `;

        // Запрос к Gemini
        const responseText = await getGeminiResponse(chatId, text, systemInstruction, history);

        // Сохраняем в историю ЭТОГО чата
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));

        return res.status(200).json({ text: responseText });
    } catch (e) {
        console.error("Chat Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
