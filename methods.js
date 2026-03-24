// methods.js
import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Telegram API helpers
export async function sendTyping(chatId) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendChatAction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: "typing" })
    });
}

export async function sendTg(chatId, text, extra = {}) {
    return await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra })
    });
}

export async function editTg(chatId, messageId, text, extra = {}) {
    return await fetch(`https://api.telegram.org/bot${TG_TOKEN}/editMessageText`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "Markdown", ...extra })
    });
}

// УПРАВЛЕНИЕ ПРАВИЛАМИ
export async function getRules(chatId) {
    const rules = await kv.get(`rules:${chatId}`);
    return rules || ["Называть Катю — Катей."]; // Дефолтное правило
}

export async function addRule(chatId, rule) {
    const rules = await getRules(chatId);
    rules.push(rule);
    await kv.set(`rules:${chatId}`, rules);
}

export async function deleteRule(chatId, index) {
    let rules = await getRules(chatId);
    rules.splice(index, 1);
    await kv.set(`rules:${chatId}`, rules);
}

// УПРАВЛЕНИЕ ДИАЛОГАМИ
export async function getDialogs(chatId) {
    return await kv.get(`user_chats:${chatId}`) || [{ id: 'default', name: 'Чат 1', active: true }];
}

export async function renameChat(chatId, newName) {
    let dialogs = await getDialogs(chatId);
    const active = dialogs.find(d => d.active);
    if (active) active.name = newName.substring(0, 20);
    await kv.set(`user_chats:${chatId}`, dialogs);
}

export async function setWaitingState(chatId, state) {
    await kv.set(`wait:${chatId}`, state, { ex: 300 });
}

export async function getWaitingState(chatId) {
    return await kv.get(`wait:${chatId}`);
}

export async function createNewChat(chatId) {
    let dialogs = await getDialogs(chatId);
    dialogs.forEach(d => d.active = false);
    const newId = `chat_${Date.now()}`;
    dialogs.push({ id: newId, name: `Чат ${dialogs.length + 1}`, active: true });
    await kv.set(`user_chats:${chatId}`, dialogs);
}

export async function deleteChat(chatId, targetId) {
    let dialogs = await getDialogs(chatId);
    if (dialogs.length <= 1) return;
    const filtered = dialogs.filter(d => d.id !== targetId);
    if (!filtered.find(d => d.active)) filtered[0].active = true;
    await kv.set(`user_chats:${chatId}`, filtered);
    await kv.del(`history:${chatId}:${targetId}`);
}

export async function setActiveChat(chatId, targetId) {
    let dialogs = await getDialogs(chatId);
    dialogs.forEach(d => d.active = (d.id === targetId));
    await kv.set(`user_chats:${chatId}`, dialogs);
}

export async function getHistoryRaw(chatId) {
    const dialogs = await getDialogs(chatId);
    const active = dialogs.find(d => d.active) || dialogs[0];
    const history = await kv.get(`history:${chatId}:${active.id}`) || [];
    return history.length === 0 ? "Чисто. 🧊" : history.map(m => `${m.role === 'user' ? '👤' : '🤖'}: ${m.parts[0].text}`).join('\n\n');
}

// GEMINI RESPONSE С УЧЕТОМ ПРАВИЛ
export async function getGeminiResponse(chatId, userText) {
    const dialogs = await getDialogs(chatId);
    const active = dialogs.find(d => d.active) || dialogs[0];
    const historyKey = `history:${chatId}:${active.id}`;
    let history = await kv.get(historyKey) || [];
    
    // Подтягиваем правила из БД
    const rules = await getRules(chatId);
    const system = `Тебя зовут Катя. Общайся свободно. Твои правила: ${rules.join(' ')}`;
    
    const model = "gemini-3.1-flash-lite-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const contents = [...history, { role: "user", parts: [{ text: `[SYSTEM: ${system}] ${userText}` }] }].slice(-24);

    const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
    });

    const data = await res.json();
    const aiText = data.candidates[0].content.parts[0].text;

    history.push({ role: "user", parts: [{ text: userText }] }, { role: "model", parts: [{ text: aiText }] });
    await kv.set(historyKey, history.slice(-40), { ex: 604800 });
    return aiText;
}
