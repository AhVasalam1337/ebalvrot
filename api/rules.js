const { sql } = require('@vercel/postgres');

export default async function handler(req, res) {
    const { method } = req;
    const { id } = req.query; // Для удаления через /api/rules?id=...

    try {
        if (method === 'GET') {
            const { rows } = await sql`SELECT id, text FROM rules ORDER BY created_at ASC`;
            return res.status(200).json({ rules: rows });
        }

        if (method === 'POST') {
            const { text } = JSON.parse(req.body);
            await sql`INSERT INTO rules (text) VALUES (${text})`;
            return res.status(200).json({ success: true });
        }

        if (method === 'DELETE') {
            await sql`DELETE FROM rules WHERE id = ${id}`;
            return res.status(200).json({ success: true });
        }

        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        res.status(405).end(`Method ${method} Not Allowed`);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
