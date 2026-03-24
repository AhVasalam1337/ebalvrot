import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('BalastDB: 3.1 Lite Engine');

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chatId = body?.message?.chat?.id;
  const userText = body?.message?.text;

  if (!chatId || !userText) return res.status(200).send('OK');

  let currentStep = "Подготовка";

  try {
    currentStep = "Чтение истории";
    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    // Используем найденную тобой модель Gemini 3.1 Flash Lite
    currentStep = "Запрос к Gemini 3.1 Flash Lite";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const contents = [
      ...history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts[0].text }]
      })),
      { role: "user", parts: [{ text: userText }] }
    ].slice(-14); // Оптимально для 250K TPM

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents,
        generationConfig: { 
            temperature: 0.75, 
            maxOutputTokens: 2000,
            topP: 0.95
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    const data = await response.json();

    if (data.error) {
      // Если лимит 429 всё же прилетел, выдаем красивый ответ
      if (data.error.code === 429) {
          throw new Error("🚀 Слишком быстро строчишь! Подожди 10 секунд и попробуй снова.");
      }
      throw new Error(data.error.message);
    }

    const aiResponse = data.candidates[0].content.parts[0].text;

    currentStep = "Обновление базы";
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-20);
    
    kv.set(historyKey, updatedHistory, { ex: 604800 }).catch(e => console.error(e));

    currentStep = "Отправка в ТГ";
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiResponse.substring(0, 4000),
        parse_mode: "Markdown"
      })
    });

  } catch (error) {
    console.error(`Ошибка [${currentStep}]:`, error.message);
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ *BalastDB:* ${error.message}`,
          parse_mode: "Markdown"
        })
      });
    }
  }

  return res.status(200).send('OK');
}
