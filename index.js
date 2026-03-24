import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('BalastDB: Debug Mode Active');

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chatId = body?.message?.chat?.id;
  const userText = body?.message?.text;

  if (!chatId || !userText) return res.status(200).send('OK');

  let currentStep = "Инициализация";

  try {
    // ЛОВУШКА 1: BalastDB
    currentStep = "Чтение из BalastDB";
    const historyKey = `chat:${chatId}`;
    let history = [];
    try {
      history = await kv.get(historyKey) || [];
    } catch (dbError) {
      console.error("DB Error:", dbError);
      // Не роняем всё, если база легла, просто идем без истории
    }

    // ЛОВУШКА 2: Подготовка запроса к Gemini
    currentStep = "Запрос к Gemini 2.0-flash-lite";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const contents = [
      ...history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts[0].text }]
      })),
      { role: "user", parts: [{ text: userText }] }
    ].slice(-10);

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2000 }
      })
    });

    // ЛОВУШКА 3: Парсинг ответа Gemini
    currentStep = "Парсинг ответа Gemini";
    const data = await geminiResponse.json();

    if (data.error) {
      throw new Error(`Google API Error: ${data.error.message} (Code: ${data.error.code})`);
    }

    if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
      // Проверяем причину блокировки (Safety)
      const safetyReason = data.promptFeedback?.blockReason || "Неизвестная блокировка";
      throw new Error(`Gemini ничего не выдал. Причина: ${safetyReason}`);
    }

    let aiResponse = data.candidates[0].content.parts[0].text;

    // ЛОВУШКА 4: Сохранение в базу
    currentStep = "Сохранение в BalastDB";
    const updatedHistory = [
      ...history,
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: aiResponse }] }
    ].slice(-20);
    
    kv.set(historyKey, updatedHistory, { ex: 604800 }).catch(e => console.error("KV Set Error:", e));

    // ЛОВУШКА 5: Отправка в Telegram
    currentStep = "Отправка в Telegram";
    const telegramUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
    
    const tgRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: aiResponse.substring(0, 4000), // Страховка от лимита ТГ
        parse_mode: "Markdown"
      })
    });

    if (!tgRes.ok) {
      const tgErr = await tgRes.json();
      throw new Error(`Telegram API Error: ${tgErr.description}`);
    }

  } catch (error) {
    console.error(`Ошибка на этапе [${currentStep}]:`, error.message);
    
    // Отправляем отчет об ошибке прямо в ТГ пользователю
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `❌ Сбой на этапе: *${currentStep}*\n\nСообщение: \`${error.message}\``,
          parse_mode: "Markdown"
        })
      });
    } catch (e) {
      console.error("Не удалось отправить отчет об ошибке в ТГ");
    }
  }

  return res.status(200).send('OK');
}
