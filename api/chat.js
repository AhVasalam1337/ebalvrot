import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
    // Настройка заголовков для работы с PWA
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    // Vercel автоматически парсит JSON, если пришел заголовок application/json
    const { text, chatId } = req.body;
    
    // В PWA мы используем chatId как идентификатор пользователя для простоты
    const userId = chatId; 

    if (!text || !chatId) {
        return res.status(400).json({ error: "Missing text or chatId" });
    }

    try {
        // 1. СОХРАНЯЕМ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ В REDIS
        const userMsg = { role: 'user', text: text, timestamp: Date.now() };
        await redis.rpush(`history:${chatId}`, JSON.stringify(userMsg));

        // 2. РЕГИСТРИРУЕМ ЧАТ В СПИСКЕ ДИАЛОГОВ (чтобы dialogs.js его видел)
        await redis.sadd(`user:${userId}:chats`, chatId);
        await redis.hset(`chat:${chatId}:meta`, { 
            updatedAt: Date.now(),
            lastSnippet: text.substring(0, 30)
        });

        // 3. ПОЛУЧАЕМ ОТВЕТ ОТ GEMINI
        // Передаем историю, если твой methods.js умеет её обрабатывать
        const responseText = await getGeminiResponse(chatId, text);

        // 4. СОХРАНЯЕМ ОТВЕТ БОТА В REDIS
        const botMsg = { role: 'model', text: responseText, timestamp: Date.now() };
        await redis.rpush(`history:${chatId}`, JSON.stringify(botMsg));

        // 5. ВОЗВРАЩАЕМ ОТВЕТ НА ФРОНТЕНД
        return res.status(200).json({ text: responseText });

    } catch (e) {
        console.error("Chat Error:", e);
        return res.status(500).json({ error: e.message });
    }
}
