// index.js
import { sendTg, getGeminiResponse, getDialogs, createNewChat, setActiveChat } from './methods.js';
import { mainKeyboard, getDialogsMarkup } from './buttons.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    // Обработка инлайн-кнопок (выбор чата)
    if (req.body.callback_query) {
        const { data, message } = req.body.callback_query;
        const chatId = message.chat.id;

        if (data === 'new_chat') {
            await createNewChat(chatId);
            await sendTg(chatId, "✅ Создан новый диалог! Теперь я буду отвечать здесь.", mainKeyboard);
        } else if (data.startsWith('select_chat:')) {
            const targetId = data.split(':')[1];
            await setActiveChat(chatId, targetId);
            await sendTg(chatId, "🔄 Переключился на этот диалог. Я всё вспомнил!", mainKeyboard);
        }
        return res.status(200).send('OK');
    }

    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text = message.text;

    try {
        if (text === '/start') {
            await sendTg(chatId, "Рад тебя видеть! О чем поболтаем?", mainKeyboard);
        } else if (text === '💬 Диалоги') {
            const dialogs = await getDialogs(chatId);
            await sendTg(chatId, "Твои текущие диалоги:", getDialogsMarkup(dialogs));
        } else {
            const aiResponse = await getGeminiResponse(chatId, text);
            await sendTg(chatId, aiResponse, mainKeyboard);
        }
    } catch (e) {
        console.error(e);
    }

    return res.status(200).send('OK');
}
