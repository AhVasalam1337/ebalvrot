const msgDiv = document.getElementById('chat-messages');
const input = document.getElementById('userInput');
const btn = document.getElementById('sendBtn');

let myId = localStorage.getItem('pwa_chat_id') || 'pwa_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('pwa_chat_id', myId);

let currentOffset = 0;
let isLoadingMore = false;
let hasMore = true;

// 1. ПОДГРУЗКА ИСТОРИИ
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

            if (isFirstLoad) {
                scrollToBottom('auto');
            } else {
                msgDiv.scrollTop = msgDiv.scrollHeight - oldHeight;
            }
        } else if (isFirstLoad) {
            renderMessage("Привет! Я Катя.", 'bot', true);
        }
    } catch (e) { 
        console.error(e); 
    } finally { 
        isLoadingMore = false; 
    }
}

// Слушатель скролла
msgDiv.addEventListener('scroll', () => {
    if (msgDiv.scrollTop < 20 && hasMore && !isLoadingMore) loadHistory();
});

window.addEventListener('DOMContentLoaded', () => loadHistory(true));

// 2. ОТПРАВКА
input.addEventListener('input', () => { 
    btn.disabled = !input.value.trim(); 
});

async function send() {
    const text = input.value.trim();
    if(!text) return;
    renderMessage(text, 'user', true);
    input.value = '';
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

// 3. РЕНДЕР
function renderMessage(text, role, animate = true, extraClass = '', prepend = false) {
    const container = document.createElement('div');
    container.className = `flex gap-3 items-start ${animate ? 'msg-anim' : ''} ${role === 'user' ? 'flex-row-reverse' : ''}`;
    
    const avatar = role === 'bot' 
        ? '<div class="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-geminiAccent shrink-0 shadow-sm text-sm">✨</div>' 
        : '<div class="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white shrink-0 shadow-sm text-xs font-bold">P</div>';

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
    container.innerHTML = `<div class="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-geminiAccent shrink-0 text-sm">✨</div><div class="bg-geminiBotMsg p-4 rounded-2xl rounded-tl-none flex gap-1 items-center"><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]"></div><div class="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]">
