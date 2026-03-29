import fetch from 'node-fetch';

export async function getGeminiResponse(systemInstruction, contents) {
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY не найден");

    const model = "gemini-3.1-flash-lite-preview"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const payload = {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: contents,
        generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 2048,
        }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.error) {
        throw new Error(data.error.message || "Ошибка API Gemini");
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) throw new Error("Пустой ответ от модели");

    return resultText;
}
