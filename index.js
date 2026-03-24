// index.js
import { sendTg, sendTyping, editTg, getGeminiResponse, getDialogs, createNewChat, setActiveChat, deleteChat, getHistoryRaw, setWaitingState, getWaitingState, renameChat } from './methods.js';
import { mainKeyboard, getDialogsMarkup, settingsMarkup, getDeleteMarkup } from './buttons.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    if (req.body.callback_query) {
        const { data, message } = req.body.callback_query;
        const chatId = message.chat.id;
        const msgId = message.message_id;

        if (data === 'new_chat') {
            await createNewChat(chatId);
            await editTg(chatId, msgId, "💎");
            const aiText = await getGeminiResponse(chatId, "Привет");
            await sendTg(chatId, aiText, mainKeyboard);
        } 
        else if (data.startsWith('select_chat:')) {
            const targetId = data.split(':')[1];
            await setActiveChat(chatId, targetId);
            await editTg(chatId, msgId, "✅"); 
        }
        else if (data === 'rename_start') {
            await setWaitingState(chatId, 'await_rename');
            await editTg(chatId, msgId, "Напиши новое название для этого чата:");
        }
        else if (data === 'manage_delete') {
            const dialogs = await getDialogs(chatId);
            await editTg(chatId, msgId, "Выбери диалог для удаления 🗑:", getDeleteMarkup(dialogs));
        }
        else if (data.startsWith('delete_confirm:')) {
            const targetId = data.split(':')[1];
            await deleteChat(chatId, targetId);
            await editTg(chatId, msgId, "🗑 Удалено.");
        }
        else if (data === 'get_context') {
            const report = await getHistoryRaw(chatId);
            await sendTg(chatId, report, mainKeyboard);
        }
        else if (data === 'close_settings') {
            await editTg(chatId, msgId, "☁️");
        }
        return res.status(200).send('OK');
    }

    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text = message.text;

    // Проверка режима ожидания (переименование)
    const waitState = await getWaitingState(chatId);
    if (waitState === 'await_rename') {
        await renameChat(chatId, text);
        await setWaitingState(chatId, null);
        await sendTg(chatId, `📝 Переименовала в: ${text}`, mainKeyboard);
        return res.status(200).send('OK');
    }

    try {
        if (text === '/start') {
            await sendTg(chatId, "Катя. ✨", mainKeyboard);
        } 
        else if (text === '💬 Диалоги') {
            const dialogs = await getDialogs(chatId);
            await sendTg(chatId, "Твои диалоги 💬:", getDialogsMarkup(dialogs));
        } 
        else if (text === '⚙️ Настройки') {
            await sendTg(chatId, "Настройки ⚙️:", settingsMarkup);
        }
        else if (['📅 Планы', '🤡 Мемы'].includes(text)) {
            await sendTg(chatId, "Скоро здесь что-то будет... ☁️", mainKeyboard);
        }
        else {
            await sendTyping(chatId);
            const aiResponse = await getGeminiResponse(chatId, text);
            await sendTg(chatId, aiResponse, mainKeyboard);
        }
    } catch (e) {
        console.error(e);
    }

    return res.status(200).send('OK');
}
