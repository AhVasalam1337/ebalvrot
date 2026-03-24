// index.js
import { sendTg, getGeminiResponse } from './methods.js';
import { mainKeyboard } from './buttons.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('BalastDB Engine');

    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const text = message.text;

    try {
        if (text === '/start') {
            await sendTg(chatId, "Рад тебя видеть, солнце! Я на связи. О чем поболтаем?", mainKeyboard);
        } else if (text === '📅 Планы') {
            // Тут можно добавить логику вывода планов из базы позже
            await sendTg(chatId, "Твои планы пока в разработке, но я всё запомню! 📝", mainKeyboard);
        } else {
            // Обычный чат через Gemini 3.1 Preview
            const aiResponse = await getGeminiResponse(chatId, text);
            // ФИКС: Добавляем mainKeyboard в каждый ответ, чтобы кнопки не пропадали
            await sendTg(chatId, aiResponse, mainKeyboard);
        }
    } catch (e) {
        console.error("Ошибка в index.js:", e);
        // Не падаем в 500, просто молча логируем
    }

    return res.status(200).send('OK');
}
