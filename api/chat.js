import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    // ПРИНИМАЕМ userId С ФРОНТЕНДА
    const { text, chatId, userId } = req.body; 

    try {
        // 1. ПРИВЯЗКА: Записываем, что этот чат принадлежит пользователю
        if (userId) {
            await redis.sadd(`user:${userId}:chats`, chatId);
        }

        // 2. ИСТОРИЯ: Сохраняем сообщение
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));

        // 3. МЕТАДАННЫЕ: Обновляем время для сортировки в списке
        await redis.hset(`chat:${chatId}:meta`, { 
            updatedAt: Date.now(),
            name: text.substring(0, 20) + "..." 
        });

        // 4. ГЕМИНКА: Получаем ответ
        const rulesArray = await redis.lrange('geminka:rules', 0, -1);
        const fullPrompt = text + (rulesArray.length ? "\n\nПравила:\n" + rulesArray.join('\n') : "");
        const responseText = await getGeminiResponse(chatId, fullPrompt);

        // 5. ОТВЕТ: Сохраняем ответ бота
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));

        return res.status(200).json({ text: responseText });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
