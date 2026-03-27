import { kv } from '@vercel/kv';
import { getActiveChat } from '../methods.js';

export default async function handler(req, res) {
    const { chatId } = req.query;
    if (!chatId) return res.status(400).json({ error: 'No chatId' });

    try {
        const active = await getActiveChat(chatId);
        const historyKey = `history:${chatId}:${active.id}`;
        const history = await kv.get(historyKey) || [];
        
        return res.status(200).json({ history });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
