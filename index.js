// index.js
import { kv } from '@vercel/kv';
import { sendTg, sendTyping, getGeminiResponse, getDialogs, createNewChat, nextChat, deleteChat, getRulesRaw, setWaitingState, getWaitingState, renameChat, addRule, deleteRule, getActiveChat, setTrait, deleteTgMessage, clearChatPhysical } from './methods.js';
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

    // Обработка ожидания ввода (удаляем сообщение сразу)
    if (waitState) {
        await deleteTgMessage(chatId, message.message_id);
        if (waitState === 'await_rename') {
            await renameChat(chatId, text);
            await setWaitingState(chatId, null);
            await sendTg(chatId, `✅ Назвали: *${text}*`, settingsKeyboard);
        } else if (waitState === 'await_rule') {
            await addRule(chatId, text);
            await setWaitingState(chatId, null);
            await sendTg(chatId, `📜 Запомнила правило.`, rulesKeyboard);
        } else if (waitState.startsWith('edit_trait:')) {
            const trait = waitState.split(':')[1];
            if (!isNaN(text)) {
                await setTrait(chatId, trait, text);
                await setWaitingState(chatId, null);
                await sendTg(chatId, `🎭 ${trait} теперь на ${text}`, traitsKeyboard);
            }
        }
        return res.status(200).send('OK');
    }

    // Команды
    switch (text) {
        case "/start":
        case "⬅️ Назад":
            await sendTg(chatId, "Катя на связи.", mainKeyboard);
            break;
        case "⚙️ Настройки":
        case "⚙️ В настройки":
            await sendTg(chatId, "Что крутим?", settingsKeyboard);
            break;
        case "🎭 Характер":
        case "🎭 Назад":
            await sendTg(chatId, "Выбери черту:", traitsKeyboard);
            break;
        case "📏 Лак: + / -":
            await setWaitingState(chatId, "edit_trait:brevity");
            await sendTg(chatId, "Уровень (1-10):", getLevelKeyboard());
            break;
        case "❤️ Эмп: + / -":
            await setWaitingState(chatId, "edit_trait:empathy");
            await sendTg(chatId, "Уровень (1-10):", getLevelKeyboard());
            break;
        case "👤 Чел: + / -":
            await setWaitingState(chatId, "edit_trait:humanity");
            await sendTg(chatId, "Уровень (1-10):", getLevelKeyboard());
            break;
        case "📜 Правила":
            await sendTg(chatId, "Управление правилами:", rulesKeyboard);
            break;
        case "➕ Добавить правило":
            await setWaitingState(chatId, "await_rule");
            await sendTg(chatId, "Пиши правило:");
            break;
        case "✏️ Название":
            await setWaitingState(chatId, "await_rename");
            await sendTg(chatId, "Пиши название:");
            break;
        case "📑 Положняк":
            await sendTg(chatId, await getRulesRaw(chatId));
            break;
        case "🧹 Снести всё":
            const status = await clearChatPhysical(chatId);
            await sendTg(chatId, status, mainKeyboard);
            break;
        case "💬 Диалоги":
            const nextName = await nextChat(chatId);
            await sendTg(chatId, `🔄 Переключились на: *${nextName}*`, mainKeyboard);
            break;
        case "🗑 Удалить чат":
            const dialogs = await getDialogs(chatId);
            if (dialogs.length > 1) {
                await deleteChat(chatId, active.id);
                await sendTg(chatId, "🗑 Чат удален. Переключилась на другой.", mainKeyboard);
            } else {
                await sendTg(chatId, "Единственный чат нельзя удалить.", mainKeyboard);
            }
            break;
        default:
            await sendTyping(chatId);
            const aiResponse = await getGeminiResponse(chatId, text);
            await sendTg(chatId, aiResponse);
    }
    return res.status(200).send('OK');
}
