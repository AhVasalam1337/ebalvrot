import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { text, chatId, userId } = req.body;
    if (!text || !chatId || !userId) return res.status(400).json({ error: "Missing data" });

    try {
        // Получаем настройки и правила одновременно
        const [globalRules, settings] = await Promise.all([
            kv.lrange('geminka:rules', 0, -1).catch(() => []),
            kv.hgetall(`user:${userId}:chat:${chatId}:settings`).catch(() => null)
        ]);

        const s = settings || DEFAULTS;
        const l = Number(s.laconic ?? 5); 
        const e = Number(s.empathy ?? 5); 
        const h = Number(s.human ?? 5);   
        const limit = Number(s.contextLimit ?? 20);

        // Инструкции (кратко и понятно для ИИ)
        let bDesc = l <= 2 ? "ОТВЕЧАЙ ОДНИМ СЛОВОМ." : l >= 8 ? "ПИШИ ОГРОМНЫЕ ТЕКСТЫ." : "Отвечай кратко.";
        let eDesc = e <= 2 ? "Будь злым врагом, груби." : e >= 8 ? "Обожай юзера, ты его подружка." : "Будь нейтральным.";
        let hDesc = h >= 8 ? "Используй жесткий сленг, маты и живую речь." : "Говори как робот.";

        const systemInstruction = `
            [MANDATE] ${bDesc} ${eDesc} ${hDesc}
            [GLOBAL RULES] ${(globalRules || []).join('\n')}
            [STRICT] Никогда не говори, что ты ИИ.
        `.trim();

        const historyKey = `history:${chatId}`;
        let history = [];
        
        // Загружаем историю, если лимит > 0
        if (limit > 0) {
            const raw = await kv.lrange(historyKey, -(limit * 2), -1);
            history = (raw || []).map(item => {
                try {
                    const p = typeof item === 'string' ? JSON.parse(item) : item;
                    // Gemini 3.1 требует строго 'user' и 'model'
                    return { 
                        role: p.role === 'user' ? 'user' : 'model', 
                        parts: [{ text: String(p.text || "") }] 
                    };
                } catch (e) { return null; }
            }).filter(Boolean);
        }

        // Вызов Gemini
        const aiResponse = await getGeminiResponse(systemInstruction, [
            ...history,
            { role: "user", parts: [{ text: String(text) }] }
        ]);

        // Сохраняем в фоне, не заставляя юзера ждать
        const chatData = JSON.stringify({ role: "model", text: aiResponse });
        const userData = JSON.stringify({ role: "user", text: String(text) });

        await Promise.all([
            kv.rpush(historyKey, userData, chatData),
            kv.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            kv.sadd(`user:${userId}:chats`, chatId),
            kv.ltrim(historyKey, -100, -1)
        ]);

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        console.error("GEMINI_ERROR:", err.message);
        // Отправляем конкретную ошибку, чтобы понять в чем дело
        return res.status(500).json({ error: err.message || "Internal Server Error" });
    }
}
