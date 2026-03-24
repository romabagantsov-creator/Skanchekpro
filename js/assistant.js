// ==================== ИИ-АССИСТЕНТ ====================

let assistantModal = null;

/**
 * Открыть ИИ-ассистента
 */
function openAssistant() {
    // Удаляем существующее окно, если есть
    if (assistantModal) {
        assistantModal.remove();
        assistantModal = null;
    }
    
    assistantModal = document.createElement('div');
    assistantModal.className = 'modal';
    assistantModal.style.animation = 'fadeIn 0.2s ease';
    assistantModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; height: 550px; display: flex; flex-direction: column;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1rem;">🤖 ИИ-ассистент</span>
                <button id="closeAssistantBtn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 20px; padding: 4px 8px; border-radius: 8px; transition: all 0.2s;">
                    ✕
                </button>
            </div>
            <div class="modal-body" id="assistantMessages" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 16px;">
                <div class="assistant-message bot" style="background: var(--bg-tertiary); padding: 12px 16px; border-radius: 16px; max-width: 85%; align-self: flex-start;">
                    👋 Привет! Я твой финансовый ассистент.<br><br>
                    Задай мне вопрос о твоих расходах. Например:<br><br>
                    • "Сколько я потратил?"<br>
                    • "Покажи расходы за этот месяц"<br>
                    • "Какие категории трат?"<br>
                    • "Дай совет по экономии"<br>
                    • "Какие были крупные покупки?"<br>
                    • "Привет" или "Помощь"
                </div>
            </div>
            <div class="modal-footer" style="border-top: 1px solid var(--border); padding: 12px; display: flex; gap: 8px;">
                <input type="text" id="assistantInput" class="form-input" placeholder="Спроси меня о финансах..." style="flex: 1;" autocomplete="off">
                <button class="btn btn-primary" id="sendAssistantBtn" style="width: auto; margin: 0; padding: 0.5rem 1rem;">➤</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalRoot').appendChild(assistantModal);
    
    // Добавляем обработчики
    const closeBtn = document.getElementById('closeAssistantBtn');
    if (closeBtn) {
        closeBtn.onclick = () => closeAssistant();
        closeBtn.onmouseover = () => {
            closeBtn.style.background = 'rgba(239, 68, 68, 0.2)';
            closeBtn.style.color = '#ef4444';
        };
        closeBtn.onmouseout = () => {
            closeBtn.style.background = 'none';
            closeBtn.style.color = 'var(--text-secondary)';
        };
    }
    
    const sendBtn = document.getElementById('sendAssistantBtn');
    if (sendBtn) {
        sendBtn.onclick = () => sendAssistantMessage();
    }
    
    const inputField = document.getElementById('assistantInput');
    if (inputField) {
        inputField.focus();
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendAssistantMessage();
            }
        });
    }
    
    // Закрытие по Escape
    const closeHandler = (e) => {
        if (e.key === 'Escape') {
            closeAssistant();
            document.removeEventListener('keydown', closeHandler);
        }
    };
    document.addEventListener('keydown', closeHandler);
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
 * Отправить сообщение ассистенту
 */
async function sendAssistantMessage() {
    const input = document.getElementById('assistantInput');
    const message = input?.value?.trim();
    if (!message) return;
    
    input.value = '';
    input.focus();
    
    // Добавляем сообщение пользователя
    addAssistantMessage(message, 'user');
    
    // Показываем индикатор набора
    const typingId = addTypingIndicator();
    
    // Получаем ответ (с небольшой задержкой для реализма)
    setTimeout(() => {
        const response = getAssistantResponse(message);
        removeTypingIndicator(typingId);
        addAssistantMessage(response, 'bot');
    }, 500);
}

/**
 * Добавить сообщение в чат
 */
