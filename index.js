import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Статус для проверки из браузера
  if (req.method !== 'POST') {
    return res.status(200).send('BalastDB System: Direct Connection Ready');
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || !body.message || !body.message.text) return res.status(200).send('OK');

    const chatId = body.message.chat.id;
    const userText = body.message.text;

    // 1. Берем историю из BalastDB
    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    // 2. Формируем запрос к Gemini напрямую по URL
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    // Преобразуем историю BalastDB в формат Google
    const contents = [
      ...history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.parts[0].text }]
      })),
      { role: "user", parts: [{ text: userText }] }
    ].slice(-16); // Берем последние 16 сообщений

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Gemini Error: ${data.error.message}`);
    }

    const aiResponse = data.candidates[0].content.parts[0].text;

    // 3. Сохраняем в BalastDB
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-20);

    await kv.set(historyKey, updatedHistory, { ex: 604800 });

    // 4. Отправляем в Телеграм
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
    console.error("Критическая ошибка:", error.message);
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ Прямой вызов упал: ${error.message}`
        })
      });
    }
  }

  return res.status(200).send('OK');
}
