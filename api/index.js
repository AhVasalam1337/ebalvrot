import { kv } from '@vercel/kv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  systemInstruction: "Ты — личный ассистент. Ты используешь BalastDB для хранения контекста. Будь теплым в общении, помни детали и поддерживай разговор."
});

export default async function handler(req, res) {
  // Телеграм присылает данные в теле POST запроса
  if (req.method !== 'POST') {
    return res.status(200).send('Бот BalastDB запущен!');
  }

  const body = req.body;
  if (!body.message || !body.message.text) {
    return res.status(200).send('OK');
  }

  const chatId = body.message.chat.id;
  const userText = body.message.text;

  try {
    // 1. Достаем историю из BalastDB
    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    // 2. Инициализируем чат
    const chat = model.startChat({
      history: history.map(item => ({
        role: item.role,
        parts: item.parts
      })).slice(-10) // Берем последние 10 сообщений
    });

    // 3. Генерируем ответ
    const result = await chat.sendMessage(userText);
    const aiResponse = await result.response.text();

    // 4. Обновляем BalastDB
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-20);

    await kv.set(historyKey, updatedHistory, { ex: 604800 }); // Храним неделю

    // 5. Отправляем в Телеграм
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
