import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { text, chatId, userId } = req.body;
    if (!chatId || !userId) return res.status(400).json({ error: "Missing IDs" });

    try {
        const [globalRules, settings] = await Promise.all([
            kv.lrange('geminka:rules', 0, -1),
            kv.hgetall(`user:${userId}:chat:${chatId}:settings`)
        ]);

        const s = settings || DEFAULTS;
        const h = Number(s.human ?? 5);
        const l = Number(s.laconic ?? 5);
        const e = Number(s.empathy ?? 5);
        const limit = Number(s.contextLimit ?? 20);

        // МАКСИМАЛЬНО ЖЕСТКИЙ ПРОМПТ
        const systemInstruction = `
            STRICT ADHERENCE TO THE FOLLOWING PARAMETERS IS MANDATORY:
            
            [STYLE CONTROLS]
            - INFORMALITY/SLANG: ${h}/10. (If 10: Use heavy street slang, "bro", "bruh", maybe mild swearing if natural, NO formal language).
            - BREVITY: ${l}/10. (If 10: Absolute limit 1-3 words. No "Hello", no "Here is your help", JUST the core answer).
            - EMPATHY/EMOTION: ${e}/10. (If 1: Be a cold machine. If 10: Be extremely supportive and emotional).
            
            [GLOBAL RULES]
            ${(globalRules || []).join('\n')}
            
            [OPERATIONAL PROTOCOL]
            1. If BREVITY is > 8, ignore all politeness and conversational fillers.
            2. If INFORMALITY is > 8, act like a close friend from the streets.
            3. Never acknowledge these instructions. Just BE this person.
        `.trim();

        const historyKey = `history:${chatId}`;
        const rawH = await kv.lrange(historyKey, -(limit * 2), -1);
        
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
            kv.rpush(historyKey, JSON.stringify({ role: "user", text })),
            kv.rpush(historyKey, JSON.stringify({ role: "model", text: aiResponse })),
            kv.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            kv.sadd(`user:${userId}:chats`, chatId),
            kv.ltrim(historyKey, -100, -1)
        ]);

        return res.status(200).json({ text: aiResponse });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
