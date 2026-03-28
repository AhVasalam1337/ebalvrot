const msgDiv = document.getElementById('chat-messages');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatNameDisplay = document.getElementById('chatNameDisplay');
const menuContent = document.getElementById('menuContent');
const modalOverlay = document.getElementById('modalOverlay');

let userId = localStorage.getItem('pwa_user_id') || 'u_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_user_id', userId);
let currentChatId = localStorage.getItem('pwa_chat_id');
let userSettings = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };

const STATES = { MAIN: 'MAIN', DIALOGS: 'DIALOGS', RULES: 'RULES', SETTINGS: 'SETTINGS' };

// УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ
function renderMessage(text, role, animate = false) {
    const container = document.createElement('div');
    container.className = `flex gap-3 mb-5 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    const bubble = document.createElement('div');
    bubble.className = `${role === 'bot' ? 'bg-geminiBotMsg' : 'bg-geminiUserMsg'} p-4 rounded-2xl max-w-[85%] text-white border border-gray-800 whitespace-pre-wrap`;
    if (animate) bubble.classList.add('animate-message-entry');
    bubble.innerText = text;
    container.innerHTML = role === 'bot' ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full">` : `<div class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold">Я</div>`;
    container.appendChild(bubble);
    msgDiv.appendChild(container);
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

// РАБОТА С API
async function api(action, method = 'GET', body = null) {
    const url = `/api/manage?action=${action}&userId=${userId}&chatId=${currentChatId}`;
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    return res.json();
}

async function selectChat(id, name) {
    currentChatId = id;
    localStorage.setItem('pwa_chat_id', id);
    chatNameDisplay.innerText = name || "Чат";
    msgDiv.innerHTML = '<div class="p-10 text-center text-gray-600 animate-pulse">Загрузка истории...</div>';
    
    const data = await api('chat');
    userSettings = data.settings;
    msgDiv.innerHTML = '';
    if (data.history) data.history.forEach(m => renderMessage(m.parts[0].text, m.role === 'user' ? 'user' : 'bot'));
    if (window.innerWidth < 1024) toggleMenu();
}

async function handleSend() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    input.value = ''; sendBtn.disabled = true;
    renderMessage(text, 'user');
    
    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, chatId: currentChatId, userId })
    });
    const data = await res.json();
    if (data.text) renderMessage(data.text, 'bot', true);
    sendBtn.disabled = false;
}

// МЕНЮ И НАСТРОЙКИ
function renderMenu(state) {
    menuContent.innerHTML = '';
    document.getElementById('backBtn').classList.toggle('hidden', state === STATES.MAIN);
    
    if (state === STATES.MAIN) {
        const items = [{i:'forum', t:'Чаты', s:STATES.DIALOGS}, {i:'gavel', t:'Правила', s:STATES.RULES}, {i:'tune', t:'Тюнинг', s:STATES.SETTINGS}];
        items.forEach(item => {
            const d = document.createElement('div');
            d.className = 'flex items-center gap-3 text-gray-300 p-4 hover:bg-gray-800 rounded-xl cursor-pointer';
            d.innerHTML = `<span class="material-icons-outlined">${item.i}</span><span>${item.t}</span>`;
            d.onclick = () => renderMenu(item.s);
            menuContent.appendChild(d);
        });
    } else if (state === STATES.DIALOGS) {
        syncDialogs();
    } else if (state === STATES.SETTINGS) {
        renderSettings();
    } else if (state === STATES.RULES) {
        syncRules();
    }
}

async function syncDialogs() {
    const { list } = await api('list');
    const addBtn = document.createElement('button');
    addBtn.className = 'w-full p-4 mb-4 border border-dashed border-geminiAccent text-geminiAccent rounded-xl';
    addBtn.innerText = '+ НОВЫЙ ЧАТ';
    addBtn.onclick = async () => {
        const newId = 'c_' + Math.random().toString(36).substr(2, 9);
        currentChatId = newId;
        await api('chat', 'POST', { name: "Новый диалог" });
        selectChat(newId, "Новый диалог");
    };
    menuContent.appendChild(addBtn);
    list.forEach(d => {
        const el = document.createElement('div');
        el.className = `p-3 mb-2 rounded-xl border ${d.id === currentChatId ? 'border-geminiAccent bg-geminiAccent/10' : 'border-gray-700'}`;
        el.innerHTML = `<div class="flex justify-between">
            <span class="truncate cursor-pointer flex-1" onclick="selectChat('${d.id}', '${d.name}')">${d.name}</span>
            <button onclick="deleteChat('${d.id}')" class="text-gray-500">×</button>
        </div>`;
        menuContent.appendChild(el);
    });
}

function renderSettings() {
    const fields = [
        {id:'laconic', n:'Краткость'}, {id:'empathy', n:'Эмпатия'}, 
        {id:'human', n:'Сленг'}, {id:'contextLimit', n:'Память', max: 51}
    ];
    fields.forEach(f => {
        const div = document.createElement('div');
        div.className = 'mb-6';
        div.innerHTML = `<div class="flex justify-between text-xs text-gray-400 mb-2"><span>${f.n}</span><span id="v_${f.id}">${userSettings[f.id]}</span></div>
            <input type="range" min="0" max="${f.max || 10}" value="${userSettings[f.id]}" class="w-full accent-geminiAccent" 
            oninput="userSettings['${f.id}']=parseInt(this.value); document.getElementById('v_${f.id}').innerText=this.value">`;
        menuContent.appendChild(div);
    });
    const save = document.createElement('button');
    save.className = 'w-full p-4 bg-geminiAccent text-black font-bold rounded-xl';
    save.innerText = 'СОХРАНИТЬ';
    save.onclick = async () => { await api('chat', 'POST', { settings: userSettings }); renderMenu(STATES.MAIN); };
    menuContent.appendChild(save);
}

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
    if (!currentChatId) {
        currentChatId = 'c_' + Math.random().toString(36).substr(2, 9);
        api('chat', 'POST', { name: "Первый чат" }).then(() => selectChat(currentChatId, "Первый чат"));
    } else {
        selectChat(currentChatId, chatNameDisplay.innerText);
    }
    
    document.getElementById('menuBtn').onclick = toggleMenu;
    document.getElementById('backBtn').onclick = () => renderMenu(STATES.MAIN);
    document.getElementById('sendBtn').onclick = handleSend;
    input.onkeydown = (e) => (e.key === 'Enter' && !e.shiftKey) ? (e.preventDefault(), handleSend()) : null;
});

function toggleMenu() {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('overlay');
    const isOpen = s.classList.contains('translate-x-0');
    s.classList.toggle('translate-x-0', !isOpen);
    s.classList.toggle('-translate-x-full', isOpen);
    o.classList.toggle('hidden', isOpen);
    if (!isOpen) renderMenu(STATES.MAIN);
}
