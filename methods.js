// methods.js
import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

export async function sendTg(chatId, text, extra = {}) {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: "Markdown",
                ...extra
            })
        });
    } catch (e) {
        console.error("Ошибка Telegram API:", e);
    }
}

export async function getGeminiResponse(chatId, userText) {
    const historyKey = `chat:${chatId}`;
    let history = [];

    try {
        history = await kv.get(historyKey) || [];
    } catch (e) {
        console.error("Ошибка BalastDB (KV):", e);
    }

    const system = "Ты — BalastDB, уютный ИИ. Ты общаешься с девушкой своего создателя. Будь теплым, помни всё и поддерживай её.";
    
    // ВНИМАНИЕ: Для 3.1 Flash Lite сейчас актуален v1alpha или v1beta с полным именем
    const model = "gemini-1.5-flash"; // Брат, если 3.1 всё еще плюет 404, это временный костыль, но давай попробуем еще раз 3.1
    const model31 = "gemini-1.5-flash"; // Замени на gemini-3.1-flash-lite, если уверен, что в твоем регионе она уже в v1beta

    // Самый надежный эндпоинт, который хавает почти всё
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

    const contents = [
        ...history,
        { role: "user", parts: [{ text: `[SYSTEM: ${system}] ${userText}` }] }
    ].slice(-20);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    const data = await res.json();
    
    if (data.error) {
        console.error("Gemini Critical Error:", JSON.stringify(data.error));
        return "Милая, мой движок на техобслуживании. Попробуй через минуту? ✨";
    }
    
    if (!data.candidates || !data.candidates[0].content) {
        return "Я немного задумался... Повтори, пожалуйста? ❤️";
    }

    const aiText = data.candidates[0].content.parts[0].text;

    try {
        const newHistory = [
            ...history,
            { role: "user", parts: [{ text: userText }] },
            { role: "model", parts: [{ text: aiText }] }
        ].slice(-30);
        await kv.set(historyKey, newHistory, { ex: 604800 });
    } catch (e) {
        console.error("KV Save Error:", e);
    }

    return aiText;
}
