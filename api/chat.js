import { kv } from '@vercel/kv';
import { getGeminiResponse } from '../methods.js';

const DEFAULTS = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  
  const { text, chatId, userId } = req.body;
  if (!chatId || !userId) return res.status(400).json({ error: "Missing IDs" });

  try {
    const [globalRules, settings] = await Promise.all([
      kv.lrange('geminka:rules', 0, -1),
      kv.hgetall(`user:${userId}:chat:${chatId}:settings`)
    ]);

    const s = settings || DEFAULTS;
    const l = Number(s.laconic ?? 5); 
    const e = Number(s.empathy ?? 5); 
    const h = Number(s.human ?? 5);   
    const limit = Number(s.contextLimit ?? 20);

    let brevity = l <= 2 ? "ПИШИ ОГРОМНЫЕ ПАСТЫ." : l <= 5 ? "Будь общительным." : l <= 8 ? "Коротко, 1-2 предложения." : "СТРОГО 1-2 СЛОВА.";
    let empathy = e <= 2 ? "Будь токсичным, злым, матерись." : e <= 5 ? "Ты нейтрален." : e <= 8 ? "Будь добрым." : "ТЫ ОБОЖАЕШЬ ЕГО ❤️.";
    let human = h <= 3 ? "Как робот." : h <= 7 ? "Как человек." : "ЖИВОЙ: сленг, мат, опечатки, маленькие буквы.";

    const systemInstruction = `[MANDATE]\n${brevity}\n${empathy}\n${human}\n[RULES]\n${(globalRules || []).join('\n')}\n[STRICT] Не говори, что ты ИИ.`.trim();

    const historyKey = `history:${chatId}`;
    let formattedHistory = [];
    if (limit > 0) {
      const rawH = await kv.lrange(historyKey, -(limit * 2), -1);
      formattedHistory = (rawH || []).map(item => {
        const p = typeof item === 'string' ? JSON.parse(item) : item;
        return { role: p.role === 'user' ? 'user' : 'model', parts: [{ text: String(p.text || "") }] };
      });
    }

    const aiResponse = await getGeminiResponse(systemInstruction, [
      ...formattedHistory,
      { role: "user", parts: [{ text: String(text) }] }
    ]);

    await Promise.all([
      kv.rpush(historyKey, JSON.stringify({ role: "user", text })),
      kv.rpush(historyKey, JSON.stringify({ role: "model", text: aiResponse })),
      kv.hset(`chat:${chatId}:meta`, { updatedAt: Date.now() }),
      kv.sadd(`user:${userId}:chats`, chatId),
      kv.ltrim(historyKey, -100, -1)
    ]);

    return res.status(200).json({ text: aiResponse });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
