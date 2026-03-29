export async function getGeminiResponse(systemInstruction, contents) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Ключ GEMINI_API_KEY не найден");

    const model = "gemini-3.1-flash-lite-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const payload = {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: contents,
        generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            maxOutputTokens: 2048
        }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (!res.ok || data.error) {
        throw new Error(`Ошибка Gemini API: ${data?.error?.message || res.statusText}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Пустой ответ от модели");

    return text;
}
