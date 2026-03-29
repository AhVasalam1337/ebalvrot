import fetch from 'node-fetch';

export async function getGeminiResponse(systemInstruction, contents) {
    const key = process.env.GEMINI_API_KEY;
    
    if (!key) {
        throw new Error("В настройках Vercel не найден GEMINI_API_KEY");
    }

    const model = "gemini-3.1-flash-lite-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: contents
        })
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(`Google API Error: ${data.error.message}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
        throw new Error("Gemini прислала пустой ответ (проверь фильтры безопасности)");
    }

    return text;
}
