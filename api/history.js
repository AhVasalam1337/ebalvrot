import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    const { chatId, offset = 0 } = req.query;
    if (!chatId) return res.status(400).json({ error: "No chatId" });

    const step = 10;
    // Логика: берем последние сообщения. 
    // Если offset 0, берем от -10 до -1.
    // Если offset 10, берем от -20 до -11.
    const start = -(Number(offset) + step);
    const end = -1 - Number(offset);

    try {
        const history = await kv.lrange(`history:${chatId}`, start, end);
        const parsed = (history || []).map(h => typeof h === 'string' ? JSON.parse(h) : h);
        
        return res.status(200).json({ 
            messages: parsed,
            hasMore: parsed.length === step 
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
