import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { text, chatId, userId } = req.body;
    if (!chatId || !userId || !text) return res.status(400).json({ error: "Missing data" });

    try {
        // 1. Получаем данные (параллельно для скорости)
        const [globalRules, settings] = await Promise.all([
            kv.lrange('geminka:rules', 0, -1).catch(() => []),
            kv.hgetall(`user:${userId}:chat:${chatId}:settings`).catch(() => null)
        ]);

        const s = settings || DEFAULTS;
        const limit = Math.max(0, Number(s.contextLimit ?? 20));

        // 2. Формируем системную инструкцию (упростил сборку для стабильности)
        const brevity = s.laconic <= 2 ? "ПИШИ ПАСТЫ." : s.laconic <= 5 ? "Будь общительным." : s.laconic <= 8 ? "Коротко." : "1-2 СЛОВА.";
        const empathy = s.empathy <= 2 ? "Будь токсичным врагом." : s.empathy <= 5 ? "Нейтрально." : s.empathy <= 8 ? "Дружелюбно." : "ОБОЖАЙ ЕГО.";
        const human = s.human <= 3 ? "Как робот." : s.human <= 7 ? "Обычный человек." : "ЖИВОЙ: сленг, мат, опечатки.";

        const systemInstruction = `[MANDATE]\n${brevity}\n${empathy}\n${human}\n[RULES]\n${(globalRules || []).join('\n')}\nНикогда не говори, что ты ИИ.`.trim();

        // 3. Собираем историю безопасно
        let formattedHistory = [];
        if (limit > 0) {
            const rawH = await kv.lrange(`history:${chatId}`, -(limit * 2), -1) || [];
            formattedHistory = rawH.map(item => {
                try {
                    const p = typeof item === 'string' ? JSON.parse(item) : item;
                    return { 
                        role: p.role === 'user' ? 'user' : 'model', 
                        parts: [{ text: String(p.text || "") }] 
                    };
                } catch (e) { return null; }
            }).filter(Boolean);
        }

        // 4. Запрос к нейронке
        const aiResponse = await getGeminiResponse(systemInstruction, [
            ...formattedHistory,
            { role: "user", parts: [{ text: String(text) }] }
        ]);

        // 5. Сохраняем всё (без ожидания каждого, чтобы быстрее ответить)
        const historyKey = `history:${chatId}`;
        const saveTasks = [
            kv.rpush(historyKey, JSON.stringify({ role: "user", text })),
            kv.rpush(historyKey, JSON.stringify({ role: "model", text: aiResponse })),
            kv.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            kv.sadd(`user:${userId}:chats`, chatId),
            kv.ltrim(historyKey, -100, -1)
        ];
        
        await Promise.all(saveTasks);

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        console.error("Handler Error:", err);
        return res.status(500).json({ error: err.message, stack: err.stack });
    }
}
