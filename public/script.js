const msgDiv = document.getElementById('chat-messages');
const input = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatNameDisplay = document.getElementById('chatNameDisplay');
const menuContent = document.getElementById('menuContent');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

// ЛОГИКА АВТОРИЗАЦИИ ПО КЛЮЧУ
let userId = localStorage.getItem('pwa_user_id');

if (!userId || userId === 'null' || userId === 'undefined') {
    const promptId = prompt("Введите ваш ключ доступа (например, 777):", "");
    if (promptId && promptId.trim()) {
        userId = promptId.trim();
        localStorage.setItem('pwa_user_id', userId);
    } else {
        userId = 'temp_' + Math.random().toString(36).substr(2, 5);
        alert("Используется временный ID. Чаты могут пропасть после очистки куки.");
    }
}

let currentChatId = localStorage.getItem('pwa_chat_id');
let userSettings = { laconic: 5, empathy: 5, human: 5, contextLimit: 20 };
let currentOffset = 0; // Смещение для пагинации

const STATES = { MAIN: 'MAIN', DIALOGS: 'DIALOGS', RULES: 'RULES', SETTINGS: 'SETTINGS' };

/**
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 */
function checkInput() {
    const text = input.value.trim();
    sendBtn.disabled = text.length === 0;
    sendBtn.style.opacity = text.length > 0 ? '1' : '0.5';
}

function renderMessage(text, role, animate = false, prepend = false) {
    const container = document.createElement('div');
    container.className = `flex gap-3 mb-5 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    
    const bubble = document.createElement('div');
    bubble.className = `${role === 'bot' ? 'bg-geminiBotMsg' : 'bg-geminiUserMsg'} p-4 rounded-2xl max-w-[85%] text-white border border-gray-800 msg-anim prose prose-invert prose-sm`;
    
    if (animate) bubble.classList.add('animate-message-entry');
    
    if (role === 'bot') {
        bubble.innerHTML = marked.parse(text);
    } else {
        bubble.innerText = text;
    }
    
    const avatar = role === 'bot' 
        ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0">` 
        : `<div class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold shrink-0 text-[10px] text-white">Я</div>`;
    
    container.innerHTML = avatar;
    container.appendChild(bubble);

    if (prepend) {
        // Добавляем в начало (для истории)
        msgDiv.prepend(container);
    } else {
        // Добавляем в конец (для новых)
        msgDiv.appendChild(container);
        msgDiv.scrollTop = msgDiv.scrollHeight;
    }
}

/**
 * API WRAPPER
 */
async function api(action, method = 'GET', body = null, forceChatId = null) {
    const targetChatId = forceChatId || currentChatId || '';
    const url = `/api/manage?action=${action}&userId=${userId}&chatId=${targetChatId}`;
    
    const options = { 
        method, 
        headers: { 'Content-Type': 'application/json' } 
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("API Call failed:", e);
        return {};
    }
}

/**
 * ЛОГИКА ЧАТА
 */
async function loadHistoryChunk() {
    try {
        const res = await fetch(`/api/history?chatId=${currentChatId}&offset=${currentOffset}`);
        const data = await res.json();
        
        if (data.messages && data.messages.length > 0) {
            // Удаляем кнопку "Еще", если она есть, перед добавлением новых сообщений
            const oldBtn = document.getElementById('load-more-btn');
            if (oldBtn) oldBtn.remove();

            // Сообщения из API приходят от новых к старым (из-за lrange -10 -1)
            // Но мы их вставляем в начало по одному, поэтому переворачиваем, 
            // чтобы сохранить хронологию внутри пачки
            data.messages.reverse().forEach(m => {
                renderMessage(m.text, m.role === 'user' ? 'user' : 'bot', false, true);
            });

            currentOffset += data.messages.length;

            if (data.hasMore) {
                const btn = document.createElement('button');
                btn.id = 'load-more-btn';
                btn.className = 'w-full py-3 mb-4 text-[10px] text-gray-500 uppercase tracking-widest hover:text-geminiAccent transition-colors';
                btn.innerText = 'Показать предыдущие сообщения';
                btn.onclick = loadHistoryChunk;
                msgDiv.prepend(btn);
            }
        }
    } catch (e) {
        console.error("Ошибка загрузки истории:", e);
    }
}

