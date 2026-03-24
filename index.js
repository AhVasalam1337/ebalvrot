// index.js
import { sendTg, sendTyping, editTg, getGeminiResponse, getDialogs, createNewChat, setActiveChat, deleteChat, getHistoryRaw } from './methods.js';
import { mainKeyboard, getDialogsMarkup, settingsMarkup, getDeleteMarkup } from './buttons.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    if (req.body.callback_query) {
        const { data, message } = req.body.callback_query;
        const chatId = message.chat.id;
        const msgId = message.message_id;

        if (data === 'new_chat') {
            await createNewChat(chatId);
            await editTg(chatId, msgId, "."); // Минимальный след
            const aiText = await getGeminiResponse(chatId, "Привет");
            await sendTg(chatId, aiText, mainKeyboard);
        } 
        else if (data.startsWith('select_chat:')) {
            const targetId = data.split(':')[1];
            await setActiveChat(chatId, targetId);
            await editTg(chatId, msgId, "·"); 
        }
        else if (data === 'manage_delete') {
            const dialogs = await getDialogs(chatId);
            await editTg(chatId, msgId, "Выбери:", getDeleteMarkup(dialogs));
        }
        else if (data.startsWith('delete_confirm:')) {
            const targetId = data.split(':')[1];
            await deleteChat(chatId, targetId);
            await editTg(chatId, msgId, "🗑");
        }
        else if (data === 'get_context') {
            const report = await getHistoryRaw(chatId);
            await sendTg(chatId, report, mainKeyboard);
        }
        else if (data === 'close_settings') {
            await editTg(chatId, msgId, ".");
        }
        return res.status(200).send('OK');
    }

    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text = message.text;

    try {
        if (text === '/start') {
            await sendTg(chatId, "Катя.", mainKeyboard);
        } 
        else if (text === '💬 Диалоги') {
            const dialogs = await getDialogs(chatId);
            await sendTg(chatId, "Диалоги:", getDialogsMarkup(dialogs));
        } 
        else if (text === '⚙️ Настройки') {
            await sendTg(chatId, "Настройки:", settingsMarkup);
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
