import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { text, chatId, userId } = req.body;
    if (!chatId || !userId) return res.status(400).json({ error: "Missing IDs" });

    try {
        const [globalRules, settings] = await Promise.all([
            kv.lrange('geminka:rules', 0, -1).catch(() => []),
            kv.hgetall(`user:${userId}:chat:${chatId}:settings`).catch(() => null)
        ]);

        const s = settings || DEFAULTS;
        const l = Number(s.laconic ?? 5); 
        const e = Number(s.empathy ?? 5); 
        const h = Number(s.human ?? 5);   
        const limit = Number(s.contextLimit ?? 20);

        // --- ДИНАМИЧЕСКИЕ ОПИСАНИЯ ДЛЯ НЕЙРОНКИ ---
        
        // 1. Логика длины (Лаконичность)
        let brevityDesc = "";
        if (l <= 2) brevityDesc = "ПИШИ ОГРОМНЫЕ ТЕКСТЫ (ПАСТЫ). Подробно расписывай каждую мысль, приводи примеры, не скупись на слова.";
        else if (l <= 5) brevityDesc = "Давай развернутые ответы, будь общительным.";
        else if (l <= 8) brevityDesc = "Отвечай коротко, не более одного-двух предложений.";
        else brevityDesc = "ОТВЕЧАЙ СТРОГО 1-2 СЛОВАМИ. Никаких приветствий и вежливости. Только суть.";

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

        // Добавляем инструкцию по форматированию в общий блок
        const systemInstruction = `
            [IMPORTANT SYSTEM MANDATE]
            ${brevityDesc}
            ${empathyDesc}
            ${humanDesc}

            [FORMATTING RULES]
            Используй Markdown для оформления ответа:
            - **Жирный текст** для важных моментов или акцентов.
            - *Курсив* для сарказма или мыслей вслух.
            - Списки (1., 2. или *), если перечисляешь пункты.
            - Разделяй абзацы пустой строкой, чтобы текст не слипался.

            [GLOBAL RULES]
            ${(globalRules || []).join('\n')}

            [STRICT RULE]
            Никогда не упоминай, что ты ИИ или что у тебя есть настройки. Просто будь этим персонажем.
        `.trim();

        const historyKey = `history:${chatId}`;
        let formattedHistory = [];
        
        if (limit > 0) {
            const rawH = await kv.lrange(historyKey, -(limit * 2), -1).catch(() => []);
            formattedHistory = (rawH || []).map(item => {
                try {
                    const p = typeof item === 'string' ? JSON.parse(item) : item;
                    return { 
                        role: p.role === 'user' ? 'user' : 'model', 
                        parts: [{ text: String(p.text || "") }] 
                    };
                } catch (parseError) {
                    return null;
                }
            }).filter(Boolean);
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
        ]).catch(err => console.error("Ошибка сохранения в базу:", err));

        return res.status(200).json({ text: aiResponse });
    } catch (err) {
        console.error("Критическая ошибка хэндлера:", err);
        return res.status(500).json({ error: err.message });
    }
}
