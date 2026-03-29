import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    const { method, query: { action, userId, chatId, text } } = req;

    if (!userId || userId === 'null' || userId === 'undefined') {
        return res.status(200).json({ list: [] });
    }

    try {
        // --- ПОЛУЧЕНИЕ СПИСКА ДИАЛОГОВ ---
        if (action === 'list') {
            const ids = await kv.smembers(`user:${userId}:chats`);
            if (!ids || ids.length === 0) return res.status(200).json({ list: [] });

            const list = await Promise.all(ids.map(async (id) => {
                const meta = await kv.hgetall(`chat:${id}:meta`);
                return { 
                    id, 
                    name: meta?.name || "Новый диалог", 
                    updatedAt: Number(meta?.updatedAt || 0) 
                };
            }));

            // Сортируем: новые сверху
            const sortedList = list
                .filter(i => i.id)
                .sort((a, b) => b.updatedAt - a.updatedAt);

            return res.status(200).json({ list: sortedList });
        }

        // --- УПРАВЛЕНИЕ КОНКРЕТНЫМ ЧАТОМ ---
        if (action === 'chat') {
            if (!chatId) return res.status(400).json({ error: "Missing chatId" });

            if (method === 'GET') {
                const [history, settings, meta] = await Promise.all([
                    kv.lrange(`history:${chatId}`, 0, -1),
                    kv.hgetall(`user:${userId}:chat:${chatId}:settings`),
                    kv.hgetall(`chat:${chatId}:meta`)
                ]);

                // Гарантируем связь пользователя с этим чатом
                await kv.sadd(`user:${userId}:chats`, chatId);

                return res.status(200).json({
                    history: history || [],
                    settings: settings || { laconic: 5, empathy: 5, human: 5, contextLimit: 20 },
                    meta: meta || { name: "Диалог", updatedAt: Date.now() }
                });
            }

            if (method === 'POST') {
                const { name, settings } = req.body || {};
                if (name) {
                    await kv.hset(`chat:${chatId}:meta`, { name, updatedAt: Date.now() });
                }
                if (settings) {
                    await kv.hset(`user:${userId}:chat:${chatId}:settings`, settings);
                }
                // При любом обновлении добавляем в список чатов пользователя
                await kv.sadd(`user:${userId}:chats`, chatId);
                return res.status(200).json({ success: true });
            }

            if (method === 'DELETE') {
                await Promise.all([
                    kv.del(`history:${chatId}`),
                    kv.del(`chat:${chatId}:meta`),
                    kv.del(`user:${userId}:chat:${chatId}:settings`),
                    kv.srem(`user:${userId}:chats`, chatId)
                ]);
                return res.status(200).json({ success: true });
            }
        }

        // --- СИСТЕМНЫЕ ПРАВИЛА ---
        if (action === 'rules') {
            const rulesKey = 'geminka:rules';
            if (method === 'GET') {
                const rules = await kv.lrange(rulesKey, 0, -1);
                return res.status(200).json({ rules: (rules || []).map((r, i) => ({ id: i, text: r })) });
            }
            if (method === 'POST') {
                if (req.body.text) {
                    await kv.rpush(rulesKey, req.body.text);
                }
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                if (text) {
                    await kv.lrem(rulesKey, 0, decodeURIComponent(text));
                }
                return res.status(200).json({ success: true });
            }
        }

        return res.status(405).end();
    } catch (e) {
        console.error("KV Management Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
