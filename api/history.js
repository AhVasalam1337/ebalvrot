import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Устанавливаем заголовки для CORS, чтобы браузер не ругался
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Обработка пре-флайт запроса от браузера
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { chatId } = req.query;

    if (!chatId) {
        return res.status(400).json({ error: "Параметр chatId отсутствует" });
    }

    try {
        // Проверяем наличие таблицы и создаем её, если нужно
        await sql`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // Получаем историю
        const { rows } = await sql`
            SELECT role, content 
            FROM messages 
            WHERE chat_id = ${chatId} 
            ORDER BY created_at ASC 
            LIMIT 100
        `;

        // Форматируем для фронтенда
        const history = rows.map(row => ({
            role: row.role,
            parts: [{ text: row.content }]
        }));

        return res.status(200).json({ history });

    } catch (error) {
        console.error("Database Error:", error);
        return res.status(500).json({ 
            error: "Ошибка сервера", 
            message: error.message 
        });
    }
}
