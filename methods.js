// methods.js
import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

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

export async function getDialogs(chatId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await kv.get(key);
    if (!dialogs) {
        dialogs = [{ 
            id: 'default', name: 'Чат 1', active: true, 
            rules: ["Называть Катю — Катей."],
            traits: { brevity: 5, empathy: 5, humanity: 5 }
        }];
        await kv.set(key, dialogs);
    }
    return dialogs;
}

export async function getActiveChat(chatId) {
    const dialogs = await getDialogs(chatId);
    return dialogs.find(d => d.active) || dialogs[0];
}

export async function updateActiveChatData(chatId, updateFn) {
    const key = `user_chats:${chatId}`;
    let dialogs = await getDialogs(chatId);
    const index = dialogs.findIndex(d => d.active);
    if (index !== -1) {
        updateFn(dialogs[index]);
        await kv.set(key, dialogs);
    }
}

// ЭКСПОРТЫ ДЛЯ ПРАВИЛ И ТРЕЙТОВ
export async function getRules(chatId) {
    const active = await getActiveChat(chatId);
    return active.rules || [];
}

export async function setTrait(chatId, traitName, level) {
    await updateActiveChatData(chatId, (chat) => {
        if (!chat.traits) chat.traits = { brevity: 5, empathy: 5, humanity: 5 };
        chat.traits[traitName] = parseInt(level);
    });
}

export async function getRulesRaw(chatId) {
    const active = await getActiveChat(chatId);
    const rules = active.rules || [];
    const t = active.traits || { brevity: 5, empathy: 5, humanity: 5 };
    let msg = `📋 *Положняк чата "${active.name}":*\n\n*Правила:*\n` + (rules.length ? rules.map((r, i) => `${i + 1}. ${r}`).join('\n') : "Нет правил.");
    msg += `\n\n*Характер:*\n📏 Лак: ${t.brevity} | ❤️ Эмп: ${t.empathy} | 👤 Чел: ${t.humanity}`;
    return msg;
}

export async function addRule(chatId, rule) {
    await updateActiveChatData(chatId, (chat) => {
        if (!chat.rules) chat.rules = [];
        chat.rules.push(rule);
    });
}

export async function deleteRule(chatId, ruleIndex) {
    await updateActiveChatData(chatId, (chat) => {
        if (chat.rules) chat.rules.splice(ruleIndex, 1);
    });
}

export async function renameChat(chatId, newName) {
    await updateActiveChatData(chatId, (chat) => {
        chat.name = newName.substring(0, 20);
    });
}

export async function setWaitingState(chatId, state) {
    await kv.set(`wait:${chatId}`, state, { ex: 300 });
}

export async function getWaitingState(chatId) {
    return await kv.get(`wait:${chatId}`);
}

export async function createNewChat(chatId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await getDialogs(chatId);
    dialogs.forEach(d => d.active = false);
    const newId = `chat_${Date.now()}`;
    dialogs.push({ 
        id: newId, name: `Чат ${dialogs.length + 1}`, active: true, 
        rules: ["Называть Катю — Катей."],
        traits: { brevity: 5, empathy: 5, humanity: 5 }
    });
    await kv.set(key, dialogs);
}

export async function deleteChat(chatId, targetId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await getDialogs(chatId);
    if (dialogs.length <= 1) return;
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

export async function getGeminiResponse(chatId, userText) {
    const active = await getActiveChat(chatId);
    const historyKey = `history:${chatId}:${active.id}`;
    let history = await kv.get(historyKey) || [];
    
    const rules = active.rules || [];
    const t = active.traits || { brevity: 5, empathy: 5, humanity: 5 };

    const traitInstructions = [
        `Твои правила: ${rules.join(' ')}`,
        `Лаконичность: ${t.brevity}/10 (1-кратко, 10-развернуто).`,
        `Эмпатия: ${t.empathy}/10 (при 10 ты боготворишь собеседника, его благополучие — всё для тебя).`,
        `Человечность: ${t.humanity}/10 (насколько ты кажешься живым человеком, а не программой).`
    ];
    
    const system = traitInstructions.join('. ');
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
