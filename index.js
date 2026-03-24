import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('BalastDB Online');

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body?.message?.text) return res.status(200).send('OK');

    const chatId = body.message.chat.id;
    const userText = body.message.text;

    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const contents = [
      ...history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.parts[0].text }]
      })),
      { role: "user", parts: [{ text: userText }] }
    ].slice(-16);

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    const data = await response.json();
    if (data.error) throw new Error(`Gemini Error: ${data.error.message}`);

    const aiResponse = data.candidates[0].content.parts[0].text;

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
