// index.js
import { kv } from '@vercel/kv'; // КРИТИЧЕСКИЙ ФИКС
import { sendTg, sendTyping, getGeminiResponse, getDialogs, createNewChat, setActiveChat, deleteChat, getRulesRaw, setWaitingState, getWaitingState, renameChat, getRules, addRule, deleteRule, getActiveChat, setTrait, deleteTgMessage, clearChatPhysical } from './methods.js';
import { mainKeyboard, settingsKeyboard, traitsKeyboard, rulesKeyboard, getLevelKeyboard } from './buttons.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    const { message, callback_query } = req.body;
    
    // В этой версии мы заменяем callback на обычные текстовые команды из Reply-меню
    if (callback_query) return res.status(200).send('OK'); 

    if (!message || !message.text) return res.status(200).send('OK');
    const chatId = message.chat.id;
    const text = message.text;

    // Трекинг ID для чистки
    const active = await getActiveChat(chatId);
    let ids = await kv.get(`msg_ids:${chatId}:${active.id}`) || [];
    ids.push(message.message_id);
    await kv.set(`msg_ids:${chatId}:${active.id}`, ids.slice(-50));

    const waitState = await getWaitingState(chatId);

    // ОБРАБОТКА ОЖИДАНИЯ ВВОДА
    if (waitState) {
        await deleteTgMessage(chatId, message.message_id);
        if (waitState === 'await_rename') {
            await renameChat(chatId, text);
            await setWaitingState(chatId, null);
            await sendTg(chatId, `✅ Название изменено на: ${text}`, settingsKeyboard);
        } else if (waitState === 'await_rule') {
            await addRule(chatId, text);
            await setWaitingState(chatId, null);
            await sendTg(chatId, `📜 Правило добавлено`, rulesKeyboard);
        } else if (waitState.startsWith('edit_trait:')) {
            const trait = waitState.split(':')[1];
            if (!isNaN(text)) {
                await setTrait(chatId, trait, text);
                await setWaitingState(chatId, null);
                await sendTg(chatId, `🎭 ${trait} теперь ${text}`, traitsKeyboard);
            }
        }
        return res.status(200).send('OK');
    }

    // ЛОГИКА МЕНЮ
    switch (text) {
        case "/start":
        case "⬅️ Назад":
            await sendTg(chatId, "Главное меню", mainKeyboard);
            break;
        case "⚙️ Настройки":
        case "⚙️ В настройки":
            await sendTg(chatId, "Настройки чата", settingsKeyboard);
            break;
        case "🎭 Характер":
        case "🎭 Назад к характеру":
            await sendTg(chatId, "Выбери черту для изменения:", traitsKeyboard);
            break;
        case "📏 Изменить Лаконичность":
            await setWaitingState(chatId, "edit_trait:brevity");
            await sendTg(chatId, "Выбери уровень (1-10):", getLevelKeyboard());
            break;
        case "❤️ Изменить Эмпатию":
            await setWaitingState(chatId, "edit_trait:empathy");
            await sendTg(chatId, "Выбери уровень (1-10):", getLevelKeyboard());
            break;
        case "👤 Изменить Человечность":
            await setWaitingState(chatId, "edit_trait:humanity");
            await sendTg(chatId, "Выбери уровень (1-10):", getLevelKeyboard());
            break;
        case "📜 Правила":
            await sendTg(chatId, "Управление правилами:", rulesKeyboard);
            break;
        case "➕ Добавить правило":
            await setWaitingState(chatId, "await_rule");
            await sendTg(chatId, "Пришли текст правила:");
            break;
        case "✏️ Название":
            await setWaitingState(chatId, "await_rename");
            await sendTg(chatId, "Пришли новое название чата:");
            break;
        case "📑 Положняк":
            const raw = await getRulesRaw(chatId);
            await sendTg(chatId, raw);
            break;
        case "🧹 Снести всё":
            const status = await clearChatPhysical(chatId);
            await sendTg(chatId, status, mainKeyboard);
            break;
        case "💬 Диалоги":
            const dialogs = await getDialogs(chatId);
            const list = dialogs.map(d => `${d.active ? '✨' : '▫️'} ${d.name}`).join('\n');
            await sendTg(chatId, `Твои чаты:\n${list}\n\n(Для переключения пока используй команду /next_chat - в разработке)`, mainKeyboard);
            break;
        default:
            await sendTyping(chatId);
            const aiResponse = await getGeminiResponse(chatId, text);
            await sendTg(chatId, aiResponse);
    }

    return res.status(200).send('OK');
}
