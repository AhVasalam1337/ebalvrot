import fetch from 'node-fetch';

const GEMINI_KEY = process.env.GEMINI_API_KEY;

export async function getGeminiResponse(systemInstruction, contents) {
    const model = "gemini-3.1-flash-lite-preview"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const payload = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: contents, // contents уже приходят полностью готовыми из api/chat.js
        generationConfig: {
            temperature: 0.9,
            topP: 0.95,
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
        console.error("Gemini API Detailed Error:", JSON.stringify(data.error, null, 2));
        throw new Error(data.error.message);
    }

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error("Некорректный ответ от модели 3.1");
    }

    return data.candidates[0].content.parts[0].text;
}
