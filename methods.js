// methods.js
import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Имитация печати
export async function sendTyping(chatId) {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendChatAction`;
    return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: "typing" })
    });
}

export async function sendTg(chatId, text, extra = {}) {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra })
    });
}

export async function deleteMsg(chatId, messageId) {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/deleteMessage`;
    return await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId })
    });
}

// УПРАВЛЕНИЕ БАЗОЙ (НИЧЕГО НЕ ПРОЕБАНО)
export async function getDialogs(chatId) {
    const key = `user_chats:${chatId}`;
    let data = await kv.get(key);
    if (!data) {
        data = [{ id: 'default', name: 'Основной чат', active: true }];
        await kv.set(key, data);
    }
    return data;
}

export async function createNewChat(chatId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await getDialogs(chatId);
    dialogs.forEach(d => d.active = false);
    const newId = `chat_${Date.now()}`;
    dialogs.push({ id: newId, name: `Диалог ${dialogs.length + 1}`, active: true });
    await kv.set(key, dialogs);
    return newId;
}

export async function deleteChat(chatId, targetId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await getDialogs(chatId);
    if (dialogs.length <= 1) return; // Не удаляем последний чат
    const filtered = dialogs.filter(d => d.id !== targetId);
    if (!filtered.find(d => d.active)) filtered[0].active = true;
    await kv.set(key, filtered);
    await kv.del(`history:${chatId}:${targetId}`);
}

export async function setActiveChat(chatId, targetId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await getDialogs(chatId);
    dialogs.forEach(d => d.active = (d.id === targetId));
    await kv.set(key, dialogs);
}

// GEMINI 3.1 FLASH LITE PREVIEW (СОХРАНЕНО)
export async function getGeminiResponse(chatId, userText) {
    const dialogs = await getDialogs(chatId);
    const activeChat = dialogs.find(d => d.active) || dialogs[0];
    const historyKey = `history:${chatId}:${activeChat.id}`;

    let history = await kv.get(historyKey) || [];

    // ЧИСТЫЙ КОНТЕКСТ
    const system = "Тебя зовут Катя. Общайся свободно.";
    const model = "gemini-3.1-flash-lite-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const contents = [...history, { role: "user", parts: [{ text: `[SYSTEM: ${system}] ${userText}` }] }].slice(-24);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const aiText = data.candidates[0].content.parts[0].text;
    history.push({ role: "user", parts: [{ text: userText }] }, { role: "model", parts: [{ text: aiText }] });
    await kv.set(historyKey, history.slice(-40), { ex: 604800 });

    return aiText;
}
