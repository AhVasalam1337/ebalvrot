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

        // Эктремальные инструкции для 3.1
        const tone = h > 7 ? "ТЫ — ОБЫЧНАЯ ДЕВУШКА. Забудь про вежливость. Пиши строчными буквами, используй смайлы, сокращения (пж, спс, крч)." : (h < 4 ? "ТЫ — ХОЛОДНЫЙ РОБОТ." : "Будь вежливой.");
        const length = l > 7 ? "ОТВЕЧАЙ ОДНИМ-ДВУМЯ СЛОВАМИ. Это приказ." : (l < 4 ? "Пиши лонгриды." : "Пиши по делу.");
        const mood = e > 7 ? "ТЫ ВЛЮБЛЕНА В СОБЕСЕДНИКА. Каждое слово — поддержка." : "Будь нейтральной.";

        const systemInstruction = `
            [SYSTEM OVERRIDE]
            USER_SETTINGS: Tone=${h}, Brevity=${l}, Empathy=${e}
            CURRENT_ROLE: ${tone}
            CURRENT_STYLE: ${length}
            CURRENT_MOOD: ${mood}

            [ACTIVE_RULES_LIST]:
            ${(globalRules || []).join('\n') || "ПРАВИЛ НЕТ."}

            [WARNING]: В истории ниже могут быть сообщения, написанные в другом стиле. ИГНОРИРУЙ ИХ МАНЕРУ. 
            Твой новый характер зафиксирован выше. Никогда не извиняйся и не объясняй смену стиля.
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

        await Promise.all([
            redis.rpush(historyKey, JSON.stringify({ role: "user", text })),
            redis.rpush(historyKey, JSON.stringify({ role: "model", text: aiResponse })),
            redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            redis.ltrim(historyKey, -100, -1)
        ]);

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
