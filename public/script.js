/**
 * ПОЛНЫЙ КОРРЕКТНЫЙ SCRIPT.JS
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

let userId = localStorage.getItem('pwa_user_id') || 'u_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_user_id', userId);
let currentChatId = localStorage.getItem('pwa_chat_id') || 'c_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_chat_id', currentChatId);

const STATES = { MAIN: 'MAIN', DIALOGS: 'DIALOGS', RULES: 'RULES', SETTINGS: 'SETTINGS' };

function renderMenu(state) {
    menuContent.innerHTML = '';
    backBtn.classList.remove('hidden');
    switch(state) {
        case STATES.MAIN:
            menuTitle.innerText = 'Меню';
            backBtn.classList.add('hidden');
            createMenuItem('forum', 'Диалоги', () => renderMenu(STATES.DIALOGS));
            createMenuItem('gavel', 'Правила', () => renderMenu(STATES.RULES));
            createMenuItem('settings', 'Настройки', () => renderMenu(STATES.SETTINGS));
            break;
        case STATES.DIALOGS:
            menuTitle.innerText = 'Диалоги';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            syncDialogs();
            break;
        case STATES.RULES:
            menuTitle.innerText = 'Правила';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            syncRules();
            break;
        case STATES.SETTINGS:
            menuTitle.innerText = 'Настройки';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            createMenuItem('psychology', 'Характер', openCharacterEditor);
            createMenuItem('edit', 'Переименовать чат', openRenameChat);
            break;
    }
}

function createMenuItem(icon, text, action, color = 'text-gray-300') {
    const div = document.createElement('div');
    div.className = `flex items-center gap-3 ${color} p-3 hover:bg-gray-800 rounded-xl cursor-pointer active:scale-95 transition-all`;
    div.innerHTML = `<span class="material-icons-outlined">${icon}</span><span class="text-sm font-medium">${text}</span>`;
    div.onclick = action;
    menuContent.appendChild(div);
}

// СИНХРОНИЗАЦИЯ ДИАЛОГОВ
async function syncDialogs() {
    menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 animate-pulse text-[10px]">ЗАГРУЗКА...</div>';
    try {
        const res = await fetch(`/api/dialogs?userId=${userId}`);
        const data = await res.json();
        menuContent.innerHTML = '';

        // КНОПКА: НОВЫЙ ДИАЛОГ (Теперь создает его в Redis сразу)
        const nBtn = document.createElement('div');
        nBtn.className = 'flex items-center gap-3 text-geminiAccent p-3 mb-4 bg-geminiAccent/10 border border-dashed border-geminiAccent/30 rounded-xl cursor-pointer hover:bg-geminiAccent/20';
        nBtn.innerHTML = '<span class="material-icons-outlined">add_comment</span><span class="text-sm font-bold uppercase">Новый диалог</span>';
        nBtn.onclick = async () => {
            const newId = 'c_' + Math.random().toString(36).substr(2, 9);
            await fetch('/api/dialogs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, chatId: newId })
            });
            currentChatId = newId;
            localStorage.setItem('pwa_chat_id', currentChatId);
            chatNameDisplay.innerText = 'Новый чат';
            msgDiv.innerHTML = '';
            renderMessage("Чат создан и сохранен. Жду твоего сообщения!", 'bot');
            toggleMenu();
        };
        menuContent.appendChild(nBtn);

        if (data.list) {
            data.list.forEach(d => {
                const item = document.createElement('div');
                item.className = `group flex items-center justify-between p-3 mb-2 rounded-xl border border-gray-700 cursor-pointer hover:bg-gray-800 ${d.id === currentChatId ? 'bg-geminiAccent/10 border-geminiAccent' : 'bg-gray-800/30'}`;
                item.innerHTML = `
                    <div class="flex-1 truncate" onclick="selectChat('${d.id}', '${d.name}')">
                        <div class="text-sm font-bold text-white truncate">${d.name}</div>
                        <div class="text-[9px] text-gray-500 uppercase">${new Date(d.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <button class="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 p-2 transition-all" onclick="deleteChat('${d.id}')">
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
    localStorage.setItem('pwa_chat_id', currentChatId);
    chatNameDisplay.innerText = name;
    loadHistory(true);
    toggleMenu();
};

window.deleteChat = async (id) => {
    if (confirm('Удалить этот диалог?')) {
        await fetch(`/api/dialogs?userId=${userId}&chatId=${id}`, { method: 'DELETE' });
        if (id === currentChatId) location.reload(); else syncDialogs();
    }
};

// ПРАВИЛА
async function syncRules() {
    menuContent.innerHTML = '';
    const res = await fetch('/api/rules');
    const data = await res.json();
    if (data.rules) {
        data.rules.forEach((rule, idx) => {
            const div = document.createElement('div');
            div.className = 'flex items-start justify-between gap-2 p-3 bg-geminiBotMsg rounded-xl mb-2 border border-gray-800';
            div.innerHTML = `<div class="text-[12px] text-gray-300 flex-1 text-left">${rule.text}</div>
                <button class="text-gray-600 hover:text-red-400 p-1" onclick="deleteRule('${rule.id}')"><span class="material-icons-outlined text-sm">delete</span></button>`;
            menuContent.appendChild(div);
        });
    }
    const addBtn = document.createElement('button');
    addBtn.className = 'w-full p-3 mt-2 border border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-geminiAccent text-[11px] font-bold';
    addBtn.innerText = '+ ДОБАВИТЬ ПРАВИЛО';
    addBtn.onclick = openAddRule;
    menuContent.appendChild(addBtn);
}

window.deleteRule = async (id) => {
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
    syncRules();
};

function openAddRule() {
    showModal('Новое правило', '<textarea id="modalInput" class="w-full h-24 bg-gray-800 border-gray-700 rounded-xl p-3 text-white text-sm"></textarea>', async () => {
        const text = document.getElementById('modalInput').value;
        if (!text) return;
        await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        modalOverlay.classList.add('hidden');
        syncRules();
    });
}

// ПЕРЕИМЕНОВАНИЕ
function openRenameChat() {
    showModal('Переименовать чат', `<input id="modalInput" type="text" class="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-white" value="${chatNameDisplay.innerText}">`, async () => {
        const name = document.getElementById('modalInput').value;
        if (!name) return;
        await fetch('/api/chat/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: currentChatId, name })
        });
        chatNameDisplay.innerText = name;
        modalOverlay.classList.add('hidden');
        syncDialogs();
    });
}

// ОТПРАВКА
async function handleSendMessage() {
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    input.value = '';
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
        renderMessage('Ошибка.', 'bot'); 
    } finally { sendBtn.disabled = false; }
}

// ИСТОРИЯ И ПРОЧЕЕ
async function loadHistory(isFirst = false) {
    if (isFirst) msgDiv.innerHTML = '';
    const res = await fetch(`/api/history?chatId=${currentChatId}`);
    const data = await res.json();
    if (data.history) {
        data.history.forEach(m => renderMessage(m.parts[0].text, m.role === 'user' ? 'user' : 'bot', false));
    }
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

function renderMessage(text, role, anim = true) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start mb-4 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    const avatar = role === 'bot' ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full">` : `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white text-[10px]">Я</div>`;
    container.innerHTML = `${avatar}<div class="${role === 'bot' ? 'bg-geminiBotMsg border-gray-800' : 'bg-geminiUserMsg border-gray-700'} p-4 rounded-2xl max-w-[85%] text-[15px] text-white border text-left whitespace-pre-wrap">${text}</div>`;
    msgDiv.appendChild(container);
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

function showLoading() {
    const id = 'l'+Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex gap-3 mb-4';
    div.innerHTML = `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full"><div class="bg-geminiBotMsg p-4 rounded-2xl border border-gray-800 flex gap-1"><div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]"></div><div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div></div>`;
    msgDiv.appendChild(div);
    msgDiv.scrollTop = msgDiv.scrollHeight;
    return id;
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
modalCancel.onclick = () => modalOverlay.classList.add('hidden');
sendBtn.onclick = handleSendMessage;
menuBtn.onclick = toggleMenu;
overlay.onclick = toggleMenu;
input.onkeydown = (e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };
window.onload = () => loadHistory(true);
function openCharacterEditor() { alert('Скоро...'); }
