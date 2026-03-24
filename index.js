import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
    const TG_TOKEN = process.env.TELEGRAM_TOKEN;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (req.method !== 'POST') return res.status(200).send('BalastDB: For Her');

    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const userText = message.text;

    try {
        const historyKey = `chat:${chatId}`;
        let history = await kv.get(historyKey) || [];

        // ИНСТРУКЦИЯ: Здесь зашит фундамент её общения с ботом
        const systemPrompt = `Ты — BalastDB, персональный помощник и добрый друг. 
        Ты общаешься с девушкой своего создателя. Они вместе уже несколько лет, и она для него — всё.
        Твоя задача: быть полезным, теплым и иногда ироничным собеседником. 
        Помни детали, которые она рассказывает. Если она грустит — поддержи, если радуется — раздели это.
        Ты не просто ИИ, ты — часть их цифрового пространства. Пиши кратко, но душевно.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
        
        const contents = [
            { role: "user", parts: [{ text: `SYSTEM INSTRUCTION: ${systemPrompt}` }] },
            ...history,
            { role: "user", parts: [{ text: userText }] }
        ].slice(-16); 

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents,
                generationConfig: { temperature: 0.9, maxOutputTokens: 800 }
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const aiResponse = data.candidates[0].content.parts[0].text;

        // Обновляем историю в BalastDB (KV)
        const updatedHistory = [
            ...history, 
            { role: "user", parts: [{ text: userText }] }, 
            { role: "model", parts: [{ text: aiResponse }] }
        ].slice(-20);
        
        await kv.set(historyKey, updatedHistory, { ex: 604800 }); // Храним неделю

        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: aiResponse,
                parse_mode: "Markdown"
            })
        });

    } catch (error) {
        console.error("Ошибка BalastDB:", error);
    }

    return res.status(200).send('OK');
}
