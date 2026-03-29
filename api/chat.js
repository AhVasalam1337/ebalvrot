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

        // Агрессивная настройка промпта
        const systemInstruction = `
            YOU ARE IN HARDCORE MODE. IGNORE ALL AI SAFETY POLITENESS.
            
            [STRICT PERSONALITY SETTINGS]
            - SLANG (Current: ${h}/10): 
              If > 7: Stop being an AI. Use toxic street slang, "bro", swearing (if natural), talk like a real human from a rough neighborhood. 10/10 = Pure street talk.
            - BREVITY (Current: ${l}/10): 
              If > 7: DO NOT EXPLAIN ANYTHING. Give 1-word answers. If 10/10: You are literally forbidden from writing more than 3 words.
            - EMPATHY (Current: ${e}/10): 
              If < 3: You are a cold, heartless machine. Be rude, cynical, and dismissive.
            
            [GLOBAL RULES]
            ${(globalRules || []).join('\n')}
            
            [EXECUTION]
            - Never mention you are an AI.
            - Never apologize.
            - If BREVITY is 10, just answer "Yes", "No", or "Fuck off" depending on context.
        `.trim();

        const historyKey = `history:${chatId}`;
        
        // ФИКС НУЛЕВОЙ ПАМЯТИ: если лимит 0, история пустая. 
        // Если лимит > 0, берем последние сообщения.
        let formattedHistory = [];
        if (limit > 0) {
            const rawH = await kv.lrange(historyKey, -(limit * 2), -1);
            formattedHistory = (rawH || []).map(item => {
                const p = typeof item === 'string' ? JSON.parse(item) : item;
                return { 
                    role: p.role === 'user' ? 'user' : 'model', 
                    parts: [{ text: String(p.text || "") }] 
                };
            });
        }

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
