import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    try {
        // 1. Загружаем настройки характера и лимит контекста
        const settings = await redis.hgetall(`user:${userId}:settings`) || {
            laconic: 5, empathy: 5, human: 5, contextLimit: 20
        };

        // 2. Формируем инструкцию по характеру
        const personality = `
        STYLE SETTINGS:
        - Laconic (0-10): ${settings.laconic} (Shortness of speech)
        - Empathy (0-10): ${settings.empathy} (Emotional support)
        - Humanity (0-10): ${settings.human} (Natural/Informal language)
        `;

        // 3. Загружаем правила
        const rulesArray = await redis.lrange('geminka:rules', 0, -1) || [];
        const rulesText = rulesArray.length > 0 ? "\nCORE RULES:\n" + rulesArray.join('\n') : "";

        // 4. Получаем историю с учетом лимита (contextLimit)
        const limit = parseInt(settings.contextLimit) || 20;
        const rawHistory = await redis.lrange(`history:${chatId}`, -limit, -1) || [];

        // 5. Итоговый системный промпт
        const systemInstruction = personality + rulesText;

        // 6. Запрос к нейронке
        const responseText = await getGeminiResponse(chatId, text, systemInstruction, rawHistory);

        // 7. Сохранение истории
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));
        
        // Обновление меты (время и имя если это первый месседж)
        await redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() });

        return res.status(200).json({ text: responseText });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: e.message });
    }
}
