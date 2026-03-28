/**
 * ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ
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

// Локальный кеш настроек
let userSettings = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

/**
 * ЛОГИКА ИНТЕРФЕЙСА
 */
function checkInput() {
    const text = input.value.trim();
    if (text.length > 0) {
        sendBtn.disabled = false;
        sendBtn.classList.remove('opacity-50', 'grayscale', 'pointer-events-none');
    } else {
        sendBtn.disabled = true;
        sendBtn.classList.add('opacity-50', 'grayscale', 'pointer-events-none');
    }
}

async function loadSettings() {
    try {
        const res = await fetch(`/api/user/settings?userId=${userId}`);
        const data = await res.json();
        userSettings = data;
    } catch (e) { console.error("Settings load error"); }
}

async function handleSendMessage() {
    const text = input.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    input.value = '';
    checkInput();
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
        renderMessage('Ошибка сети.', 'bot');
    } finally {
        checkInput();
    }
}

/**
 * РЕНДЕРИНГ МЕНЮ
 */
function renderMenu(state) {
    menuContent.innerHTML = '';
    backBtn.classList.remove('hidden');
    
    switch(state) {
        case STATES.MAIN:
            menuTitle.innerText = 'Меню';
            backBtn.classList.add('hidden');
            createMenuItem('forum', 'Диалоги', () => renderMenu(STATES.DIALOGS));
            createMenuItem('gavel', 'Правила', () => renderMenu(STATES.RULES));
            createMenuItem('tune', 'Настройки', () => renderMenu(STATES.SETTINGS));
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
            renderSettingsSliders();
            break;
    }
}

function createMenuItem(icon, text, action) {
    const div = document.createElement('div');
    div.className = 'flex items-center gap-3 text-gray-300 p-4 hover:bg-gray-800 rounded-xl cursor-pointer mb-1 transition-all';
    div.innerHTML = `<span class="material-icons-outlined">${icon}</span><span class="text-sm font-medium">${text}</span>`;
    div.onclick = action;
    menuContent.appendChild(div);
}

/**
 * НАСТРОЙКИ (ПОЛЗУНКИ)
 */
