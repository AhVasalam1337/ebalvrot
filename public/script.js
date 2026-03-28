/**
 * ПОЛНЫЙ SCRIPT.JS - ФИКС КНОПКИ И ИМЕН
 */
const msgDiv = document.getElementById('chat-messages');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuContent = document.getElementById('menuContent');
const menuTitle = document.getElementById('menuTitle');
const backBtn = document.getElementById('backBtn');
const chatNameDisplay = document.getElementById('chatNameDisplay');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalSave = document.getElementById('modalSave');
const modalCancel = document.getElementById('modalCancel');

const STATES = { MAIN: 'MAIN', DIALOGS: 'DIALOGS', RULES: 'RULES', SETTINGS: 'SETTINGS' };

let userId = localStorage.getItem('pwa_user_id') || 'u_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_user_id', userId);
let currentChatId = localStorage.getItem('pwa_chat_id') || 'c_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_chat_id', currentChatId);

let userSettings = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

// ФУНКЦИЯ ОЖИВЛЕНИЯ КНОПКИ
function checkInput() {
    const text = input.value.trim();
    if (text.length > 0) {
        sendBtn.disabled = false;
        sendBtn.classList.remove('opacity-50', 'grayscale', 'pointer-events-none');
        sendBtn.classList.add('bg-geminiAccent', 'text-black'); // Принудительно делаем активной
    } else {
        sendBtn.disabled = true;
        sendBtn.classList.add('opacity-50', 'grayscale', 'pointer-events-none');
    }
}

async function handleSendMessage() {
    const text = input.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    sendBtn.classList.add('opacity-50');
    input.value = '';
    checkInput(); // Сразу гасим кнопку после отправки

    renderMessage(text, 'user');
    const lId = showLoading();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, chatId: currentChatId, userId })
        });
        const data = await res.json();
        document.getElementById(lId)?.remove();
        if (data.text) renderMessage(data.text, 'bot');
    } catch (e) {
        document.getElementById(lId)?.remove();
        renderMessage('Ошибка связи.', 'bot');
    } finally {
        checkInput();
    }
}

async function syncDialogs() {
    menuContent.innerHTML = '<div class="p-4 text-center text-gray-500 text-[10px]">ЗАГРУЗКА...</div>';
    try {
        const res = await fetch(`/api/dialogs?userId=${userId}`);
        const data = await res.json();
        menuContent.innerHTML = '';

        // Кнопка нового чата
        const nBtn = document.createElement('div');
        nBtn.className = 'flex items-center gap-3 text-geminiAccent p-4 mb-4 bg-geminiAccent/10 border border-dashed border-geminiAccent/30 rounded-xl cursor-pointer';
        nBtn.innerHTML = '<span class="material-icons-outlined">add_comment</span><span class="text-sm font-bold uppercase">Новый чат</span>';
        nBtn.onclick = async () => {
            const newId = 'c_' + Math.random().toString(36).substr(2, 9);
            await fetch('/api/dialogs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, chatId: newId }) });
            currentChatId = newId;
            localStorage.setItem('pwa_chat_id', newId);
            chatNameDisplay.innerText = 'Новый чат';
            msgDiv.innerHTML = '';
            toggleMenu();
        };
        menuContent.appendChild(nBtn);

        if (data.list) {
            data.list.forEach(d => {
                const item = document.createElement('div');
                item.className = `flex items-center justify-between p-3 mb-2 rounded-xl border border-gray-700 cursor-pointer ${d.id === currentChatId ? 'bg-geminiAccent/10 border-geminiAccent' : 'bg-gray-800/30'}`;
                item.innerHTML = `
                    <div class="flex-1 truncate" onclick="selectChat('${d.id}', '${d.name.replace(/'/g, "&apos;")}')">
                        <div class="text-sm font-bold text-white truncate">${d.name}</div>
                        <div class="text-[9px] text-gray-500 uppercase">${new Date(d.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <button class="text-gray-600 hover:text-red-400 p-2 ml-2" onclick="deleteChat('${d.id}')">
                        <span class="material-icons-outlined text-sm">delete</span>
                    </button>
                `;
                menuContent.appendChild(item);
            });
        }
    } catch (e) { console.error(e); }
}

window.selectChat = (id, name) => {
    currentChatId = id;
    localStorage.setItem('pwa_chat_id', id);
    chatNameDisplay.innerText = name;
    loadHistory(true);
    toggleMenu();
};

window.deleteChat = async (id) => {
    if (!confirm('Удалить этот диалог?')) return;
    await fetch(`/api/dialogs?userId=${userId}&chatId=${id}`, { method: 'DELETE' });
    if (id === currentChatId) location.reload(); else syncDialogs();
};

function openRenameChat() {
    showModal('Имя чата', `<input id="modalInput" type="text" class="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-white" value="${chatNameDisplay.innerText}">`, async () => {
        const newName = document.getElementById('modalInput').value.trim();
        if (!newName) return;
        
        const res = await fetch('/api/chat/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: currentChatId, name: newName })
        });

        if (res.ok) {
            chatNameDisplay.innerText = newName;
            modalOverlay.classList.add('hidden');
            // Важно: перерисовываем меню, чтобы имя обновилось в списке
            if (sidebar.classList.contains('translate-x-0')) renderMenu(STATES.SETTINGS);
        }
    });
}

