export async function getGeminiStream(systemInstruction, contents) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Ключ GEMINI_API_KEY не найден");

    const model = "gemini-3.1-flash-lite-preview";
    // ВАЖНО: URL меняется на streamGenerateContent
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;

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

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || "Ошибка стриминга API");
    }

    return res.body; // Возвращаем поток (ReadableStream)
}

// Старую функцию getGeminiResponse можно оставить для других нужд
