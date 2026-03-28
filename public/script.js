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

/**
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 */
function checkInput() {
    const text = input.value.trim();
    sendBtn.disabled = text.length === 0;
    // Визуальный фидбек для кнопки
    sendBtn.style.opacity = text.length > 0 ? '1' : '0.5';
    sendBtn.style.cursor = text.length > 0 ? 'pointer' : 'default';
}

function renderMessage(text, role, animate = false) {
    const container = document.createElement('div');
    container.className = `flex gap-3 mb-5 ${role === 'user' ? 'flex-row-reverse' : ''}`;
    const bubble = document.createElement('div');
    bubble.className = `${role === 'bot' ? 'bg-geminiBotMsg' : 'bg-geminiUserMsg'} p-4 rounded-2xl max-w-[85%] text-white border border-gray-800 whitespace-pre-wrap msg-anim`;
    if (animate) bubble.classList.add('animate-message-entry');
    bubble.innerText = text;
    
    const avatar = role === 'bot' 
        ? `<img src="https://i.imgur.com/JgGswRe.png" class="w-9 h-9 rounded-full shrink-0">` 
        : `<div class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold shrink-0 text-xs">Я</div>`;
    
    container.innerHTML = avatar;
    container.appendChild(bubble);
    msgDiv.appendChild(container);
    msgDiv.scrollTop = msgDiv.scrollHeight;
}

async function api(action, method = 'GET', body = null) {
    const url = `/api/manage?action=${action}&userId=${userId}&chatId=${currentChatId}`;
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    return res.json();
}

/**
 * ОСНОВНАЯ ЛОГИКА
 */
async function selectChat(id, name, isInitial = false) {
    currentChatId = id;
    localStorage.setItem('pwa_chat_id', id);
    chatNameDisplay.innerText = name || "Чат";
    msgDiv.innerHTML = '<div class="p-10 text-center text-gray-600 animate-pulse text-xs uppercase tracking-widest">Загрузка истории...</div>';
    
    try {
        const data = await api('chat');
        userSettings = data.settings || userSettings;
        msgDiv.innerHTML = '';
        if (data.history) {
            data.history.forEach(m => renderMessage(m.parts[0].text, m.role === 'user' ? 'user' : 'bot'));
        }
    } catch (e) {
        msgDiv.innerHTML = '<div class="p-10 text-center text-red-500 text-xs">ОШИБКА ЗАГРУЗКИ</div>';
    }
    
    // Закрываем меню только если это НЕ первая загрузка страницы
    if (!isInitial && window.innerWidth < 1024) toggleMenu();
}

async function handleSend() {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    
    input.value = '';
    checkInput();
    renderMessage(text, 'user');
    
    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, chatId: currentChatId, userId })
    });
    const data = await res.json();
    if (data.text) renderMessage(data.text, 'bot', true);
}

/**
 * МЕНЮ И НАВИГАЦИЯ
 */
function toggleMenu() {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('overlay');
    const isOpen = s.classList.contains('translate-x-0');
    
    if (isOpen) {
        s.classList.replace('translate-x-0', '-translate-x-full');
        o.classList.add('hidden');
    } else {
        renderMenu(STATES.MAIN);
        s.classList.replace('-translate-x-full', 'translate-x-0');
        o.classList.remove('hidden');
    }
}

