import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

// Дефолтные настройки, если в базе пусто
const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { text, chatId, userId } = req.body;
    if (!chatId || !userId) return res.status(400).json({ error: "Missing IDs" });

    try {
        // 1. Загружаем глобальные правила и настройки конкретного чата
        const [globalRules, settings] = await Promise.all([
            kv.lrange('geminka:rules', 0, -1),
            kv.hgetall(`user:${userId}:chat:${chatId}:settings`)
        ]);

        // 2. Приводим настройки к числам, иначе AI их не поймет
        const s = settings || DEFAULTS;
        const h = Number(s.human ?? DEFAULTS.human);
        const l = Number(s.laconic ?? DEFAULTS.laconic);
        const e = Number(s.empathy ?? DEFAULTS.empathy);
        const limit = Number(s.contextLimit ?? DEFAULTS.contextLimit);

        // 3. Формируем системную инструкцию (Инъекция характера)
        const systemInstruction = `
            [PERSONALITY]
            - Slang/Informality: ${h}/10 (1=Robot, 10=Street slang, swear words if natural, "bro")
            - Brevity: ${l}/10 (1=Verbose, 10=1-5 words max, very short)
            - Empathy: ${e}/10 (1=Cold, 10=Very emotional/supportive)
            
            [RULES]
            ${(globalRules || []).join('\n')}
            
            [STYLE]
            Strictly follow these levels. If Brevity is 10, never write more than one sentence. 
            Your personality depends on the Slang level: high level means you talk like a close friend.
        `.trim();

        const historyKey = `history:${chatId}`;
        
        // 4. Загружаем контекст строго по лимиту из настроек
        // Умножаем на 2, так как в истории хранятся и вопросы, и ответы
        const rawH = await kv.lrange(historyKey, -(limit * 2), -1);
        
        const formattedHistory = (rawH || []).map(item => {
            const p = typeof item === 'string' ? JSON.parse(item) : item;
            return { 
                role: p.role === 'user' ? 'user' : 'model', 
                parts: [{ text: String(p.text || "") }] 
            };
        });

        // 5. Запрос к Gemini
        const aiResponse = await getGeminiResponse(systemInstruction, [
            ...formattedHistory,
            { role: "user", parts: [{ text: String(text) }] }
        ]);

        // 6. Сохраняем всё в базу
        await Promise.all([
            kv.rpush(historyKey, JSON.stringify({ role: "user", text })),
            kv.rpush(historyKey, JSON.stringify({ role: "model", text: aiResponse })),
            kv.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            kv.sadd(`user:${userId}:chats`, chatId),
            kv.ltrim(historyKey, -100, -1) // Защита от раздувания базы (макс 100 сообщений)
        ]);

        return res.status(200).json({ text: aiResponse });
    } catch (err) {
        console.error("Chat API Error:", err);
        return res.status(500).json({ error: err.message });
    }
}
