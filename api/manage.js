import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const DEFAULTS = { 
    laconic: 5, 
    empathy: 5, 
    human: 5, 
    contextLimit: 20 
};

export default async function handler(req, res) {
    const { method } = req;
    const { action, userId, chatId } = req.query;

    try {
        if (action === 'chat') {
            const settingsKey = `user:${userId}:chat:${chatId}:settings`;
            const metaKey = `chat:${chatId}:meta`;
            const historyKey = `history:${chatId}`;

            if (method === 'GET') {
                const [rawHistory, rawSettings, rawMeta] = await Promise.all([
                    redis.lrange(historyKey, -50, -1),
                    redis.hgetall(settingsKey),
                    redis.hgetall(metaKey)
                ]);

                // БЕЗОПАСНЫЙ ПАРСИНГ: Если один месседж битый, он просто пропустится, а не уронит всё
                const history = (rawHistory || []).reduce((acc, item) => {
                    try {
                        const p = typeof item === 'string' ? JSON.parse(item) : item;
                        acc.push({
                            role: p.role || 'user',
                            text: p.text || (p.parts ? p.parts[0].text : "") || String(item)
                        });
                    } catch (e) {
                        console.warn("Skip broken history item");
                    }
                    return acc;
                }, []);

                return res.status(200).json({ 
                    history: history, 
                    settings: rawSettings && Object.keys(rawSettings).length > 0 ? rawSettings : DEFAULTS, 
                    meta: rawMeta && Object.keys(rawMeta).length > 0 ? rawMeta : { name: "Новый диалог", updatedAt: Date.now() }
                });
            }

            if (method === 'POST') {
                const { name, settings } = req.body;
                if (name) await redis.hset(metaKey, { name: String(name), updatedAt: Date.now() });
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
        }

        if (action === 'list') {
            if (!userId) return res.status(200).json({ list: [] });
            const ids = await redis.smembers(`user:${userId}:chats`);
            if (!ids || ids.length === 0) return res.status(200).json({ list: [] });

            const list = await Promise.all(ids.map(async (id) => {
                const m = await redis.hgetall(`chat:${id}:meta`);
                return { 
                    id, 
                    name: String(m?.name || "Диалог"), 
                    updatedAt: Number(m?.updatedAt || 0) 
                };
            }));

            return res.status(200).json({ list: list.sort((a, b) => b.updatedAt - a.updatedAt) });
        }

        // Правила (action=rules) — оставляем как было, там всё ок
        if (action === 'rules') {
            const key = 'geminka:rules';
            if (method === 'GET') {
                const rules = await redis.lrange(key, 0, -1);
                return res.status(200).json({ rules: (rules || []).map((r, i) => ({ id: i, text: String(r) })) });
            }
            if (method === 'POST') {
                if (req.body.text) await redis.rpush(key, String(req.body.text));
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                await redis.lrem(key, 0, req.query.text);
                return res.status(200).json({ success: true });
            }
        }

        return res.status(405).end();
    } catch (e) {
        // Ловим всё, чтобы фронт не видел 500 ошибку
        return res.status(200).json({ history: [], settings: DEFAULTS, meta: { name: "Ошибка" }, list: [] });
    }
}
