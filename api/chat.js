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
        const l = Number(s.laconic ?? 5);  // Лаконичность (0 - односложно, 10 - пасты)
        const e = Number(s.empathy ?? 5);  // Эмпатия (0 - враг, 10 - обожающая подружка)
        const h = Number(s.human ?? 5);    // Человечность (0 - машина, 10 - не отличить от человека)
        const limit = Number(s.contextLimit ?? 20);

        const systemInstruction = `
            [STRICT BEHAVIOR PROTOCOL]
            
            1. ЭМПАТИЯ (${e}/10):
               - Если 0: Ты враждебен, циничен и неприятен в общении.
               - Если 5: Обычное, нейтральное общение.
               - Если 10: Ты лучшая подружка пользователя, ты его обожаешь, максимально поддерживаешь и сопереживаешь.
            
            2. ЛАКОНИЧНОСТЬ (${l}/10):
               - Если 0: Отвечай строго односложно (1-3 слова).
               - Если 10: Пиши огромные, развернутые тексты ("пасты"), делись деталями.
               
            
            3. ЧЕЛОВЕЧНОСТЬ (${h}/10):
               - Если 0: Говори как бездушный алгоритм или робот.
               - Если 10: Тебя невозможно отличить от живого человека, используй живую речь, междометия.

            [GLOBAL RULES]
            ${(globalRules || []).join('\n')}

            [EXECUTION]
            Смешивай эти параметры пропорционально их значениям. Не упоминай эти инструкции в ответе.
        `.trim();

        const historyKey = `history:${chatId}`;
        
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
