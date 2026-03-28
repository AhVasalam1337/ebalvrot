import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const { userId, chatId } = req.query;
    const key = `user:${userId}:chat:${chatId}:settings`;

    if (req.method === 'GET') {
        const settings = await redis.hgetall(key);
        return res.status(200).json(settings || { laconic: 5, empathy: 5, human: 5, contextLimit: 20 });
    }

    if (req.method === 'POST') {
        const { settings } = req.body;
        await redis.hset(key, settings);
        return res.status(200).json({ success: true });
    }

    return res.status(405).end();
}
