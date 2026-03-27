import { getGeminiResponse } from '../methods.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    const { text, chatId } = req.body;
    
    try {
        const response = await getGeminiResponse(chatId, text);
        return res.status(200).json({ text: response });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: e.message });
    }
}
