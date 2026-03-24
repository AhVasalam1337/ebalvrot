import { kv } from '@vercel/kv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  systemInstruction: "Ты — личный ассистент. Ты используешь BalastDB для хранения контекста. Будь теплым в общении, помни детали и поддерживай разговор. Если тебе говорят цифры или факты — запоминай их."
});

export default async function handler(req, res) {
  // Проверка метода. Если заходим через браузер — видим статус.
  if (req.method !== 'POST') {
    return res.status(200).send('BalastDB Online and Ready');
  }

  try {
    // Явный парсинг body, если Vercel прислал его как строку
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    if (!body || !body.message || !body.message.text) {
      return res.status(200).send('OK');
    }

    const chatId = body.message.chat.id;
    const userText = body.message.text;

    // 1. Извлекаем историю из BalastDB
    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    // 2. Инициализация чата с историей (максимум 14 сообщений для экономии токенов)
    const chat = model.startChat({
      history: history.map(item => ({
        role: item.role,
        parts: item.parts
      })).slice(-14)
    });

    // 3. Запрос к Gemini
    const result = await chat.sendMessage(userText);
    const response = await result.response;
    const aiResponse = response.text();

    // 4. Сохраняем новый контекст в BalastDB
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-20); // Держим лимит в 20 сообщений в базе

    await kv.set(historyKey, updatedHistory, { ex: 604800 }); // TTL 7 дней

    // 5. Отправка ответа в Telegram
    const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiResponse,
        parse_mode: "Markdown"
      })
    });

  } catch (error) {
    console.error("Критическая ошибка BalastDB/Gemini:", error);
    // Попытка отправить сообщение об ошибке пользователю
    try {
      const chatId = req.body?.message?.chat?.id;
      if (chatId) {
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Брат, система BalastDB словила временный глюк. Попробуй еще раз через минуту."
          })
        });
      }
    } catch (tgError) {
      console.error("Не удалось отправить отчет об ошибке в TG:", tgError);
    }
  }

  return res.status(200).send('OK');
}
