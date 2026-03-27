const msgDiv = document.getElementById('chat-messages');
const input = document.getElementById('userInput');
const btn = document.getElementById('sendBtn');

// Идентификатор сессии. 'pwa_' отделяет веб-юзеров от телеграм-юзеров в базе.
let myId = localStorage.getItem('pwa_chat_id') || 'pwa_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_chat_id', myId);

let currentOffset = 0;
let isLoadingMore = false;
let hasMore = true;

/**
 * 1. ПОДГРУЗКА ИСТОРИИ
 * Подгружает по 10 сообщений. Если isFirstLoad = true, очищает экран и скроллит вниз.
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
            
            // Рендерим сообщения сверху вниз, но вставляем в начало контейнера (prepend)
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
                // Магия: фиксируем скролл, чтобы при подгрузке старых сообщений экран не прыгал
                msgDiv.scrollTop = msgDiv.scrollHeight - oldHeight;
            }
        } else if (isFirstLoad) {
            // Если истории совсем нет, показываем стартовое приветствие
            renderMessage("Привет! Я Катя. Как твои дела?", 'bot', true);
        }
    } catch (e) { 
        console.error("Ошибка при загрузке истории:", e); 
    } finally { 
        isLoadingMore = false; 
    }
}

// Слушатель скролла для реализации Infinite Scroll вверх
msgDiv.addEventListener('scroll', () => {
    if (msgDiv.scrollTop < 20 && hasMore && !isLoadingMore) {
        loadHistory();
    }
});

// Запуск при загрузке страницы
window.addEventListener('DOMContentLoaded', () => loadHistory(true));

/**
 * 2. ОТПРАВКА СООБЩЕНИЯ
 */
input.addEventListener('input', () => { 
    btn.disabled = !input.value.trim(); 
});

async function send() {
    const text = input.value.trim();
    if(!text) return;
    
    // Мгновенно отображаем сообщение пользователя
    renderMessage(text, 'user', true);
    input.value = '';
    btn.disabled = true;
    
    // Показываем индикатор того, что Катя "думает"
    const loadingId = showLoading();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ text, chatId: myId })
        });
        
        const data = await res.json();
        hideLoading(loadingId);
        
        if(data.text) {
            renderMessage(data.text, 'bot', true);
        } else {
            throw new Error('Empty response');
        }
    } catch (e) {
        hideLoading(loadingId);
        renderMessage('Ошибка связи. Катя не смогла ответить.', 'bot', true, 'bg-red-900/30 border border-red-800');
    }
}

/**
 * 3. РЕНДЕР СООБЩЕНИЙ (DOM)
 */
function renderMessage(text, role, animate = true, extraClass = '', prepend = false) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start ${animate ? 'msg-anim' : ''} ${role === 'user' ? 'flex-row-reverse' : ''}`;
    
    const avatar = role === 'bot' 
        ? '<div class="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-geminiAccent shrink-0 shadow-sm text-sm">✨</div>' 
        : '<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white shrink-0 shadow-sm text-xs font-bold">P</div>';

    const bubbleBg = role === 'bot' 
        ? `bg-geminiBotMsg rounded-2xl rounded-tl-none ${extraClass}` 
        : `bg-geminiUserMsg rounded-2xl rounded-tr-none`;

    container.innerHTML = `
        ${avatar}
        <div class="${bubbleBg} p-4 max-w-[85%] shadow-sm">
            <div class="message-text text-[15px]">${text}</div>
        </div>
    `;
    
    if (prepend) {
        msgDiv.prepend(container);
    } else {
        msgDiv.appendChild(container);
        if(animate) scrollToBottom('smooth');
    }
}

/**
 * 4. ИНДИКАТОРЫ И СКРОЛЛ
 */
function showLoading() {
    const id = 'l_' + Date.now();
    const container = document.createElement('div');
    container.id = id;
    container.className = 'flex gap-3 items-start msg-anim';
    container.innerHTML = `
        <div class="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-geminiAccent shrink-0 text-sm">✨</div>
        <div class="bg-geminiBotMsg p-4 rounded-2xl rounded-tl-none flex gap-1 items-center">
            <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
            <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div>
            <div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
        </div>
    `;
    msgDiv.appendChild(container);
    scrollToBottom('smooth');
    return id;
}

function hideLoading(id) { 
    const el = document.getElementById(id);
    if(el) el.remove(); 
}

function scrollToBottom(behavior) { 
    msgDiv.scrollTo({ top: msgDiv.scrollHeight, behavior }); 
}

// Слушатели событий
btn.onclick = send;
input.onkeypress = (e) => {
    if (e.key === 'Enter') send();
};
