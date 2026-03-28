/**
 * GEMINKA PWA - FULL CLIENT SCRIPT
 * Версия: 2.1 (Character + Memory + Animation)
 */

// Элементы UI
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

// Состояния меню
const STATES = { MAIN: 'MAIN', DIALOGS: 'DIALOGS', RULES: 'RULES', SETTINGS: 'SETTINGS' };

// Данные пользователя
let userId = localStorage.getItem('pwa_user_id') || 'u_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_user_id', userId);
let currentChatId = localStorage.getItem('pwa_chat_id') || 'c_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_chat_id', currentChatId);

// Настройки (по умолчанию)
let userSettings = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

/**
 * ИНИЦИАЛИЗАЦИЯ И ОБРАБОТКА ВВОДА
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
    } catch (e) { console.error("Ошибка загрузки настроек"); }
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
        if (data.text) renderMessage(data.text, 'bot', true);
    } catch (e) {
        document.getElementById(lId)?.remove();
        renderMessage('Ошибка на стороне сервера.', 'bot');
    } finally {
        checkInput();
    }
}

/**
 * РЕНДЕРИНГ СООБЩЕНИЙ
 */
function renderMessage(text, role, animate = false) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start mb-5 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    
    const avatar = role === 'bot' 
        ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0">` 
        : `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white text-[10px] shrink-0 font-bold uppercase">Я</div>`;
    
    const bubble = document.createElement('div');
    bubble.className = `${role === 'bot' ? 'bg-geminiBotMsg border-gray-800' : 'bg-geminiUserMsg border-gray-700'} 
                        p-4 rounded-2xl max-w-[85%] text-[15px] text-white border text-left whitespace-pre-wrap transition-all duration-700`;
    
    if (animate) bubble.classList.add('animate-message-entry', 'ring-1', 'ring-geminiAccent');
    bubble.innerText = text;

    container.innerHTML = avatar;
    container.appendChild(bubble);
    msgDiv.appendChild(container);
    msgDiv.scrollTop = msgDiv.scrollHeight;

    if (animate) {
        setTimeout(() => bubble.classList.remove('ring-1', 'ring-geminiAccent'), 2000);
    }
}

function showLoading() {
    const id = 'l' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex gap-3 mb-5';
    div.innerHTML = `
        <img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0">
        <div class="bg-geminiBotMsg p-4 rounded-2xl border border-gray-800 flex gap-1">
            <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
            <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div>
            <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
        </div>`;
    msgDiv.appendChild(div);
    msgDiv.scrollTop = msgDiv.scrollHeight;
    return id;
}

/**
 * УПРАВЛЕНИЕ МЕНЮ (NAVIGATION)
 */
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
            menuTitle.innerText = 'Ваши чаты';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            syncDialogs();
            break;
        case STATES.RULES:
            menuTitle.innerText = 'Правила системы';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            syncRules();
            break;
        case STATES.SETTINGS:
            menuTitle.innerText = 'Настройки бота';
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
 * НАСТРОЙКИ (ХАРАКТЕР + КОНТЕКСТ)
 */
