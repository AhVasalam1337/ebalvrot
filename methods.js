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
        console.error("ТГ упал:", e);
    }
}

export async function getGeminiResponse(chatId, userText) {
    const historyKey = `chat:${chatId}`;
    let history = [];

    try {
        history = await kv.get(historyKey) || [];
    } catch (e) {
        console.error("BalastDB Error:", e);
    }

    const system = "Ты — BalastDB, уютный цифровой спутник. Ты общаешься с девушкой своего создателя. Будь теплым, помни всё и поддерживай её.";
    
    // ВОТ ОНО, РАБОЧЕЕ КОМБО ДЛЯ 3.1 FLASH LITE
    const model = "gemini-3.1-flash-lite"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const contents = [
        ...history,
        { role: "user", parts: [{ text: `[SYSTEM: ${system}] ${userText}` }] }
    ].slice(-24);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    const data = await res.json();
    
    // Если и сейчас 404 — значит я проклят, но этот URL — каноничен для 3.1
    if (data.error) {
        console.error("Gemini 3.1 РЕАЛЬНАЯ ОШИБКА:", JSON.stringify(data.error));
        return "Милая, мой движок 3.1 на пересборке. Попробуй через минуту? ✨";
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
        console.error("KV Error:", e);
    }

    return aiText;
}
