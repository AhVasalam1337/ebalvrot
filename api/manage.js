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
        // 1. ПРАВИЛА
        if (action === 'rules') {
            const key = 'geminka:rules';
            if (method === 'GET') {
                const rules = await redis.lrange(key, 0, -1);
                return res.status(200).json({ 
                    rules: (rules || []).map((r, i) => ({ id: i, text: String(r) })) 
                });
            }
            if (method === 'POST') {
                if (req.body && req.body.text) {
                    await redis.rpush(key, String(req.body.text));
                }
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                await redis.lrem(key, 0, req.query.text);
                return res.status(200).json({ success: true });
            }
        }

        // 2. ЧАТ (История и Настройки)
        if (action === 'chat') {
            if (!chatId || !userId) {
                return res.status(200).json({ history: [], settings: DEFAULTS, meta: { name: "Новый чат" } });
            }

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
                        return {
                            role: p.role || 'user',
                            text: t,
                            parts: [{ text: t }] // Для совместимости с твоим script.js
                        };
                    } catch (e) {
                        return { role: 'user', text: String(item), parts: [{ text: String(item) }] };
                    }
                });

                return res.status(200).json({ 
                    history: history, 
                    settings: (rawSettings && rawSettings.human) ? rawSettings : DEFAULTS, 
                    meta: (rawMeta && rawMeta.name) ? rawMeta : { name: "Новый диалог", updatedAt: Date.now() }
                });
            }

            if (method === 'POST') {
                const { name, settings } = req.body || {};
                if (name) {
                    await redis.hset(metaKey, { name: String(name), updatedAt: Date.now() });
                }
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

        // 3. СПИСОК ЧАТОВ
        if (action === 'list') {
            if (!userId) return res.status(200).json({ list: [] });
            const ids = await redis.smembers(`user:${userId}:chats`);
            if (!ids || ids.length === 0) return res.status(200).json({ list: [] });

            const list = await Promise.all(ids.map(async (id) => {
                const m = await redis.hgetall(`chat:${id}:meta`);
                return { 
                    id: id, 
                    name: String(m?.name || "Диалог"), 
                    updatedAt: Number(m?.updatedAt || 0) 
                };
            }));

            return res.status(200).json({ 
                list: list.sort((a, b) => b.updatedAt - a.updatedAt) 
            });
        }

        return res.status(405).end();
    } catch (err) {
        console.error("API Error:", err);
        // Отдаем 200 с пустыми данными, чтобы фронт не вис на "Ошибке загрузки"
        return res.status(200).json({ history: [], settings: DEFAULTS, list: [], rules: [] });
    }
}
