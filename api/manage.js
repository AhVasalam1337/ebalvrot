import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const { method } = req;
    const { action, userId, chatId } = req.query;

    try {
        // Управление правилами
        if (action === 'rules') {
            const key = 'geminka:rules';
            if (method === 'GET') {
                const rules = await redis.lrange(key, 0, -1);
                return res.status(200).json({ rules: (rules || []).map((r, i) => ({ id: i, text: r })) });
            }
            if (method === 'POST') {
                await redis.rpush(key, req.body.text);
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                await redis.lrem(key, 0, req.query.text);
                return res.status(200).json({ success: true });
            }
        }

        // Управление чатами и настройками
        if (action === 'chat') {
            const settingsKey = `user:${userId}:chat:${chatId}:settings`;
            const metaKey = `chat:${chatId}:meta`;

            if (method === 'GET') {
                const [history, settings, meta] = await Promise.all([
                    redis.lrange(`history:${chatId}`, -20, -1),
                    redis.hgetall(settingsKey),
                    redis.hgetall(metaKey)
                ]);
                return res.status(200).json({ 
                    history: (history || []).map(i => JSON.parse(i)), 
                    settings: settings || {}, 
                    meta 
                });
            }
            if (method === 'POST') {
                const { name, settings } = req.body;
                if (name) await redis.hset(metaKey, { name, updatedAt: Date.now() });
                if (settings) await redis.hset(settingsKey, settings);
                // Добавляем ID чата в список чатов пользователя
                await redis.sadd(`user:${userId}:chats`, chatId);
                return res.status(200).json({ success: true });
            }
        }

        // Список чатов
        if (action === 'list') {
            const ids = await redis.smembers(`user:${userId}:chats`);
            const list = await Promise.all((ids || []).map(async (id) => {
                const meta = await redis.hgetall(`chat:${id}:meta`);
                return { id, name: meta?.name || "Диалог", updatedAt: meta?.updatedAt || 0 };
            }));
            return res.status(200).json({ list: list.sort((a, b) => b.updatedAt - a.updatedAt) });
        }

        return res.status(405).end();
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
