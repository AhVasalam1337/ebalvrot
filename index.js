import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('BalastDB: 2.5 Flash Engine Active');

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body?.message?.text) return res.status(200).send('OK');

    const chatId = body.message.chat.id;
    const userText = body.message.text;

    // 1. Контекст из BalastDB
    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    // 2. Запрос к топовой Gemini 2.5 Flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    // Формируем историю для 2.5
    const contents = [
      ...history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.parts[0].text }]
      })),
      { role: "user", parts: [{ text: userText }] }
    ].slice(-20); // Память на 20 сообщений

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Gemini 2.5 Error: ${data.error.message}`);
    }

    const aiResponse = data.candidates[0].content.parts[0].text;

    // 3. Обновляем BalastDB
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-30); // Храним чуть больше для глубины

    await kv.set(historyKey, updatedHistory, { ex: 604800 });

    // 4. Отправка в Телеграм
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
    console.error("Критический сбой:", error.message);
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: chatId, 
          text: `⚠️ BalastDB Error: ${error.message}` 
        })
      });
    }
  }

  return res.status(200).send('OK');
}
