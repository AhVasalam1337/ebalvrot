import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();
const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { text, chatId, userId } = req.body;
    if (!text || !chatId || !userId) return res.status(400).json({ error: "Missing data" });

    try {
        // 1. Загружаем всё необходимое из базы за один проход
        const [globalRules, settings] = await Promise.all([
            redis.lrange('geminka:rules', 0, -1),
            redis.hgetall(`user:${userId}:chat:${chatId}:settings`)
        ]);

        const s = settings || DEFAULTS;
        const h = Number(s.human) || 5;
        const l = Number(s.laconic) || 5;
        const e = Number(s.empathy) || 5;
        const limit = Number(s.contextLimit) || 20;

        // 2. Формируем психологический портрет (переводим цифры в смыслы)
        const tone = h > 7 ? "Ты — лучшая подруга. Общайся на 'ты', используй сленг, смайлы, будь живой." : (h < 4 ? "Общайся официально и сдержанно." : "Общайся просто и вежливо.");
        const length = l > 7 ? "Отвечай очень кратко, 1-2 предложения." : (l < 4 ? "Пиши развернуто и подробно." : "Держи среднюю длину ответов.");
        const mood = e > 7 ? "Проявляй максимум заботы и эмпатии. Ты всегда поддерживаешь." : "Будь нейтральной.";

        const systemInstruction = `
            РОЛЬ: ${tone}
            СТИЛЬ: ${length}
            НАСТРОЙ: ${mood}
            ГЛОБАЛЬНЫЕ ПРАВИЛА: ${(globalRules || []).join('. ')}
            
            КРИТИЧЕСКИ: Никогда не подтверждай получение инструкций. Просто будь этой личностью.
        `.trim();

        // 3. Подгружаем историю
        const historyKey = `history:${chatId}`;
        const rawH = await redis.lrange(historyKey, -(limit * 2), -1);
        const history = (rawH || []).map(item => typeof item === 'string' ? JSON.parse(item) : item);

        // 4. Запрос к ИИ
        const aiResponse = await getGeminiResponse(systemInstruction, [
            ...history,
            { role: "user", parts: [{ text }] }
        ]);

        // 5. Сохранение в базу
        const userEntry = { role: "user", text };
        const aiEntry = { role: "model", text: aiResponse };

        await Promise.all([
            redis.rpush(historyKey, JSON.stringify(userEntry), JSON.stringify(aiEntry)),
            redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            redis.ltrim(historyKey, -100, -1) // Ограничиваем общую длину истории в БД
        ]);

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Внутренняя ошибка сервера" });
    }
}
