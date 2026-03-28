import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    if (!chatId || !userId) return res.status(400).json({ error: "No IDs provided" });

    try {
        // Параллельный запрос правил и настроек
        const [globalRules, rawSettings] = await Promise.all([
            redis.lrange('geminka:rules', 0, -1),
            redis.hgetall(`user:${userId}:chat:${chatId}:settings`)
        ]);

        // Дефолты, если в Redis пусто
        const settings = rawSettings || { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };
        
        console.log(`[DEBUG] Chat: ${chatId} | Settings:`, settings);

        const limit = parseInt(settings.contextLimit);

        // Получаем историю именно этого чата
        let history = [];
        if (limit > 0) {
            const range = limit >= 51 ? 0 : -(limit * 2);
            const rawHistory = await redis.lrange(`history:${chatId}`, range, -1) || [];
            history = rawHistory.map(item => typeof item === 'string' ? JSON.parse(item) : item);
        }

        // ФОРМИРУЕМ ЖЕСТКУЮ ИНСТРУКЦИЮ
        // Мы преобразуем 1-10 в понятные нейронке команды
        const laconicText = settings.laconic > 7 ? "Write very short, maximum 2 sentences." : 
                           (settings.laconic < 4 ? "Write detailed, long and thorough answers." : "Average length.");
        
        const empathyText = settings.empathy > 7 ? "Be extremely supportive and emotional." : 
                           (settings.empathy < 4 ? "Be cold, robotic and strictly factual." : "Neutral tone.");

        const systemInstruction = `
        IMPORTANT: YOUR PERSONALITY CONSTRAINTS:
        - LENGTH: ${laconicText} (Scale: ${settings.laconic}/10)
        - EMOTION: ${empathyText} (Scale: ${settings.empathy}/10)
        - HUMANITY: Level ${settings.human}/10 (higher is more casual/slangy)

        GLOBAL RULES:
        ${(globalRules || []).join('\n')}
        `;

        const responseText = await getGeminiResponse(chatId, text, systemInstruction, history);

        // Сохраняем (не ждем через await для скорости)
        redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));

        return res.status(200).json({ text: responseText });
    } catch (e) {
        console.error("CRITICAL ERROR:", e);
        return res.status(500).json({ error: e.message });
    }
}
