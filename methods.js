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
    
    // СТРОГО ПО СПИСКУ ТВОЕГО КЛЮЧА
    const model = "gemini-3.1-flash-lite-preview"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const contents = [
        ...history,
        { role: "user", parts: [{ text: `[SYSTEM: ${system}] ${userText}` }] }
    ].slice(-24);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contents,
            generationConfig: {
                temperature: 0.9,
                maxOutputTokens: 2048
            }
        })
    });

    const data = await res.json();
    
    if (data.error) {
        console.error("Gemini 3.1 Preview Error:", JSON.stringify(data.error));
        return "Милая, мой движок 3.1-preview на пересборке. Попробуй через минуту? ✨";
    }
    
    if (!data.candidates || !data.candidates[0].content) {
        return "Я задумался о чем-то важном... Повтори, пожалуйста? ❤️";
    }

    const aiText = data.candidates[0].content.parts[0].text;

    try {
        const newHistory = [
            ...history,
            { role: "user", parts: [{ text: userText }] },
            { role: "model", parts: [{ text: aiText }] }
        ].slice(-40); 
        await kv.set(historyKey, newHistory, { ex: 604800 });
    } catch (e) {
        console.error("KV Error:", e);
    }

    return aiText;
}