async function selectChat(id, name, isInitial = false) {
    if (!id) return;
    currentChatId = id;
    currentOffset = 0; // Сбрасываем смещение
    localStorage.setItem('pwa_chat_id', id);
    
    chatNameDisplay.innerText = name || "Загрузка...";
    msgDiv.innerHTML = '<div class="p-10 text-center text-gray-600 animate-pulse text-[10px] uppercase tracking-widest">Синхронизация...</div>';
    
    try {
        // Загружаем настройки и мету
        const data = await api('chat');
        userSettings = data.settings || userSettings;
        chatNameDisplay.innerText = data.meta?.name || name || "Чат";
        
        msgDiv.innerHTML = '';
        
        // Загружаем первую пачку истории
        await loadHistoryChunk();

        if (msgDiv.children.length === 0) {
            msgDiv.innerHTML = '<div class="p-10 text-center text-gray-700 text-[10px] uppercase tracking-[0.2em]">История пуста</div>';
        } else {
            // Скроллим вниз после первой загрузки
            msgDiv.scrollTop = msgDiv.scrollHeight;
        }
    } catch (e) {
        msgDiv.innerHTML = '<div class="p-10 text-center text-red-500 text-xs">ОШИБКА ПОДКЛЮЧЕНИЯ</div>';
    }
    
    if (!isInitial && window.innerWidth < 1024) toggleMenu();
}

chatNameDisplay.onclick = async () => {
    const oldName = chatNameDisplay.innerText;
    const newName = prompt("Новое название чата:", oldName);
    if (newName && newName.trim() && newName !== oldName) {
        chatNameDisplay.innerText = newName.trim();
        await api('chat', 'POST', { name: newName.trim() });
    }
};

async function handleSend() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    
    input.value = '';
    checkInput();
    renderMessage(text, 'user');
    currentOffset++; // Увеличиваем оффсет, так как в базе стало на 1 сообщение больше
    
    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, chatId: currentChatId, userId })
        });
        const data = await res.json();
        if (data.text) {
            renderMessage(data.text, 'bot', true);
            currentOffset++; // И еще на одно (ответ бота)
        }
    } catch (e) {
        renderMessage("Ошибка сервера.", "bot");
    }
}

/**
 * НАВИГАЦИЯ И МЕНЮ
 */
