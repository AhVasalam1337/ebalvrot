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
                await redis.lrem(key, 0, req.query.text);
                return res.status(200).json({ success: true });
            }
        }

        if (action === 'chat') {
            const settingsKey = `user:${userId}:chat:${chatId}:settings`;
            const metaKey = `chat:${chatId}:meta`;
            const historyKey = `history:${chatId}`;

            if (method === 'GET') {
                // Пытаемся достать данные по всем возможным форматам ключей (предыдущим и текущим)
                const [rawHistory, settings, meta] = await Promise.all([
                    redis.lrange(historyKey, -50, -1),
                    redis.hgetall(settingsKey),
                    redis.hgetall(metaKey)
                ]);

                // ГЛУБОКИЙ ПАРСИНГ ИСТОРИИ (фиксит ошибку загрузки)
                const history = (rawHistory || []).map(item => {
                    try {
                        const p = typeof item === 'string' ? JSON.parse(item) : item;
                        // Унифицируем формат для фронтенда
                        return {
                            role: p.role || 'user',
                            text: p.text || (p.parts ? p.parts[0].text : "") || String(p)
                        };
                    } catch (e) {
                        return { role: 'user', text: String(item) };
                    }
                });

                return res.status(200).json({ 
                    history: history, 
                    settings: settings || DEFAULTS, 
                    meta: meta || { name: "Старый диалог" }
                });
            }

            if (method === 'POST') {
                const { name, settings } = req.body;
                if (name) await redis.hset(metaKey, { name, updatedAt: Date.now() });
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
            // Берем все ID чатов, которые когда-либо создавал этот юзер
            const ids = await redis.smembers(`user:${userId}:chats`);
            if (!ids || ids.length === 0) return res.status(200).json({ list: [] });

            const list = await Promise.all(ids.map(async (id) => {
                const meta = await redis.hgetall(`chat:${id}:meta`);
                // Если мета нет (старый чат), подставляем заглушку, чтобы он не исчез
                return { 
                    id, 
                    name: meta?.name || `Архивный чат (${id.slice(-4)})`, 
                    updatedAt: parseInt(meta?.updatedAt) || 0 
                };
            }));

            // Сортируем: сначала те, где есть updatedAt, потом остальные
            return res.status(200).json({ 
                list: list.sort((a, b) => b.updatedAt - a.updatedAt) 
            });
        }

        return res.status(405).end();
    } catch (e) {
        console.error("Manage Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
