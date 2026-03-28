import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const { userId } = req.query;
    if (req.method === 'GET') {
        const s = await redis.hgetall(`user:${userId}:settings`);
        return res.status(200).json(s || { laconic: 5, empathy: 5, human: 5, contextLimit: 20 });
    }
    if (req.method === 'POST') {
        const { settings } = req.body;
        await redis.hset(`user:${userId}:settings`, settings);
        return res.status(200).json({ success: true });
    }
}
