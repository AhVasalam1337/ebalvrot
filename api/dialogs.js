const { sql } = require('@vercel/postgres');

export default async function handler(req, res) {
    const { userId } = req.query;
    try {
        // Выбираем уникальные chat_id и их имена
        const { rows } = await sql`
            SELECT chat_id as id, MAX(created_at) as updated_at 
            FROM messages 
            GROUP BY chat_id 
            ORDER BY updated_at DESC
        `;
        // Добавляем заглушку имени, если в базе нет отдельной таблицы chats
        const list = rows.map(r => ({
            id: r.id,
            name: `Чат ${r.id.substring(0, 5)}...`,
            updatedAt: r.updated_at
        }));
        res.status(200).json({ list });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
