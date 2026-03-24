import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('BalastDB: Warp Speed');

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const chatId = body?.message?.chat?.id;
    const userText = body?.message?.text;

    if (!chatId || !userText) return res.status(200).send('OK');

    const historyKey = `chat:${chatId}`;
    let history = await kv.get(historyKey) || [];

    // Переходим на 2.0-flash-lite для скорости, чтобы не ловить таймаут Vercel
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const contents = [
      ...history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts[0].text }]
      })),
      { role: "user", parts: [{ text: userText }] }
    ].slice(-12); // Немного сократили контекст для скорости подгрузки

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2500, // Это примерно 10 000 - 12 000 символов, но ТГ съест только 4к
          topP: 0.95,
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
    
    if (!data.candidates || !data.candidates[0].content) {
      throw new Error("ИИ промолчал или запрос заблокирован.");
    }

    let aiResponse = data.candidates[0].content.parts[0].text;

    // Обрезаем текст под лимит Telegram (4096 символов), чтобы не было ошибки 400
    if (aiResponse.length > 4000) {
      aiResponse = aiResponse.substring(0, 3950) + "... (текст обрезан лимитом Telegram)";
    }

    // Сохраняем историю в фоне
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-20);
    
    kv.set(historyKey, updatedHistory, { ex: 604800 }).catch(console.error);

    // Отправка в ТГ
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
    console.error("Ошибка:", error.message);
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `⚠️ Баг: ${error.message}` })
      }).catch(() => {});
    }
  }

  return res.status(200).send('OK');
}
