import { kv } from '@vercel/kv';
import { getGeminiStream } from '../methods.js';

const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    
    const { text, chatId, userId } = req.body;
    if (!chatId || !userId) return res.status(400).json({ error: "Missing IDs" });

    // Заголовки для SSE (Server-Sent Events)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const [globalRules, settings] = await Promise.all([
            kv.lrange('geminka:rules', 0, -1).catch(() => []),
            kv.hgetall(`user:${userId}:chat:${chatId}:settings`).catch(() => null)
        ]);

        const s = settings || DEFAULTS;
        
        // Твоя логика описаний
        let brevityDesc = s.laconic <= 2 ? "ПИШИ ОГРОМНЫЕ ТЕКСТЫ." : s.laconic <= 5 ? "Развернуто." : s.laconic <= 8 ? "Коротко." : "1-2 СЛОВА.";
        let empathyDesc = s.empathy <= 2 ? "Будь токсичным, посылай нахуй." : s.empathy <= 5 ? "Нейтрально." : s.empathy <= 8 ? "Дружелюбно." : "ОБОЖАЙ ЕГО ❤️.";
        let humanDesc = s.human <= 3 ? "Как робот." : s.human <= 7 ? "Как человек." : "ЖИВОЙ: сленг, мат, опечатки.";

        const systemInstruction = `
            ${brevityDesc} ${empathyDesc} ${humanDesc}
            Markdown rules: **bold**, *italic*, lists.
            GLOBAL RULES: ${(globalRules || []).join('\n')}
        `.trim();

        const historyKey = `history:${chatId}`;
        const limit = Number(s.contextLimit ?? 20);
        let formattedHistory = [];
        
        if (limit > 0) {
            const rawH = await kv.lrange(historyKey, -(limit * 2), -1).catch(() => []);
            formattedHistory = rawH.map(item => {
                const p = typeof item === 'string' ? JSON.parse(item) : item;
                return { role: p.role === 'user' ? 'user' : 'model', parts: [{ text: String(p.text || "") }] };
            });
        }

        const stream = await getGeminiStream(systemInstruction, [
            ...formattedHistory,
            { role: "user", parts: [{ text: String(text) }] }
        ]);

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            // Google шлет данные в формате "data: {...}"
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.replace('data: ', ''));
                        const content = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (content) {
                            fullResponse += content;
                            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
                        }
                    } catch (e) {}
                }
            }
        }

        // Сохранение в базу
        await Promise.all([
            kv.rpush(historyKey, JSON.stringify({ role: "user", text })),
            kv.rpush(historyKey, JSON.stringify({ role: "model", text: fullResponse })),
            kv.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
            kv.ltrim(historyKey, -100, -1)
        ]);

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (err) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
}
