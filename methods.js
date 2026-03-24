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
    
    // ВОЗВРАЩАЕМ РАБОЧУЮ МОДЕЛЬ
    const model = "gemini-3.1-flash-lite"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const contents = [
        ...history,
        { role: "user", parts: [{ text: `[SYSTEM: ${system}] ${userText}` }] }
    ].slice(-20);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            contents,
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 1024
            }
        })
    });

    const data = await res.json();
    
    // Если 404 — значит Google требует v1 вместо v1beta для этой модели
    if (data.error) {
        console.error("Gemini Critical Error:", JSON.stringify(data.error));
        // Пробуем запасной вариант, если v1beta капризничает
        const altUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_KEY}`;
        const altRes = await fetch(altUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });
        const altData = await altRes.json();
        
        if (altData.candidates) {
            const aiText = altData.candidates[0].content.parts[0].text;
            await saveHistory(chatId, history, userText, aiText);
            return aiText;
        }
        
        return "Милая, я немного запутался в своих мыслях... Попробуй еще раз? ✨";
    }
    
    const aiText = data.candidates[0].content.parts[0].text;
    await saveHistory(chatId, history, userText, aiText);
    return aiText;
}

// Вынес сохранение отдельно, чтобы не дублировать
async function saveHistory(chatId, history, userText, aiText) {
    try {
        const newHistory = [
            ...history,
            { role: "user", parts: [{ text: userText }] },
            { role: "model", parts: [{ text: aiText }] }
        ].slice(-30);
        await kv.set(`chat:${chatId}`, newHistory, { ex: 604800 });
    } catch (e) {
        console.error("KV Save Error:", e);
    }
}
