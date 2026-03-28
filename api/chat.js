import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    // СТРОГАЯ ПРОВЕРКА: Если нет ID чата или юзера — стоп.
    if (!chatId || !userId) return res.status(400).json({ error: "Missing ID" });

    try {
        // 1. Ключ настроек: строго привязан к Юзеру И Чату
        const settingsKey = `user:${userId}:chat:${chatId}:settings`;
        const settings = await redis.hgetall(settingsKey) || {
            laconic: 5, empathy: 5, human: 5, contextLimit: 20
        };

        const limit = parseInt(settings.contextLimit);

        // 2. Ключ правил: сделаем их глобальными для юзера, но не для чата
        // (Или чатовыми, если хочешь, чтобы в каждом чате были свои правила)
        const rulesKey = `user:${userId}:rules`; 
        const rules = await redis.lrange(rulesKey, 0, -1) || [];

        // 3. Контекст: Только для этого chatId
        let history = [];
        if (limit > 0) {
            const range = limit >= 51 ? 0 : -(limit * 2);
            const rawHistory = await redis.lrange(`history:${chatId}`, range, -1) || [];
            history = rawHistory.map(item => JSON.parse(item));
        }

        const systemInstruction = `
        RULES: ${rules.join('\n')}
        STYLE: Laconic:${settings.laconic}, Empathy:${settings.empathy}
        `;

        const responseText = await getGeminiResponse(chatId, text, systemInstruction, history);

        // Пишем историю строго в этот chatId
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));

        return res.status(200).json({ text: responseText });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
