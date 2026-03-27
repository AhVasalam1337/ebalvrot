import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    // Настройка CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    try {
        // 1. Получаем список всех chat_id для этого пользователя
        // Мы храним их в Set (множестве), чтобы ID не дублировались
        const chatIds = await redis.smembers(`user:${userId}:chats`);

        if (!chatIds || chatIds.length === 0) {
            return res.status(200).json({ list: [] });
        }

        // 2. Получаем метаданные для каждого чата (например, имя)
        // Если метаданных нет, создаем дефолтное имя
        const list = await Promise.all(chatIds.map(async (id) => {
            const meta = await redis.hgetall(`chat:${id}:meta`);
            return {
                id: id,
                name: meta?.name || `Чат ${id.substring(0, 5)}`,
                updatedAt: meta?.updatedAt || Date.now()
            };
        }));

        // Сортируем по дате (свежие сверху)
        list.sort((a, b) => b.updatedAt - a.updatedAt);

        return res.status(200).json({ list });
    } catch (error) {
        console.error("Redis Dialogs Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
