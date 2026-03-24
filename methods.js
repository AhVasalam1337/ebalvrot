// methods.js
import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

export async function sendTg(chatId, text, extra = {}) {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra })
    });
}

// Получаем список диалогов пользователя
export async function getDialogs(chatId) {
    const key = `user_chats:${chatId}`;
    let data = await kv.get(key);
    if (!data) {
        // Если пусто, создаем первый дефолтный чат
        data = [{ id: 'default', name: 'Основной чат', active: true }];
        await kv.set(key, data);
    }
    return data;
}

// Создаем новый чат
export async function createNewChat(chatId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await getDialogs(chatId);
    
    // Снимаем активность со всех
    dialogs.forEach(d => d.active = false);
    
    const newId = `chat_${Date.now()}`;
    dialogs.push({ id: newId, name: `Диалог ${dialogs.length + 1}`, active: true });
    
    await kv.set(key, dialogs);
    return newId;
}

// Переключаем активный чат
export async function setActiveChat(chatId, targetId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await getDialogs(chatId);
    dialogs.forEach(d => d.active = (d.id === targetId));
    await kv.set(key, dialogs);
}

// Ответ от Gemini (теперь берет историю из активного чата)
export async function getGeminiResponse(chatId, userText) {
    const dialogs = await getDialogs(chatId);
    const activeChat = dialogs.find(d => d.active) || dialogs[0];
    const historyKey = `history:${chatId}:${activeChat.id}`;

    let history = await kv.get(historyKey) || [];

    const system = "Ты — BalastDB, уютный ИИ. Ты общаешься с девушкой своего создателя. Твоя память ограничена этим конкретным диалогом.";
    const model = "gemini-3.1-flash-lite-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const contents = [...history, { role: "user", parts: [{ text: `[SYSTEM: ${system}] ${userText}` }] }].slice(-24);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    const data = await res.json();
    if (data.error) return "Ой, что-то в движке 3.1 хрустнуло. Попробуй еще раз? ✨";

    const aiText = data.candidates[0].content.parts[0].text;
    history.push({ role: "user", parts: [{ text: userText }] }, { role: "model", parts: [{ text: aiText }] });
    await kv.set(historyKey, history.slice(-40), { ex: 604800 });

    return aiText;
}
