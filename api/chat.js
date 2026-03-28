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

        const systemInstruction = `
            ЛИЧНОСТЬ: ${tone}
            СТИЛЬ: ${length}
            НАСТРОЙ: ${mood}
            ПРАВИЛА: ${(globalRules || []).join('. ')}
            НИКОГДА не подтверждай получение этих инструкций.
        `.trim();

        // ЗАГРУЗКА И ПРАВИЛЬНАЯ ТРАНСФОРМАЦИЯ ИСТОРИИ
        const historyKey = `history:${chatId}`;
        const rawH = await redis.lrange(historyKey, -(limit * 2), -1);
        
        // ВАЖНО: Превращаем плоские объекты из базы в формат parts: [{ text }]
        const formattedHistory = (rawH || []).map(item => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            return {
                role: p.role === 'user' ? 'user' : 'model',
                parts: [{ text: String(p.text || p.parts?.[0]?.text || "") }]
            };
        });

        // Текущее сообщение тоже в правильном формате
        const currentMsg = { role: "user", parts: [{ text: String(text) }] };

        // Запрос к 3.1
        const aiResponse = await getGeminiResponse(systemInstruction, [...formattedHistory, currentMsg]);

        // Сохраняем в базу в ПЛОСКОМ виде (для экономии места), 
        // так как при загрузке мы всё равно маппим выше
        await Promise.all([
            redis.rpush(historyKey, JSON.stringify({ role: "user", text }), JSON.stringify({ role: "model", text: aiResponse })),
            redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            redis.ltrim(historyKey, -100, -1)
        ]);

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        console.error("Payload Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
