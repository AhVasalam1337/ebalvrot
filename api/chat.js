import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { text, chatId, userId } = req.body;
    if (!chatId || !userId) return res.status(400).json({ error: "Missing IDs" });

    try {
        // Загружаем правила и настройки
        const [globalRules, settings] = await Promise.all([
            kv.lrange('geminka:rules', 0, -1),
            kv.hgetall(`user:${userId}:chat:${chatId}:settings`)
        ]);

        const s = settings || DEFAULTS;
        const h = Number(s.human ?? 5);
        const l = Number(s.laconic ?? 5);
        const e = Number(s.empathy ?? 5);
        const limit = Number(s.contextLimit ?? 20);

        // Формируем промпт
        const systemInstruction = `
            [PERSONALITY]
            - Slang/Informality: ${h}/10 (1=Robot, 10=Street slang, swear words if natural, "bro")
            - Brevity: ${l}/10 (1=Verbose, 10=1-5 words max)
            - Empathy: ${e}/10 (1=Cold, 10=Very emotional/supportive)
            
            [RULES]
            ${(globalRules || []).join('\n')}
            
            [STYLE]
            Strictly follow these levels. If Brevity is 10, never write more than one sentence.
        `.trim();

        const historyKey = `history:${chatId}`;
        
        // Получаем контекст (последние N сообщений)
        const rawH = await kv.lrange(historyKey, -(limit * 2), -1);
        const formattedHistory = (rawH || []).map(item => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            return { 
                role: p.role === 'user' ? 'user' : 'model', 
                parts: [{ text: String(p.text || "") }] 
            };
        });

        // Запрос к AI
        const aiResponse = await getGeminiResponse(systemInstruction, [
            ...formattedHistory,
            { role: "user", parts: [{ text: String(text) }] }
        ]);

        // Атомарное обновление истории и метаданных
        await Promise.all([
            kv.rpush(historyKey, JSON.stringify({ role: "user", text })),
            kv.rpush(historyKey, JSON.stringify({ role: "model", text: aiResponse })),
            kv.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            kv.sadd(`user:${userId}:chats`, chatId),
            kv.ltrim(historyKey, -100, -1) // Храним не более 100 сообщений в сырой базе
        ]);

        return res.status(200).json({ text: aiResponse });
    } catch (err) {
        console.error("Chat Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
