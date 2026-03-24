import { kv } from '@vercel/kv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import fetch from 'node-fetch';

// Используем именно тот ключ, который ты проверил
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Возвращаемся к v1beta, раз она выдала тебе "Всё ок"
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: "v1beta" });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('BalastDB Online');

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body?.message?.text) return res.status(200).send('OK');

    const chatId = body.message.chat.id;
    const userText = body.message.text;

    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    const chat = model.startChat({
      history: history.map(item => ({
        role: item.role,
        parts: item.parts
      })).slice(-12)
    });

    const result = await chat.sendMessage(userText);
    const response = await result.response;
    const aiResponse = response.text();

    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-20);

    await kv.set(historyKey, updatedHistory, { ex: 604800 });

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
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `⚠️ Ошибка: ${error.message}` })
      });
    }
  }
  return res.status(200).send('OK');
}