function renderSettingsSliders() {
    const box = document.createElement('div');
    box.className = 'space-y-6 p-2';

    // Блок переименования
    const renameDiv = document.createElement('div');
    renameDiv.className = 'flex items-center gap-3 text-blue-400 p-4 bg-blue-400/5 rounded-xl border border-blue-400/20 cursor-pointer mb-4 active:scale-95 transition-all';
    renameDiv.innerHTML = '<span class="material-icons-outlined text-sm">edit</span><span class="text-[10px] font-bold uppercase tracking-wider">Переименовать текущий чат</span>';
    renameDiv.onclick = openRenameChat;
    box.appendChild(renameDiv);

    // Слайдеры Характера
    const charBox = document.createElement('div');
    charBox.className = 'bg-gray-800/30 rounded-2xl p-4 border border-gray-700/50 space-y-4';
    charBox.innerHTML = `<div class="text-[10px] font-bold text-geminiAccent uppercase tracking-widest mb-2 opacity-50">Параметры личности</div>`;

    const configs = [
        { id: 'laconic', label: 'Лаконичность', icon: 'short_text' },
        { id: 'empathy', label: 'Эмпатия', icon: 'favorite_border' },
        { id: 'human', label: 'Человечность', icon: 'face' }
    ];

    configs.forEach(s => {
        const row = document.createElement('div');
        row.innerHTML = `
            <div class="flex justify-between text-[11px] mb-1">
                <span class="text-gray-400 flex items-center gap-1"><span class="material-icons-outlined text-xs">${s.icon}</span> ${s.label}</span>
                <span class="text-geminiAccent font-mono font-bold" id="val_${s.id}">${userSettings[s.id]}</span>
            </div>
            <input type="range" min="0" max="10" value="${userSettings[s.id]}" 
                class="w-full accent-geminiAccent h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                oninput="updateVal('${s.id}', this.value)">
        `;
        charBox.appendChild(row);
    });
    box.appendChild(charBox);

    // Блок Памяти
    const contextBox = document.createElement('div');
    contextBox.className = 'bg-gray-800/30 rounded-2xl p-4 border border-gray-700/50';
    const currentLimit = userSettings.contextLimit >= 51 ? '∞' : (userSettings.contextLimit == 0 ? 'FISH' : userSettings.contextLimit);
    
    contextBox.innerHTML = `
        <div class="text-[10px] font-bold text-geminiAccent uppercase tracking-widest mb-2 opacity-50">Глубина памяти</div>
        <div class="flex justify-between text-[11px] mb-1">
            <span class="text-gray-400">Сообщений в контексте</span>
            <span class="text-geminiAccent font-bold text-sm" id="val_contextLimit">${currentLimit}</span>
        </div>
        <input type="range" min="1" max="51" value="${userSettings.contextLimit}" 
            class="w-full accent-geminiAccent h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-4"
            oninput="updateVal('contextLimit', this.value)">
        
        <button id="goldfishBtn" class="w-full p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all">
            <span class="material-icons-outlined text-sm">sailing</span> Режим "Золотая рыбка"
        </button>
    `;
    box.appendChild(contextBox);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'w-full p-4 bg-geminiAccent text-black font-bold rounded-xl text-[10px] uppercase shadow-lg shadow-geminiAccent/10 active:scale-95 transition-all';
    saveBtn.innerText = 'Применить и сохранить';
    saveBtn.onclick = saveSettingsToServer;
    box.appendChild(saveBtn);

    menuContent.appendChild(box);

    document.getElementById('goldfishBtn').onclick = () => {
        updateVal('contextLimit', 0);
        saveSettingsToServer();
    };
}

window.updateVal = (id, val) => {
    userSettings[id] = parseInt(val);
    const display = document.getElementById(`val_${id}`);
    if (display) {
        if (id === 'contextLimit') {
            display.innerText = val >= 51 ? '∞' : (val == 0 ? 'FISH' : val);
        } else {
            display.innerText = val;
        }
    }
};

