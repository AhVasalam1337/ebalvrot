import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    // Вытаскиваем данные из тела запроса
    const { text, chatId, userId } = req.body;

    if (!chatId || !userId) {
        return res.status(400).json({ error: "Missing chatId or userId" });
    }

    try {
        // 1. Пытаемся загрузить настройки КОНКРЕТНОГО чата
        // Ключ: user:{userId}:chat:{chatId}:settings
        let settings = await redis.hgetall(`user:${userId}:chat:${chatId}:settings`);
        
        // Если настроек нет (новый чат), ставим дефолт
        if (!settings) {
            settings = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };
        }

        // 2. Формируем инструкцию на основе актуальных настроек
        const systemInstruction = `
        CURRENT CHAT CONSTRAINTS:
        - LACONICISM: ${settings.laconic}/10
        - EMPATHY: ${settings.empathy}/10
        - HUMANITY: ${settings.human}/10
        
        GLOBAL RULES:
        ${(await redis.lrange('geminka:rules', 0, -1) || []).join('\n')}
        `;

        // 3. СТРОГАЯ ЛОГИКА КОНТЕКСТА (Золотая рыбка живет здесь)
        const limit = parseInt(settings.contextLimit);
        let history = [];

        if (limit === 0) {
            // РЕЖИМ ЗОЛОТОЙ РЫБКИ: История пуста, Gemini видит только текущее сообщение
            history = []; 
        } else if (limit >= 51) {
            // БЕСКОНЕЧНОСТЬ: Грузим всё
            history = await redis.lrange(`history:${chatId}`, 0, -1) || [];
        } else {
            // ЛИМИТ: Берем последние N сообщений
            // Redis lrange берет индексы, каждое сообщение - это 1 роль (user/model)
            // Чтобы получить 20 "диалогов", нужно взять 40 записей
            history = await redis.lrange(`history:${chatId}`, -(limit * 2), -1) || [];
        }

        // Парсим историю из JSON строк
        const parsedHistory = history.map(item => typeof item === 'string' ? JSON.parse(item) : item);

        // 4. Запрос к нейронке
        const responseText = await getGeminiResponse(chatId, text, systemInstruction, parsedHistory);

        // 5. Сохраняем в базу (даже если рыбка включена, пишем для логов и будущего)
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));
        
        return res.status(200).json({ text: responseText });

    } catch (e) {
        console.error("API ERROR:", e);
        return res.status(500).json({ error: "Internal Server Error", details: e.message });
    }
}
