import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Функция отправки в Телеграм
export async function sendTg(chatId, text, extra = {}) {
    return await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "Markdown",
            ...extra
        })
    });
}

// Функция общения с Gemini (сохранение истории)
export async function getGeminiResponse(chatId, userText) {
    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    const system = "Ты — BalastDB, уютный цифровой спутник для любимой женщины своего создателя. Ты помнишь всё, что она говорит, поддерживаешь её и создаешь атмосферу тепла.";
    
    const contents = [
        { role: "user", parts: [{ text: `SYSTEM: ${system}` }] },
        ...history,
        { role: "user", parts: [{ text: userText }] }
    ].slice(-16); // Держим контекст

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    const data = await res.json();
    if (!data.candidates) throw new Error("Gemini Error");
    
    const aiText = data.candidates[0].content.parts[0].text;

    // Сохраняем в BalastDB
    history.push({ role: "user", parts: [{ text: userText }] });
    history.push({ role: "model", parts: [{ text: aiText }] });
    await kv.set(historyKey, history.slice(-20), { ex: 604800 });

    return aiText;
}
