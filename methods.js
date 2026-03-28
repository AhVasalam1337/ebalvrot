import fetch from 'node-fetch';

const GEMINI_KEY = process.env.GEMINI_API_KEY;

/**
 * Ядро общения с ИИ.
 * @param {string} systemInstruction - Установки личности (идут в подкорку).
 * @param {Array} contents - История сообщений в формате {role, parts}.
 */
export async function getGeminiResponse(systemInstruction, contents) {
    const model = "gemini-1.5-flash"; // Оптимально для диалогов
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    const payload = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: contents,
        generationConfig: {
            temperature: 0.9, // Делает речь живой
            topP: 0.95,
            maxOutputTokens: 1024,
        }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.candidates?.[0]) {
        console.error("Gemini API Error:", JSON.stringify(data, null, 2));
        throw new Error(data.error?.message || "Ошибка генерации ответа");
    }

    return data.candidates[0].content.parts[0].text;
}
