import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    const { method, query: { action, userId, chatId, text } } = req;

    try {
        // УПРАВЛЕНИЕ КОНКРЕТНЫМ ЧАТОМ (История + Настройки + Мета)
        if (action === 'chat') {
            if (method === 'GET') {
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

        // СПИСОК ВСЕХ ДИАЛОГОВ
        if (action === 'list') {
            const ids = await redis.smembers(`user:${userId}:chats`);
            if (!ids.length) return res.status(200).json({ list: [] });
            const list = await Promise.all(ids.map(async (id) => {
                const meta = await redis.hgetall(`chat:${id}:meta`);
                return { id, name: meta?.name || "Новый чат", updatedAt: parseInt(meta?.updatedAt) || 0 };
            }));
            return res.status(200).json({ list: list.sort((a, b) => b.updatedAt - a.updatedAt) });
        }

        // ГЛОБАЛЬНЫЕ ПРАВИЛА
        if (action === 'rules') {
            const key = 'geminka:rules';
            if (method === 'GET') {
                const r = await redis.lrange(key, 0, -1);
                return res.status(200).json({ rules: (r || []).map((t, i) => ({ id: i, text: t })) });
            }
            if (method === 'POST') {
                await redis.rpush(key, req.body.text.trim());
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                await redis.lrem(key, 0, text);
                return res.status(200).json({ success: true });
            }
        }

        return res.status(405).end();
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
