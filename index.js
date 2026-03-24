import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
    const TG_TOKEN = process.env.TELEGRAM_TOKEN;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const MY_ADMIN_ID = process.env.MY_ADMIN_ID;

    // --- СЕРВЕРНЫЙ ЛОГ ГОТОВНОСТИ (Webhook от Vercel) ---
    // Настрой этот путь в Vercel: https://твой-домен.vercel.app/api/ready
    if (req.url.includes('/api/ready')) {
        try {
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: MY_ADMIN_ID,
                    text: "🚀 **BalastDB: Сервер обновлен.** Билд завершен успешно, я в строю.",
                    parse_mode: "Markdown"
                })
            });
            return res.status(200).send('Notification sent');
        } catch (e) {
            return res.status(500).send('Error');
        }
    }

    // Обработка только POST запросов от Telegram
    if (req.method !== 'POST') {
        return res.status(200).send('BalastDB Engine is running');
    }

    const body = req.body;
    if (!body || !body.message || !body.message.text) {
        return res.status(200).send('No message');
    }

    const chatId = body.message.chat.id;
    const userText = body.message.text;

    try {
        const historyKey = `chat:${chatId}`;
        let history = await kv.get(historyKey) || [];

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_KEY}`;
        
        const contents = [
            ...history.map(h => ({ role: h.role, parts: [{ text: h.parts[0].text }] })),
            { role: "user", parts: [{ text: userText }] }
        ].slice(-15);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents,
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 1000
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const aiResponse = data.candidates[0].content.parts[0].text;

        const updatedHistory = [...history, 
            { role: "user", parts: [{ text: userText }] }, 
            { role: "model", parts: [{ text: aiResponse }] }
        ].slice(-20);
        
        await kv.set(historyKey, updatedHistory, { ex: 604800 });

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