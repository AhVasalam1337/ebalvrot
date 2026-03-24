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

    const system = "Ты — BalastDB, персональный ИИ для девушки своего создателя. Ты помнишь всё, что она говорит, поддерживаешь её и создаешь атмосферу тепла.";
    
    // ИСПОЛЬЗУЕМ GEMINI 3.1 FLASH LITE
    const model = "gemini-3.1-flash-lite"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const contents = [
        { role: "user", parts: [{ text: `SYSTEM_INSTRUCTION: ${system}` }] },
        ...history,
        { role: "user", parts: [{ text: userText }] }
    ].slice(-20); // 3.1 держит контекст лучше, можно чуть расширить

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
    
    if (data.error) {
        console.error("Gemini 3.1 Error:", JSON.stringify(data.error));
        return "Милая, мой движок 3.1 чихает. Попробуй еще разок через секунду? ✨";
    }
    
    const aiText = data.candidates[0].content.parts[0].text;

    try {
        const newHistory = [
            ...history,
            { role: "user", parts: [{ text: userText }] },
            { role: "model", parts: [{ text: aiText }] }
        ].slice(-24); // Сохраняем побольше для 3.1
        await kv.set(historyKey, newHistory, { ex: 604800 });
    } catch (e) {
        console.error("Ошибка сохранения в KV:", e);
    }

    return aiText;
}