async function saveSettingsToServer() {
    await fetch(`/api/user/settings?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: userSettings })
    });
    renderMenu(STATES.SETTINGS);
}

/**
 * ДИАЛОГИ (СПИСОК)
 */
async function syncDialogs() {
    menuContent.innerHTML = '<div class="p-8 text-center text-gray-600 text-[10px] animate-pulse">СИНХРОНИЗАЦИЯ...</div>';
    const res = await fetch(`/api/dialogs?userId=${userId}`);
    const data = await res.json();
    menuContent.innerHTML = '';

    const newChatBtn = document.createElement('div');
    newChatBtn.className = 'flex items-center gap-3 text-geminiAccent p-4 mb-4 bg-geminiAccent/5 border border-dashed border-geminiAccent/20 rounded-xl cursor-pointer hover:bg-geminiAccent/10';
    newChatBtn.innerHTML = '<span class="material-icons-outlined">add_comment</span><span class="text-xs font-bold uppercase">Начать новый диалог</span>';
    newChatBtn.onclick = async () => {
        const id = 'c_' + Math.random().toString(36).substr(2, 9);
        await fetch('/api/dialogs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, chatId: id }) });
        currentChatId = id; localStorage.setItem('pwa_chat_id', id);
        chatNameDisplay.innerText = 'Новый чат'; msgDiv.innerHTML = ''; toggleMenu();
    };
    menuContent.appendChild(newChatBtn);

    if (data.list) {
        data.list.forEach(d => {
            const item = document.createElement('div');
            item.className = `flex items-center justify-between p-3 mb-2 rounded-xl border transition-all ${d.id === currentChatId ? 'bg-geminiAccent/10 border-geminiAccent' : 'bg-gray-800/20 border-gray-700/50'}`;
            item.innerHTML = `
                <div class="flex-1 truncate cursor-pointer" onclick="selectChat('${d.id}', '${d.name}')">
                    <div class="text-sm font-bold text-white truncate">${d.name}</div>
                    <div class="text-[8px] text-gray-500 uppercase mt-1">${new Date(d.updatedAt).toLocaleTimeString()}</div>
                </div>
                <button class="text-gray-600 hover:text-red-400 p-2" onclick="deleteChat('${d.id}')"><span class="material-icons-outlined text-sm">delete_outline</span></button>`;
            menuContent.appendChild(item);
        });
    }
}

window.selectChat = (id, name) => {
    currentChatId = id; localStorage.setItem('pwa_chat_id', id);
    chatNameDisplay.innerText = name; loadHistory(true); toggleMenu();
};

window.deleteChat = async (id) => {
    if (confirm('Удалить этот чат навсегда?')) {
        await fetch(`/api/dialogs?userId=${userId}&chatId=${id}`, { method: 'DELETE' });
        if (id === currentChatId) location.reload(); else syncDialogs();
    }
};

/**
 * ПРАВИЛА
 */
async function syncRules() {
    menuContent.innerHTML = '<div class="p-4 text-center text-gray-600 text-[10px]">ЗАГРУЗКА...</div>';
    const res = await fetch('/api/rules');
    const data = await res.json();
    menuContent.innerHTML = '';

    if (data.rules) {
        data.rules.forEach(r => {
            const div = document.createElement('div');
            div.className = 'p-3 bg-gray-800/40 rounded-xl mb-2 border border-gray-700/50 flex justify-between items-start';
            div.innerHTML = `<div class="text-[11px] text-gray-300 pr-2">${r.text}</div>
                             <button class="text-gray-600 hover:text-red-400" onclick="deleteRule('${r.id}')">×</button>`;
            menuContent.appendChild(div);
        });
    }

    const addRuleBtn = document.createElement('button');
    addRuleBtn.className = 'w-full p-3 mt-4 border border-dashed border-gray-700 rounded-xl text-gray-500 text-[10px] font-bold uppercase';
    addRuleBtn.innerText = '+ Добавить правило';
    addRuleBtn.onclick = () => showModal('Новое правило', '<textarea id="modalInput" class="w-full h-24 bg-gray-900 border-gray-700 rounded-xl p-3 text-white text-xs"></textarea>', async () => {
        const text = document.getElementById('modalInput').value;
        if (text) {
            await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
            modalOverlay.classList.add('hidden'); syncRules();
        }
    });
    menuContent.appendChild(addRuleBtn);
}

window.deleteRule = async (id) => {
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
    syncRules();
};

/**
 * ВСПОМОГАТЕЛЬНЫЕ: МОДАЛКИ И ИСТОРИЯ
 */
function openRenameChat() {
    showModal('Имя чата', `<input id="modalInput" type="text" class="w-full bg-gray-900 border-gray-700 rounded-xl p-3 text-white" value="${chatNameDisplay.innerText}">`, async () => {
        const name = document.getElementById('modalInput').value;
        if (name) {
            await fetch('/api/chat/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: currentChatId, name }) });
            chatNameDisplay.innerText = name; modalOverlay.classList.add('hidden');
        }
    });
}

function showModal(title, body, onSave) {
    modalTitle.innerText = title; modalBody.innerHTML = body; modalOverlay.classList.remove('hidden'); modalSave.onclick = onSave;
}

async function loadHistory(isFirst = false) {
    if (isFirst) msgDiv.innerHTML = '';
    const res = await fetch(`/api/history?chatId=${currentChatId}`);
    const data = await res.json();
    if (data.history) data.history.forEach(m => renderMessage(m.parts?.[0]?.text || m.text, m.role === 'user' ? 'user' : 'bot'));
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    input.addEventListener('input', checkInput);
    sendBtn.addEventListener('click', handleSendMessage);
    menuBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
    modalCancel.addEventListener('click', () => modalOverlay.classList.add('hidden'));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
    checkInput(); loadHistory(true);
});
