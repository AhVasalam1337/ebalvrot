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

    const system = "Ты — BalastDB, персональный ИИ для девушки твоего создателя. Ты помнишь всё, что она говорит, поддерживаешь её и создаешь атмосферу тепла.";
    
    // ФИКС: Исправлена опечатка в v1beta и уточнена модель 3.1
    const model = "gemini-3.1-flash-lite-001"; 
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
                temperature: 0.8,
                topP: 0.95,
                maxOutputTokens: 1024
            }
        })
    });

    const data = await res.json();
    
    if (data.error) {
        console.error("Gemini 3.1 Hard Error:", JSON.stringify(data.error));
        return "Милая, мой движок 3.1 немного забарахлил. Попробуй еще разок? ✨";
    }
    
    if (!data.candidates || !data.candidates[0].content) {
        return "Я задумался о чем-то очень важном... Повтори, пожалуйста? ❤️";
    }

    const aiText = data.candidates[0].content.parts[0].text;

    try {
        const newHistory = [
            ...history,
            { role: "user", parts: [{ text: userText }] },
            { role: "model", parts: [{ text: aiText }] }
        ].slice(-30); // 3.1 отлично держит жирный контекст
        await kv.set(historyKey, newHistory, { ex: 604800 });
    } catch (e) {
        console.error("Ошибка сохранения в KV:", e);
    }

    return aiText;
}
