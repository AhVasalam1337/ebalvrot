import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('BalastDB: Supercharged');

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const chatId = body?.message?.chat?.id;
    const userText = body?.message?.text;

    if (!chatId || !userText) return res.status(200).send('OK');

    // 1. Контекст BalastDB
    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    // 2. Прямой запрос к Gemini 2.5 Flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const contents = [
      ...history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts[0].text }]
      })),
      { role: "user", parts: [{ text: userText }] }
    ].slice(-16);

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents,
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048, // Больше текста!
          topP: 0.95,
        },
        safetySettings: [ // Чтобы не обрывала на полуслове
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0].content) {
      throw new Error(data.error?.message || "Пустой ответ от ИИ");
    }

    const aiResponse = data.candidates[0].content.parts[0].text;

    // 3. Быстрое сохранение в BalastDB (не ждем завершения)
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-24);
    
    kv.set(historyKey, updatedHistory, { ex: 604800 }).catch(console.error);

    // 4. Моментальная отправка в Телеграм
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
    console.error("Сбой:", error.message);
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `⚠️ Туплю: ${error.message}` })
      }).catch(e => {});
    }
  }

  return res.status(200).send('OK');
}
