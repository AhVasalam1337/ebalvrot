import { Redis } from '@upstash/redis';
import { getGeminiResponse } from '../methods.js';

const redis = Redis.fromEnv();
const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { text, chatId, userId } = req.body;

    try {
        const [globalRules, rawSettings] = await Promise.all([
            redis.lrange('geminka:rules', 0, -1),
            redis.hgetall(`user:${userId}:chat:${chatId}:settings`)
        ]);

        const s = rawSettings || DEFAULTS;
        const limit = parseInt(s.contextLimit);

        let history = [];
        if (limit > 0) {
            const range = limit >= 51 ? 0 : -(limit * 2);
            const rawH = await redis.lrange(`history:${chatId}`, range, -1) || [];
            history = rawH.map(i => typeof i === 'string' ? JSON.parse(i) : i);
        }

        const sys = `
        CONSTRAINTS: 
        - LACONIC: ${s.laconic > 7 ? 'max 2 sentences' : (s.laconic < 4 ? 'detailed' : 'normal')}
        - EMOTION: ${s.empathy > 7 ? 'supportive' : (s.empathy < 4 ? 'robotic' : 'neutral')}
        - HUMANITY: ${s.human}/10
        RULES: ${(globalRules || []).join('\n')}`;

        const responseText = await getGeminiResponse(chatId, text, sys, history);

        // Обновляем мету чата (время активности), чтобы он всплывал в списке
        await redis.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() });
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'user', text }));
        await redis.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: responseText }));

        return res.status(200).json({ text: responseText });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
