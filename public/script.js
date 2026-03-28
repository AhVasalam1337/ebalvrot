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

// Текущий ID чата
let myId = localStorage.getItem('pwa_chat_id') || 'pwa_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_chat_id', myId);

const STATES = { MAIN: 'MAIN', DIALOGS: 'DIALOGS', RULES: 'RULES', SETTINGS: 'SETTINGS' };

/**
 * 1. УПРАВЛЕНИЕ МЕНЮ
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
 * 2. СИНХРОНИЗАЦИЯ С BALASTDB (REDIS API)
 */

async function syncDialogs() {
    menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 animate-pulse text-[10px]">ЗАГРУЗКА...</div>';
    try {
        const res = await fetch(`/api/dialogs?userId=${myId}`);
        const data = await res.json();
        menuContent.innerHTML = '';

        // КНОПКА "НОВЫЙ ДИАЛОГ"
        const newChatBtn = document.createElement('div');
        newChatBtn.className = 'flex items-center gap-3 text-geminiAccent p-3 mb-4 bg-geminiAccent/10 border border-dashed border-geminiAccent/30 rounded-xl cursor-pointer hover:bg-geminiAccent/20 transition-all';
        newChatBtn.innerHTML = '<span class="material-icons-outlined">add_comment</span><span class="text-sm font-bold uppercase tracking-tighter">Новый диалог</span>';
        newChatBtn.onclick = () => {
            const newId = 'pwa_' + Math.random().toString(36).substr(2, 9);
            myId = newId;
            localStorage.setItem('pwa_chat_id', myId);
            chatNameDisplay.innerText = 'Geminка';
            msgDiv.innerHTML = '';
            renderMessage("Привет! Я создала новый диалог. О чём хочешь поговорить?", 'bot');
            toggleMenu();
        };
        menuContent.appendChild(newChatBtn);

        // СПИСОК СУЩЕСТВУЮЩИХ
        if (data.list && data.list.length > 0) {
            data.list.forEach(d => {
                const item = document.createElement('div');
                item.className = `p-3 mb-2 rounded-xl border border-gray-700 cursor-pointer hover:bg-gray-800 transition-all ${d.id === myId ? 'bg-geminiAccent/10 border-geminiAccent' : 'bg-gray-800/30'}`;
                item.innerHTML = `
                    <div class="text-sm font-bold text-white truncate">${d.name || 'Диалог ' + d.id.slice(-4)}</div>
                    <div class="text-[9px] text-gray-500 mt-1 uppercase tracking-widest">${new Date(d.updatedAt).toLocaleDateString()}</div>
                `;
                item.onclick = () => {
                    myId = d.id;
                    localStorage.setItem('pwa_chat_id', myId);
                    chatNameDisplay.innerText = d.name || 'Geminка';
                    loadHistory(true); // Важно: подгружаем историю выбранного чата
                    toggleMenu();
                };
                menuContent.appendChild(item);
            });
        }
    } catch (e) {
        menuContent.innerHTML = '<div class="p-4 text-red-500 text-[10px]">ОШИБКА REDIS</div>';
    }
}

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
                    <div class="text-[12px] text-gray-300 flex-1 leading-relaxed text-left">${rule.text}</div>
                    <button class="text-gray-600 hover:text-red-400 p-1 shrink-0" onclick="deleteRule('${rule.id}')">
                        <span class="material-icons-outlined text-[18px]">delete</span>
                    </button>
                `;
                menuContent.appendChild(div);
            });
        }
    } catch (e) { console.error(e); }

    const addBtn = document.createElement('button');
    addBtn.className = 'w-full flex items-center justify-center gap-2 p-3 mt-4 border border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-geminiAccent transition-all';
    addBtn.innerHTML = '<span class="material-icons-outlined">add</span><span class="text-[11px] font-bold uppercase">Добавить</span>';
    addBtn.onclick = openAddRule;
    menuContent.appendChild(addBtn);
}

/**
 * 3. ЯДРО ЧАТА
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
            renderMessage("История пуста. Начнем общение?", 'bot');
        }
    } catch (e) {
        if (isFirstLoad) msgDiv.innerHTML = '';
    }
}

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
        renderMessage('Ошибка связи с сервером.', 'bot');
    }
}

function renderMessage(text, role, anim = true) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start ${anim ? 'opacity-0 translate-y-2 animate-[fadeIn_0.3s_ease-out_forwards]' : ''} ${role === 'user' ? 'flex-row-reverse' : ''}`;
    
    const avatar = role === 'bot' 
        ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0 border border-gray-800 shadow-sm">` 
        : `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold shrink-0 text-[10px] shadow-sm uppercase">Я</div>`;
    
    // Текст теперь всегда прижат к левому краю внутри бабла
    container.innerHTML = `
        ${avatar}
        <div class="${role === 'bot' ? 'bg-geminiBotMsg rounded-tl-none border-gray-800' : 'bg-geminiUserMsg rounded-tr-none border-gray-700'} p-4 rounded-2xl max-w-[85%] text-[15px] text-white border whitespace-pre-wrap leading-relaxed shadow-sm text-left">
            ${text}
        </div>
    `;
    msgDiv.appendChild(container);
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

/**
 * 4. ВСПОМОГАТЕЛЬНОЕ
 */
function showLoading() {
    const id = 'l' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex gap-3 items-start';
    div.innerHTML = `
        <img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0">
        <div class="bg-geminiBotMsg p-4 rounded-2xl rounded-tl-none flex gap-1 items-center border border-gray-800">
            <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
            <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]"></div>
            <div class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
        </div>
    `;
    msgDiv.appendChild(div);
    msgDiv.scrollTop = msgDiv.scrollHeight;
    return id;
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
        sidebar.classList.replace('translate-x-0', '-translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    } else {
        renderMenu(STATES.MAIN);
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        sidebar.classList.replace('-translate-x-full', 'translate-x-0');
    }
}

async function deleteRule(id) {
    if (confirm('Удалить?')) {
        await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
        syncRules();
    }
}

function openAddRule() {
    showModal('Новое правило', `<textarea id="modalInput" class="w-full h-24 bg-gray-800 border-gray-700 rounded-xl p-3 text-white text-sm" placeholder="Например: Отвечай коротко..."></textarea>`, async () => {
        const text = document.getElementById('modalInput').value;
        await fetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        modalOverlay.classList.add('hidden');
        syncRules();
    });
}

function deleteChatAction() {
    if (confirm('Очистить историю?')) {
        fetch(`/api/history?chatId=${myId}`, { method: 'DELETE' }).then(() => location.reload());
    }
}

async function openRenameChat() {
    showModal('Имя чата', `<input id="modalInput" type="text" class="w-full bg-gray-800 border-gray-700 rounded-xl p-3 text-white" value="${chatNameDisplay.innerText}">`, async () => {
        const name = document.getElementById('modalInput').value;
        await fetch('/api/chat/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: myId, name })
        });
        chatNameDisplay.innerText = name;
        modalOverlay.classList.add('hidden');
    });
}

async function openCharacterEditor() {
    showModal('Характер', `<textarea id="modalInput" class="w-full h-32 bg-gray-800 border-gray-700 rounded-xl p-3 text-white text-sm">Ты — Geminка...</textarea>`, async () => {
        modalOverlay.classList.add('hidden');
    });
}

/**
 * ИНИЦИАЛИЗАЦИЯ
 */
menuBtn.onclick = toggleMenu;
overlay.onclick = toggleMenu;
btn.onclick = send;
window.addEventListener('DOMContentLoaded', () => loadHistory(true));
input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

const style = document.createElement('style');
style.textContent = `@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`;
document.head.appendChild(style);
