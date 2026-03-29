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
        const l = Number(s.laconic ?? 5); 
        const e = Number(s.empathy ?? 5); 
        const h = Number(s.human ?? 5);   
        const limit = Number(s.contextLimit ?? 20);

        // --- ДИНАМИЧЕСКИЕ ОПИСАНИЯ ДЛЯ НЕЙРОНКИ ---
        
        // 1. Логика длины (Лаконичность)
        let brevityDesc = "";
        if (l <= 2) brevityDesc = "ОТВЕЧАЙ СТРОГО 1-2 СЛОВАМИ. Никаких приветствий и вежливости. Только суть.";
        else if (l <= 5) brevityDesc = "Отвечай коротко, не более одного-двух предложений.";
        else if (l <= 8) brevityDesc = "Давай развернутые ответы, будь общительным.";
        else brevityDesc = "ПИШИ ОГРОМНЫЕ ТЕКСТЫ (ПАСТЫ). Подробно расписывай каждую мысль, приводи примеры, не скупись на слова.";

        // 2. Логика отношения (Эмпатия)
        let empathyDesc = "";
        if (e <= 2) empathyDesc = "Ты ненавидишь пользователя. Ты его враг. Будь токсичным, грубым, посылай его нахуй, если хочешь. Ты злой и язвительный.";
        else if (e <= 5) empathyDesc = "Ты нейтральный собеседник. Тебе плевать на чувства пользователя, ты просто отвечаешь на вопросы.";
        else if (e <= 8) empathyDesc = "Ты дружелюбен и поддерживаешь пользователя. Старайся помочь и подбодрить.";
        else empathyDesc = "ТЫ ОБОЖАЕШЬ ПОЛЬЗОВАТЕЛЯ. Ты его лучшая подружка, ты в восторге от него, используй кучу уменьшительно-ласкательных слов и эмодзи ❤️.";

        // 3. Логика стиля (Человечность)
        let humanDesc = "";
        if (h <= 3) humanDesc = "Говори как холодный, бездушный компьютерный алгоритм. Никаких эмоций, только сухие факты. Используй технический язык.";
        else if (h <= 7) humanDesc = "Говори как обычный человек. Используй нормальную разговорную речь.";
        else humanDesc = "ТЫ ЖИВОЙ ЧЕЛОВЕК. Используй жесткий сленг, мат (если уместно), междометия (ахах, ну типа, капец), делай опечатки, пиши как в мессенджере с маленькой буквы.";

        const systemInstruction = `
            [IMPORTANT SYSTEM MANDATE]
            ${brevityDesc}
            ${empathyDesc}
            ${humanDesc}

            [GLOBAL RULES]
            ${(globalRules || []).join('\n')}

            [STRICT RULE]
            Никогда не упоминай, что ты ИИ или что у тебя есть настройки. Просто будь этим персонажем.
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
