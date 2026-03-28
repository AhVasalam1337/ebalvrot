import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { userId, chatId } = req.query;

    try {
        // УДАЛЕНИЕ ДИАЛОГА
        if (req.method === 'DELETE') {
            if (!userId || !chatId) return res.status(400).json({ error: "Missing data" });
            // Удаляем из списка пользователя
            await redis.srem(`user:${userId}:chats`, chatId);
            // Удаляем саму историю и мету (опционально, для чистоты базы)
            await redis.del(`history:${chatId}`, `chat:${chatId}:meta`);
            return res.status(200).json({ success: true });
        }

        // ПОЛУЧЕНИЕ СПИСКА
        if (req.method === 'GET') {
            if (!userId) return res.status(400).json({ error: "Missing userId" });
            const chatIds = await redis.smembers(`user:${userId}:chats`);
            if (!chatIds.length) return res.status(200).json({ list: [] });

            const list = await Promise.all(chatIds.map(async (id) => {
                const meta = await redis.hgetall(`chat:${id}:meta`);
                return {
                    id: id,
                    name: meta?.name || `Чат ${id.slice(-4)}`,
                    updatedAt: parseInt(meta?.updatedAt) || Date.now()
                };
            }));
            list.sort((a, b) => b.updatedAt - a.updatedAt);
            return res.status(200).json({ list });
        }
        
        // СОЗДАНИЕ ПУСТОГО ЧАТА (чтобы он сразу был в списке)
        if (req.method === 'POST') {
            const { userId, chatId } = req.body;
            await redis.sadd(`user:${userId}:chats`, chatId);
            await redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now(), name: "Новый чат" });
            return res.status(200).json({ success: true });
        }

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
