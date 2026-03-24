// index.js
import { sendTg, getGeminiResponse } from './methods.js'; // Фикс: добавлено .js
import { mainKeyboard } from './buttons.js';           // Фикс: добавлено .js

export default async function handler(req, res) {
    // Проверка на пустой запрос (чтобы Vercel не падал при пингах)
    if (req.method !== 'POST') return res.status(200).send('BalastDB Core is Online');

    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text = message.text;

    try {
        if (text === '/start') {
            await sendTg(chatId, "Рад тебя видеть, солнце! Я на связи. О чем поболтаем?", mainKeyboard);
        } else if (text === '📅 Планы') {
            await sendTg(chatId, "Твои планы пока в разработке, но я всё запомню! 📝");
        } else {
            // Запрос к нейронке через вынесенный метод
            const aiResponse = await getGeminiResponse(chatId, text);
            await sendTg(chatId, aiResponse);
        }
    } catch (e) {
        console.error("Критическая ошибка хендлера:", e);
        // Не даем функции упасть с 500, возвращаем 200, чтобы ТГ не спамил повторами
    }

    return res.status(200).send('OK');
}
