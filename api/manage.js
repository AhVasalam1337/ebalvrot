import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    const { method } = req;
    const { action, userId, chatId, text } = req.query;

    try {
        // РАБОТА С ПРАВИЛАМИ (action=rules)
        if (action === 'rules') {
            const rulesKey = 'geminka:rules';
            if (method === 'GET') {
                const rules = await redis.lrange(rulesKey, 0, -1);
                return res.status(200).json({ rules: (rules || []).map((r, i) => ({ id: i, text: r })) });
            }
            if (method === 'POST') {
                const newRule = req.body.text || req.body.rule;
                if (newRule) await redis.rpush(rulesKey, newRule.trim());
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                // Если передаем текст правила в теле или в query
                const ruleToDelete = text || req.body.text;
                await redis.lrem(rulesKey, 0, ruleToDelete);
                return res.status(200).json({ success: true });
            }
        }

        // РАБОТА С КОНКРЕТНЫМ ЧАТОМ (action=chat)
        if (action === 'chat') {
            const settingsKey = `user:${userId}:chat:${chatId}:settings`;
            const metaKey = `chat:${chatId}:meta`;

            if (method === 'GET') {
                const [rawHistory, settings, meta] = await Promise.all([
                    redis.lrange(`history:${chatId}`, 0, 100),
                    redis.hgetall(settingsKey),
                    redis.hgetall(metaKey)
                ]);
                const history = (rawHistory || []).map(item => {
                    const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                    return { role: parsed.role, parts: [{ text: parsed.text }] };
                });
                return res.status(200).json({ history, settings: settings || DEFAULTS, meta });
            }
            if (method === 'POST') {
                const { name, settings } = req.body;
                if (name) await redis.hset(metaKey, { name, updatedAt: Date.now() });
                if (settings) await redis.hset(settingsKey, settings);
                return res.status(200).json({ success: true });
            }
            if (method === 'DELETE') {
                await Promise.all([
                    redis.srem(`user:${userId}:chats`, chatId),
                    redis.del(`history:${chatId}`, metaKey, settingsKey)
                ]);
                return res.status(200).json({ success: true });
            }
        }

        // СПИСОК ЧАТОВ (action=list)
        if (action === 'list') {
            const ids = await redis.smembers(`user:${userId}:chats`);
            if (!ids || ids.length === 0) return res.status(200).json({ list: [] });
            
            const list = await Promise.all(ids.map(async (id) => {
                const meta = await redis.hgetall(`chat:${id}:meta`);
                return { id, name: meta?.name || "Новый чат", updatedAt: parseInt(meta?.updatedAt) || 0 };
            }));
            return res.status(200).json({ list: list.sort((a, b) => b.updatedAt - a.updatedAt) });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: e.message });
    }
}
