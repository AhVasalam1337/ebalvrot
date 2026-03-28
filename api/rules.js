import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const key = 'geminka:rules'; // Единый ключ для всех чатов

    if (req.method === 'GET') {
        const rules = await redis.lrange(key, 0, -1);
        return res.status(200).json({ rules: rules.map((r, i) => ({ id: i, text: r })) });
    }

    if (req.method === 'POST') {
        const { text } = req.body;
        await redis.rpush(key, text);
        return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
        const { id } = req.query;
        const rules = await redis.lrange(key, 0, -1);
        rules.splice(id, 1);
        await redis.del(key);
        if (rules.length > 0) await redis.rpush(key, ...rules);
        return res.status(200).json({ success: true });
    }
}
