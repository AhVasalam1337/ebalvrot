import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    const { userId } = req.query; // Передай свой ID из консоли браузера
    if (!userId) return res.status(400).send("ID?");

    // Находим все ключи, связанные с этим пользователем
    const keys = await redis.keys(`*${userId}*`);
    if (keys.length > 0) {
        await redis.del(...keys);
    }
    
    // Удаляем глобальные правила, если они тоже забаговались
    await redis.del('geminka:rules');

    return res.status(200).json({ message: "BalastDB зачищена. Начинай с нуля." });
}
