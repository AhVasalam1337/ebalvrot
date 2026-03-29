import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ text: 'No' })

  try {
    const { text, chatId } = req.body
    const key = process.env.GEMINI_API_KEY
    const model = 'gemini-3.1-flash-lite-preview'

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: text || 'Привет' }] }]
      })
    })

    const data = await response.json()
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Ошибка API'

    if (chatId) {
      await kv.rpush(`history:${chatId}`, JSON.stringify({ role: 'model', text: aiText }))
    }

    return res.status(200).json({ text: aiText })
  } catch (err) {
    return res.status(200).json({ text: 'Crash: ' + err.message })
  }
}
