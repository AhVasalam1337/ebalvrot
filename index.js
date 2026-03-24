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
            await sendTg(chatId, "Рад тебя видеть, солнце! Я готов. О чем поболтаем?", mainKeyboard);
        } else if (text === '📅 Планы') {
            await sendTg(chatId, "Твои планы пока пусты, но я могу их запомнить!");
        } else {
            // Обычный чат через Gemini
            const aiResponse = await getGeminiResponse(chatId, text);
            await sendTg(chatId, aiResponse);
        }
    } catch (e) {
        console.error(e);
        await sendTg(chatId, "⚠️ Ошибка в движке. Проверь логи Vercel.");
    }

    return res.status(200).send('OK');
}
