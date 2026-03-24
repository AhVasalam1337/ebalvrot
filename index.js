import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('BalastDB: Armor Mode');

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chatId = body?.message?.chat?.id;
  const userText = body?.message?.text;

  if (!chatId || !userText) return res.status(200).send('OK');

  try {
    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const contents = [
      ...history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts[0].text }]
      })),
      { role: "user", parts: [{ text: userText }] }
    ].slice(-12);

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents,
        generationConfig: { temperature: 0.8, maxOutputTokens: 2000 }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(`Gemini Error: ${data.error.message}`);
    
    const aiResponse = data.candidates[0].content.parts[0].text;

    // Сохраняем в базу (фоном)
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-20);
    kv.set(historyKey, updatedHistory, { ex: 604800 }).catch(console.error);

    // --- БРОНЕБОЙНАЯ ОТПРАВКА В TELEGRAM ---
    const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
    
    // Попытка 1: С Markdown
    let tgRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiResponse.substring(0, 4000),
        parse_mode: "Markdown"
      })
    });

    // Попытка 2: Если Markdown сломался (ошибка 400), шлем чистый текст
    if (!tgRes.ok) {
      console.error("Markdown failed, sending plain text...");
      tgRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: aiResponse.substring(0, 4000)
          // parse_mode убран
        })
      });
    }

    if (!tgRes.ok) {
      const finalErr = await tgRes.json();
      throw new Error(`Telegram Final Fail: ${finalErr.description}`);
    }

  } catch (error) {
    console.error("Critical Error:", error.message);
    if (chatId) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `⚠️ Ошибка отправки: ${error.message}` })
      }).catch(() => {});
    }
  }

  return res.status(200).send('OK');
}
