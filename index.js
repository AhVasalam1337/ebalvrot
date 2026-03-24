// index.js
import { sendTg, sendTyping, deleteMsg, getGeminiResponse, getDialogs, createNewChat, setActiveChat, deleteChat } from './methods.js';
import { mainKeyboard, getDialogsMarkup, settingsMarkup, getDeleteMarkup } from './buttons.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    // CALLBACKS (Инлайн-кнопки)
    if (req.body.callback_query) {
        const { data, message } = req.body.callback_query;
        const chatId = message.chat.id;
        const msgId = message.message_id;

        if (data === 'new_chat') {
            await deleteMsg(chatId, msgId);
            await createNewChat(chatId);
            await sendTg(chatId, "✨ Создала новый диалог!", mainKeyboard);
        } 
        else if (data.startsWith('select_chat:')) {
            await deleteMsg(chatId, msgId);
            const targetId = data.split(':')[1];
            await setActiveChat(chatId, targetId);
            await sendTg(chatId, "🔄 Переключилась. Я всё помню!", mainKeyboard);
        }
        else if (data === 'manage_delete') {
            await deleteMsg(chatId, msgId);
            const dialogs = await getDialogs(chatId);
            await sendTg(chatId, "Выбери диалог для удаления:", getDeleteMarkup(dialogs));
        }
        else if (data.startsWith('delete_confirm:')) {
            await deleteMsg(chatId, msgId);
            const targetId = data.split(':')[1];
            await deleteChat(chatId, targetId);
            await sendTg(chatId, "🗑 Удалено.", mainKeyboard);
        }
        else if (data === 'close_settings') {
            await deleteMsg(chatId, msgId);
        }
        return res.status(200).send('OK');
    }

    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text = message.text;

    try {
        if (text === '/start') {
            await sendTg(chatId, "Привет, Катя! Я на связи.", mainKeyboard);
        } 
        else if (text === '💬 Диалоги') {
            const dialogs = await getDialogs(chatId);
            await sendTg(chatId, "Твои диалоги:", getDialogsMarkup(dialogs));
        } 
        else if (text === '⚙️ Настройки') {
            await sendTg(chatId, "Настройки бота:", settingsMarkup);
        }
        else if (['📅 Планы', '🤡 Мемы'].includes(text)) {
            await sendTg(chatId, "Скоро здесь что-то будет... ✨", mainKeyboard);
        }
        else {
            // ИМИТАЦИЯ ЧЕЛОВЕКА: Сначала статус "печатает"
            await sendTyping(chatId);
            const aiResponse = await getGeminiResponse(chatId, text);
            await sendTg(chatId, aiResponse, mainKeyboard);
        }
    } catch (e) {
        console.error(e);
        await sendTg(chatId, "Упс, я призадумалась... Попробуешь еще раз? ❤️");
    }

    return res.status(200).send('OK');
}
