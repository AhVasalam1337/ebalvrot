/**
 * GEMINKA CORE - CLEAN VERSION
 */

// Элементы интерфейса
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

// Инициализация данных пользователя
let userId = localStorage.getItem('pwa_user_id') || 'u_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_user_id', userId);
let currentChatId = localStorage.getItem('pwa_chat_id') || 'c_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_chat_id', currentChatId);

// Глобальный объект настроек текущего сеанса
let userSettings = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

/**
 * ФУНКЦИИ ВВОДА
 */
function checkInput() {
    const text = input.value.trim();
    sendBtn.disabled = text.length === 0;
    if (text.length > 0) {
        sendBtn.classList.remove('opacity-50', 'grayscale', 'pointer-events-none');
    } else {
        sendBtn.classList.add('opacity-50', 'grayscale', 'pointer-events-none');
    }
}

/**
 * РАБОТА С НАСТРОЙКАМИ
 */
async function loadChatSettings(chatId) {
    try {
        const res = await fetch(`/api/user/settings?userId=${userId}&chatId=${chatId}`);
        const data = await res.json();
        if (data && !data.error) {
            userSettings = {
                laconic: parseInt(data.laconic) || 5,
                empathy: parseInt(data.empathy) || 5,
                human: parseInt(data.human) || 5,
                contextLimit: parseInt(data.contextLimit) || 0
            };
        } else {
            userSettings = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };
        }
    } catch (e) {
        console.error("Ошибка загрузки настроек чата");
    }
}

