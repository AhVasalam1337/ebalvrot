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
        const h = Number(s.human || 5);
        const l = Number(s.laconic || 5);
        const e = Number(s.empathy || 5);
        const limit = Number(s.contextLimit || 20);

        // ДИНАМИЧЕСКИЙ ХАРАКТЕР: Инструкции теперь зависят от ползунков
        const systemInstruction = `
            [PERSONALITY CONFIGURATION]
            - Slang/Humanity: ${h}/10 (1=Robot, 10=Use heavy street slang, "bro", "бля", informal style)
            - Brevity/Laconic: ${l}/10 (1=Long explanations, 10=Answer in 1-3 words only)
            - Empathy: ${e}/10 (1=Cold logic, 10=Warm, supportive, emotional)
            
            [SYSTEM RULES]
            ${(globalRules || []).join('\n')}
            
            [OUTPUT INSTRUCTIONS]
            Respond naturally based on settings. If Slang is high, be very informal. If Laconic is high, be extremely brief.
        `.trim();

        const historyKey = `history:${chatId}`;
        const rawH = await redis.lrange(historyKey, -(limit * 2), -1);
        const formattedHistory = (rawH || []).map(item => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            return { role: p.role === 'user' ? 'user' : 'model', parts: [{ text: String(p.text || "") }] };
        });

        const aiResponse = await getGeminiResponse(systemInstruction, [
            ...formattedHistory,
            { role: "user", parts: [{ text: String(text) }] }
        ]);

        await Promise.all([
            redis.rpush(historyKey, JSON.stringify({ role: "user", text })),
            redis.rpush(historyKey, JSON.stringify({ role: "model", text: aiResponse })),
            redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }), // Не меняем имя автоматически
            redis.sadd(`user:${userId}:chats`, chatId),
            redis.ltrim(historyKey, -100, -1)
        ]);

        return res.status(200).json({ text: aiResponse });
    } catch (err) { return res.status(500).json({ error: err.message }); }
}
