import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { text, chatId } = req.body;
    const userId = chatId; 

    try {
        // 1. ЗАГРУЖАЕМ ПРАВИЛА ИЗ REDIS
        const rulesArray = await redis.lrange('geminka:rules', 0, -1);
        const rulesPrompt = rulesArray.length > 0 
            ? "\n\nСТРОГИЕ ПРАВИЛА ДЛЯ ТЕБЯ:\n" + rulesArray.join('\n') 
            : "";

        // 2. ФОРМИРУЕМ ПОЛНЫЙ ПРОМПТ ДЛЯ METHODS.JS
        // Мы склеиваем текущий текст сообщения с правилами, чтобы Gemini их увидела
        const promptWithRules = text + rulesPrompt;

        // 3. СОХРАНЯЕМ В ИСТОРИЮ (ТОЛЬКО ЧИСТЫЙ ТЕКСТ ПОЛЬЗОВАТЕЛЯ)
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text: text }));
        await redis.sadd(`user:${userId}:chats`, chatId);

        // 4. ЗАПРОС К GEMINI (Передаем текст с вклеенными правилами)
        const responseText = await getGeminiResponse(chatId, promptWithRules);

        // 5. СОХРАНЯЕМ ОТВЕТ БОТА
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));

        return res.status(200).json({ text: responseText });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
