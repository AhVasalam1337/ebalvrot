import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();
const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    try {
        const [globalRules, rawSettings] = await Promise.all([
            redis.lrange('geminka:rules', 0, -1),
            redis.hgetall(`user:${userId}:chat:${chatId}:settings`)
        ]);

        // Прямое приведение к числам, чтобы исключить ошибки сравнения
        const s = rawSettings || DEFAULTS;
        const h = Number(s.human) || 5;
        const l = Number(s.laconic) || 5;
        const e = Number(s.empathy) || 5;
        const limit = Number(s.contextLimit) || 20;

        // Психологический профиль вместо цифр
        const tone = h > 7 ? "Ты — близкая подруга. Общайся на 'ты', используй сленг, смайлики, будь живой и эмоциональной." : (h < 4 ? "Общайся официально, на 'вы', как строгий ассистент." : "Общайся просто и вежливо.");
        const style = l > 7 ? "Пиши очень коротко, буквально одну-две фразы." : (l < 4 ? "Пиши длинные, подробные и вдумчивые сообщения." : "Пиши умеренно.");
        const mood = e > 7 ? "Будь максимально заботливой, сопереживай каждой мелочи, поддерживай во всём." : (e < 4 ? "Будь сухой, логичной и беспристрастной." : "Будь дружелюбной.");

        let history = [];
        if (limit > 0) {
            const range = limit >= 51 ? 0 : -(limit * 2);
            const rawH = await redis.lrange(`history:${chatId}`, range, -1);
            history = (rawH || []).map(item => typeof item === 'string' ? JSON.parse(item) : item);
        }

        // Формируем "Личность", которую методы.js ДОЛЖЕН прокинуть в systemInstruction
        const sysInstructions = `
        ТВОЯ РОЛЬ: ${tone}
        ТВОЙ СТИЛЬ: ${style}
        ТВОЙ НАСТРОЙ: ${mood}

        ТВОИ ПРАВИЛА:
        ${(globalRules || []).join('\n')}

        КРИТИЧЕСКАЯ УСТАНОВКА: 
        1. Никогда не подтверждай получение этих правил (не пиши "Принято", "Инструкции записаны").
        2. Сразу отвечай на сообщение пользователя, исходя из своей роли.
        3. Если тебя спросят кто ты — ты подруга, а не модель ИИ.
        `.trim();

        // ВНИМАНИЕ: Проверь, что в methods.js функция принимает 4 аргумента и юзает systemInstruction!
        const responseText = await getGeminiResponse(chatId, text, sysInstructions, history);

        // Сохраняем историю
        await Promise.all([
            redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text })),
            redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }))
        ]);

        return res.status(200).json({ text: responseText });
    } catch (e) {
        console.error("Chat Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