function addAssistantMessage(text, sender) {
    const container = document.getElementById('assistantMessages');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = `assistant-message ${sender}`;
    div.style.cssText = sender === 'user' 
        ? 'background: var(--accent); color: white; align-self: flex-end; margin-left: auto; padding: 12px 16px; border-radius: 16px; max-width: 85%; word-wrap: break-word; white-space: pre-wrap;'
        : 'background: var(--bg-tertiary); color: var(--text-primary); align-self: flex-start; padding: 12px 16px; border-radius: 16px; max-width: 85%; word-wrap: break-word; white-space: pre-wrap;';
    
    div.innerHTML = text.replace(/\n/g, '<br>');
    container.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Показать индикатор набора
 */
function addTypingIndicator() {
    const container = document.getElementById('assistantMessages');
    if (!container) return null;
    
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'assistant-message bot typing';
    div.style.cssText = 'background: var(--bg-tertiary); padding: 12px 16px; border-radius: 16px; align-self: flex-start; opacity: 0.7;';
    div.innerHTML = '🤔 <span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>';
    container.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
    return id;
}

/**
 * Убрать индикатор набора
 */
function removeTypingIndicator(id) {
    const element = document.getElementById(id);
    if (element) element.remove();
}

/**
 * Получить ответ ассистента на основе данных
 */
function getAssistantResponse(query) {
    const receipts = window.appState?.receipts || [];
    const lowerQuery = query.toLowerCase();
    
    // ============ Анализ запроса ============
    
    // Приветствие
    if (lowerQuery.includes('привет') || lowerQuery.includes('здравствуй') || lowerQuery === 'hi') {
        return '👋 Привет! Я твой финансовый помощник. Могу рассказать о твоих расходах, дать советы по экономии или показать статистику. Что хочешь узнать?';
    }
    
    // Помощь
    if (lowerQuery.includes('помощь') || lowerQuery.includes('что умеешь') || lowerQuery.includes('команды')) {
        return `🤖 Я умею отвечать на вопросы о финансах:

📊 "Сколько я потратил?" - общая сумма всех расходов

📅 "Покажи расходы за этот месяц" - траты в текущем месяце

🏷️ "Топ категории" или "категории" - самые затратные категории

💡 "Дай совет по экономии" - персональные рекомендации

💎 "Крупные покупки" или "большие траты" - самые дорогие чеки

👋 "Привет" - поздороваться

❓ "Помощь" - показать это сообщение

Попробуй спросить что-то из этого!`;
    }
    
    // Вопрос о сумме
    if (lowerQuery.includes('сколько') && (lowerQuery.includes('потратил') || lowerQuery.includes('потрачено') || lowerQuery.includes('всего'))) {
        const total = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
        const count = receipts.length;
        
        if (count === 0) {
            return '📭 У вас пока нет чеков. Добавьте несколько чеков, и я смогу показать статистику!';
        }
        
        let word = 'покупок';
        if (count === 1) word = 'покупку';
        else if (count >= 2 && count <= 4) word = 'покупки';
        
        return `💰 За всё время вы потратили ${formatMoney(total)} на ${count} ${word}.`;
    }
    
    // Вопрос о текущем месяце
    if (lowerQuery.includes('этот месяц') || lowerQuery.includes('за месяц') || (lowerQuery.includes('месяц') && !lowerQuery.includes('прошлый'))) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let monthTotal = 0;
        let monthCount = 0;
        
        receipts.forEach(r => {
            if (r.date) {
                const parts = r.date.split('.');
                if (parts.length === 3) {
                    const month = parseInt(parts[1]) - 1;
                    const year = parseInt(parts[2]);
                    
                    if (year === currentYear && month === currentMonth) {
                        monthTotal += r.total || 0;
                        monthCount++;
                    }
                }
            }
        });
        
        const monthNames = ['Январе', 'Феврале', 'Марте', 'Апреле', 'Мае', 'Июне', 'Июле', 'Августе', 'Сентябре', 'Октябре', 'Ноembre', 'Декабре'];
        
        if (monthCount === 0) {
            return `📭 В ${monthNames[currentMonth]} у вас пока нет чеков. Добавьте чеки за этот месяц, чтобы увидеть статистику!`;
        }
        
        let word = 'покупок';
        if (monthCount === 1) word = 'покупку';
        else if (monthCount >= 2 && monthCount <= 4) word = 'покупки';
        
        return `📊 В ${monthNames[currentMonth]} вы потратили ${formatMoney(monthTotal)} на ${monthCount} ${word}.`;
    }
    
    // Вопрос о категориях
    if (lowerQuery.includes('топ') || (lowerQuery.includes('категори') && !lowerQuery.includes('добавить'))) {
        const categoryTotals = {};
        receipts.forEach(r => {
            const cat = r.category || 'Прочее';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + (r.total || 0);
        });
        
        const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
        
        if (sorted.length === 0) {
            return '📭 У вас пока нет чеков. Добавьте несколько чеков, и я смогу показать статистику по категориям!';
        }
        
        let response = '🏆 Ваши топ категории:\n\n';
        sorted.slice(0, 5).forEach(([cat, amount], i) => {
            const totalAll = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
            const percent = ((amount / totalAll) * 100).toFixed(1);
            response += `${i+1}. ${getCategoryIcon(cat)} ${cat} — ${formatMoney(amount)} (${percent}%)\n`;
        });
        return response;
    }
    
    // Вопрос о советах
    if (lowerQuery.includes('совет') || lowerQuery.includes('экономия') || lowerQuery.includes('сэкономить')) {
        const total = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
        const avg = receipts.length ? total / receipts.length : 0;
        
        let advice = '💡 Советы по экономии:\n\n';
        
        if (avg > 2000) {
            advice += '• Ваш средний чек выше 2000₽. Попробуйте планировать покупки заранее и составлять список продуктов.\n';
        }
        
        // Находим самую частую категорию
        const categoryCount = {};
        receipts.forEach(r => {
            categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;
        });
        
        const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
        if (topCategory) {
            if (topCategory[0] === 'Рестораны') {
                advice += '• Вы часто посещаете рестораны. Попробуйте готовить дома 2-3 раза в неделю — это сэкономит до 5000₽ в месяц.\n';
            } else if (topCategory[0] === 'Транспорт') {
                advice += '• Рассмотрите покупку проездного билета для экономии на транспорте.\n';
            } else if (topCategory[0] === 'Электроника') {
                advice += '• Перед покупкой техники сравнивайте цены в разных магазинах. Используйте кэшбэк-сервисы.\n';
            } else if (topCategory[0] === 'Продукты') {
                advice += '• Покупайте продукты оптом и следите за акциями. Используйте карты лояльности магазинов.\n';
            }
        }
        
        advice += '• Откладывайте 10% от каждой покупки на накопления — это поможет создать финансовую подушку.';
        
        return advice;
    }
    
    // Вопрос о крупных покупках
    if (lowerQuery.includes('крупный') || lowerQuery.includes('большой') || lowerQuery.includes('максимальн') || lowerQuery.includes('самый дорогой')) {
        const sorted = [...receipts].sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 5);
        
        if (sorted.length === 0) {
            return '📭 У вас пока нет чеков. Добавьте чеки, чтобы я мог анализировать покупки.';
        }
        
        let response = '💎 Ваши самые крупные покупки:\n\n';
        sorted.forEach((r, i) => {
            response += `${i+1}. ${r.store || 'Магазин'} — ${formatMoney(r.total)} (${r.date || 'дата неизвестна'})\n`;
        });
        return response;
    }
    
    // Вопрос о среднем чеке
    if (lowerQuery.includes('средний') && (lowerQuery.includes('чек') || lowerQuery.includes('покупк'))) {
        const total = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
        const avg = receipts.length ? total / receipts.length : 0;
        
        if (receipts.length === 0) {
            return '📭 У вас пока нет чеков. Добавьте чеки, чтобы я мог рассчитать средний чек.';
        }
        
        return `📈 Ваш средний чек составляет ${formatMoney(avg)}. ${avg > 1500 ? 'Это выше среднего. Попробуйте планировать покупки заранее!' : 'Это хороший показатель. Продолжайте в том же духе!'}`;
    }
    
    // Если ничего не подошло
    return `🤔 Я не совсем понял вопрос. Попробуйте спросить:

• "Сколько я потратил?"
• "Покажи расходы за этот месяц"
• "Топ категории"
• "Дай совет по экономии"
• "Какие были крупные покупки?"
• "Средний чек"

Или скажите "помощь" для полного списка команд.`;
}
