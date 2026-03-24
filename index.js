import { kv } from '@vercel/kv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';

// Явно указываем версию API 'v1', чтобы избежать 404 ошибки беты
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash"
}, { apiVersion: 'v1' }); 

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('BalastDB Online and Ready');
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    if (!body || !body.message || !body.message.text) {
      return res.status(200).send('OK');
    }

    const chatId = body.message.chat.id;
    const userText = body.message.text;

    // 1. Работа с BalastDB
    const historyKey = `chat:${chatId}`;
    let history = [];
    try {
      history = await kv.get(historyKey) || [];
    } catch (dbErr) {
      console.error("Ошибка BalastDB:", dbErr.message);
    }

    // 2. Инициализация чата
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

    // 4. Обновляем BalastDB
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-20);

    await kv.set(historyKey, updatedHistory, { ex: 604800 });

    // 5. Ответ в Телегач
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
    console.error("Глобальная ошибка:", error);
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ Ошибка: ${error.message}`
        })
      });
    }
  }

  return res.status(200).send('OK');
}
