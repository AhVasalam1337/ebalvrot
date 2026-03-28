/**
 * ПОЛНЫЙ SCRIPT.JS С АНИМАЦИЕЙ И "ЗОЛОТОЙ РЫБКОЙ"
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
    const res = await fetch(`/api/user/settings?userId=${userId}`);
    userSettings = await res.json();
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
        if (data.text) renderMessage(data.text, 'bot', true); // Анимация только для бота
    } catch (e) {
        document.getElementById(lId)?.remove();
        renderMessage('Ошибка сети.', 'bot');
    } finally {
        checkInput();
    }
}

/**
 * РЕНДЕРИНГ СООБЩЕНИЙ С АНИМАЦИЕЙ
 */
function renderMessage(text, role, animate = false) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start mb-5 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    
    const avatar = role === 'bot' 
        ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0 shadow-md">` 
        : `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white text-[10px] shrink-0 font-bold uppercase">Я</div>`;
    
    // Добавляем класс подсветки если animate = true
    const highlightClass = animate ? 'animate-message-entry ring-2 ring-geminiAccent ring-offset-2 ring-offset-gray-900' : '';
    
    container.innerHTML = `
        ${avatar}
        <div class="${role === 'bot' ? 'bg-geminiBotMsg border-gray-800' : 'bg-geminiUserMsg border-gray-700'} 
            ${highlightClass} p-4 rounded-2xl max-w-[85%] text-[15px] text-white border text-left whitespace-pre-wrap transition-all duration-1000">
            ${text}
        </div>
    `;
    
    msgDiv.appendChild(container);
    msgDiv.scrollTop = msgDiv.scrollHeight;

    // Убираем подсветку через 2 секунды
    if (animate) {
        setTimeout(() => {
            const bubble = container.querySelector('div');
            bubble.classList.remove('ring-2', 'ring-geminiAccent', 'ring-offset-2', 'ring-offset-gray-900');
        }, 2000);
    }
}

/**
 * МЕНЮ И НАСТРОЙКИ
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
            renderSettingsSliders();
            break;
        case STATES.RULES:
            menuTitle.innerText = 'Правила';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            syncRules();
            break;
    }
}

function renderSettingsSliders() {
    const box = document.createElement('div');
    box.className = 'space-y-6 p-2';

    // Характер
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
            <input type="range" min="0" max="10" value="${userSettings[s.id]}" class="w-full accent-geminiAccent h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer" oninput="updateVal('${s.id}', this.value)">
        `;
        charBox.appendChild(row);
    });
    box.appendChild(charBox);

    // Контекст
    const contextBox = document.createElement('div');
    contextBox.className = 'bg-gray-800/50 rounded-2xl p-4 border border-gray-700';
    const limitLabel = userSettings.contextLimit >= 51 ? '∞' : userSettings.contextLimit;
    
    contextBox.innerHTML = `
        <div class="text-[10px] font-bold text-geminiAccent uppercase tracking-widest mb-2">Память</div>
        <div class="flex justify-between text-[11px] mb-1">
            <span class="text-gray-400">Глубина контекста</span>
            <span class="text-geminiAccent font-bold text-sm" id="val_contextLimit">${limitLabel}</span>
        </div>
        <input type="range" min="1" max="51" value="${userSettings.contextLimit}" 
            class="w-full accent-geminiAccent h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer mb-4"
            oninput="updateVal('contextLimit', this.value)">
        
        <button id="goldfishBtn" class="w-full p-3 bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-2 active:scale-95 transition-all">
            <span class="material-icons-outlined text-sm">sailing</span> Режим "Золотая рыбка"
        </button>
    `;
    box.appendChild(contextBox);

    const sBtn = document.createElement('button');
    sBtn.className = 'w-full p-4 bg-geminiAccent text-black font-bold rounded-xl text-xs uppercase shadow-lg shadow-geminiAccent/20';
    sBtn.innerText = 'Применить и сохранить';
    sBtn.onclick = saveSettings;
    box.appendChild(sBtn);

    menuContent.appendChild(box);

    // Логика кнопки Золотая рыбка
    document.getElementById('goldfishBtn').onclick = () => {
        updateVal('contextLimit', 0);
        saveSettings();
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

async function saveSettings() {
    await fetch(`/api/user/settings?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: userSettings })
    });
    renderMenu(STATES.SETTINGS); // Перерисовать для обновления UI
}

/**
 * ОСТАЛЬНЫЕ ФУНКЦИИ
 */
