import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

export async function sendTg(chatId, text, extra = {}) {
    try {
        const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "Markdown",
                ...extra
            })
        });
    } catch (e) {
        console.error("Ошибка отправки в ТГ:", e);
    }
}

export async function getGeminiResponse(chatId, userText) {
    const historyKey = `chat:${chatId}`;
    let history = [];
    
    // Безопасное получение истории
    try {
        history = await kv.get(historyKey) || [];
    } catch (e) {
        console.error("Ошибка KV:", e);
    }

    const system = "Ты — BalastDB, уютный ИИ. Ты общаешься с девушкой своего создателя. Будь теплым и помни контекст.";
    
    const contents = [
        { role: "user", parts: [{ text: `SYSTEM: ${system}` }] },
        ...history,
        { role: "user", parts: [{ text: userText }] }
    ].slice(-12);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    const data = await res.json();
    
    if (!data.candidates || !data.candidates[0].content) {
        console.error("Gemini Error Data:", JSON.stringify(data));
        throw new Error("Gemini не ответил");
    }
    
    const aiText = data.candidates[0].content.parts[0].text;

    // Безопасное сохранение
    try {
        history.push({ role: "user", parts: [{ text: userText }] });
        history.push({ role: "model", parts: [{ text: aiText }] });
        await kv.set(historyKey, history.slice(-20), { ex: 604800 });
    } catch (e) {
        console.error("Ошибка сохранения в KV:", e);
    }

    return aiText;
}
