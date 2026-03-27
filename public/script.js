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

let myId = localStorage.getItem('pwa_chat_id') || 'pwa_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_chat_id', myId);

let currentOffset = 0;
let isLoadingMore = false;
let hasMore = true;

/**
 * 1. ЛОГИКА МЕНЮ
 */
const STATES = { MAIN: 'MAIN', DIALOGS: 'DIALOGS', RULES: 'RULES', SETTINGS: 'SETTINGS', CHAR_SET: 'CHAR_SET' };

function renderMenu(state) {
    menuContent.innerHTML = '';
    backBtn.classList.remove('hidden');

    switch(state) {
        case STATES.MAIN:
            menuTitle.innerText = 'Меню';
            backBtn.classList.add('hidden');
            createItem('forum', 'Диалоги', () => renderMenu(STATES.DIALOGS));
            createItem('gavel', 'Правила', () => renderMenu(STATES.RULES));
            createItem('settings', 'Настройки', () => renderMenu(STATES.SETTINGS));
            break;

        case STATES.DIALOGS:
            menuTitle.innerText = 'Диалоги';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            loadDialogsList();
            break;

        case STATES.RULES:
            menuTitle.innerText = 'Правила';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            renderRules();
            break;

        case STATES.SETTINGS:
            menuTitle.innerText = 'Настройки';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            createItem('psychology', 'Настройка характера', () => renderMenu(STATES.CHAR_SET));
            createItem('edit', 'Переименовать чат', openRenameChat);
            createItem('delete_forever', 'Удалить чат', deleteChatAction, 'text-red-400');
            break;

        case STATES.CHAR_SET:
            menuTitle.innerText = 'Характер';
            backBtn.onclick = () => renderMenu(STATES.SETTINGS);
            createItem('visibility', 'Текущий промпт', () => alert('Промпт: Ты — Geminка...'));
            createItem('history_edu', 'Изменить промпт', openCharacterEditor);
            createItem('restart_alt', 'Сброс до заводских', resetCharacterAction, 'text-orange-400');
            break;
    }
}

function createItem(icon, text, action, color = 'text-gray-300') {
    const div = document.createElement('div');
    div.className = `flex items-center gap-3 ${color} p-3 hover:bg-gray-800 rounded-xl cursor-pointer transition-colors`;
    div.innerHTML = `<span class="material-icons-outlined">${icon}</span><span>${text}</span>`;
    div.onclick = action;
    menuContent.appendChild(div);
}

// Заглушка диалогов
async function loadDialogsList() {
    menuContent.innerHTML = '<div class="text-center p-4 text-gray-500">Загрузка...</div>';
    try {
        const res = await fetch(`/api/dialogs?chatId=${myId}`);
        const data = await res.json();
        menuContent.innerHTML = '';
        if (data.list && data.list.length > 0) {
            data.list.forEach(d => {
                const item = document.createElement('div');
                item.className = 'p-3 bg-gray-800/50 rounded-xl mb-2 border border-gray-700 cursor-pointer';
                item.innerHTML = `<div class="text-sm font-bold text-white truncate">${d.name || 'Чат'}</div>`;
                item.onclick = () => { /* Смена чата */ };
                menuContent.appendChild(item);
            });
        } else {
            menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 italic">Диалогов пока нет</div>';
        }
    } catch(e) {
        menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 italic">Список пуст</div>';
    }
}

// Правила (как в боте)
function renderRules() {
    const rules = [
        "Код должен быть представлен полностью.",
        "Сторонние блоки кода не изменять.",
        "Соблюдать краткость и вежливость.",
        "Всегда критиковать идеи пользователя."
    ];
    rules.forEach((r, i) => {
        const div = document.createElement('div');
        div.className = 'p-3 bg-geminiBotMsg rounded-lg mb-2 text-xs text-gray-300 border-l-2 border-geminiAccent';
        div.innerText = `${i + 1}. ${r}`;
        menuContent.appendChild(div);
    });
}

/**
 * 2. ДЕЙСТВИЯ
 */
function openCharacterEditor() {
    showModal('Изменить характер', `<textarea id="modalInput" class="w-full h-32 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-sm focus:outline-none">Ты — Geminка...</textarea>`, () => {
        alert('Сохранено (API)');
        modalOverlay.classList.add('hidden');
    });
}

function openRenameChat() {
    showModal('Переименовать', `<input id="modalInput" type="text" class="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white" value="${chatNameDisplay.innerText}">`, () => {
        chatNameDisplay.innerText = document.getElementById('modalInput').value;
        modalOverlay.classList.add('hidden');
    });
}

function deleteChatAction() {
    if(confirm('Удалить чат?')) location.reload();
}

function resetCharacterAction() {
    if(confirm('Сбросить характер?')) alert('Сброшено');
}

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
 * 3. ИСТОРИЯ И ЧАТ
 */
async function loadHistory(isFirstLoad = false) {
    if (isLoadingMore) return;
    isLoadingMore = true;
    try {
        const res = await fetch(`/api/history?chatId=${myId}&limit=10&offset=${currentOffset}`);
        const data = await res.json();
        if (isFirstLoad) msgDiv.innerHTML = '';
        if (data.history && data.history.length > 0) {
            data.history.reverse().forEach(msg => {
                renderMessage(msg.parts[0].text, msg.role === 'user' ? 'user' : 'bot', false);
            });
            currentOffset += data.history.length;
            if (isFirstLoad) scrollToBottom();
        } else if (isFirstLoad) {
            renderMessage("Привет! Я Geminка. Чем помогу?", 'bot');
        }
    } catch (e) {
        if (isFirstLoad) renderMessage("Привет! Я Geminка. Готова к работе.", 'bot');
    } finally {
        isLoadingMore = false;
    }
}

input.addEventListener('input', function() {
    btn.disabled = !this.value.trim();
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});

async function send() {
    const text = input.value.trim();
    if(!text) return;
    renderMessage(text, 'user');
    input.value = ''; input.style.height = 'auto';
    const lId = showLoading();
    try {
        const res = await fetch('/api/chat', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ text, chatId: myId }) 
        });
        const data = await res.json();
        document.getElementById(lId)?.remove();
        if(data.text) renderMessage(data.text, 'bot');
    } catch(e) {
        document.getElementById(lId)?.remove();
        renderMessage('Ошибка связи.', 'bot');
    }
}

function renderMessage(text, role, animate = true) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start ${animate ? 'opacity-0 translate-y-2 animate-[fadeIn_0.3s_ease-out_forwards]' : ''} ${role === 'user' ? 'flex-row-reverse' : ''}`;
    const avatar = role === 'bot' ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0">` : `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold shrink-0 text-xs">К</div>`;
    container.innerHTML = `${avatar}<div class="${role === 'bot' ? 'bg-geminiBotMsg rounded-tl-none' : 'bg-geminiUserMsg rounded-tr-none'} p-4 rounded-2xl max-w-[85%] text-[15px] text-white leading-relaxed whitespace-pre-wrap">${text}</div>`;
    msgDiv.appendChild(container);
    scrollToBottom();
}

function showLoading() {
    const id = 'l' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex gap-3 items-start';
    div.innerHTML = `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0"><div class="bg-geminiBotMsg p-4 rounded-2xl rounded-tl-none flex gap-1"><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div></div>`;
    msgDiv.appendChild(div);
    scrollToBottom();
    return id;
}

function scrollToBottom() { msgDiv.scrollTop = msgDiv.scrollHeight; }

btn.onclick = send;
window.addEventListener('DOMContentLoaded', () => loadHistory(true));
input.onkeydown = (e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
