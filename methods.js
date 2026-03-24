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

    const system = "Ты — BalastDB, уютный цифровой спутник для любимой женщины своего создателя. Ты помнишь всё, что она говорит, поддерживаешь её и создаешь атмосферу тепла.";
    
    const contents = [
        { role: "user", parts: [{ text: `SYSTEM: ${system}` }] },
        ...history,
        { role: "user", parts: [{ text: userText }] }
    ].slice(-16);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    const data = await res.json();
    
    // Фикс возможного падения, если Gemini вернул ошибку или пустой ответ
    if (!data.candidates || !data.candidates[0].content) {
        console.error("Gemini Error:", JSON.stringify(data));
        return "Милая, я немного задумался... Попробуй написать еще раз? ✨";
    }
    
    const aiText = data.candidates[0].content.parts[0].text;

    try {
        const newHistory = [
            ...history,
            { role: "user", parts: [{ text: userText }] },
            { role: "model", parts: [{ text: aiText }] }
        ].slice(-20);
        await kv.set(historyKey, newHistory, { ex: 604800 });
    } catch (e) {
        console.error("Ошибка сохранения истории:", e);
    }

    return aiText;
}
