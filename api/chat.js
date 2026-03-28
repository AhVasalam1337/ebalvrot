import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    try {
        // 1. Загружаем настройки конкретного чата
        const settings = await redis.hgetall(`user:${userId}:chat:${chatId}:settings`) || {
            laconic: 5, empathy: 5, human: 5, contextLimit: 20
        };

        const limit = parseInt(settings.contextLimit);

        // 2. ЖЕСТКАЯ ПРОВЕРКА КОНТЕКСТА
        let history = [];
        if (limit > 0) {
            // Если не рыбка, тянем историю
            const range = limit >= 51 ? 0 : -(limit * 2);
            const rawHistory = await redis.lrange(`history:${chatId}`, range, -1) || [];
            history = rawHistory.map(item => typeof item === 'string' ? JSON.parse(item) : item);
        } 
        // Если limit === 0, history остается [] — Бот физически не увидит прошлого.

        const systemInstruction = `
        PERSONALITY: Laconic:${settings.laconic}, Empathy:${settings.empathy}, Human:${settings.human}
        RULES: ${(await redis.lrange('geminka:rules', 0, -1) || []).join('\n')}
        `;

        // 3. Запрос к API (передаем пустую историю, если рыбка)
        const responseText = await getGeminiResponse(chatId, text, systemInstruction, history);

        // 4. Сохранение (пишем в базу всегда, чтобы можно было выключить рыбку и увидеть историю)
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));

        return res.status(200).json({ text: responseText });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
