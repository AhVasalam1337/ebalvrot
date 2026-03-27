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
 * 1. ЛОГИКА МЕНЮ И БД
 */
const STATES = { MAIN: 'MAIN', DIALOGS: 'DIALOGS', RULES: 'RULES', SETTINGS: 'SETTINGS' };

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
            createItem('psychology', 'Настройка характера', openCharacterEditor);
            createItem('edit', 'Переименовать чат', openRenameChat);
            createItem('delete_forever', 'Удалить чат', deleteChatAction, 'text-red-400');
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

/**
 * 2. СИНХРОНИЗАЦИЯ С BALASTDB
 */
async function syncDialogs() {
    menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 animate-pulse text-xs">Подключение к BalastDB...</div>';
    const res = await fetch(`/api/dialogs?userId=${myId}`);
    const data = await res.json();
    menuContent.innerHTML = '';
    if (data.list?.length) {
        data.list.forEach(d => {
            const item = document.createElement('div');
            item.className = `p-3 mb-2 rounded-xl border border-gray-700 cursor-pointer hover:bg-gray-800 ${d.id === myId ? 'bg-geminiAccent/10 border-geminiAccent' : 'bg-gray-800/30'}`;
            item.innerHTML = `<div class="text-sm font-bold text-white truncate">${d.name || 'Диалог'}</div><div class="text-[10px] text-gray-500">${new Date(d.updatedAt).toLocaleString()}</div>`;
            item.onclick = () => { myId = d.id; localStorage.setItem('pwa_chat_id', myId); chatNameDisplay.innerText = d.name; loadHistory(true); toggleMenu(); };
            menuContent.appendChild(item);
        });
    } else {
        menuContent.innerHTML = '<div class="p-4 text-center text-gray-500 text-xs italic">История пуста</div>';
    }
}

async function syncRules() {
    menuContent.innerHTML = '<div class="text-center p-4 text-gray-500 animate-pulse text-xs">Загрузка правил...</div>';
    const res = await fetch('/api/rules');
    const data = await res.json();
    menuContent.innerHTML = '';
    
    data.rules.forEach(rule => {
        const div = document.createElement('div');
        div.className = 'group flex items-start justify-between gap-2 p-3 bg-geminiBotMsg rounded-xl mb-2 border border-gray-800 hover:border-gray-600 transition-all';
        div.innerHTML = `
            <div class="text-xs text-gray-300 flex-1">${rule.text}</div>
            <button class="text-gray-600 hover:text-red-400 transition-colors" onclick="deleteRule('${rule.id}')">
                <span class="material-icons-outlined text-[18px]">delete</span>
            </button>
        `;
        menuContent.appendChild(div);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'w-full flex items-center justify-center gap-2 p-3 mt-4 border-2 border-dashed border-gray-700 rounded-xl text-gray-500 hover:text-geminiAccent hover:border-geminiAccent transition-all';
    addBtn.innerHTML = '<span class="material-icons-outlined">add</span><span class="text-sm font-bold uppercase">Добавить правило</span>';
    addBtn.onclick = openAddRule;
    menuContent.appendChild(addBtn);
}

async function deleteRule(id) {
    if(confirm('Удалить это правило из БД?')) {
        // В Vercel без Express параметры передаем через query string
        await fetch(`/api/rules?id=${id}`, { method: 'DELETE' });
        syncRules();
    }
}

function openAddRule() {
    showModal('Новое правило', `<textarea id="modalInput" class="w-full h-24 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-sm" placeholder="Введите текст правила..."></textarea>`, async () => {
        const text = document.getElementById('modalInput').value;
        if(text) {
            await fetch('/api/rules', { method: 'POST', body: JSON.stringify({ text }) });
            syncRules();
            modalOverlay.classList.add('hidden');
        }
    });
}

/**
 * 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 */
async function openRenameChat() {
    showModal('Переименовать', `<input id="modalInput" type="text" class="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white" value="${chatNameDisplay.innerText}">`, async () => {
        const name = document.getElementById('modalInput').value;
        chatNameDisplay.innerText = name;
        await fetch('/api/chat/rename', { method: 'POST', body: JSON.stringify({ chatId: myId, name }) });
        modalOverlay.classList.add('hidden');
    });
}

async function openCharacterEditor() {
    showModal('Характер', `<textarea id="modalInput" class="w-full h-32 bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-sm">Ты — Geminка...</textarea>`, async () => {
        const prompt = document.getElementById('modalInput').value;
        await fetch('/api/chat/character', { method: 'POST', body: JSON.stringify({ chatId: myId, prompt }) });
        modalOverlay.classList.add('hidden');
    });
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
        sidebar.classList.remove('translate-x-0'); sidebar.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0'); setTimeout(() => overlay.classList.add('hidden'), 300);
        document.body.style.overflow = '';
    } else {
        renderMenu(STATES.MAIN);
        overlay.classList.remove('hidden'); setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        sidebar.classList.remove('-translate-x-full'); sidebar.classList.add('translate-x-0');
        document.body.style.overflow = 'hidden';
    }
}

menuBtn.onclick = toggleMenu;
overlay.onclick = toggleMenu;

/**
 * 4. ЧАТ И ИСТОРИЯ
 */
async function loadHistory(isFirstLoad = false) {
    try {
        const res = await fetch(`/api/history?chatId=${myId}`);
        const data = await res.json();
        if (isFirstLoad) msgDiv.innerHTML = '';
        if (data.history?.length) {
            data.history.reverse().forEach(m => renderMessage(m.parts[0].text, m.role === 'user' ? 'user' : 'bot', false));
            msgDiv.scrollTop = msgDiv.scrollHeight;
        } else if (isFirstLoad) {
            renderMessage("Привет! Я Geminка, подключена к BalastDB.", 'bot');
        }
    } catch(e) { console.error('History fail', e); }
}

input.addEventListener('input', function() {
    btn.disabled = !this.value.trim();
    this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px';
});

async function send() {
    const text = input.value.trim();
    if(!text) return;
    renderMessage(text, 'user');
    input.value = ''; input.style.height = 'auto';
    const lId = showLoading();
    try {
        const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ text, chatId: myId }) });
        const data = await res.json();
        document.getElementById(lId).remove();
        if(data.text) renderMessage(data.text, 'bot');
    } catch(e) { document.getElementById(lId).remove(); renderMessage('Ошибка БД.', 'bot'); }
}

function renderMessage(text, role, anim = true) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start ${anim ? 'opacity-0 translate-y-2 animate-[fadeIn_0.3s_ease-out_forwards]' : ''} ${role === 'user' ? 'flex-row-reverse' : ''}`;
    const av = role === 'bot' ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0">` : `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold shrink-0 text-xs">К</div>`;
    container.innerHTML = `${av}<div class="${role === 'bot' ? 'bg-geminiBotMsg rounded-tl-none' : 'bg-geminiUserMsg rounded-tr-none'} p-4 rounded-2xl max-w-[85%] text-[15px] text-white whitespace-pre-wrap">${text}</div>`;
    msgDiv.appendChild(container);
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

function showLoading() {
    const id = 'l' + Date.now();
    const div = document.createElement('div');
    div.id = id; div.className = 'flex gap-3 items-start';
    div.innerHTML = `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0"><div class="bg-geminiBotMsg p-4 rounded-2xl rounded-tl-none flex gap-1"><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div></div>`;
    msgDiv.appendChild(div);
    msgDiv.scrollTop = msgDiv.scrollHeight;
    return id;
}

btn.onclick = send;
window.addEventListener('DOMContentLoaded', () => loadHistory(true));
input.onkeydown = (e) => { if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
