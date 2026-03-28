import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const { userId, chatId } = req.query;
    if (!userId || !chatId) return res.status(400).json({ error: "No IDs" });

    // Уникальный ключ для настроек КОНКРЕТНОГО чата
    const key = `user:${userId}:chat:${chatId}:settings`;

    if (req.method === 'GET') {
        const settings = await redis.hgetall(key);
        // Если настроек нет, отдаем дефолт
        return res.status(200).json(settings || { laconic: 5, empathy: 5, human: 5, contextLimit: 20 });
    }

    if (req.method === 'POST') {
        const { settings } = req.body;
        // Чистим данные перед сохранением, чтобы contextLimit был числом
        const cleanSettings = {
            laconic: parseInt(settings.laconic),
            empathy: parseInt(settings.empathy),
            human: parseInt(settings.human),
            contextLimit: parseInt(settings.contextLimit)
        };
        await redis.hset(key, cleanSettings);
        return res.status(200).json({ success: true });
    }

    return res.status(405).end();
}
