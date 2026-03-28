import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();
const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    try {
        const [globalRules, rawSettings] = await Promise.all([
            redis.lrange('geminka:rules', 0, -1),
            redis.hgetall(`user:${userId}:chat:${chatId}:settings`)
        ]);

        const s = rawSettings || DEFAULTS;
        const limit = parseInt(s.contextLimit) || 20;

        // Загрузка истории согласно лимиту
        let history = [];
        if (limit > 0) {
            const range = limit >= 51 ? 0 : -(limit * 2);
            const rawH = await redis.lrange(`history:${chatId}`, range, -1);
            history = (rawH || []).map(i => typeof i === 'string' ? JSON.parse(i) : i);
        }

        // Формирование жесткого системного промпта на основе настроек
        const sysInstructions = [
            `Твой стиль общения:`,
            `- Краткость: ${s.laconic}/10 (чем выше, тем короче ответы, при 10 - только суть).`,
            `- Эмпатия: ${s.empathy}/10 (чем выше, тем больше поддержки и эмоций).`,
            `- Человечность: ${s.human}/10 (чем выше, тем больше сленга и меньше официоза).`,
            `Глобальные правила системы, которые ОБЯЗАТЕЛЬНЫ к исполнению:`,
            ...(globalRules || []).map(r => `- ${r}`)
        ].join('\n');

        const responseText = await getGeminiResponse(chatId, text, sysInstructions, history);

        // Сохранение в базу
        await Promise.all([
            redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text })),
            redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }))
        ]);

        return res.status(200).json({ text: responseText });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
