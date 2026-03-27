const msgDiv = document.getElementById('chat-messages');
const input = document.getElementById('userInput'); // Теперь это Textarea
const btn = document.getElementById('sendBtn');

let myId = localStorage.getItem('pwa_chat_id') || 'pwa_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_chat_id', myId);

let currentOffset = 0;
let isLoadingMore = false;
let hasMore = true;

/**
 * 1. ПОДГРУЗКА ИСТОРИИ
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
                const role = msg.role === 'user' ? 'user' : 'bot';
                const text = msg.parts[0].text;
                renderMessage(text, role, false, '', true);
            });

            currentOffset += data.history.length;
            hasMore = data.hasMore;

            if (isFirstLoad) {
                scrollToBottom('auto');
            } else {
                msgDiv.scrollTop = msgDiv.scrollHeight - oldHeight;
            }
        } else if (isFirstLoad) {
            renderMessage("Привет! Я Катя.", 'bot', true);
        }
    } catch (e) { console.error(e); } finally { isLoadingMore = false; }
}

msgDiv.addEventListener('scroll', () => {
    if (msgDiv.scrollTop < 20 && hasMore && !isLoadingMore) loadHistory();
});

window.addEventListener('DOMContentLoaded', () => loadHistory(true));

/**
 * 2. ОТПРАВКА И ФИКСЫ ВВОДА
 */

// ЛОГИКА АВТО-РАСШИРЕНИЯ СТРОКИ (NEW)
input.addEventListener('input', function() {
    // Деактивируем кнопку, если пусто
    btn.disabled = !this.value.trim();

    // Сбрасываем высоту, чтобы вычислить новую
    this.style.height = 'auto';
    
    // Вычисляем новую высоту на основе текста
    const newHeight = this.scrollHeight;
    
    if(newHeight > 36) { // 36px - высота одной строки
        this.style.height = newHeight + 'px';
        this.style.overflowY = newHeight > 150 ? 'scroll' : 'hidden'; // max-height из CSS
        this.parentElement.style.borderRadius = '16px'; // Делаем менее закругленным при расширении
    } else {
        this.style.height = '36px'; // Дефолт
        this.parentElement.style.borderRadius = '24px';
    }
});

async function send() {
    const text = input.value.trim();
    if(!text) return;
    
    renderMessage(text, 'user', true);
    
    // Сбрасываем поле ввода (текст и высоту)
    input.value = '';
    input.style.height = '36px';
    input.parentElement.style.borderRadius = '24px';
    btn.disabled = true;
    
    const loadingId = showLoading();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ text, chatId: myId })
        });
        const data = await res.json();
        hideLoading(loadingId);
        if(data.text) renderMessage(data.text, 'bot', true);
    } catch (e) {
        hideLoading(loadingId);
        renderMessage('Ошибка.', 'bot', true, 'bg-red-900/30');
    }
}

/**
 * 3. РЕНДЕР
 */
function renderMessage(text, role, animate = true, extraClass = '', prepend = false) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start ${animate ? 'msg-anim' : ''} ${role === 'user' ? 'flex-row-reverse' : ''}`;
    
    // БОТ АВАТАР (Katya Image)
    const botAvatar = `<img src="https://raw.githubusercontent.com/AhVasalam1337/ebalvrot/main/%D0%B2%D1%8B%D0%B2.png" 
                            class="w-9 h-9 rounded-full object-cover border border-gray-700 shadow-sm shrink-0 mt-1">`;
    
    // ЮЗЕР АВАТАР ('К')
    const userAvatar = `<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white shrink-0 shadow-sm text-xs font-bold mt-1">К</div>`;
    
    const avatar = role === 'bot' ? botAvatar : userAvatar;

    const bubbleBg = role === 'bot' ? `bg-geminiBotMsg rounded-2xl rounded-tl-none ${extraClass}` : `bg-geminiUserMsg rounded-2xl rounded-tr-none`;

    container.innerHTML = `${avatar}<div class="${bubbleBg} p-4 max-w-[85%] shadow-sm"><div class="message-text text-[15px]">${text}</div></div>`;
    
    if (prepend) {
        msgDiv.prepend(container);
    } else {
        msgDiv.appendChild(container);
        if(animate) scrollToBottom('smooth');
    }
}

function showLoading() {
    const id = 'l_' + Date.now();
    const container = document.createElement('div');
    container.id = id;
    container.className = 'flex gap-3 items-start msg-anim';
    
    // БОТ АВАТАР (Katya Image)
    const botAvatar = `<img src="https://raw.githubusercontent.com/AhVasalam1337/ebalvrot/main/%D0%B2%D1%8B%D0%B2.png" 
                            class="w-9 h-9 rounded-full object-cover border border-gray-700 shadow-sm shrink-0 mt-1">`;

    container.innerHTML = `${botAvatar}<div class="bg-geminiBotMsg p-4 rounded-2xl rounded-tl-none flex gap-1 items-center"><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div></div>`;
    msgDiv.appendChild(container);
    scrollToBottom('smooth');
    return id;
}

function hideLoading(id) { document.getElementById(id)?.remove(); }
function scrollToBottom(behavior) { msgDiv.scrollTo({ top: msgDiv.scrollHeight, behavior }); }

btn.onclick = send;

// Обработка Enter для отправки (без Shift)
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
    }
});
