// Заменяет selectChat и loadHistory
window.selectChat = async (id, name) => {
    currentChatId = id;
    localStorage.setItem('pwa_chat_id', id);
    chatNameDisplay.innerText = name;
    msgDiv.innerHTML = '<div class="p-8 text-center animate-pulse text-gray-600">Загрузка...</div>';
    
    try {
        // ОДИН запрос за всем сразу!
        const res = await fetch(`/api/manage?action=chat&userId=${userId}&chatId=${id}`);
        const data = await res.json();
        
        userSettings = data.settings;
        msgDiv.innerHTML = '';
        if (data.history) {
            data.history.forEach(m => renderMessage(m.parts[0].text, m.role === 'user' ? 'user' : 'bot'));
        }
    } catch (e) {
        msgDiv.innerHTML = 'Ошибка загрузки';
    }
    toggleMenu();
};

// Универсальное сохранение (и настроек, и имени)
async function saveChatMeta(payload) {
    return fetch(`/api/manage?action=chat&userId=${userId}&chatId=${currentChatId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

// Пример использования для настроек:
// await saveChatMeta({ settings: userSettings });

// Пример для переименования:
// await saveChatMeta({ name: "Новое имя" });
