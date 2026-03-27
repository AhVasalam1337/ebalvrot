const { sql } = require('@vercel/postgres');

export default async function handler(req, res) {
    const { chatId } = req.query;
    if (!chatId) return res.status(400).json({ error: "Missing chatId" });

    try {
        // Берем последние 50 сообщений
        const { rows } = await sql`
            SELECT role, content FROM messages 
            WHERE chat_id = ${chatId} 
            ORDER BY created_at ASC
        `;

        // Мапим в формат Gemini
        const history = rows.map(row => ({
            role: row.role,
            parts: [{ text: row.content }]
        }));

        res.status(200).json({ history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
