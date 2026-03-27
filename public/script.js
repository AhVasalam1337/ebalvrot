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

/**
 * 1. ЛОГИКА МЕНЮ (ПЕРЕНОС ИЗ БОТА)
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
            loadDialogsList(); // Загрузка из DB
            break;

        case STATES.RULES:
            menuTitle.innerText = 'Правила';
            backBtn.onclick = () => renderMenu(STATES.MAIN);
            loadRulesList(); // Загрузка из DB
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
            createItem('visibility', 'Текущий промпт', () => fetchStatus('character'));
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

// Загрузка диалогов (логика из бота)
async function loadDialogsList() {
    menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 animate-pulse">Загрузка...</div>';
    const res = await fetch(`/api/dialogs?chatId=${myId}`);
    const data = await res.json();
    menuContent.innerHTML = '';
    if (!data.list || data.list.length === 0) {
        menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 italic">Нет других диалогов</div>';
        return;
    }
    data.list.forEach(d => {
        const item = document.createElement('div');
        item.className = 'p-3 bg-gray-800/50 rounded-xl mb-2 border border-gray-700 active:scale-95 transition-transform cursor-pointer';
        item.innerHTML = `<div class="text-sm font-bold text-white truncate">${d.name || 'Без названия'}</div><div class="text-[10px] text-gray-500">${new Date(d.date).toLocaleDateString()}</div>`;
        item.onclick = () => switchChat(d.id);
        menuContent.appendChild(item);
    });
}

// Правила (логика из бота/БД верцеля)
async function loadRulesList() {
    const res = await fetch('/api/rules');
    const data = await res.json();
    data.rules.forEach((rule, index) => {
        const div = document.createElement('div');
        div.className = 'p-3 bg-geminiBotMsg rounded-lg mb-2 text-xs text-gray-300 border-l-2 border-geminiAccent';
        div.innerText = `${index + 1}. ${rule}`;
        menuContent.appendChild(div);
    });
}

/**
 * 2. ДЕЙСТВИЯ (МОДАЛКИ)
 */
async function openCharacterEditor() {
    showModal('Изменить характер', `<textarea id="modalInput" class="w-full h-32 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-sm focus:outline-none">Ты — Geminка...</textarea>`, async () => {
        const val = document.getElementById('modalInput').value;
        await fetch('/api/settings/character', { method: 'POST', body: JSON.stringify({ chatId: myId, prompt: val }) });
        toggleMenu();
    });
}

async function resetCharacterAction() {
    if(confirm('Сбросить характер до стандартного?')) {
        await fetch('/api/settings/character/reset', { method: 'POST', body: JSON.stringify({ chatId: myId }) });
        toggleMenu();
    }
}

async function openRenameChat() {
    showModal('Переименовать', `<input id="modalInput" type="text" class="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white" value="${chatNameDisplay.innerText}">`, async () => {
        const val = document.getElementById('modalInput').value;
        chatNameDisplay.innerText = val;
        await fetch('/api/settings/rename', { method: 'POST', body: JSON.stringify({ chatId: myId, name: val }) });
        toggleMenu();
    });
}

function showModal(title, bodyHtml, onSave) {
    modalTitle.innerText = title;
    modalBody.innerHTML = bodyHtml;
    modalOverlay.classList.remove('hidden');
    modalSave.classList.toggle('hidden', !onSave);
    if (onSave) modalSave.onclick = onSave;
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
 * 3. БАЗОВАЯ ЛОГИКА ЧАТА (БЕЗ ИЗМЕНЕНИЙ)
 */
async function loadHistory(isFirstLoad = false) {
    // ... логика подгрузки сообщений ...
    msgDiv.innerHTML = isFirstLoad ? '<div class="text-center p-10 opacity-20">Geminка готова</div>' : msgDiv.innerHTML;
}

input.addEventListener('input', function() {
    btn.disabled = !this.value.trim();
    this.style.height = 'auto';
    const h = this.scrollHeight;
    this.style.height = h > 36 ? h + 'px' : '36px';
    this.style.overflowY = h > 150 ? 'scroll' : 'hidden';
});

async function send() {
    const text = input.value.trim();
    if(!text) return;
    renderMessage(text, 'user');
    input.value = ''; input.style.height = '36px';
    const lId = showLoading();
    const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ text, chatId: myId }) });
    const data = await res.json();
    document.getElementById(lId)?.remove();
    if(data.text) renderMessage(data.text, 'bot');
}

function renderMessage(text, role) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start msg-anim ${role === 'user' ? 'flex-row-reverse' : ''}`;
    const avatar = role === 'bot' ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0">` : `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold shrink-0">К</div>`;
    container.innerHTML = `${avatar}<div class="${role === 'bot' ? 'bg-geminiBotMsg rounded-tl-none' : 'bg-geminiUserMsg rounded-tr-none'} p-4 rounded-2xl max-w-[85%] text-[15px]">${text}</div>`;
    msgDiv.appendChild(container);
    msgDiv.scrollTo({ top: msgDiv.scrollHeight, behavior: 'smooth' });
}

function showLoading() {
    const id = 'l' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex gap-3 items-start msg-anim';
    div.innerHTML = `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0"><div class="bg-geminiBotMsg p-4 rounded-2xl rounded-tl-none flex gap-1"><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div></div>`;
    msgDiv.appendChild(div);
    return id;
}

btn.onclick = send;
window.addEventListener('DOMContentLoaded', () => loadHistory(true));
