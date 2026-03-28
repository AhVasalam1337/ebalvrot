import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    try {
        // 1. Получаем настройки пользователя (Харктер + Контекст)
        const settings = await redis.hgetall(`user:${userId}:settings`) || {
            laconic: 5, empathy: 5, human: 5, contextLimit: 20
        };

        // 2. Формируем "Системную инструкцию характера"
        const personalityPrompt = `
        ТВОИ ТЕКУЩИЕ НАСТРОЙКИ ХАРАКТЕРА (от 0 до 10):
        - Лаконичность: ${settings.laconic}/10 (чем выше, тем короче и суше ответы).
        - Эмпатия: ${settings.empathy}/10 (чем выше, тем больше поддержки и сочувствия).
        - Человечность: ${settings.human}/10 (чем выше, тем меньше ты кажешься роботом, используй сленг, юмор, живую речь).
        `;

        // 3. Получаем правила
        const rulesArray = await redis.lrange('geminka:rules', 0, -1) || [];
        const rulesText = rulesArray.length > 0 ? "\nТВОИ ЖЕСТКИЕ ПРАВИЛА:\n" + rulesArray.join('\n') : "";

        // 4. УМНАЯ ОБРЕЗКА КОНТЕКСТА
        const limit = parseInt(settings.contextLimit) || 20;
        // Берем последние N сообщений (каждое сообщение - это 1 элемент в списке Redis)
        const rawHistory = await redis.lrange(`history:${chatId}`, -limit, -1) || [];

        // 5. ЗАПРОС
        // Собираем всё: Характер + Правила + Текст
        const fullInstruction = personalityPrompt + rulesText;
        const responseText = await getGeminiResponse(chatId, text, fullInstruction, rawHistory);

        // 6. СОХРАНЕНИЕ
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));
        await redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() });

        return res.status(200).json({ text: responseText });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
