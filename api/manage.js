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
        // --- РАБОТА С ЧАТОМ (История, Настройки, Мета) ---
        if (action === 'chat') {
            if (!chatId || !userId) return res.status(200).json({ history: [], settings: DEFAULTS, meta: { name: "Нет ID" } });

            const settingsKey = `user:${userId}:chat:${chatId}:settings`;
            const metaKey = `chat:${chatId}:meta`;
            const historyKey = `history:${chatId}`;

            if (method === 'GET') {
                const [rawHistory, rawSettings, rawMeta] = await Promise.all([
                    redis.lrange(historyKey, -50, -1),
                    redis.hgetall(settingsKey),
                    redis.hgetall(metaKey)
                ]);

                // 1. Формируем историю (всегда массив)
                const history = (rawHistory || []).map(item => {
                    try {
                        const p = typeof item === 'string' ? JSON.parse(item) : item;
                        return {
                            role: p.role || 'user',
                            text: p.text || (p.parts ? p.parts[0].text : "") || String(p)
                        };
                    } catch (e) {
                        return { role: 'user', text: String(item) };
                    }
                });

                // 2. Формируем настройки (всегда объект с числами)
                const settings = {
                    human: Number(rawSettings?.human || DEFAULTS.human),
                    laconic: Number(rawSettings?.laconic || DEFAULTS.laconic),
                    empathy: Number(rawSettings?.empathy || DEFAULTS.empathy),
                    contextLimit: Number(rawSettings?.contextLimit || DEFAULTS.contextLimit)
                };

                // 3. Формируем мета (всегда объект с именем)
                const meta = {
                    name: String(rawMeta?.name || "Новый диалог"),
                    updatedAt: Number(rawMeta?.updatedAt || Date.now())
                };

                return res.status(200).json({ history, settings, meta });
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

        // --- СПИСОК ЧАТОВ ---
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

        // --- ПРАВИЛА ---
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
        console.error("MOBILE_DEBUG_ERROR:", e.message);
        return res.status(200).json({ history: [], settings: DEFAULTS, meta: { name: "Ошибка" }, list: [] });
    }
}