function renderSettingsSliders() {
    const box = document.createElement('div');
    box.className = 'space-y-6 p-2';

    // Рендерим Переименование чата сверху
    const renameBtn = document.createElement('div');
    renameBtn.className = 'flex items-center gap-3 text-blue-400 p-4 bg-blue-400/10 rounded-xl cursor-pointer mb-4';
    renameBtn.innerHTML = '<span class="material-icons-outlined">edit</span><span class="text-xs font-bold uppercase">Переименовать этот чат</span>';
    renameBtn.onclick = openRenameChat;
    box.appendChild(renameBtn);

    // Ползунки Характера
    const charBox = document.createElement('div');
    charBox.className = 'bg-gray-800/50 rounded-2xl p-4 border border-gray-700 space-y-4';
    charBox.innerHTML = `<div class="text-[10px] font-bold text-geminiAccent uppercase tracking-widest mb-2">Характер</div>`;

    const sliders = [
        { id: 'laconic', label: 'Лаконичность', icon: 'short_text' },
        { id: 'empathy', label: 'Эмпатия', icon: 'favorite_border' },
        { id: 'human', label: 'Человечность', icon: 'face' }
    ];

    sliders.forEach(s => {
        const row = document.createElement('div');
        row.innerHTML = `
            <div class="flex justify-between text-[11px] mb-1">
                <span class="text-gray-400 flex items-center gap-1"><span class="material-icons-outlined text-xs">${s.icon}</span> ${s.label}</span>
                <span class="text-geminiAccent font-mono" id="val_${s.id}">${userSettings[s.id]}</span>
            </div>
            <input type="range" min="0" max="10" value="${userSettings[s.id]}" 
                class="w-full accent-geminiAccent h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                oninput="updateVal('${s.id}', this.value)">
        `;
        charBox.appendChild(row);
    });
    box.appendChild(charBox);

    // Контекст
    const contextBox = document.createElement('div');
    contextBox.className = 'bg-gray-800/50 rounded-2xl p-4 border border-gray-700';
    contextBox.innerHTML = `
        <div class="text-[10px] font-bold text-geminiAccent uppercase tracking-widest mb-2">Контекст</div>
        <div class="flex justify-between text-[11px] mb-1">
            <span class="text-gray-400">Глубина памяти</span>
            <span class="text-geminiAccent font-mono" id="val_contextLimit">${userSettings.contextLimit}</span>
        </div>
        <input type="range" min="1" max="50" value="${userSettings.contextLimit}" 
            class="w-full accent-geminiAccent h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            oninput="updateVal('contextLimit', this.value)">
    `;
    box.appendChild(contextBox);

    const sBtn = document.createElement('button');
    sBtn.className = 'w-full p-4 bg-geminiAccent text-black font-bold rounded-xl text-xs uppercase';
    sBtn.innerText = 'Сохранить настройки';
    sBtn.onclick = async () => {
        sBtn.innerText = 'СОХРАНЕНИЕ...';
        await fetch(`/api/user/settings?userId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: userSettings })
        });
        sBtn.innerText = 'СОХРАНЕНО!';
        setTimeout(() => sBtn.innerText = 'СОХРАНИТЬ НАСТРОЙКИ', 2000);
    };
    box.appendChild(sBtn);

    menuContent.appendChild(box);
}

window.updateVal = (id, val) => {
    userSettings[id] = parseInt(val);
    document.getElementById(`val_${id}`).innerText = val;
};

/**
 * ДИАЛОГИ И ПРАВИЛА
 */
async function syncDialogs() {
    menuContent.innerHTML = '<div class="p-4 text-center text-gray-500 text-[10px]">ЗАГРУЗКА...</div>';
    const res = await fetch(`/api/dialogs?userId=${userId}`);
    const data = await res.json();
    menuContent.innerHTML = '';

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
            item.innerHTML = `<div class="flex-1 truncate" onclick="selectChat('${d.id}', '${d.name.replace(/'/g, "\\'")}')"><div class="text-sm font-bold text-white truncate">${d.name}</div></div>
                <button class="text-gray-600 hover:text-red-400 p-2" onclick="deleteChat('${d.id}')"><span class="material-icons-outlined text-sm">delete</span></button>`;
            menuContent.appendChild(item);
        });
    }
}

async function syncRules() {
    menuContent.innerHTML = '';
    const res = await fetch('/api/rules');
    const data = await res.json();
    if (data.rules) {
        data.rules.forEach(rule => {
            const div = document.createElement('div');
            div.className = 'flex items-start justify-between gap-2 p-3 bg-geminiBotMsg rounded-xl mb-2 border border-gray-800';
            div.innerHTML = `<div class="text-[12px] text-gray-300 flex-1 text-left">${rule.text}</div><button class="text-gray-600 hover:text-red-400 p-1" onclick="deleteRule('${rule.id}')"><span class="material-icons-outlined text-sm">delete</span></button>`;
            menuContent.appendChild(div);
        });
    }
    const addBtn = document.createElement('button');
    addBtn.className = 'w-full p-3 mt-2 border border-dashed border-gray-700 rounded-xl text-gray-500 text-[11px] font-bold uppercase';
    addBtn.innerText = '+ Добавить правило';
    addBtn.onclick = openAddRule;
    menuContent.appendChild(addBtn);
}

window.selectChat = (id, name) => {
    currentChatId = id; localStorage.setItem('pwa_chat_id', id); chatNameDisplay.innerText = name; loadHistory(true); toggleMenu();
};

window.deleteChat = async (id) => {
    if (!confirm('Удалить?')) return;
    await fetch(`/api/dialogs?userId=${userId}&chatId=${id}`, { method: 'DELETE' });
    location.reload();
};

window.deleteRule = async (id) => { await fetch(`/api/rules?id=${id}`, { method: 'DELETE' }); syncRules(); };

/**
 * МОДАЛКИ
 */
function openAddRule() {
    showModal('Новое правило', '<textarea id="modalInput" class="w-full h-24 bg-gray-800 border-gray-700 rounded-xl p-3 text-white text-sm"></textarea>', async () => {
        const text = document.getElementById('modalInput').value;
        if (!text) return;
        await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        modalOverlay.classList.add('hidden'); syncRules();
    });
}

function openRenameChat() {
    showModal('Имя чата', `<input id="modalInput" type="text" class="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-white" value="${chatNameDisplay.innerText}">`, async () => {
        const name = document.getElementById('modalInput').value.trim();
        if (!name) return;
        await fetch('/api/chat/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: currentChatId, name }) });
        chatNameDisplay.innerText = name; modalOverlay.classList.add('hidden');
    });
}

/**
 * ВСПОМОГАТЕЛЬНЫЕ
 */
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
    msgDiv.appendChild(div); msgDiv.scrollTop = msgDiv.scrollHeight; return id;
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

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    input.addEventListener('input', checkInput);
    sendBtn.addEventListener('click', handleSendMessage);
    menuBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
    modalCancel.addEventListener('click', () => modalOverlay.classList.add('hidden'));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
    checkInput();
    loadHistory(true);
});
