// Используем встроенный fetch, импорт не нужен
export async function getGeminiResponse(systemInstruction, contents) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Ключ GEMINI_API_KEY не найден в Environment Variables");

    const model = "gemini-3.1-flash-lite-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: systemInstruction }] },
            contents: contents,
            generationConfig: { temperature: 0.9, maxOutputTokens: 2048 }
        })
    });

    const data = await res.json();
    if (data.error) throw new Error(`Gemini Error: ${data.error.message}`);
    
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "Пустой ответ";
}