async function saveSettingsToServer() {
    const btn = document.getElementById('saveSettingsBtn');
    if (!btn) return;
    
    const originalText = btn.innerText;
    btn.innerText = 'СОХРАНЕНИЕ...';
    btn.disabled = true;

    try {
        const res = await fetch(`/api/user/settings?userId=${userId}&chatId=${currentChatId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: userSettings })
        });

        if (res.ok) {
            btn.innerText = 'СОХРАНЕНО!';
            btn.classList.add('bg-green-600');
            btn.classList.remove('bg-geminiAccent');
            
            setTimeout(() => {
                btn.innerText = originalText;
                btn.classList.remove('bg-green-600');
                btn.classList.add('bg-geminiAccent');
                btn.disabled = false;
            }, 2000);
        }
    } catch (e) {
        btn.innerText = 'ОШИБКА!';
        btn.classList.add('bg-red-600');
        setTimeout(() => {
            btn.innerText = originalText;
            btn.classList.remove('bg-red-600');
            btn.disabled = false;
        }, 2000);
    }
}

/**
 * ЧАТ И СООБЩЕНИЯ
 */
async function handleSendMessage() {
    const text = input.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    input.value = '';
    checkInput();
    renderMessage(text, 'user');
    const loadingId = showLoading();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, chatId: currentChatId, userId })
        });
        const data = await res.json();
        document.getElementById(loadingId)?.remove();
        if (data.text) renderMessage(data.text, 'bot', true);
    } catch (e) {
        document.getElementById(loadingId)?.remove();
        renderMessage('Ошибка связи с сервером.', 'bot');
    } finally {
        checkInput();
    }
}

function renderMessage(text, role, animate = false) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start mb-5 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    
    const avatar = role === 'bot' 
        ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0 shadow-sm">` 
        : `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white text-[10px] shrink-0 font-bold uppercase">Я</div>`;
    
    const bubble = document.createElement('div');
    bubble.className = `${role === 'bot' ? 'bg-geminiBotMsg border-gray-800' : 'bg-geminiUserMsg border-gray-700'} 
                        p-4 rounded-2xl max-w-[85%] text-[15px] text-white border text-left whitespace-pre-wrap transition-all duration-500`;
    
    if (animate) bubble.classList.add('animate-message-entry', 'ring-1', 'ring-geminiAccent');
    bubble.innerText = text;

    container.innerHTML = avatar;
    container.appendChild(bubble);
    msgDiv.appendChild(container);
    msgDiv.scrollTop = msgDiv.scrollHeight;

    if (animate) {
        setTimeout(() => bubble.classList.remove('ring-1', 'ring-geminiAccent'), 1500);
    }
}

function showLoading() {
    const id = 'loader_' + Date.now();
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
 * МЕНЮ И НАВИГАЦИЯ
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
    backBtn.classList.toggle('hidden', state === STATES.MAIN);
    
    switch(state) {
        case STATES.MAIN:
            menuTitle.innerText = 'Параметры';
            createMenuItem('forum', 'Диалоги', () => renderMenu(STATES.DIALOGS));
            createMenuItem('gavel', 'Правила системы', () => renderMenu(STATES.RULES));
            createMenuItem('tune', 'Настройки чата', () => renderMenu(STATES.SETTINGS));
            break;
        case STATES.DIALOGS:
            menuTitle.innerText = 'Ваши чаты';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            syncDialogs();
            break;
        case STATES.RULES:
            menuTitle.innerText = 'Правила';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            syncRules();
            break;
        case STATES.SETTINGS:
            menuTitle.innerText = 'Настройки диалога';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            renderSettingsSliders();
            break;
    }
}

function createMenuItem(icon, text, action) {
    const d = document.createElement('div');
    d.className = 'flex items-center gap-3 text-gray-300 p-4 hover:bg-gray-800 rounded-xl cursor-pointer transition-all active:scale-95';
    d.innerHTML = `<span class="material-icons-outlined text-xl">${icon}</span><span class="text-sm font-medium">${text}</span>`;
    d.onclick = action;
    menuContent.appendChild(d);
}

/**
 * ПАНЕЛЬ НАСТРОЕК
 */
function renderSettingsSliders() {
    const box = document.createElement('div');
    box.className = 'space-y-6 p-2';

    const charBox = document.createElement('div');
    charBox.className = 'bg-gray-800/30 rounded-2xl p-4 border border-gray-700/50 space-y-4';
    
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

    const contextBox = document.createElement('div');
    contextBox.className = 'bg-gray-800/30 rounded-2xl p-4 border border-gray-700/50';
    const limitDisplay = userSettings.contextLimit >= 51 ? '∞' : (userSettings.contextLimit == 0 ? 'FISH' : userSettings.contextLimit);
    
    contextBox.innerHTML = `
        <div class="text-[10px] font-bold text-geminiAccent uppercase tracking-widest mb-2 opacity-50">Память диалога</div>
        <div class="flex justify-between text-[11px] mb-1">
            <span class="text-gray-400">Глубина контекста</span>
            <span class="text-geminiAccent font-bold text-sm" id="val_contextLimit">${limitDisplay}</span>
        </div>
        <input type="range" min="0" max="51" value="${userSettings.contextLimit}" 
            class="w-full accent-geminiAccent h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-4"
            oninput="updateVal('contextLimit', this.value)">
        
        <button id="goldfishBtn" class="w-full p-3 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-xl text-[9px] font-black uppercase active:scale-95 transition-all">
            🐟 Включить режим "Золотая рыбка"
        </button>
    `;
    box.appendChild(contextBox);

    const sBtn = document.createElement('button');
    sBtn.id = 'saveSettingsBtn';
    sBtn.className = 'w-full p-4 bg-geminiAccent text-black font-bold rounded-xl text-[10px] uppercase shadow-lg active:scale-95 transition-all';
    sBtn.innerText = 'Сохранить настройки чата';
    sBtn.onclick = saveSettingsToServer;
    box.appendChild(sBtn);

    const renameBtn = document.createElement('button');
    renameBtn.className = 'w-full p-3 mt-4 text-gray-500 text-[9px] font-bold uppercase border border-gray-700 rounded-xl active:scale-95';
    renameBtn.innerText = 'Переименовать диалог';
    renameBtn.onclick = openRenameChat;
    box.appendChild(renameBtn);

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
        if (id === 'contextLimit') display.innerText = val >= 51 ? '∞' : (val == 0 ? 'FISH' : val);
        else display.innerText = val;
    }
};

/**
 * УПРАВЛЕНИЕ ДИАЛОГАМИ
 */
async function syncDialogs() {
    menuContent.innerHTML = '<div class="p-8 text-center text-gray-600 text-[10px] animate-pulse">ЗАГРУЗКА...</div>';
    const res = await fetch(`/api/dialogs?userId=${userId}`);
    const data = await res.json();
    menuContent.innerHTML = '';

    const newBtn = document.createElement('div');
    newBtn.className = 'flex items-center gap-3 text-geminiAccent p-4 mb-4 bg-geminiAccent/5 border border-dashed border-geminiAccent/20 rounded-xl cursor-pointer hover:bg-geminiAccent/10';
    newBtn.innerHTML = '<span class="material-icons-outlined">add</span><span class="text-xs font-bold uppercase">Новый чат</span>';
    newBtn.onclick = async () => {
        const id = 'c_' + Math.random().toString(36).substr(2, 9);
        await fetch('/api/dialogs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, chatId: id }) });
        currentChatId = id; localStorage.setItem('pwa_chat_id', id); chatNameDisplay.innerText = 'Новый чат'; msgDiv.innerHTML = ''; toggleMenu();
    };
    menuContent.appendChild(newBtn);

    if (data.list) data.list.forEach(d => {
        const item = document.createElement('div');
        item.className = `flex items-center justify-between p-3 mb-2 rounded-xl border transition-all ${d.id === currentChatId ? 'bg-geminiAccent/10 border-geminiAccent' : 'bg-gray-800/20 border-gray-700/50'}`;
        item.innerHTML = `<div class="flex-1 truncate cursor-pointer" onclick="selectChat('${d.id}', '${d.name}')"><div class="text-sm font-bold text-white">${d.name}</div></div>
            <button class="text-gray-600 hover:text-red-400 p-2" onclick="deleteChat('${d.id}')"><span class="material-icons-outlined text-sm">delete</span></button>`;
        menuContent.appendChild(item);
    });
}

window.selectChat = async (id, name) => {
    // 1. Сначала меняем ID
    currentChatId = id; 
    localStorage.setItem('pwa_chat_id', id);
    chatNameDisplay.innerText = name;
    
    // 2. Очищаем экран, чтобы не видеть старых сообщений другого чата
    msgDiv.innerHTML = ''; 
    
    // 3. ЖДЕМ загрузки настроек именно для нового ID
    await loadChatSettings(id);
    
    // 4. И только потом грузим историю
    loadHistory(true); 
    toggleMenu();
};

window.deleteChat = async (id) => {
    if (confirm('Удалить этот диалог?')) {
        await fetch(`/api/dialogs?userId=${userId}&chatId=${id}`, { method: 'DELETE' });
        if (id === currentChatId) location.reload(); else syncDialogs();
    }
};

/**
 * ПРАВИЛА И МОДАЛКИ
 */
async function syncRules() {
    menuContent.innerHTML = '';
    const res = await fetch('/api/rules');
    const data = await res.json();
    if (data.rules) data.rules.forEach(r => {
        const d = document.createElement('div');
        d.className = 'p-3 bg-gray-800/40 rounded-xl mb-2 border border-gray-700/50 flex justify-between';
        d.innerHTML = `<div class="text-[11px] text-gray-300 pr-2">${r.text}</div><button class="text-gray-400" onclick="deleteRule('${r.id}')">×</button>`;
        menuContent.appendChild(d);
    });
    const add = document.createElement('button');
    add.className = 'w-full p-3 border border-dashed border-gray-700 rounded-xl text-gray-500 text-[10px] uppercase';
    add.innerText = '+ Добавить системное правило';
    add.onclick = () => showModal('Новое правило', '<textarea id="modalInput" class="w-full h-24 bg-gray-900 border-gray-700 rounded-xl p-3 text-white text-xs"></textarea>', async () => {
        const text = document.getElementById('modalInput').value;
        if (!text) return;
        await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        modalOverlay.classList.add('hidden'); syncRules();
    });
    menuContent.appendChild(add);
}

window.deleteRule = async (id) => { 
    await fetch(`/api/rules?id=${id}`, { method: 'DELETE' }); 
    syncRules(); 
};

function openRenameChat() {
    showModal('Переименовать', `<input id="modalInput" type="text" class="w-full bg-gray-900 border-gray-700 rounded-xl p-3 text-white" value="${chatNameDisplay.innerText}">`, async () => {
        const name = document.getElementById('modalInput').value;
        if (!name) return;
        await fetch('/api/chat/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: currentChatId, name }) });
        chatNameDisplay.innerText = name; 
        modalOverlay.classList.add('hidden');
    });
}

function showModal(t, b, s) { 
    modalTitle.innerText = t; 
    modalBody.innerHTML = b; 
    modalOverlay.classList.remove('hidden'); 
    modalSave.onclick = s; 
}

async function loadHistory(isFirst = false) {
    if (isFirst) msgDiv.innerHTML = '';
    try {
        const res = await fetch(`/api/history?chatId=${currentChatId}`);
        const data = await res.json();
        if (data.history) {
            data.history.forEach(m => {
                const text = m.parts?.[0]?.text || m.text;
                renderMessage(text, m.role === 'user' ? 'user' : 'bot');
            });
        }
    } catch (e) { console.error("History load error"); }
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

// Запуск
document.addEventListener('DOMContentLoaded', async () => {
    // Удаляем любой брендинг из верстки
    const badNodes = document.querySelectorAll('.edition-label, #branding, .branding-text');
    badNodes.forEach(n => n.remove());

    await loadChatSettings(currentChatId);
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
    
    checkInput(); 
    loadHistory(true);
});
