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

// Модальное окно
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
 * 1. ЛОГИКА МЕНЮ И НАСТРОЕК (ИЗ ПРОЕКТА БОТА)
 */
const MENU_STATES = { MAIN: 'MAIN', SETTINGS: 'SETTINGS' };

function renderMenu(state) {
    menuContent.innerHTML = '';
    if (state === MENU_STATES.MAIN) {
        menuTitle.innerText = 'Меню';
        backBtn.classList.add('hidden');
        const items = [
            { icon: 'forum', text: 'Диалоги', action: () => alert('Список чатов в разработке') },
            { icon: 'gavel', text: 'Правила', action: () => showModal('Правила', 'Будь вежлив, Geminка всё помнит.', false) },
            { icon: 'settings', text: 'Настройки', action: () => renderMenu(MENU_STATES.SETTINGS) }
        ];
        items.forEach(item => createMenuItem(item));
    } else {
        menuTitle.innerText = 'Настройки';
        backBtn.classList.remove('hidden');
        const items = [
            { icon: 'psychology', text: 'Настройка характера', action: () => openCharacterSettings() },
            { icon: 'edit', text: 'Переименовать чат', action: () => openRenameChat() },
            { icon: 'delete_forever', text: 'Удалить чат', action: () => deleteChatAction(), color: 'text-red-400' }
        ];
        items.forEach(item => createMenuItem(item));
    }
}

function createMenuItem(item) {
    const div = document.createElement('div');
    div.className = `flex items-center gap-3 ${item.color || 'text-gray-300'} p-3 hover:bg-gray-800 rounded-xl cursor-pointer transition-colors`;
    div.innerHTML = `<span class="material-icons-outlined">${item.icon}</span><span>${item.text}</span>`;
    div.onclick = item.action;
    menuContent.appendChild(div);
}

// Функции-действия (API интеграция как в боте)
async function openCharacterSettings() {
    const currentPrompt = "Ты — Geminка, умный и верный ИИ-ассистент."; // В будущем тянуть с API
    showModal('Характер', `<textarea id="modalInput" class="w-full h-32 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-geminiAccent">${currentPrompt}</textarea>`, async () => {
        const val = document.getElementById('modalInput').value;
        await fetch('/api/settings/character', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chatId: myId, prompt: val }) });
        toggleMenu(); 
    });
}

async function openRenameChat() {
    showModal('Переименовать', `<input id="modalInput" type="text" class="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-geminiAccent" value="${chatNameDisplay.innerText}">`, async () => {
        const val = document.getElementById('modalInput').value;
        chatNameDisplay.innerText = val;
        await fetch('/api/settings/rename', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chatId: myId, name: val }) });
        toggleMenu();
    });
}

async function deleteChatAction() {
    if(confirm('Удалить всю историю безвозвратно?')) {
        await fetch(`/api/history?chatId=${myId}`, { method: 'DELETE' });
        location.reload();
    }
}

/**
 * 2. СИСТЕМНЫЕ ОКНА И МОДАЛКИ
 */
function showModal(title, bodyHtml, onSave) {
    modalTitle.innerText = title;
    modalBody.innerHTML = bodyHtml;
    modalOverlay.classList.remove('hidden');
    if (!onSave) modalSave.classList.add('hidden');
    else {
        modalSave.classList.remove('hidden');
        modalSave.onclick = onSave;
    }
}

modalCancel.onclick = () => modalOverlay.classList.add('hidden');
backBtn.onclick = () => renderMenu(MENU_STATES.MAIN);

function toggleMenu() {
    const isOpen = sidebar.classList.contains('translate-x-0');
    if (isOpen) {
        sidebar.classList.remove('translate-x-0');
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
        document.body.style.overflow = '';
    } else {
        renderMenu(MENU_STATES.MAIN);
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
    if (isLoadingMore || !hasMore) return;
    isLoadingMore = true;
    try {
        const res = await fetch(`/api/history?chatId=${myId}&limit=10&offset=${currentOffset}`);
        const data = await res.json();
        if (isFirstLoad) msgDiv.innerHTML = '';
        if (data.history && data.history.length > 0) {
            const oldHeight = msgDiv.scrollHeight;
            [...data.history].reverse().forEach(msg => {
                renderMessage(msg.parts[0].text, msg.role === 'user' ? 'user' : 'bot', false, '', true);
            });
            currentOffset += data.history.length;
            hasMore = data.hasMore;
            if (isFirstLoad) scrollToBottom('auto');
            else msgDiv.scrollTop = msgDiv.scrollHeight - oldHeight;
        } else if (isFirstLoad) {
            renderMessage("Привет! Я Geminка.", 'bot', true);
        }
    } catch (e) { console.error(e); } finally { isLoadingMore = false; }
}

input.addEventListener('input', function() {
    btn.disabled = !this.value.trim();
    this.style.height = 'auto';
    const newHeight = this.scrollHeight;
    if(newHeight > 36) {
        this.style.height = newHeight + 'px';
        this.style.overflowY = newHeight > 150 ? 'scroll' : 'hidden';
        this.parentElement.style.borderRadius = '16px';
    } else {
        this.style.height = '36px';
        this.parentElement.style.borderRadius = '24px';
    }
});

async function send() {
    const text = input.value.trim();
    if(!text) return;
    renderMessage(text, 'user', true);
    input.value = '';
    input.style.height = '36px';
    input.parentElement.style.borderRadius = '24px';
    btn.disabled = true;
    const loadingId = showLoading();
    try {
        const res = await fetch('/api/chat', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ text, chatId: myId }) });
        const data = await res.json();
        hideLoading(loadingId);
        if(data.text) renderMessage(data.text, 'bot', true);
    } catch (e) { hideLoading(loadingId); renderMessage('Ошибка.', 'bot', true, 'bg-red-900/30'); }
}

function renderMessage(text, role, animate = true, extraClass = '', prepend = false) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start ${animate ? 'msg-anim' : ''} ${role === 'user' ? 'flex-row-reverse' : ''}`;
    const botAvatar = `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full object-cover border border-gray-700 shadow-sm shrink-0 mt-1">`;
    const userAvatar = `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white shrink-0 shadow-sm text-xs font-bold mt-1">К</div>`;
    const avatar = role === 'bot' ? botAvatar : userAvatar;
    const bubbleBg = role === 'bot' ? `bg-geminiBotMsg rounded-2xl rounded-tl-none ${extraClass}` : `bg-geminiUserMsg rounded-2xl rounded-tr-none`;
    container.innerHTML = `${avatar}<div class="${bubbleBg} p-4 max-w-[85%] shadow-sm"><div class="message-text text-[15px]">${text}</div></div>`;
    if (prepend) msgDiv.prepend(container);
    else { msgDiv.appendChild(container); if(animate) scrollToBottom('smooth'); }
}

function showLoading() {
    const id = 'l_' + Date.now();
    const container = document.createElement('div');
    container.id = id;
    container.className = 'flex gap-3 items-start msg-anim';
    const botAvatar = `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full object-cover border border-gray-700 shadow-sm shrink-0 mt-1">`;
    container.innerHTML = `${botAvatar}<div class="bg-geminiBotMsg p-4 rounded-2xl rounded-tl-none flex gap-1 items-center"><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div></div>`;
    msgDiv.appendChild(container);
    scrollToBottom('smooth');
    return id;
}

function hideLoading(id) { document.getElementById(id)?.remove(); }
function scrollToBottom(behavior) { msgDiv.scrollTo({ top: msgDiv.scrollHeight, behavior }); }

btn.onclick = send;
window.addEventListener('DOMContentLoaded', () => loadHistory(true));
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
