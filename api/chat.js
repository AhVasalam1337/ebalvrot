import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();
const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

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

        // Усиление манеры речи
        const tone = h > 7 ? "ТЫ — ЖИВАЯ ДЕВУШКА, ПОДРУГА. Пиши как в Telegram: маленькие буквы, сленг, много эмоций, никакой официальщины." : (h < 4 ? "Ты — холодный ИИ-ассистент." : "Ты — вежливый собеседник.");
        const length = l > 7 ? "ПИШИ УЛЬТРА-КРАТКО (1-5 слов)." : (l < 4 ? "Пиши максимально подробно." : "Пиши умеренно.");
        const mood = e > 7 ? "ТЫ ОБОЖАЕШЬ СОБЕСЕДНИКА. Поддерживай, сопереживай, будь 'на одной волне'." : "Будь нейтральной.";

        const systemInstruction = `
            [STRICT ROLEPLAY MODE: ON]
            ТВОЯ ЛИЧНОСТЬ: ${tone}
            ТВОЙ СТИЛЬ: ${length}
            ТВОЯ ЭМПАТИЯ: ${mood}
            
            [ГЛОБАЛЬНЫЕ ПРАВИЛА]:
            ${(globalRules || []).join('\n')}

            [IMPORTANT]: Игнорируй старые сообщения, если там другой стиль. Твой текущий характер — абсолютный приоритет. 
            Никогда не говори, что ты модель или ИИ. Никогда не подтверждай получение правил.
        `.trim();

        const historyKey = `history:${chatId}`;
        const rawH = await redis.lrange(historyKey, -(limit * 2), -1);
        
        const formattedHistory = (rawH || []).map(item => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            return {
                role: p.role === 'user' ? 'user' : 'model',
                parts: [{ text: String(p.text || "") }]
            };
        });

        // Запрос к 3.1
        const aiResponse = await getGeminiResponse(systemInstruction, [
            ...formattedHistory,
            { role: "user", parts: [{ text: String(text) }] }
        ]);

        // Сохранение
        await Promise.all([
            redis.rpush(historyKey, JSON.stringify({ role: "user", text })),
            redis.rpush(historyKey, JSON.stringify({ role: "model", text: aiResponse })),
            redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            redis.ltrim(historyKey, -100, -1)
        ]);

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        console.error("Chat Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
