import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const key = 'geminka:rules'; // Глобальный ключ для всех чатов и юзеров

    try {
        if (req.method === 'GET') {
            const rules = await redis.lrange(key, 0, -1) || [];
            // Отдаем массив объектов, где ID — это просто индекс для фронтенда, 
            // но текст — это наш главный ориентир.
            return res.status(200).json({ 
                rules: rules.map((r, i) => ({ id: i, text: r })) 
            });
        }

        if (req.method === 'POST') {
            const { text } = req.body;
            if (!text || text.trim() === "") return res.status(400).json({ error: "Empty rule" });
            
            // Добавляем в конец списка
            await redis.rpush(key, text.trim());
            return res.status(200).json({ success: true });
        }

        if (req.method === 'DELETE') {
            const { text } = req.query; // Удаляем по тексту, а не по индексу!
            if (!text) return res.status(400).json({ error: "No text provided" });

            // LREM удаляет конкретное значение из списка. 
            // 0 означает "удалить все вхождения этого текста"
            await redis.lrem(key, 0, text);
            return res.status(200).json({ success: true });
        }

        return res.status(405).end();
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
