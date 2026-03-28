import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();
const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    const { method } = req;
    const { action, userId, chatId } = req.query;

    try {
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
                // Исправлено: удаление по значению
                await redis.lrem(key, 0, req.query.text);
                return res.status(200).json({ success: true });
            }
        }

        if (action === 'chat') {
            const settingsKey = `user:${userId}:chat:${chatId}:settings`;
            const metaKey = `chat:${chatId}:meta`;
            const historyKey = `history:${chatId}`;

            if (method === 'GET') {
                const [rawHistory, settings, meta] = await Promise.all([
                    redis.lrange(historyKey, -50, -1),
                    redis.hgetall(settingsKey),
                    redis.hgetall(metaKey)
                ]);

                const history = (rawHistory || []).map(item => {
                    try { return typeof item === 'string' ? JSON.parse(item) : item; }
                    catch (e) { return { role: 'user', text: String(item) }; }
                });

                return res.status(200).json({ 
                    history: history || [], 
                    settings: settings || DEFAULTS, 
                    meta: meta || { name: "Новый диалог" }
                });
            }

            if (method === 'POST') {
                const { name, settings } = req.body;
                if (name) await redis.hset(metaKey, { name, updatedAt: Date.now() });
                if (settings) {
                    await redis.hset(settingsKey, {
                        human: Number(settings.human) || 5,
                        laconic: Number(settings.laconic) || 5,
                        empathy: Number(settings.empathy) || 5,
                        contextLimit: Number(settings.contextLimit) || 20
                    });
                }
                await redis.sadd(`user:${userId}:chats`, chatId);
                return res.status(200).json({ success: true });
            }

            // НОВОЕ: ПОЛНАЯ ОЧИСТКА ЧАТА (Если всё пошло по пизде)
            if (method === 'DELETE') {
                await Promise.all([
                    redis.del(historyKey),
                    redis.del(settingsKey),
                    redis.del(metaKey),
                    redis.srem(`user:${userId}:chats`, chatId)
                ]);
                return res.status(200).json({ success: true });
            }
        }

        if (action === 'list') {
            const ids = await redis.smembers(`user:${userId}:chats`);
            if (!ids || ids.length === 0) return res.status(200).json({ list: [] });

            const list = await Promise.all(ids.map(async (id) => {
                const meta = await redis.hgetall(`chat:${id}:meta`);
                return { 
                    id, 
                    name: meta?.name || "Диалог", 
                    updatedAt: parseInt(meta?.updatedAt) || 0 
                };
            }));

            return res.status(200).json({ list: list.sort((a, b) => b.updatedAt - a.updatedAt) });
        }

        return res.status(405).end();
    } catch (e) {
        console.error("Manage Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
