import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

// Переменная для отслеживания первого запуска после деплоя
let isNewDeploy = true;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('BalastDB Engine is running');
    }

    const body = req.body;
    if (!body.message || !body.message.text) {
        return res.sendStatus(200);
    }

    const chatId = body.message.chat.id;
    const userText = body.message.text;
    const TG_TOKEN = process.env.TELEGRAM_TOKEN;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const MY_ADMIN_ID = 6828357999; // Укажи свой ID здесь

    // Уведомление о том, что бот обновился и готов (сработает один раз после пуша)
    if (isNewDeploy) {
        try {
            await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: MY_ADMIN_ID,
                    text: "✅ **BalastDB: Деплой завершен.** Код обновлен, база данных на связи."
                })
            });
            isNewDeploy = false;
        } catch (e) {
            console.error("Ошибка отправки статуса деплоя:", e);
        }
    }

    try {
        const historyKey = `chat:${chatId}`;
        // Работаем с BalastDB (Vercel KV)
        let history = await kv.get(historyKey) || [];

        // Формируем запрос к Gemini 3.1 Flash Lite
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GEMINI_KEY}`;
        
        const contents = [
            ...history.map(h => ({ role: h.role, parts: [{ text: h.parts[0].text }] })),
            { role: "user", parts: [{ text: userText }] }
        ].slice(-15); // Держим контекст чуть побольше

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
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        const aiResponse = data.candidates[0].content.parts[0].text;

        // Обновляем историю в BalastDB (храним 7 дней)
        const updatedHistory = [...history, 
            { role: "user", parts: [{ text: userText }] }, 
            { role: "model", parts: [{ text: aiResponse }] }
        ].slice(-20);
        
        await kv.set(historyKey, updatedHistory, { ex: 604800 });

        // Отправка ответа пользователю в Telegram
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
        console.error("Ошибка обработки:", error);
        // В случае критической ошибки уведомляем админа
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: "⚠️ Произошла ошибка в работе BalastDB. Проверь логи в облаке."
            })
        });
    }

    return res.status(200).send('OK');
}