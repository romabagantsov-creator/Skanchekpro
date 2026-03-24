// ==================== ИИ-АССИСТЕНТ ====================

let assistantModal = null;
let assistantMessages = [];

/**
 * Открыть ИИ-ассистента
 */
function openAssistant() {
    if (assistantModal) return;
    
    assistantModal = document.createElement('div');
    assistantModal.className = 'modal';
    assistantModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; height: 500px; display: flex; flex-direction: column;">
            <div class="modal-header">🤖 ИИ-ассистент</div>
            <div class="modal-body" id="assistantMessages" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;">
                <div class="assistant-message bot">
                    👋 Привет! Я твой финансовый ассистент. 
                    Задай мне вопрос о твоих расходах. Например:
                    • "Сколько я потратил за этот месяц?"
                    • "Покажи топ категорий"
                    • "Дай совет по экономии"
                    • "Какие были крупные покупки?"
                </div>
            </div>
            <div class="modal-footer" style="border-top: 1px solid var(--border);">
                <input type="text" id="assistantInput" class="form-input" placeholder="Спроси меня о финансах..." style="flex: 1;">
                <button class="btn btn-primary" onclick="sendAssistantMessage()" style="width: auto; margin: 0;">➤</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalRoot').appendChild(assistantModal);
    document.getElementById('assistantInput')?.focus();
    
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
    const message = input.value.trim();
    if (!message) return;
    
    input.value = '';
    
    // Добавляем сообщение пользователя
    addAssistantMessage(message, 'user');
    
    // Показываем индикатор набора
    const typingId = addTypingIndicator();
    
    // Получаем ответ
    const response = await getAssistantResponse(message);
    
    // Убираем индикатор
    removeTypingIndicator(typingId);
    
    // Добавляем ответ ассистента
    addAssistantMessage(response, 'bot');
}

/**
 * Добавить сообщение в чат
 */
function addAssistantMessage(text, sender) {
    const container = document.getElementById('assistantMessages');
    const div = document.createElement('div');
    div.className = `assistant-message ${sender}`;
    div.innerHTML = text;
    container.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Показать индикатор набора
 */
function addTypingIndicator() {
    const container = document.getElementById('assistantMessages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'assistant-message bot typing';
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
 * Получить ответ ассистента
 */
async function getAssistantResponse(query) {
    const receipts = window.appState.receipts;
    const lowerQuery = query.toLowerCase();
    
    // Анализ запроса
    if (lowerQuery.includes('сколько') && (lowerQuery.includes('потратил') || lowerQuery.includes('потрачено'))) {
        const total = receipts.reduce((sum, r) => sum + r.total, 0);
        const count = receipts.length;
        return `💰 За всё время вы потратили ${formatMoney(total)} на ${count} покупок.`;
    }
    
    if (lowerQuery.includes('этот месяц') || lowerQuery.includes('за месяц')) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        let monthTotal = 0;
        let monthCount = 0;
        
        receipts.forEach(r => {
            const [day, month, year] = r.date.split('.');
            const monthNum = parseInt(month) - 1;
            const yearNum = parseInt(year);
            
            if (yearNum === currentYear && monthNum === currentMonth) {
                monthTotal += r.total;
                monthCount++;
            }
        });
        
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        return `📊 В ${monthNames[currentMonth]} вы потратили ${formatMoney(monthTotal)} на ${monthCount} покупок.`;
    }
    
    if (lowerQuery.includes('топ') || lowerQuery.includes('категория')) {
        const categoryTotals = {};
        receipts.forEach(r => {
            categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.total;
        });
        
        const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);
        
        if (sorted.length === 0) {
            return 'У вас пока нет чеков для анализа. Добавьте несколько чеков, и я смогу показать статистику!';
        }
        
        let response = '🏆 Ваши топ категории:\n';
        sorted.forEach(([cat, amount]) => {
            response += `• ${cat}: ${formatMoney(amount)}\n`;
        });
        return response;
    }
    
    if (lowerQuery.includes('совет') || lowerQuery.includes('экономия')) {
        const total = receipts.reduce((sum, r) => sum + r.total, 0);
        const avg = total / (receipts.length || 1);
        
        let advice = '💡 Советы по экономии:\n';
        
        if (avg > 2000) {
            advice += '• Ваш средний чек выше 2000₽. Попробуйте планировать покупки заранее.\n';
        }
        
        // Находим самую частую категорию
        const categoryCount = {};
        receipts.forEach(r => {
            categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;
        });
        
        const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
        if (topCategory) {
            if (topCategory[0] === 'Рестораны') {
                advice += '• Вы часто посещаете рестораны. Попробуйте готовить дома 2-3 раза в неделю.\n';
            } else if (topCategory[0] === 'Транспорт') {
                advice += '• Рассмотрите покупку проездного билета для экономии на транспорте.\n';
            } else if (topCategory[0] === 'Электроника') {
                advice += '• Перед покупкой техники сравнивайте цены в разных магазинах.\n';
            }
        }
        
        advice += '• Откладывайте 10% от каждой покупки на накопления.';
        return advice;
    }
    
    if (lowerQuery.includes('крупный') || lowerQuery.includes('большой')) {
        const sorted = [...receipts].sort((a, b) => b.total - a.total).slice(0, 5);
        
        if (sorted.length === 0) {
            return 'У вас пока нет чеков. Добавьте чеки, чтобы я мог анализировать покупки.';
        }
        
        let response = '💎 Ваши самые крупные покупки:\n';
        sorted.forEach((r, i) => {
            response += `${i+1}. ${r.store} — ${formatMoney(r.total)} (${r.date})\n`;
        });
        return response;
    }
    
    if (lowerQuery.includes('привет') || lowerQuery.includes('здравствуй')) {
        return '👋 Привет! Я твой финансовый помощник. Могу рассказать о твоих расходах, дать советы по экономии или показать статистику. Что хочешь узнать?';
    }
    
    if (lowerQuery.includes('помощь') || lowerQuery.includes('что умеешь')) {
        return `🤖 Я умею отвечать на вопросы о финансах:
• "Сколько я потратил?"
• "Покажи расходы за этот месяц"
• "Какие категории трат?"
• "Дай совет по экономии"
• "Какие были крупные покупки?"
• "Привет" или "Помощь"

Попробуй спросить что-то из этого!`;
    }
    
    // Если ничего не подошло
    return `Я не совсем понял вопрос. Попробуйте спросить:
• "Сколько я потратил?"
• "Покажи топ категорий"
• "Дай совет по экономии"
• "Какие были крупные покупки?"

Или скажите "помощь" для полного списка команд.`;
}
