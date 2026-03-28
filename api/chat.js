import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();
const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    if (!chatId || !userId) return res.status(400).json({ error: "Missing IDs" });

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

        const systemInstruction = `
            [STRICT ROLEPLAY]
            Tone: ${h > 7 ? "Girlfriend/Friend" : "Assistant"}
            Style: ${l > 7 ? "Short" : "Normal"}
            Rules: ${(globalRules || []).join('\n')}
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

        const aiResponse = await getGeminiResponse(systemInstruction, [
            ...formattedHistory,
            { role: "user", parts: [{ text: String(text) }] }
        ]);

        // ПРИНУДИТЕЛЬНАЯ ЗАПИСЬ ВСЕХ СВЯЗЕЙ
        await Promise.all([
            // Сохраняем сообщение пользователя
            redis.rpush(historyKey, JSON.stringify({ role: "user", text })),
            // Сохраняем ответ нейронки
            redis.rpush(historyKey, JSON.stringify({ role: "model", text: aiResponse })),
            // Обновляем мету (чтобы чат поднялся в списке)
            redis.hset(`chat:${chatId}:meta`, { 
                name: text.slice(0, 30), 
                updatedAt: Date.now() 
            }),
            // Добавляем ID чата в список чатов пользователя (БЕЗ ЭТОГО ОН НЕ ПОЯВИТСЯ В СПИСКЕ)
            redis.sadd(`user:${userId}:chats`, chatId),
            // Ограничиваем историю
            redis.ltrim(historyKey, -100, -1)
        ]);

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        console.error("Chat Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
