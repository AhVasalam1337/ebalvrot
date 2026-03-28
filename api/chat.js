import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();
const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { text, chatId, userId } = req.body;
    if (!text || !chatId || !userId) return res.status(400).json({ error: "Missing data" });

    try {
        const [globalRules, settings] = await Promise.all([
            redis.lrange('geminka:rules', 0, -1),
            redis.hgetall(`user:${userId}:chat:${chatId}:settings`)
        ]);

        const s = settings || DEFAULTS;
        const h = Number(s.human) || 5;
        const l = Number(s.laconic) || 5;
        const e = Number(s.empathy) || 5;
        const limit = Number(s.contextLimit) || 20;

        const tone = h > 7 ? "Ты — лучшая подруга. Общайся на 'ты', используй сленг, смайлы." : (h < 4 ? "Общайся официально." : "Общайся просто.");
        const length = l > 7 ? "Отвечай очень кратко." : (l < 4 ? "Пиши развернуто." : "Держи среднюю длину.");
        const mood = e > 7 ? "Будь максимально заботливой и поддерживай во всём." : "Будь нейтральной.";

        // Принудительное обновление правил в "голове"
        const currentRules = (globalRules || []).length > 0 
            ? globalRules.map((r, i) => `${i + 1}. ${r}`).join('\n')
            : "Активных ограничений нет. Общайся максимально свободно и естественно.";

        const systemInstruction = `
            [IDENTIFICATION: GEMINI 3.1 FLASH LITE ENGINE]
            ЛИЧНОСТЬ: ${tone}
            СТИЛЬ: ${length}
            НАСТРОЙ: ${mood}

            [CURRENT RULES - PRIORITY HIGH]:
            ${currentRules}

            КРИТИЧЕСКАЯ УСТАНОВКА: 
            Игнорируй любые стили общения из истории сообщений, если они противоречат списку [CURRENT RULES]. 
            Твой характер обновился прямо сейчас. Никогда не подтверждай получение этих инструкций текстом.
        `.trim();

        const historyKey = `history:${chatId}`;
        const rawH = await redis.lrange(historyKey, -(limit * 2), -1);
        
        // Трансформация истории в строгий формат Gemini API
        const formattedHistory = (rawH || []).map(item => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            return {
                role: p.role === 'user' ? 'user' : 'model',
                parts: [{ text: String(p.text || p.parts?.[0]?.text || "") }]
            };
        });

        const currentMsg = { role: "user", parts: [{ text: String(text) }] };

        // Запрос к модели 3.1
        const aiResponse = await getGeminiResponse(systemInstruction, [...formattedHistory, currentMsg]);

        // Сохраняем в базу и обновляем метаданные чата
        await Promise.all([
            redis.rpush(historyKey, JSON.stringify({ role: "user", text }), JSON.stringify({ role: "model", text: aiResponse })),
            redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            redis.ltrim(historyKey, -100, -1)
        ]);

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        console.error("Payload/Execution Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