async function syncDialogs() {
    menuContent.innerHTML = '<div class="p-4 text-center text-gray-500 text-[10px]">ЗАГРУЗКА...</div>';
    const res = await fetch(`/api/dialogs?userId=${userId}`);
    const data = await res.json();
    menuContent.innerHTML = '';
    const nBtn = document.createElement('div');
    nBtn.className = 'flex items-center gap-3 text-geminiAccent p-4 mb-4 bg-geminiAccent/10 border border-dashed border-geminiAccent/30 rounded-xl cursor-pointer';
    nBtn.innerHTML = '<span class="material-icons-outlined">add_comment</span><span class="text-sm font-bold">НОВЫЙ ЧАТ</span>';
    nBtn.onclick = async () => {
        const id = 'c_' + Math.random().toString(36).substr(2, 9);
        await fetch('/api/dialogs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, chatId: id }) });
        currentChatId = id; localStorage.setItem('pwa_chat_id', id); chatNameDisplay.innerText = 'Новый чат'; msgDiv.innerHTML = ''; toggleMenu();
    };
    menuContent.appendChild(nBtn);
    if (data.list) data.list.forEach(d => {
        const item = document.createElement('div');
        item.className = `flex items-center justify-between p-3 mb-2 rounded-xl border border-gray-700 cursor-pointer ${d.id === currentChatId ? 'bg-geminiAccent/10 border-geminiAccent' : 'bg-gray-800/30'}`;
        item.innerHTML = `<div class="flex-1 truncate" onclick="selectChat('${d.id}', '${d.name}')"><div class="text-sm font-bold text-white">${d.name}</div></div>
            <button class="text-gray-600 p-2" onclick="deleteChat('${d.id}')"><span class="material-icons-outlined text-sm">delete</span></button>`;
        menuContent.appendChild(item);
    });
}

window.selectChat = (id, name) => { currentChatId = id; localStorage.setItem('pwa_chat_id', id); chatNameDisplay.innerText = name; loadHistory(true); toggleMenu(); };
window.deleteChat = async (id) => { if (confirm('Удалить?')) { await fetch(`/api/dialogs?userId=${userId}&chatId=${id}`, { method: 'DELETE' }); location.reload(); } };
async function syncRules() {
    menuContent.innerHTML = '';
    const res = await fetch('/api/rules');
    const data = await res.json();
    if (data.rules) data.rules.forEach(r => {
        const d = document.createElement('div');
        d.className = 'flex justify-between p-3 bg-gray-800 rounded-xl mb-2 border border-gray-700';
        d.innerHTML = `<div class="text-[12px] text-gray-300">${r.text}</div><button onclick="deleteRule('${r.id}')">×</button>`;
        menuContent.appendChild(d);
    });
    const add = document.createElement('button');
    add.className = 'w-full p-3 border border-dashed border-gray-700 rounded-xl text-gray-500 text-[10px]';
    add.innerText = '+ ДОБАВИТЬ';
    add.onclick = () => showModal('Правило', '<textarea id="modalInput" class="w-full h-24 bg-gray-800 text-white p-2"></textarea>', async () => {
        await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: document.getElementById('modalInput').value }) });
        modalOverlay.classList.add('hidden'); syncRules();
    });
    menuContent.appendChild(add);
}
window.deleteRule = async (id) => { await fetch(`/api/rules?id=${id}`, { method: 'DELETE' }); syncRules(); };

function openRenameChat() {
    showModal('Имя чата', `<input id="modalInput" type="text" class="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-white" value="${chatNameDisplay.innerText}">`, async () => {
        const name = document.getElementById('modalInput').value;
        await fetch('/api/chat/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: currentChatId, name }) });
        chatNameDisplay.innerText = name; modalOverlay.classList.add('hidden');
    });
}

function createMenuItem(icon, text, action) {
    const d = document.createElement('div'); d.className = 'flex items-center gap-3 text-gray-300 p-4 hover:bg-gray-800 rounded-xl cursor-pointer';
    d.innerHTML = `<span class="material-icons-outlined">${icon}</span><span class="text-sm">${text}</span>`;
    d.onclick = action; menuContent.appendChild(d);
}

function showLoading() {
    const id = 'l' + Date.now();
    const d = document.createElement('div'); d.id = id; d.className = 'flex gap-3 mb-5';
    d.innerHTML = `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full"><div class="bg-geminiBotMsg p-4 rounded-2xl border border-gray-800 flex gap-1"><div class="w-1 h-1 bg-gray-500 rounded-full animate-bounce"></div><div class="w-1 h-1 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div></div>`;
    msgDiv.appendChild(d); msgDiv.scrollTop = msgDiv.scrollHeight; return id;
}

async function loadHistory(first = false) {
    if (first) msgDiv.innerHTML = '';
    const res = await fetch(`/api/history?chatId=${currentChatId}`);
    const data = await res.json();
    if (data.history) data.history.forEach(m => renderMessage(m.parts?.[0]?.text || m.text, m.role === 'user' ? 'user' : 'bot'));
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

function toggleMenu() {
    if (sidebar.classList.contains('translate-x-0')) {
        sidebar.classList.replace('translate-x-0', '-translate-x-full'); overlay.classList.add('hidden');
    } else {
        renderMenu(STATES.MAIN); sidebar.classList.replace('-translate-x-full', 'translate-x-0'); overlay.classList.remove('hidden');
    }
}

function showModal(t, b, s) { modalTitle.innerText = t; modalBody.innerHTML = b; modalOverlay.classList.remove('hidden'); modalSave.onclick = s; }

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