function toggleMenu() {
    const isOpen = sidebar.classList.contains('translate-x-0');
    if (isOpen) {
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
    document.getElementById('backBtn').classList.toggle('hidden', state === STATES.MAIN);
    
    if (state === STATES.MAIN) {
        const items = [
            {i:'forum', t:'Диалоги', s:STATES.DIALOGS}, 
            {i:'gavel', t:'Правила системы', s:STATES.RULES}, 
            {i:'tune', t:'Настройки ИИ', s:STATES.SETTINGS},
            {i:'logout', t:'Сменить ключ', s:'LOGOUT'}
        ];
        items.forEach(item => {
            const d = document.createElement('div');
            d.className = 'flex items-center gap-4 text-gray-300 p-4 hover:bg-white/5 rounded-2xl cursor-pointer transition-all active:scale-95';
            d.innerHTML = `<span class="material-icons-outlined text-gray-500">${item.i}</span><span class="text-sm font-semibold">${item.t}</span>`;
            d.onclick = () => {
                if(item.s === 'LOGOUT') {
                    if(confirm("Выйти и сменить ключ?")) {
                        localStorage.clear();
                        location.reload();
                    }
                } else {
                    renderMenu(item.s);
                }
            };
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
    menuContent.innerHTML = '<div class="p-6 text-center text-xs text-gray-600 animate-pulse uppercase tracking-widest">Загрузка...</div>';
    try {
        const data = await api('list');
        const list = data.list || [];
        menuContent.innerHTML = '';

        const addBtn = document.createElement('button');
        addBtn.className = 'w-full p-4 mb-4 border border-dashed border-geminiAccent/40 text-geminiAccent text-[10px] font-black uppercase rounded-2xl hover:bg-geminiAccent/10 transition-all';
        addBtn.innerText = '+ Создать новый диалог';
        addBtn.onclick = async () => {
            const newId = 'c_' + Math.random().toString(36).substr(2, 9);
            await api('chat', 'POST', { name: "Новый диалог" }, newId);
            selectChat(newId, "Новый диалог");
        };
        menuContent.appendChild(addBtn);

        list.forEach(d => {
            const el = document.createElement('div');
            el.className = `p-4 mb-2 rounded-2xl border transition-all ${d.id === currentChatId ? 'border-geminiAccent bg-geminiAccent/10' : 'border-gray-800 bg-gray-900/50'}`;
            el.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="truncate cursor-pointer flex-1 text-sm ${d.id === currentChatId ? 'text-white font-bold' : 'text-gray-400'}" 
                          onclick="selectChat('${d.id}', '${d.name}')">${d.name}</span>
                    <button onclick="deleteChat('${d.id}')" class="text-gray-600 hover:text-red-500 ml-3 text-xl">×</button>
                </div>`;
            menuContent.appendChild(el);
        });
    } catch (e) {
        menuContent.innerHTML = '<div class="p-4 text-red-500 text-xs">Ошибка загрузки</div>';
    }
}

async function syncRules() {
    const data = await api('rules');
    menuContent.innerHTML = '';

    const addWrap = document.createElement('div');
    addWrap.className = 'mb-6 p-3 bg-white/5 rounded-2xl border border-white/5';
    addWrap.innerHTML = `
        <input id="newRuleInp" type="text" placeholder="Установка..." class="w-full bg-transparent p-2 text-sm text-white outline-none">
        <button id="addRuleBtn" class="w-full mt-3 p-3 bg-geminiAccent text-black text-[10px] font-black rounded-xl uppercase active:scale-95 transition-transform">Добавить</button>
    `;
    menuContent.appendChild(addWrap);

    document.getElementById('addRuleBtn').onclick = async () => {
        const val = document.getElementById('newRuleInp').value.trim();
        if (val) {
            await api('rules', 'POST', { text: val });
            syncRules();
        }
    };

    if (data.rules) {
        data.rules.forEach(r => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-start gap-3 p-4 mb-2 bg-gray-800/40 rounded-2xl border border-gray-700/50';
            div.innerHTML = `
                <span class="text-xs text-gray-300 flex-1 leading-relaxed">${r.text}</span>
                <button class="text-red-500 text-xl px-1" onclick="deleteRule('${encodeURIComponent(r.text)}')">×</button>
            `;
            menuContent.appendChild(div);
        });
    }
}

window.deleteRule = async (enc) => {
    if (confirm('Удалить правило?')) {
        await fetch(`/api/manage?action=rules&userId=${userId}&text=${enc}`, { method: 'DELETE' });
        syncRules();
    }
};

window.deleteChat = async (id) => {
    if (confirm('Удалить диалог?')) {
        await api('chat', 'DELETE', null, id);
        if (currentChatId === id) {
            localStorage.removeItem('pwa_chat_id');
            location.reload();
        } else {
            syncDialogs();
        }
    }
};

function renderSettings() {
    const fields = [
        {id:'laconic', n:'Лаконичность'}, {id:'empathy', n:'Эмпатия'}, 
        {id:'human', n:'Человечность'}, {id:'contextLimit', n:'Память', max: 51}
    ];
    fields.forEach(f => {
        const div = document.createElement('div');
        div.className = 'mb-8';
        const val = userSettings[f.id] || 0;
        div.innerHTML = `
            <div class="flex justify-between text-[10px] text-gray-500 uppercase font-black mb-3 tracking-widest">
                <span>${f.n}</span>
                <span id="v_${f.id}" class="text-geminiAccent">${val == 51 ? '∞' : val}</span>
            </div>
            <input type="range" min="0" max="${f.max || 10}" value="${val}" class="w-full accent-geminiAccent h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer" 
            oninput="userSettings['${f.id}']=parseInt(this.value); document.getElementById('v_${f.id}').innerText=(this.value == 51 ? '∞' : this.value)">`;
        menuContent.appendChild(div);
    });

    const save = document.createElement('button');
    save.className = 'w-full p-5 bg-geminiAccent text-black font-black text-[10px] uppercase rounded-2xl shadow-xl active:scale-95 transition-transform mt-4';
    save.innerText = 'Сохранить';
    save.onclick = async () => { 
        await api('chat', 'POST', { settings: userSettings }); 
        renderMenu(STATES.MAIN); 
    };
    menuContent.appendChild(save);
}

/**
 * ИНИЦИАЛИЗАЦИЯ
 */
document.addEventListener('DOMContentLoaded', async () => {
    input.addEventListener('input', checkInput);
    input.addEventListener('keydown', (e) => (e.key === 'Enter' && !e.shiftKey) ? (e.preventDefault(), handleSend()) : null);
    document.getElementById('menuBtn').onclick = toggleMenu;
    overlay.onclick = toggleMenu;
    document.getElementById('backBtn').onclick = () => renderMenu(STATES.MAIN);
    sendBtn.onclick = handleSend;

    try {
        const data = await api('list');
        const list = data.list || [];

        if (list.length === 0) {
            const firstId = 'c_' + Math.random().toString(36).substr(2, 9);
            currentChatId = firstId;
            localStorage.setItem('pwa_chat_id', firstId);
            await api('chat', 'POST', { name: "Первый чат" }, firstId);
            await selectChat(firstId, "Первый чат", true);
        } else {
            const toLoad = currentChatId && list.find(c => c.id === currentChatId) ? currentChatId : list[0].id;
            const chat = list.find(c => c.id === toLoad) || list[0];
            await selectChat(chat.id, chat.name, true);
        }
    } catch (e) {
        console.error("Critical Startup Error:", e);
    }
    checkInput();
});
