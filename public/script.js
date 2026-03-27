/**
 * Глобальные переменные и инициализация
 */
const msgDiv = document.getElementById('chat-messages');
const input = document.getElementById('userInput');
const btn = document.getElementById('sendBtn');
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

// ID пользователя/чата из локального хранилища
let myId = localStorage.getItem('pwa_chat_id') || 'pwa_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_chat_id', myId);

const STATES = { MAIN: 'MAIN', DIALOGS: 'DIALOGS', RULES: 'RULES', SETTINGS: 'SETTINGS' };

/**
 * 1. УПРАВЛЕНИЕ МЕНЮ (СИНХРОНИЗАЦИЯ С API)
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
            createMenuItem('psychology', 'Настройка характера', openCharacterEditor);
            createMenuItem('edit', 'Переименовать чат', openRenameChat);
            createMenuItem('delete_forever', 'Удалить чат', deleteChatAction, 'text-red-400');
            break;
    }
}

function createMenuItem(icon, text, action, color = 'text-gray-300') {
    const div = document.createElement('div');
    div.className = `flex items-center gap-3 ${color} p-3 hover:bg-gray-800 rounded-xl cursor-pointer transition-colors active:scale-95`;
    div.innerHTML = `<span class="material-icons-outlined text-[20px]">${icon}</span><span class="text-sm font-medium">${text}</span>`;
    div.onclick = action;
    menuContent.appendChild(div);
}

/**
 * 2. СИНХРОНИЗАЦИЯ С BALASTDB (API CALLS)
 */

