import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    const { method, query: { action, userId, chatId, text } } = req;

    // Базовая проверка авторизации
    if (!userId || userId === 'null' || userId === 'undefined') {
        return res.status(200).json({ list: [] });
    }

    try {
        // --- ПОЛУЧЕНИЕ СПИСКА ДИАЛОГОВ ---
        if (action === 'list') {
            const ids = await kv.smembers(`user:${userId}:chats`);
            if (!ids || ids.length === 0) return res.status(200).json({ list: [] });

            const list = await Promise.all(ids.map(async (id) => {
                try {
                    const meta = await kv.hgetall(`chat:${id}:meta`);
                    return { 
                        id, 
                        name: meta?.name || "Новый диалог", 
                        updatedAt: Number(meta?.updatedAt || 0) 
                    };
                } catch (e) {
                    return { id, name: "Ошибка загрузки", updatedAt: 0 };
                }
            }));

            const sortedList = list
                .filter(i => i && i.id)
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

                // Привязываем чат к юзеру, если еще не привязан
                await kv.sadd(`user:${userId}:chats`, chatId);

                return res.status(200).json({
                    history: history || [],
                    settings: settings || { laconic: 5, empathy: 5, human: 5, contextLimit: 20 },
                    meta: meta || { name: "Диалог", updatedAt: Date.now() }
                });
            }

            if (method === 'POST') {
                const body = req.body || {};
                if (body.name) {
                    await kv.hset(`chat:${chatId}:meta`, { name: body.name, updatedAt: Date.now() });
                }
                if (body.settings) {
                    await kv.hset(`user:${userId}:chat:${chatId}:settings`, body.settings);
                }
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
                const formattedRules = (rules || []).map((r, i) => {
                    // Обработка случая, если правило сохранено как JSON-строка
                    let content = r;
                    try { content = JSON.parse(r).text || r; } catch(e) {}
                    return { id: i, text: content };
                });
                return res.status(200).json({ rules: formattedRules });
            }
            if (method === 'POST') {
                if (req.body && req.body.text) {
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

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error("KV Management Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
