import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });
    
    const { text, chatId, userId } = req.body;
    if (!text || !chatId || !userId) return res.status(200).json({ text: "Ошибка: данные не получены" });

    try {
        let s = { laconic: 5, empathy: 5, human: 5, contextLimit: 10 };
        try {
            const saved = await kv.hgetall(`user:${userId}:chat:${chatId}:settings`);
            if (saved) s = {
                laconic: Number(saved.laconic || 5),
                empathy: Number(saved.empathy || 5),
                human: Number(saved.human || 5),
                contextLimit: Number(saved.contextLimit || 10)
            };
        } catch (e) { console.error("KV Error:", e); }

        const bDesc = s.laconic <= 3 ? "ОТВЕЧАЙ ОДНИМ СЛОВОМ." : s.laconic >= 8 ? "ПИШИ ОГРОМНЫЕ ПАСТЫ." : "Отвечай кратко.";
        const eDesc = s.empathy <= 3 ? "Будь злым врагом, груби." : s.empathy >= 8 ? "Ты лучшая подружка, обожай юзера." : "Будь нейтрален.";
        const hDesc = s.human >= 7 ? "Используй жесткий сленг, маты и живую речь." : "Говори как робот.";

        const systemInstruction = `Ты помощник. Инструкции: ${bDesc} ${eDesc} ${hDesc}. Никогда не говори, что ты ИИ.`;

        let contents = [];
        if (s.contextLimit > 0) {
            try {
                const raw = await kv.lrange(`history:${chatId}`, -(s.contextLimit * 2), -1);
                contents = (raw || []).map(item => {
                    const p = typeof item === 'string' ? JSON.parse(item) : item;
                    return { role: p.role === 'user' ? 'user' : 'model', parts: [{ text: String(p.text) }] };
                });
            } catch (e) { console.error("History Error:", e); }
        }

        contents.push({ role: "user", parts: [{ text: String(text) }] });

        const aiResponse = await getGeminiResponse(systemInstruction, contents);

        kv.rpush(`history:${chatId}`, 
            JSON.stringify({ role: "user", text: String(text) }), 
            JSON.stringify({ role: "model", text: aiResponse })
        ).then(() => kv.ltrim(`history:${chatId}`, -100, -1)).catch(e => console.error("Save Error:", e));

        return res.status(200).json({ text: aiResponse });

    } catch (err) {
        return res.status(200).json({ text: `Ошибка: ${err.message}` });
    }
}