// Загрузка диалогов
async function syncDialogs() {
    menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 animate-pulse text-[10px]">ЗАГРУЗКА ДИАЛОГОВ...</div>';
    try {
        const res = await fetch(`/api/dialogs?userId=${myId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        menuContent.innerHTML = '';
        
        if (data.list && data.list.length > 0) {
            data.list.forEach(d => {
                const item = document.createElement('div');
                item.className = `p-3 mb-2 rounded-xl border border-gray-700 cursor-pointer hover:bg-gray-800 transition-all ${d.id === myId ? 'bg-geminiAccent/10 border-geminiAccent' : 'bg-gray-800/30'}`;
                item.innerHTML = `
                    <div class="text-sm font-bold text-white truncate">${d.name || 'Чат ' + d.id.slice(0,4)}</div>
                    <div class="text-[10px] text-gray-500 mt-1">${new Date(d.updatedAt).toLocaleString()}</div>
                `;
                item.onclick = () => {
                    myId = d.id;
                    localStorage.setItem('pwa_chat_id', myId);
                    chatNameDisplay.innerText = d.name || 'Geminка';
                    loadHistory(true);
                    toggleMenu();
                };
                menuContent.appendChild(item);
            });
        } else {
            menuContent.innerHTML = '<div class="p-8 text-center text-gray-600 text-[10px] italic">СПИСОК ПУСТ</div>';
        }
    } catch (e) {
        menuContent.innerHTML = '<div class="p-8 text-center text-red-500 text-[10px]">ОШИБКА ПОДКЛЮЧЕНИЯ К API</div>';
    }
}

// Загрузка и CRUD правил
async function syncRules() {
    menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 animate-pulse text-[10px]">ПОЛУЧЕНИЕ ПРАВИЛ...</div>';
    try {
        const res = await fetch('/api/rules');
        const data = await res.json();
        menuContent.innerHTML = '';
        
        if (data.rules && data.rules.length > 0) {
            data.rules.forEach(rule => {
                const div = document.createElement('div');
                div.className = 'group flex items-start justify-between gap-2 p-3 bg-geminiBotMsg rounded-xl mb-2 border border-gray-800';
                div.innerHTML = `
                    <div class="text-[12px] text-gray-300 flex-1 leading-relaxed">${rule.text}</div>
                    <button class="text-gray-600 hover:text-red-400 transition-colors shrink-0" onclick="deleteRule('${rule.id}')">
                        <span class="material-icons-outlined text-[18px]">delete</span>
                    </button>
                `;
                menuContent.appendChild(div);
            });
        }
    } catch (e) {
        menuContent.innerHTML = '<div class="text-center p-4 text-red-500 text-[10px]">ОШИБКА ЗАГРУЗКИ ПРАВИЛ</div>';
    }

    // Кнопка добавления (всегда доступна)
    const addBtn = document.createElement('button');
    addBtn.className = 'w-full flex items-center justify-center gap-2 p-3 mt-4 border border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-geminiAccent transition-all';
    addBtn.innerHTML = '<span class="material-icons-outlined text-[20px]">add</span><span class="text-[11px] font-bold uppercase tracking-wider">Добавить правило</span>';
    addBtn.onclick = openAddRule;
    menuContent.appendChild(addBtn);
}

async function deleteRule(id) {
    if (confirm('Удалить правило навсегда?')) {
        try {
            const res = await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
            if (res.ok) syncRules();
        } catch (e) { alert('Ошибка удаления'); }
    }
}

function openAddRule() {
    showModal('Новое правило', `<textarea id="modalInput" class="w-full h-24 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-geminiAccent" placeholder="Напишите правило..."></textarea>`, async () => {
        const text = document.getElementById('modalInput').value.trim();
        if (!text) return;
        try {
            const res = await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (res.ok) {
                modalOverlay.classList.add('hidden');
                syncRules();
            }
        } catch (e) { alert('Ошибка сохранения'); }
    });
}

/**
 * 3. ДЕЙСТВИЯ (ПЕРЕИМЕНОВАНИЕ И ХАРАКТЕР)
 */
async function openRenameChat() {
    showModal('Переименовать чат', `<input id="modalInput" type="text" class="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-geminiAccent" value="${chatNameDisplay.innerText}">`, async () => {
        const name = document.getElementById('modalInput').value.trim();
        if (!name) return;
        try {
            await fetch('/api/chat/rename', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: myId, name })
            });
            chatNameDisplay.innerText = name;
            modalOverlay.classList.add('hidden');
        } catch (e) { alert('Ошибка переименования'); }
    });
}

async function openCharacterEditor() {
    showModal('Настройка характера', `<textarea id="modalInput" class="w-full h-32 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-geminiAccent">Ты — Geminка, мой персональный ИИ...</textarea>`, async () => {
        const prompt = document.getElementById('modalInput').value.trim();
        try {
            await fetch('/api/chat/character', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: myId, prompt })
            });
            modalOverlay.classList.add('hidden');
        } catch (e) { alert('Ошибка сохранения промпта'); }
    });
}

function deleteChatAction() {
    if (confirm('Это действие удалит всю историю сообщений для этого чата в BalastDB. Продолжить?')) {
        fetch(`/api/history?chatId=${myId}`, { method: 'DELETE' }).then(() => location.reload());
    }
}

/**
 * 4. СИСТЕМНЫЕ ФУНКЦИИ ИНТЕРФЕЙСА
 */
function showModal(title, bodyHtml, onSave) {
    modalTitle.innerText = title;
    modalBody.innerHTML = bodyHtml;
    modalOverlay.classList.remove('hidden');
    modalSave.onclick = onSave;
}

modalCancel.onclick = () => modalOverlay.classList.add('hidden');

function toggleMenu() {
    const isOpen = sidebar.classList.contains('translate-x-0');
    if (isOpen) {
        sidebar.classList.remove('translate-x-0');
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
        document.body.style.overflow = '';
    } else {
        renderMenu(STATES.MAIN);
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
        document.body.style.overflow = 'hidden';
    }
}

menuBtn.onclick = toggleMenu;
overlay.onclick = toggleMenu;

/**
 * 5. ЯДРО ЧАТА И ИСТОРИЯ
 */
async function loadHistory(isFirstLoad = false) {
    if (isFirstLoad) {
        msgDiv.innerHTML = '<div class="flex-1 flex items-center justify-center opacity-20"><div class="w-8 h-8 border-2 border-geminiAccent border-t-transparent rounded-full animate-spin"></div></div>';
    }
    try {
        const res = await fetch(`/api/history?chatId=${myId}`);
        const data = await res.json();
        if (isFirstLoad) msgDiv.innerHTML = '';
        
        if (data.history && data.history.length > 0) {
            data.history.forEach(m => renderMessage(m.parts[0].text, m.role === 'user' ? 'user' : 'bot', false));
            msgDiv.scrollTop = msgDiv.scrollHeight;
        } else if (isFirstLoad) {
            renderMessage("Привет! Я Geminка. Связь с BalastDB установлена.", 'bot');
        }
    } catch (e) {
        if (isFirstLoad) {
            msgDiv.innerHTML = '';
            renderMessage("Ошибка загрузки истории. Проверь BalastDB.", 'bot');
        }
    }
}

input.addEventListener('input', function() {
    btn.disabled = !this.value.trim();
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

async function send() {
    const text = input.value.trim();
    if (!text) return;

    renderMessage(text, 'user');
    input.value = '';
    input.style.height = 'auto';
    btn.disabled = true;

    const loaderId = showLoading();
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, chatId: myId })
        });
        const data = await res.json();
        document.getElementById(loaderId)?.remove();
        if (data.text) renderMessage(data.text, 'bot');
    } catch (e) {
        document.getElementById(loaderId)?.remove();
        renderMessage('Ошибка отправки. База данных недоступна.', 'bot');
    }
}

function renderMessage(text, role, anim = true) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start ${anim ? 'opacity-0 translate-y-2 animate-[fadeIn_0.3s_ease-out_forwards]' : ''} ${role === 'user' ? 'flex-row-reverse' : ''}`;
    
    const avatar = role === 'bot' 
        ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0 border border-gray-800 shadow-sm">` 
        : `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold shrink-0 text-xs shadow-sm">К</div>`;
    
    container.innerHTML = `
        ${avatar}
        <div class="${role === 'bot' ? 'bg-geminiBotMsg rounded-tl-none border-gray-800' : 'bg-geminiUserMsg rounded-tr-none border-gray-700'} p-4 rounded-2xl max-w-[85%] text-[15px] text-white border whitespace-pre-wrap leading-relaxed shadow-sm">
            ${text}
        </div>
    `;
    msgDiv.appendChild(container);
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

function showLoading() {
    const id = 'l' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex gap-3 items-start';
    div.innerHTML = `
        <img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0">
        <div class="bg-geminiBotMsg p-4 rounded-2xl rounded-tl-none flex gap-1 items-center border border-gray-800">
            <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
            <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div>
            <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
        </div>
    `;
    msgDiv.appendChild(div);
    msgDiv.scrollTop = msgDiv.scrollHeight;
    return id;
}

/**
 * ЗАПУСК
 */
btn.onclick = send;
window.addEventListener('DOMContentLoaded', () => loadHistory(true));
input.onkeydown = (e) => { 
    if (e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        send(); 
    } 
};

// Анимация fadeIn через CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);
