import { kv } from '@vercel/kv';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('BalastDB Diagnosing...');

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body?.message?.text) return res.status(200).send('OK');

    const chatId = body.message.chat.id;
    const userText = body.message.text;

    // Ссылка для получения списка моделей
    const listModelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await fetch(listModelsUrl);
    const data = await response.json();

    if (data.error) throw new Error(`Google Auth Error: ${data.error.message}`);

    // Формируем список названий моделей
    const modelList = data.models
      ? data.models.map(m => m.name.replace('models/', '')).join('\n')
      : "Список пуст или не получен";

    // Отправляем тебе в ТГ реальный список того, что видит сервер
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🚀 Доступные модели для твоего ключа:\n\n${modelList}\n\nНапиши мне ту, которую хочешь затестить!`
      })
    });

  } catch (error) {
    const chatId = req.body?.message?.chat?.id;
    if (chatId) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `⚠️ Диагностика упала: ${error.message}` })
      });
    }
  }
  return res.status(200).send('OK');
}
