import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Добавляем CORS заголовки на всякий случай
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'GET') {
            const { rows } = await sql`SELECT id, text FROM rules ORDER BY created_at ASC`;
            return res.status(200).json({ rules: rows || [] });
        }

        if (req.method === 'POST') {
            const { text } = req.body; // Vercel автоматически парсит JSON в body
            if (!text) return res.status(400).json({ error: "Text is required" });
            await sql`INSERT INTO rules (text) VALUES (${text})`;
            return res.status(200).json({ success: true });
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            await sql`DELETE FROM rules WHERE id = ${id}`;
            return res.status(200).json({ success: true });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message, details: "Check BalastDB connection" });
    }
}
