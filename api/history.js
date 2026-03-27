import { kv } from '@vercel/kv';
import { getActiveChat } from '../methods.js';

export default async function handler(req, res) {
    const { chatId, limit = 10, offset = 0 } = req.query;
    if (!chatId) return res.status(400).json({ error: 'No chatId' });

    try {
        const active = await getActiveChat(chatId);
        const historyKey = `history:${chatId}:${active.id}`;
        const allHistory = await kv.get(historyKey) || [];
        
        // Переворачиваем, берем нужный кусок и переворачиваем обратно
        const start = Math.max(0, allHistory.length - parseInt(limit) - parseInt(offset));
        const end = Math.max(0, allHistory.length - parseInt(offset));
        const historyPart = allHistory.slice(start, end);
        
        return res.status(200).json({ 
            history: historyPart,
            hasMore: start > 0 
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
