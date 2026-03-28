import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { chatId, name } = req.body;

    try {
        await redis.hset(`chat:${chatId}:meta`, { name: name, updatedAt: Date.now() });
        return res.status(200).json({ success: true });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
