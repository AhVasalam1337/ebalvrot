// methods.js
import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

const TG_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

export async function deleteTgMessage(chatId, messageId) {
    if (!messageId) return;
    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/deleteMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId })
        });
    } catch (e) {}
}

export async function sendTg(chatId, text, extra = {}) {
    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra })
    });
    const data = await res.json();
    if (data.ok) {
        const active = await getActiveChat(chatId);
        const key = `msg_ids:${chatId}:${active.id}`;
        let ids = await kv.get(key) || [];
        ids.push(data.result.message_id);
        await kv.set(key, ids.slice(-50));
    }
    return data;
}

export async function clearChatPhysical(chatId) {
    const active = await getActiveChat(chatId);
    const key = `msg_ids:${chatId}:${active.id}`;
    const historyKey = `history:${chatId}:${active.id}`;
    const ids = await kv.get(key) || [];
    for (const id of ids) { await deleteTgMessage(chatId, id); }
    await kv.del(key);
    await kv.del(historyKey);
    return "Память зачищена, экран пуст. 🧊";
}

export async function getDialogs(chatId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await kv.get(key);
    if (!dialogs) {
        dialogs = [{ id: 'default', name: 'Чат 1', active: true, rules: [], traits: { brevity: 5, empathy: 5, humanity: 5 } }];
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
    return `📋 *Чат: ${active.name}*\n\n*Правила:* ${rules.length ? rules.join(', ') : "нет"}\n*Характер:* Лак ${t.brevity}, Эмп ${t.empathy}, Чел ${t.humanity}`;
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
    await updateActiveChatData(chatId, (chat) => { chat.name = newName.substring(0, 20); });
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
    dialogs.push({ id: newId, name: `Чат ${dialogs.length + 1}`, active: true, rules: [], traits: { brevity: 5, empathy: 5, humanity: 5 } });
    await kv.set(key, dialogs);
}

export async function deleteChat(chatId, targetId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await getDialogs(chatId);
    if (dialogs.length <= 1) return;
    const filtered = dialogs.filter(d => d.id !== targetId);
    if (!filtered.find(d => d.active)) filtered[0].active = true;
    await kv.set(key, filtered);
}

export async function nextChat(chatId) {
    const key = `user_chats:${chatId}`;
    let dialogs = await getDialogs(chatId);
    const currentIndex = dialogs.findIndex(d => d.active);
    dialogs[currentIndex].active = false;
    const nextIndex = (currentIndex + 1) % dialogs.length;
    dialogs[nextIndex].active = true;
    await kv.set(key, dialogs);
    return dialogs[nextIndex].name;
}

export async function sendTyping(chatId) {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendChatAction`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: "typing" })
    });
}

// methods.js (Back to Pro version)
export async function getGeminiResponse(chatId, userText) {
    const active = await getActiveChat(chatId);
    const historyKey = `history:${chatId}:${active.id}`;
    let history = await kv.get(historyKey) || [];
    
    const rules = active.rules || [];
    const t = active.traits || { brevity: 5, empathy: 5, humanity: 5 };
    
    // Та самая системка, которая работала
    const systemPrompt = `Ты — Катя. Твой характер: лаконичность ${t.brevity}/10, эмпатия ${t.empathy}/10, человечность ${t.humanity}/10. Соблюдай правила: ${rules.join(', ')}.`;
    
    // ВОЗВРАЩАЕМ PRO ВЕРСИЮ
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_KEY}`;
    
    const cleanHistory = history.filter(h => h && h.parts && h.parts[0].text);
    const contents = [
        ...cleanHistory, 
        { role: "user", parts: [{ text: `[SYSTEM: ${systemPrompt}] ${userText}` }] }
    ].slice(-24); // Прошка тянет контекст лучше

    try {
        const res = await fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ contents }) 
        });

        if (!res.ok) {
            const errorData = await res.text();
            console.error("Gemini API Error Status:", res.status);
            console.error("Full Error:", errorData);
            return "⚠️ Катя поймала лаг (ошибка API). Попробуй позже или проверь ключ.";
        }

        const data = await res.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const aiText = data.candidates[0].content.parts[0].text;
            
            // Записываем чистую историю
            history.push({ role: "user", parts: [{ text: userText }] }, { role: "model", parts: [{ text: aiText }] });
            await kv.set(historyKey, history.slice(-40), { ex: 604800 });
            return aiText;
        } else {
            return "🤐 Что-то пошло не так, ответа нет. Попробуй нажать '🧹 Снести всё'.";
        }
    } catch (e) {
        console.error("Network Error:", e);
        return "🌪 Катю выкинуло из сети. Проверь логи Vercel.";
    }
}
