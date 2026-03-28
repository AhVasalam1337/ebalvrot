// В функции syncDialogs (внутри script.js) добавь этот блок в начало отрисовки:
async function syncDialogs() {
    menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 animate-pulse text-[10px]">ЗАГРУЗКА...</div>';
    try {
        const res = await fetch(`/api/dialogs?userId=${myId}`);
        const data = await res.json();
        menuContent.innerHTML = '';

        // КНОПКА "НОВЫЙ ЧАТ"
        const newChatBtn = document.createElement('div');
        newChatBtn.className = 'flex items-center gap-3 text-geminiAccent p-3 mb-4 bg-geminiAccent/10 border border-dashed border-geminiAccent/30 rounded-xl cursor-pointer hover:bg-geminiAccent/20 transition-all';
        newChatBtn.innerHTML = '<span class="material-icons-outlined">add_comment</span><span class="text-sm font-bold uppercase">Новый диалог</span>';
        newChatBtn.onclick = () => {
            const newId = 'pwa_' + Math.random().toString(36).substr(2, 9);
            myId = newId;
            localStorage.setItem('pwa_chat_id', myId);
            chatNameDisplay.innerText = 'Geminка';
            msgDiv.innerHTML = '';
            renderMessage("Новый диалог начат. О чём поболтаем?", 'bot');
            toggleMenu();
        };
        menuContent.appendChild(newChatBtn);

        // Далее идет отрисовка существующих диалогов (код остается прежним)
        if (data.list && data.list.length > 0) {
            data.list.forEach(d => {
                const item = document.createElement('div');
                item.className = `p-3 mb-2 rounded-xl border border-gray-700 cursor-pointer hover:bg-gray-800 ${d.id === myId ? 'bg-geminiAccent/10 border-geminiAccent' : 'bg-gray-800/30'}`;
                item.innerHTML = `<div class="text-sm font-bold text-white truncate">${d.name || 'Чат ' + d.id.slice(0,4)}</div>`;
                item.onclick = () => {
                    myId = d.id;
                    localStorage.setItem('pwa_chat_id', myId);
                    chatNameDisplay.innerText = d.name || 'Geminка';
                    loadHistory(true); // ПОДГРУЗКА ИСТОРИИ ПРИ ПЕРЕХОДЕ
                    toggleMenu();
                };
                menuContent.appendChild(item);
            });
        }
    } catch (e) { console.error(e); }
}

// В функции renderMessage (в script.js) поправь стили текста:
function renderMessage(text, role, anim = true) {
    // ... (весь код контейнера)
    // Измени класс текстового блока на:
    // "text-[15px] text-white border whitespace-pre-wrap leading-relaxed shadow-sm text-left w-full"
    // Добавление text-left и w-full уберет "странную центровку"
}