// Вспомогательные функции рендера
function renderMenu(state) {
    menuContent.innerHTML = '';
    backBtn.classList.remove('hidden');
    switch(state) {
        case STATES.MAIN:
            menuTitle.innerText = 'Меню';
            backBtn.classList.add('hidden');
            createMenuItem('forum', 'Диалоги', () => renderMenu(STATES.DIALOGS));
            createMenuItem('gavel', 'Правила', () => renderMenu(STATES.RULES));
            createMenuItem('tune', 'Конфигурация', () => renderMenu(STATES.SETTINGS));
            break;
        case STATES.DIALOGS:
            menuTitle.innerText = 'Диалоги';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            syncDialogs();
            break;
        case STATES.SETTINGS:
            menuTitle.innerText = 'Настройки';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            createMenuItem('edit', 'Переименовать этот чат', openRenameChat);
            renderSettingsSliders(); // Добавляем ползунки характера сюда
            break;
        case STATES.RULES:
            menuTitle.innerText = 'Правила';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            syncRules();
            break;
    }
}

function createMenuItem(icon, text, action) {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-3 text-gray-300 p-4 hover:bg-gray-800 rounded-xl cursor-pointer mb-1';
    div.innerHTML = `<span class="material-icons-outlined">${icon}</span><span class="text-sm font-medium">${text}</span>`;
    div.onclick = action;
    menuContent.appendChild(div);
}

function renderMessage(text, role) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start mb-5 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    const avatar = role === 'bot' ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0">` : `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white text-[10px] shrink-0 font-bold uppercase">Я</div>`;
    container.innerHTML = `${avatar}<div class="${role === 'bot' ? 'bg-geminiBotMsg border-gray-800' : 'bg-geminiUserMsg border-gray-700'} p-4 rounded-2xl max-w-[85%] text-[15px] text-white border text-left whitespace-pre-wrap">${text}</div>`;
    msgDiv.appendChild(container);
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

function showLoading() {
    const id = 'l' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex gap-3 mb-5';
    div.innerHTML = `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0"><div class="bg-geminiBotMsg p-4 rounded-2xl border border-gray-800 flex gap-1"><div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]"></div><div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div></div>`;
    msgDiv.appendChild(div);
    msgDiv.scrollTop = msgDiv.scrollHeight;
    return id;
}

async function loadHistory(isFirst = false) {
    if (isFirst) msgDiv.innerHTML = '';
    const res = await fetch(`/api/history?chatId=${currentChatId}`);
    const data = await res.json();
    if (data.history) data.history.forEach(m => renderMessage(m.parts?.[0]?.text || m.text, m.role === 'user' ? 'user' : 'bot'));
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

function toggleMenu() {
    if (sidebar.classList.contains('translate-x-0')) {
        sidebar.classList.replace('translate-x-0', '-translate-x-full');
        overlay.classList.add('hidden');
    } else {
        renderMenu(STATES.MAIN);
        sidebar.classList.replace('-translate-x-full', 'translate-x-0');
        overlay.classList.remove('hidden');
    }
}

function showModal(title, body, onSave) {
    modalTitle.innerText = title; modalBody.innerHTML = body; modalOverlay.classList.remove('hidden'); modalSave.onclick = onSave;
}

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
    // Слушаем ввод текста для оживления кнопки
    input.addEventListener('input', checkInput);
    
    sendBtn.addEventListener('click', handleSendMessage);
    menuBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
    modalCancel.addEventListener('click', () => modalOverlay.classList.add('hidden'));
    
    input.addEventListener('keydown', (e) => { 
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            handleSendMessage(); 
        } 
    });

    checkInput(); // Проверка при загрузке
    loadHistory(true);
});
