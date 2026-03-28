import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    try {
        const settings = await redis.hgetall(`user:${userId}:settings`) || {
            laconic: 5, empathy: 5, human: 5, contextLimit: 20
        };

        // УСИЛЕННЫЙ СИСТЕМНЫЙ ПРОМПТ
        const systemInstruction = `
        IMPORTANT: Act according to these personality weights (0-10):
        - LACONICISM: ${settings.laconic} (Higher = shorter, more direct answers)
        - EMPATHY: ${settings.empathy} (Higher = more supportive, caring, emotional)
        - HUMANITY: ${settings.human} (Higher = use informal language, slang, humor, be like a real person)
        
        GLOBAL RULES:
        ${(await redis.lrange('geminka:rules', 0, -1) || []).join('\n')}
        `;

        // ЛОГИКА КОНТЕКСТА (ЗОЛОТАЯ РЫБКА / БЕСКОНЕЧНОСТЬ)
        const limit = parseInt(settings.contextLimit);
        let history = [];

        if (limit === 0) {
            history = []; // Золотая рыбка - истории нет
        } else if (limit >= 51) {
            history = await redis.lrange(`history:${chatId}`, 0, -1) || []; // Бесконечность - всё
        } else {
            history = await redis.lrange(`history:${chatId}`, -limit, -1) || []; // Лимит
        }

        const responseText = await getGeminiResponse(chatId, text, systemInstruction, history);

        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));
        await redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() });

        return res.status(200).json({ text: responseText });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
