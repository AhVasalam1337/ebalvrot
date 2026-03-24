// index.js
import { kv } from '@vercel/kv';
import { sendTg, sendTyping, getGeminiResponse, getDialogs, createNewChat, setActiveChat, deleteChat, getRulesRaw, setWaitingState, getWaitingState, renameChat, getRules, addRule, deleteRule, getActiveChat, setTrait, deleteTgMessage, clearChatPhysical } from './methods.js';
import { mainKeyboard, settingsKeyboard, traitsKeyboard, rulesKeyboard, getLevelKeyboard } from './buttons.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text = message.text;

    // Регистрация ID для очистки
    const active = await getActiveChat(chatId);
    const msgKey = `msg_ids:${chatId}:${active.id}`;
    let ids = await kv.get(msgKey) || [];
    ids.push(message.message_id);
    await kv.set(msgKey, ids.slice(-50));

    const waitState = await getWaitingState(chatId);

    // Обработка ввода (удаляем сообщение юзера сразу для чистоты)
    if (waitState) {
        await deleteTgMessage(chatId, message.message_id);
        
        if (waitState === 'await_rename') {
            await renameChat(chatId, text);
            await setWaitingState(chatId, null);
            await sendTg(chatId, `✅ Имя чата теперь: *${text}*`, settingsKeyboard);
        } 
        else if (waitState === 'await_rule') {
            await addRule(chatId, text);
            await setWaitingState(chatId, null);
            await sendTg(chatId, `📜 Правило записано.`, rulesKeyboard);
        } 
        else if (waitState.startsWith('edit_trait:')) {
            const trait = waitState.split(':')[1];
            const level = parseInt(text);
            if (!isNaN(level) && level >= 1 && level <= 10) {
                await setTrait(chatId, trait, level);
                await setWaitingState(chatId, null);
                await sendTg(chatId, `🎭 Уровень ${trait} изменен на ${level}.`, traitsKeyboard);
            }
        }
        return res.status(200).send('OK');
    }

    // Команды меню
    switch (text) {
        case "/start":
        case "⬅️ Назад":
            await sendTg(chatId, "Катя слушает. Что делаем?", mainKeyboard);
            break;

        case "⚙️ Настройки":
        case "⚙️ В настройки":
            await sendTg(chatId, "Раздел настроек:", settingsKeyboard);
            break;

        case "🎭 Характер":
        case "🎭 Назад к характеру":
            await sendTg(chatId, "Какую черту подкрутим?", traitsKeyboard);
            break;

        case "📏 Изменить Лаконичность":
            await setWaitingState(chatId, "edit_trait:brevity");
            await sendTg(chatId, "Выбери уровень (1 — кратко, 10 — болтливо):", getLevelKeyboard());
            break;

        case "❤️ Изменить Эмпатию":
            await setWaitingState(chatId, "edit_trait:empathy");
            await sendTg(chatId, "Выбери уровень (1 — робот, 10 — заботливая):", getLevelKeyboard());
            break;

        case "👤 Изменить Человечность":
            await setWaitingState(chatId, "edit_trait:humanity");
            await sendTg(chatId, "Выбери уровень (1 — ИИ, 10 — как живая):", getLevelKeyboard());
            break;

        case "📜 Правила":
            await sendTg(chatId, "Правила этого чата:", rulesKeyboard);
            break;

        case "➕ Добавить правило":
            await setWaitingState(chatId, "await_rule");
            await sendTg(chatId, "Пиши новое правило одним сообщением:");
            break;

        case "✏️ Название":
            await setWaitingState(chatId, "await_rename");
            await sendTg(chatId, "Как назовем этот чат?");
            break;

        case "📑 Положняк":
            const report = await getRulesRaw(chatId);
            await sendTg(chatId, report);
            break;

        case "🧹 Снести всё":
            await sendTg(chatId, "Заметаем следы...");
            const status = await clearChatPhysical(chatId);
            await sendTg(chatId, status, mainKeyboard);
            break;

        case "💬 Диалоги":
            const dialogs = await getDialogs(chatId);
            const dialogList = dialogs.map(d => `${d.active ? '🟢' : '⚪️'} ${d.name}`).join('\n');
            await sendTg(chatId, `Твои чаты:\n\n${dialogList}\n\n_Переключение чатов пока в разработке (скоро добавлю кнопку)._`, mainKeyboard);
            break;

        default:
            await sendTyping(chatId);
            const aiResponse = await getGeminiResponse(chatId, text);
            await sendTg(chatId, aiResponse);
    }

    return res.status(200).send('OK');
}
