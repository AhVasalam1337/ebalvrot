import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // 1. Разрешаем CORS (чтобы браузер не блокировал запрос)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { chatId } = req.query;

    if (!chatId) {
        return res.status(400).json({ error: "Missing chatId parameter" });
    }

    try {
        // 2. Проверка/Создание таблицы (на случай, если база пустая)
        await sql`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // 3. Запрос данных
        const { rows } = await sql`
            SELECT role, content 
            FROM messages 
            WHERE chat_id = ${chatId} 
            ORDER BY created_at ASC 
            LIMIT 100
        `;

        // 4. Форматирование под фронтенд
        const history = rows.map(row => ({
            role: row.role,
            parts: [{ text: row.content }]
        }));

        return res.status(200).json({ history });

    } catch (error) {
        console.error("Database Error:", error);
        // Возвращаем детали ошибки, чтобы мы их увидели в консоли браузера
        return res.status(500).json({ 
            error: "Internal Server Error", 
            message: error.message,
            stack: error.stack 
        });
    }
}
