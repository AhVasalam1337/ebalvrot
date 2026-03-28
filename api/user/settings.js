import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    // Извлекаем ID из параметров запроса
    const { userId, chatId } = req.query;

    // Базовая проверка на наличие идентификаторов
    if (!userId || !chatId) {
        return res.status(400).json({ error: "Missing userId or chatId" });
    }

    // Тот самый ключ, по которому api/chat.js ищет настройки
    const settingsKey = `user:${userId}:chat:${chatId}:settings`;

    try {
        // МЕТОД GET: Загрузка настроек для отображения в интерфейсе
        if (req.method === 'GET') {
            const data = await redis.hgetall(settingsKey);
            
            // Если в базе пусто, отдаем "заводские" настройки
            if (!data) {
                return res.status(200).json({
                    laconic: 5,
                    empathy: 5,
                    human: 5,
                    contextLimit: 20
                });
            }
            
            return res.status(200).json(data);
        }

        // МЕТОД POST: Сохранение настроек из меню конфигурации
        if (req.method === 'POST') {
            const { settings } = req.body;

            if (!settings) {
                return res.status(400).json({ error: "No settings provided" });
            }

            // Принудительно парсим в числа, чтобы Redis не хранил их как строки
            // Это критично для логики "Золотой рыбки" (limit === 0)
            const cleanSettings = {
                laconic: parseInt(settings.laconic) || 5,
                empathy: parseInt(settings.empathy) || 5,
                human: parseInt(settings.human) || 5,
                contextLimit: parseInt(settings.contextLimit)
            };

            // Сохраняем объект в Redis (Hash Set)
            await redis.hset(settingsKey, cleanSettings);

            return res.status(200).json({ success: true, saved: cleanSettings });
        }

        // Если пришел какой-то другой метод (напр. DELETE или PUT)
        return res.status(405).json({ error: "Method not allowed" });

    } catch (error) {
        console.error("[SETTINGS ERROR]:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
}
