import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    const { method, query: { action, userId, chatId } } = req;

    try {
        // 1. УПРАВЛЕНИЕ ДИАЛОГАМИ И ИСТОРИЕЙ
        if (action === 'chat') {
            if (method === 'GET') {
                // Загружаем ВСЁ за один раз: историю, настройки и мету
                const [rawHistory, settings, meta] = await Promise.all([
                    redis.lrange(`history:${chatId}`, 0, 100),
                    redis.hgetall(`user:${userId}:chat:${chatId}:settings`),
                    redis.hgetall(`chat:${chatId}:meta`)
                ]);
                const history = (rawHistory || []).map(item => {
                    const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                    return { role: parsed.role, parts: [{ text: parsed.text }] };
                });
                return res.status(200).json({ history, settings: settings || DEFAULTS, meta });
            }
            if (method === 'POST') {
                const { name, settings } = req.body;
                if (name) await redis.hset(`chat:${chatId}:meta`, { name, updatedAt: Date.now() });
                if (settings) await redis.hset(`user:${userId}:chat:${chatId}:settings`, settings);
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                await Promise.all([
                    redis.srem(`user:${userId}:chats`, chatId),
                    redis.del(`history:${chatId}`, `chat:${chatId}:meta`, `user:${userId}:chat:${chatId}:settings`)
                ]);
                return res.status(200).json({ success: true });
            }
        }

        // 2. СПИСОК ЧАТОВ
        if (action === 'list') {
            const chatIds = await redis.smembers(`user:${userId}:chats`);
            if (!chatIds.length) return res.status(200).json({ list: [] });
            const list = await Promise.all(chatIds.map(async (id) => {
                const meta = await redis.hgetall(`chat:${id}:meta`);
                return { id, name: meta?.name || "Чат", updatedAt: parseInt(meta?.updatedAt) || 0 };
            }));
            return res.status(200).json({ list: list.sort((a, b) => b.updatedAt - a.updatedAt) });
        }

        // 3. ПРАВИЛА
        if (action === 'rules') {
            const key = 'geminka:rules';
            if (method === 'GET') {
                const rules = await redis.lrange(key, 0, -1);
                return res.status(200).json({ rules: (rules || []).map((r, i) => ({ id: i, text: r })) });
            }
            if (method === 'POST') {
                await redis.rpush(key, req.body.text.trim());
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                await redis.lrem(key, 0, req.query.text);
                return res.status(200).json({ success: true });
            }
        }

        return res.status(405).end();
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
