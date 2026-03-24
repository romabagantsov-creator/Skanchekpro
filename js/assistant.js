// ==================== ИИ-АССИСТЕНТ ====================

let assistantModal = null;
let chatHistory = [];

// Загрузка истории при старте
(function loadHistoryOnStart() {
    const saved = localStorage.getItem('checksan_chat_history');
    if (saved) {
        try {
            chatHistory = JSON.parse(saved);
        } catch(e) {
            chatHistory = [];
        }
    }
})();

/**
 * Сохранить историю
 */
function saveChatHistory() {
    const toSave = chatHistory.slice(-100);
    localStorage.setItem('checksan_chat_history', JSON.stringify(toSave));
}

/**
 * Добавить сообщение в историю
 */
function addToHistory(role, message) {
    chatHistory.push({
        role: role,
        message: message,
        time: new Date().toLocaleTimeString()
    });
    saveChatHistory();
}

/**
 * Открыть ассистента
 */
function openAssistant() {
    if (assistantModal) {
        assistantModal.remove();
        assistantModal = null;
    }
    
    assistantModal = document.createElement('div');
    assistantModal.className = 'modal';
    assistantModal.innerHTML = `
        <div class="modal-content" style="max-width: 550px; height: 550px; display: flex; flex-direction: column;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>🤖 ИИ-ассистент</span>
                <div style="display: flex; gap: 8px;">
                    <button id="clearHistoryBtn" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; padding: 4px 8px;" title="Очистить историю">🗑️</button>
                    <button id="closeAssistBtn" style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 20px; padding: 4px 8px;">✕</button>
                </div>
            </div>
            <div class="modal-body" id="assistantMessages" style="flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
                ${renderChatHistoryHTML()}
            </div>
            <div class="modal-footer" style="padding: 12px; display: flex; gap: 8px; border-top: 1px solid #2a2a3a;">
                <input type="text" id="assistantInput" class="form-input" placeholder="Спроси меня о финансах..." style="flex: 1;">
                <button class="btn btn-primary" id="sendMsgBtn" style="width: auto; margin: 0;">➤</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalRoot').appendChild(assistantModal);
    
    // Обработчики
    document.getElementById('closeAssistBtn').onclick = closeAssistant;
    document.getElementById('sendMsgBtn').onclick = () => sendAssistantMessage();
    document.getElementById('clearHistoryBtn').onclick = clearChatHistory;
    
    const input = document.getElementById('assistantInput');
    if (input) {
        input.focus();
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendAssistantMessage();
        });
    }
    
    // Прокрутка вниз
    const msgs = document.getElementById('assistantMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

/**
 * Отрисовать историю
 */
function renderChatHistoryHTML() {
    if (chatHistory.length === 0) {
        return `
            <div style="background: #1a1a2a; padding: 12px 16px; border-radius: 16px; align-self: flex-start;">
                👋 Привет! Я твой финансовый ассистент.<br><br>
                Задай мне вопрос:<br>
                • "Сколько я потратил?"<br>
                • "Расходы за месяц"<br>
                • "Какие были крупные покупки?"<br>
                • "Топ категории"<br>
                • "Средний чек"<br>
                • "Совет по экономии"
            </div>
        `;
    }
    
    return chatHistory.map(item => {
        if (item.role === 'user') {
            return `<div style="background: #8b5cf6; color: white; padding: 10px 14px; border-radius: 16px; align-self: flex-end; max-width: 85%;">${escapeHtml(item.message)}</div>`;
        } else {
            return `<div style="background: #1a1a2a; padding: 10px 14px; border-radius: 16px; align-self: flex-start; max-width: 85%; white-space: pre-wrap;">${escapeHtml(item.message).replace(/\n/g, '<br>')}</div>`;
        }
    }).join('');
}

/**
 * Очистить историю
 */
function clearChatHistory() {
    chatHistory = [];
    saveChatHistory();
    
    const container = document.getElementById('assistantMessages');
    if (container) {
        container.innerHTML = `
            <div style="background: #1a1a2a; padding: 12px 16px; border-radius: 16px; align-self: flex-start;">
                👋 История очищена. Задай мне вопрос!
            </div>
        `;
    }
}

/**
 * Закрыть ассистента
 */
function closeAssistant() {
    if (assistantModal) {
        assistantModal.remove();
        assistantModal = null;
    }
}

/**
 * Отправить сообщение
 */
async function sendAssistantMessage() {
    const input = document.getElementById('assistantInput');
    const message = input?.value?.trim();
    if (!message) return;
    
    input.value = '';
    
    // Добавляем сообщение пользователя
    addToHistory('user', message);
    updateChatUI(message, 'user');
    
    // Показываем индикатор печати
    const typingId = showTypingIndicator();
    
    // Имитация задержки
    setTimeout(() => {
        const response = getAnswer(message);
        removeTypingIndicator(typingId);
        addToHistory('assistant', response);
        updateChatUI(response, 'assistant');
    }, 500);
}

/**
 * Показать индикатор печати
 */
function showTypingIndicator() {
    const container = document.getElementById('assistantMessages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.style.cssText = 'background: #1a1a2a; padding: 10px 14px; border-radius: 16px; align-self: flex-start; opacity: 0.7;';
    div.innerHTML = '🤔 <span style="animation: pulse 1s infinite;">...</span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

/**
 * Убрать индикатор печати
 */
function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

/**
 * Обновить UI чата
 */
function updateChatUI(message, role) {
    const container = document.getElementById('assistantMessages');
    
    // Если это первое сообщение, очищаем приветствие
    if (chatHistory.length === 1 && role === 'user') {
        container.innerHTML = '';
    }
    
    const div = document.createElement('div');
    if (role === 'user') {
        div.style.cssText = 'background: #8b5cf6; color: white; padding: 10px 14px; border-radius: 16px; align-self: flex-end; max-width: 85%;';
        div.textContent = message;
    } else {
        div.style.cssText = 'background: #1a1a2a; padding: 10px 14px; border-radius: 16px; align-self: flex-start; max-width: 85%; white-space: pre-wrap;';
        div.innerHTML = message.replace(/\n/g, '<br>');
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

/**
 * Получить ответ на вопрос
 */
function getAnswer(query) {
    const receipts = window.appState?.receipts || [];
    const lower = query.toLowerCase();
    
    // ============ КРУПНЫЕ ПОКУПКИ ============
    if (lower.includes('крупн') || lower.includes('больш') || lower.includes('дорог') || 
        lower.includes('максимальн') || lower.includes('самый дорогой') || lower.includes('самые дорогие')) {
        
        if (receipts.length === 0) {
            return '📭 У вас пока нет чеков. Добавьте чеки, чтобы я мог показать крупные покупки!';
        }
        
        const sorted = [...receipts].sort((a, b) => (b.total || 0) - (a.total || 0));
        const top5 = sorted.slice(0, 5);
        
        let response = '💎 *Ваши самые крупные покупки:*\n\n';
        top5.forEach((r, i) => {
            response += `${i+1}. ${r.store || 'Магазин'} — ${formatMoney(r.total)} (${r.date || 'дата неизвестна'})\n`;
        });
        
        if (top5.length === 0) {
            response = '📭 Нет данных о крупных покупках.';
        }
        
        return response;
    }
    
    // ============ ОБЩАЯ СУММА ============
    if (lower.includes('сколько') || (lower.includes('потратил') && !lower.includes('месяц')) || lower.includes('всего')) {
        const total = receipts.reduce((s, r) => s + (r.total || 0), 0);
        const count = receipts.length;
        if (count === 0) return '📭 У вас пока нет чеков. Добавьте несколько!';
        return `💰 Всего потрачено: ${formatMoney(total)} (${count} ${declension(count, 'чек', 'чека', 'чеков')})`;
    }
    
    // ============ РАСХОДЫ ЗА МЕСЯЦ ============
    if (lower.includes('месяц') && !lower.includes('прошлый')) {
        const now = new Date();
        let total = 0, count = 0;
        receipts.forEach(r => {
            if (r.date) {
                const parts = r.date.split('.');
                if (parts.length === 3) {
                    const month = parseInt(parts[1]) - 1;
                    const year = parseInt(parts[2]);
                    if (year === now.getFullYear() && month === now.getMonth()) {
                        total += r.total || 0;
                        count++;
                    }
                }
            }
        });
        const monthNames = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
        if (count === 0) return `📭 В ${monthNames[now.getMonth()]} пока нет чеков.`;
        return `📊 За этот месяц: ${formatMoney(total)} (${count} ${declension(count, 'чек', 'чека', 'чеков')})`;
    }
    
    // ============ СРЕДНИЙ ЧЕК ============
    if (lower.includes('средний') || lower.includes('среднее')) {
        const total = receipts.reduce((s, r) => s + (r.total || 0), 0);
        const avg = receipts.length ? total / receipts.length : 0;
        if (receipts.length === 0) return '📭 Нет данных для расчёта.';
        return `📈 Средний чек: ${formatMoney(avg)}`;
    }
    
    // ============ ТОП КАТЕГОРИИ ============
    if (lower.includes('категори') || lower.includes('топ') || lower.includes('распределение')) {
        const cats = {};
        receipts.forEach(r => {
            const cat = r.category || 'Прочее';
            cats[cat] = (cats[cat] || 0) + (r.total || 0);
        });
        const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) return '📭 Нет данных.';
        let result = '🏆 *Топ категории:*\n\n';
        sorted.slice(0, 5).forEach(([cat, amt], i) => {
            result += `${i+1}. ${getCategoryIcon(cat)} ${cat} — ${formatMoney(amt)}\n`;
        });
        return result;
    }
    
    // ============ СОВЕТЫ ============
    if (lower.includes('совет') || lower.includes('экономи') || lower.includes('сэкономить')) {
        const total = receipts.reduce((s, r) => s + (r.total || 0), 0);
        const avg = receipts.length ? total / receipts.length : 0;
        
        let advice = '💡 *Советы по экономии:*\n\n';
        
        if (avg > 2000) {
            advice += '• Ваш средний чек выше 2000₽. Попробуйте планировать покупки заранее.\n';
        }
        
        // Находим частые категории
        const categoryCount = {};
        receipts.forEach(r => {
            categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;
        });
        const topCat = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
        
        if (topCat) {
            if (topCat[0] === 'Рестораны') {
                advice += '• Вы часто ходите в рестораны. Готовьте дома — это сэкономит до 5000₽ в месяц.\n';
            } else if (topCat[0] === 'Транспорт') {
                advice += '• Рассмотрите покупку проездного билета.\n';
            } else if (topCat[0] === 'Электроника') {
                advice += '• Сравнивайте цены перед покупкой техники.\n';
            } else if (topCat[0] === 'Продукты') {
                advice += '• Покупайте продукты оптом и следите за акциями.\n';
            }
        }
        
        advice += '\n• Откладывайте 10% от каждой покупки на накопления.\n';
        advice += '• Используйте приложения для сравнения цен.';
        
        return advice;
    }
    
    // ============ ПРИВЕТСТВИЕ ============
    if (lower.includes('привет') || lower.includes('здравствуй') || lower === 'hi') {
        const hour = new Date().getHours();
        let greeting = '';
        if (hour < 12) greeting = 'Доброе утро';
        else if (hour < 18) greeting = 'Добрый день';
        else greeting = 'Добрый вечер';
        return `${greeting}! 👋 Я твой финансовый помощник. Спроси меня о расходах!`;
    }
    
    // ============ ПОМОЩЬ ============
    if (lower.includes('помощь') || lower.includes('команды') || lower.includes('что умеешь')) {
        return `🤖 *Доступные команды:*\n\n` +
               `💰 "Сколько я потратил?" — общая сумма\n` +
               `📅 "Расходы за месяц" — траты в этом месяце\n` +
               `💎 "Какие были крупные покупки?" — топ-5 самых дорогих\n` +
               `🏷️ "Топ категории" — расходы по категориям\n` +
               `📊 "Средний чек" — средняя сумма покупки\n` +
               `💡 "Совет по экономии" — персональные рекомендации\n` +
               `👋 "Привет" — поздороваться\n` +
               `❓ "Помощь" — показать это сообщение`;
    }
    
    // ============ ПО УМОЛЧАНИЮ ============
    return `🤔 Я не понял вопрос. Попробуйте спросить:

• "Сколько я потратил?"
• "Расходы за месяц"
• "Какие были крупные покупки?"
• "Топ категории"
• "Средний чек"
• "Совет по экономии"

Или скажите "помощь" для всех команд.`;
}

/**
 * Склонение
 */
function declension(n, one, two, five) {
    n = Math.abs(n) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return five;
    if (n1 > 1 && n1 < 5) return two;
    if (n1 === 1) return one;
    return five;
}
