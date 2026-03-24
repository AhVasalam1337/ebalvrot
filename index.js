import { kv } from '@vercel/kv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  systemInstruction: "Ты — личный ассистент. Ты используешь BalastDB для контекста. Будь теплым, помни детали и поддерживай разговор. Если тебе говорят цифры или факты — запоминай их."
});

export default async function handler(req, res) {
  // Телеграм присылает данные через POST
  if (req.method !== 'POST') {
    return res.status(200).send('BalastDB Online');
  }

  try {
    const { message } = req.body;
    if (!message || !message.text) return res.status(200).send('OK');

    const chatId = message.chat.id;
    const userText = message.text;

    // 1. Читаем BalastDB
    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    // 2. Старт чата
    const chat = model.startChat({
      history: history.slice(-16) // Помним последние 8 пар сообщений
    });

    // 3. Ответ от Gemini
    const result = await chat.sendMessage(userText);
    const aiResponse = result.response.text();

    // 4. Пишем в BalastDB
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-20);

    await kv.set(historyKey, updatedHistory, { ex: 604800 }); // Храним неделю

    // 5. Отправка в ТГ
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiResponse,
        parse_mode: "Markdown"
      })
    });

  } catch (error) {
    console.error("Ошибка:", error);
  }

  return res.status(200).send('OK');
}
