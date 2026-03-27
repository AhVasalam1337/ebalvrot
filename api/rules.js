import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const { method, query } = req;
    const key = 'geminka:rules';

    try {
        if (method === 'GET') {
            const rules = await redis.lrange(key, 0, -1);
            // Возвращаем в формате, который ждет наш script.js
            return res.status(200).json({ 
                rules: rules.map((r, i) => ({ id: i.toString(), text: r })) 
            });
        }

        if (method === 'POST') {
            const { text } = req.body;
            await redis.rpush(key, text);
            return res.status(200).json({ success: true });
        }

        if (method === 'DELETE') {
            const { id } = query; // В Redis удаление из списка по индексу сложнее, но для начала:
            const rules = await redis.lrange(key, 0, -1);
            rules.splice(parseInt(id), 1);
            await redis.del(key);
            if (rules.length > 0) await redis.rpush(key, ...rules);
            return res.status(200).json({ success: true });
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
