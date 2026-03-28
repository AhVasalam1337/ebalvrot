import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { text, chatId, userId } = req.body; 

    try {
        // 1. ПРОВЕРКА ДАННЫХ (чтобы не упасть на пустом месте)
        if (!chatId || !text) return res.status(400).json({ error: "Missing data" });

        // 2. РЕГИСТРАЦИЯ (на случай, если кнопка "Новый диалог" не сработала)
        if (userId) {
            await redis.sadd(`user:${userId}:chats`, chatId);
        }

        // 3. ПОДГОТОВКА ПРАВИЛ
        const rulesArray = await redis.lrange('geminka:rules', 0, -1) || [];
        const rulesText = rulesArray.length > 0 ? "\n\nПРАВИЛА:\n" + rulesArray.join('\n') : "";

        // 4. ЗАПРОС К GEMINI
        // Важно: убедись, что getGeminiResponse внутри себя обрабатывает случай, 
        // когда в Redis по ключу history:chatId еще ничего нет.
        const responseText = await getGeminiResponse(chatId, text + rulesText);

        // 5. СОХРАНЕНИЕ (только если Gemini ответил)
        const timestamp = Date.now();
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));
        
        // Обновляем мету для списка диалогов
        await redis.hset(`chat:${chatId}:meta`, { 
            updatedAt: timestamp,
            name: text.substring(0, 25).trim() + (text.length > 25 ? "..." : "")
        });

        return res.status(200).json({ text: responseText });
    } catch (e) {
        console.error("SERVER ERROR 500:", e); // Это появится в логах Vercel
        return res.status(500).json({ error: e.message, stack: e.stack });
    }
}