function renderMenu(state) {
    menuContent.innerHTML = '';
    document.getElementById('backBtn').classList.toggle('hidden', state === STATES.MAIN);
    
    if (state === STATES.MAIN) {
        const items = [
            {i:'forum', t:'Диалоги', s:STATES.DIALOGS}, 
            {i:'gavel', t:'Правила системы', s:STATES.RULES}, 
            {i:'tune', t:'Настройки ИИ', s:STATES.SETTINGS}
        ];
        items.forEach(item => {
            const d = document.createElement('div');
            d.className = 'flex items-center gap-3 text-gray-300 p-4 hover:bg-white/5 rounded-xl cursor-pointer transition-colors active:scale-95';
            d.innerHTML = `<span class="material-icons-outlined text-gray-500">${item.i}</span><span class="text-sm font-medium">${item.t}</span>`;
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
    menuContent.innerHTML = '<div class="p-4 text-center text-xs text-gray-600 animate-pulse">СПИСОК ПУСТ...</div>';
    const { list } = await api('list');
    menuContent.innerHTML = '';

    const addBtn = document.createElement('button');
    addBtn.className = 'w-full p-3 mb-4 border border-dashed border-geminiAccent/30 text-geminiAccent text-[10px] font-black uppercase rounded-xl hover:bg-geminiAccent/5';
    addBtn.innerText = '+ Создать новый чат';
    addBtn.onclick = async () => {
        const newId = 'c_' + Math.random().toString(36).substr(2, 9);
        await api('chat', 'POST', { name: "Новый диалог" });
        selectChat(newId, "Новый диалог");
    };
    menuContent.appendChild(addBtn);

    list.forEach(d => {
        const el = document.createElement('div');
        el.className = `p-3 mb-2 rounded-xl border transition-all ${d.id === currentChatId ? 'border-geminiAccent bg-geminiAccent/10' : 'border-gray-800 bg-gray-900/50'}`;
        el.innerHTML = `
            <div class="flex justify-between items-center">
                <span class="truncate cursor-pointer flex-1 text-sm ${d.id === currentChatId ? 'text-white font-bold' : 'text-gray-400'}" 
                      onclick="selectChat('${d.id}', '${d.name}')">${d.name}</span>
                <button onclick="deleteChat('${d.id}')" class="text-gray-600 hover:text-red-500 ml-2">×</button>
            </div>`;
        menuContent.appendChild(el);
    });
}
async function syncRules() {
    menuContent.innerHTML = '<div class="p-4 text-center animate-pulse">Загрузка правил...</div>';
    const data = await api('rules');
    menuContent.innerHTML = '';

    // Форма добавления
    const addWrap = document.createElement('div');
    addWrap.className = 'mb-6 p-2 bg-white/5 rounded-xl';
    addWrap.innerHTML = `
        <input id="newRuleInp" type="text" placeholder="Новое правило..." class="w-full bg-transparent p-2 text-sm text-white outline-none">
        <button id="addRuleBtn" class="w-full mt-2 p-2 bg-geminiAccent text-black text-[10px] font-bold rounded-lg uppercase">Добавить</button>
    `;
    menuContent.appendChild(addWrap);

// Внутри syncRules в script.js
document.getElementById('addRuleBtn').onclick = async () => {
    const val = document.getElementById('newRuleInp').value.trim();
    if (val) {
        // ВАЖНО: передаем в теле JSON { text: "..." }
        await fetch(`/api/manage?action=rules&userId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: val }) // Обязательно поле text
        });
        document.getElementById('newRuleInp').value = '';
        syncRules();
    }
};

    // Список правил
    if (data.rules && data.rules.length > 0) {
        data.rules.forEach(r => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-start gap-2 p-3 mb-2 bg-gray-800/40 rounded-lg border border-gray-700';
            div.innerHTML = `
                <span class="text-xs text-gray-300 flex-1">${r.text}</span>
                <button class="text-red-500 hover:scale-125 transition-transform" onclick="deleteRule('${r.text}')">×</button>
            `;
            menuContent.appendChild(div);
        });
    }
}

window.deleteRule = async (text) => {
    if (confirm('Удалить это правило?')) {
        await fetch(`/api/manage?action=rules&text=${encodeURIComponent(text)}`, { method: 'DELETE' });
        syncRules();
    }
};

window.deleteChat = async (id) => {
    if (confirm('Удалить чат навсегда?')) {
        currentChatId = id;
        await api('chat', 'DELETE');
        location.reload();
    }
};

function renderSettings() {
    const fields = [
        {id:'laconic', n:'Краткость'}, {id:'empathy', n:'Эмпатия'}, 
        {id:'human', n:'Сленг'}, {id:'contextLimit', n:'Память (сообщений)', max: 51}
    ];
    fields.forEach(f => {
        const div = document.createElement('div');
        div.className = 'mb-6';
        const val = userSettings[f.id] || 0;
        div.innerHTML = `
            <div class="flex justify-between text-[10px] text-gray-500 uppercase font-black mb-2">
                <span>${f.n}</span>
                <span id="v_${f.id}" class="text-geminiAccent">${val === 51 ? '∞' : val}</span>
            </div>
            <input type="range" min="0" max="${f.max || 10}" value="${val}" class="w-full accent-geminiAccent h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer" 
            oninput="userSettings['${f.id}']=parseInt(this.value); document.getElementById('v_${f.id}').innerText=(this.value == 51 ? '∞' : this.value)">`;
        menuContent.appendChild(div);
    });

    const save = document.createElement('button');
    save.className = 'w-full p-4 bg-geminiAccent text-black font-black text-[10px] uppercase rounded-xl shadow-lg active:scale-95 transition-transform';
    save.innerText = 'Применить настройки';
    save.onclick = async () => { 
        await api('chat', 'POST', { settings: userSettings }); 
        renderMenu(STATES.MAIN); 
    };
    menuContent.appendChild(save);
}

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
    // Слушатели ввода
    input.addEventListener('input', checkInput);
    input.addEventListener('keydown', (e) => (e.key === 'Enter' && !e.shiftKey) ? (e.preventDefault(), handleSend()) : null);
    
    // Кнопки интерфейса
    document.getElementById('menuBtn').onclick = toggleMenu;
    document.getElementById('overlay').onclick = toggleMenu;
    document.getElementById('backBtn').onclick = () => renderMenu(STATES.MAIN);
    document.getElementById('sendBtn').onclick = handleSend;

    // Стартовая загрузка
    if (!currentChatId) {
        const tempId = 'c_' + Math.random().toString(36).substr(2, 9);
        currentChatId = tempId;
        api('chat', 'POST', { name: "Первый чат" }).then(() => selectChat(tempId, "Первый чат", true));
    } else {
        selectChat(currentChatId, chatNameDisplay.innerText, true);
    }
    
    checkInput();
});
