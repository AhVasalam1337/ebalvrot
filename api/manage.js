import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

// Дефолтные настройки, чтобы фронтенд не падал при пустой базе
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
        // --- ПРАВИЛА ---
        if (action === 'rules') {
            const key = 'geminka:rules';
            if (method === 'GET') {
                const rules = await redis.lrange(key, 0, -1);
                // Гарантируем массив
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

        // --- ЧАТ (История и Настройки) ---
        if (action === 'chat') {
            if (!chatId || !userId) return res.status(400).json({ error: "Missing IDs" });

            const settingsKey = `user:${userId}:chat:${chatId}:settings`;
            const metaKey = `chat:${chatId}:meta`;
            const historyKey = `history:${chatId}`;

            if (method === 'GET') {
                const [rawHistory, settings, meta] = await Promise.all([
                    redis.lrange(historyKey, -50, -1),
                    redis.hgetall(settingsKey),
                    redis.hgetall(metaKey)
                ]);

                // Превращаем историю в чистый массив объектов, чтобы .map() на фронте не падал
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

                // Всегда отдаем валидные объекты, даже если в Redis пусто (после FLUSHDB)
                return res.status(200).json({ 
                    history: history, 
                    settings: (settings && Object.keys(settings).length > 0) ? settings : DEFAULTS, 
                    meta: (meta && Object.keys(meta).length > 0) ? meta : { name: "Новый диалог", updatedAt: Date.now() }
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
                // Обязательно добавляем ID в список чатов пользователя
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

        // --- СПИСОК ЧАТОВ ---
        if (action === 'list') {
            if (!userId) return res.status(200).json({ list: [] });
            
            const ids = await redis.smembers(`user:${userId}:chats`);
            if (!ids || ids.length === 0) return res.status(200).json({ list: [] });

            const list = await Promise.all(ids.map(async (id) => {
                const meta = await redis.hgetall(`chat:${id}:meta`);
                return { 
                    id, 
                    name: meta?.name || "Диалог", 
                    updatedAt: meta?.updatedAt ? parseInt(meta.updatedAt) : 0 
                };
            }));

            return res.status(200).json({ 
                list: list.sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0)) 
            });
        }

        return res.status(405).end();
    } catch (e) {
        console.error("Critical Manage Error:", e);
        // Аварийный выход: фронтенд получит пустые, но структурно верные данные
        return res.status(200).json({ 
            history: [], 
            settings: DEFAULTS, 
            meta: { name: "Ошибка" }, 
            list: [], 
            rules: [] 
        });
    }
}
