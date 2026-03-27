import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); // Автоматически берет UPSTASH_REDIS_REST_URL и TOKEN

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { chatId } = req.query;

    if (!chatId) return res.status(400).json({ error: "No chatId" });

    try {
        // В Redis мы храним историю как LIST под ключом history:chatId
        const historyData = await redis.lrange(`history:${chatId}`, 0, 100);
        
        // Redis возвращает строки, парсим их в объекты
        const history = historyData.map(item => {
            const parsed = typeof item === 'string' ? JSON.parse(item) : item;
            return {
                role: parsed.role,
                parts: [{ text: parsed.text }]
            };
        });

        return res.status(200).json({ history: history || [] });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
