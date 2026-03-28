import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    try {
        // 1. ЗАГРУЗКА ХАРАКТЕРА (Индивидуально для chatId)
        const settingsKey = `user:${userId}:chat:${chatId}:settings`;
        const settings = await redis.hgetall(settingsKey) || {
            laconic: 5, empathy: 5, human: 5, contextLimit: 20
        };

        // 2. ЗАГРУЗКА ПРАВИЛ (Глобально для всех)
        const globalRules = await redis.lrange('geminka:rules', 0, -1) || [];

        const limit = parseInt(settings.contextLimit);

        // 3. ФИЛЬТР КОНТЕКСТА (Золотая рыбка)
        let history = [];
        if (limit > 0) {
            const range = limit >= 51 ? 0 : -(limit * 2);
            const raw = await redis.lrange(`history:${chatId}`, range, -1) || [];
            history = raw.map(item => JSON.parse(item));
        }

        const systemInstruction = `
        RULES: ${globalRules.join(' | ')}
        TONE: Laconic:${settings.laconic}, Empathy:${settings.empathy}, Human:${settings.human}
        `;

        const responseText = await getGeminiResponse(chatId, text, systemInstruction, history);

        // Сохраняем историю строго в этот чат
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));

        return res.status(200).json({ text: responseText });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
