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
                return res.status(200).json({ rules: (rules || []).map((r, i) => ({ id: i, text: String(r) })) });
            }
            if (method === 'POST') {
                if (req.body && req.body.text) await redis.rpush(key, String(req.body.text));
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                // Фикс: удаляем конкретный текст правила
                const ruleToDelete = req.query.text;
                if (ruleToDelete) await redis.lrem(key, 0, ruleToDelete);
                return res.status(200).json({ success: true });
            }
        }

        if (action === 'chat') {
            if (!chatId || !userId) return res.status(200).json({ history: [], settings: DEFAULTS, meta: { name: "Новый чат" } });
            const settingsKey = `user:${userId}:chat:${chatId}:settings`;
            const metaKey = `chat:${chatId}:meta`;
            const historyKey = `history:${chatId}`;

            if (method === 'GET') {
                const [rawHistory, rawSettings, rawMeta] = await Promise.all([
                    redis.lrange(historyKey, -50, -1),
                    redis.hgetall(settingsKey),
                    redis.hgetall(metaKey)
                ]);
                const history = (rawHistory || []).map(item => {
                    try {
                        const p = typeof item === 'string' ? JSON.parse(item) : item;
                        const t = p.text || (p.parts && p.parts[0] ? p.parts[0].text : String(item));
                        return { role: p.role || 'user', text: t, parts: [{ text: t }] };
                    } catch (e) { return { role: 'user', text: String(item), parts: [{ text: String(item) }] }; }
                });
                return res.status(200).json({ 
                    history, 
                    settings: (rawSettings && rawSettings.human !== undefined) ? rawSettings : DEFAULTS, 
                    meta: (rawMeta && rawMeta.name) ? rawMeta : { name: "Новый диалог", updatedAt: Date.now() }
                });
            }
            if (method === 'POST') {
                const { name, settings } = req.body || {};
                // Теперь имя чата сохраняется навсегда через этот метод
                if (name) await redis.hset(metaKey, { name: String(name), updatedAt: Date.now() });
                if (settings) {
                    await redis.hset(settingsKey, {
                        human: Number(settings.human),
                        laconic: Number(settings.laconic),
                        empathy: Number(settings.empathy),
                        contextLimit: Number(settings.contextLimit)
                    });
                }
                await redis.sadd(`user:${userId}:chats`, chatId);
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                await Promise.all([redis.del(historyKey), redis.del(settingsKey), redis.del(metaKey), redis.srem(`user:${userId}:chats`, chatId)]);
                return res.status(200).json({ success: true });
            }
        }

        if (action === 'list') {
            const ids = await redis.smembers(`user:${userId}:chats`);
            if (!ids || ids.length === 0) return res.status(200).json({ list: [] });
            const list = await Promise.all(ids.map(async (id) => {
                const m = await redis.hgetall(`chat:${id}:meta`);
                return { id, name: String(m?.name || "Диалог"), updatedAt: Number(m?.updatedAt || 0) };
            }));
            return res.status(200).json({ list: list.sort((a, b) => b.updatedAt - a.updatedAt) });
        }
        return res.status(405).end();
    } catch (err) { return res.status(200).json({ history: [], settings: DEFAULTS, list: [], rules: [] }); }
}
