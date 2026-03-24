// ==================== ИИ-АССИСТЕНТ ===================

let assistantModal = null;
let chatHistory = [];

// Ключевые слова и их синонимы для лучшего распознавания
const KEYWORDS = {
    total: ['сколько', 'потратил', 'потрачено', 'всего', 'сумма', 'расходы', 'денег', 'потратила'],
    month: ['месяц', 'этом месяце', 'за месяц', 'месячные', 'текущий месяц', 'в этом месяце', 'месячные расходы'],
    week: ['неделя', 'за неделю', 'эту неделю', 'на этой неделе', 'недельные'],
    categories: ['категории', 'категориям', 'топ категорий', 'какие категории', 'по категориям', 'распределение'],
    advice: ['совет', 'экономия', 'сэкономить', 'как экономить', 'рекомендация', 'посоветуй', 'что делать'],
    large: ['крупный', 'большой', 'максимальный', 'самый дорогой', 'дорогие покупки', 'крупные траты', 'максимум'],
    average: ['средний', 'среднее', 'средний чек', 'в среднем', 'средняя сумма'],
    today: ['сегодня', 'сегодняшние', 'за сегодня', 'сегодня потратил'],
    yesterday: ['вчера', 'за вчера', 'вчерашние'],
    help: ['помощь', 'команды', 'что умеешь', 'как пользоваться', 'список команд', 'помоги']
};

/**
 * Загрузить историю чата из localStorage
 */
function loadChatHistory() {
    const saved = localStorage.getItem('checksan_chat_history');
    if (saved) {
        try {
            chatHistory = JSON.parse(saved);
            // Ограничиваем историю 50 сообщениями
            if (chatHistory.length > 50) {
                chatHistory = chatHistory.slice(-50);
            }
        } catch(e) {
            chatHistory = [];
        }
    }
}

/**
 * Сохранить историю чата в localStorage
 */
function saveChatHistory() {
    // Сохраняем только последние 50 сообщений
    const toSave = chatHistory.slice(-50);
    localStorage.setItem('checksan_chat_history', JSON.stringify(toSave));
}

/**
 * Добавить сообщение в историю
 */
function addToHistory(role, message) {
    chatHistory.push({
        role: role,
        message: message,
        timestamp: new Date().toISOString()
    });
    saveChatHistory();
}

/**
 * Открыть ИИ-ассистента
 */
function openAssistant() {
    // Удаляем существующее окно, если есть
    if (assistantModal) {
        assistantModal.remove();
        assistantModal = null;
    }
    
    // Загружаем историю
    loadChatHistory();
    
    assistantModal = document.createElement('div');
    assistantModal.className = 'modal';
    assistantModal.style.animation = 'fadeIn 0.2s ease';
    assistantModal.innerHTML = `
        <div class="modal-content" style="max-width: 550px; height: 600px; display: flex; flex-direction: column;">
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 1rem;">🤖 ИИ-ассистент</span>
                <div style="display: flex; gap: 8px;">
                    <button id="clearChatBtn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 14px; padding: 4px 8px; border-radius: 8px; transition: all 0.2s;" title="Очистить историю">
                        🗑️
                    </button>
                    <button id="closeAssistantBtn" style="background: none; border: none; color: var(--text-secondary); cursor: pointer; font-size: 20px; padding: 4px 8px; border-radius: 8px; transition: all 0.2s;">
                        ✕
                    </button>
                </div>
            </div>
            <div class="modal-body" id="assistantMessages" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 16px;">
                ${renderChatHistory()}
            </div>
            <div class="modal-footer" style="border-top: 1px solid var(--border); padding: 12px; display: flex; gap: 8px;">
                <input type="text" id="assistantInput" class="form-input" placeholder="Спроси меня о финансах..." style="flex: 1;" autocomplete="off">
                <button class="btn btn-primary" id="sendAssistantBtn" style="width: auto; margin: 0; padding: 0.5rem 1rem;">➤</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalRoot').appendChild(assistantModal);
    
    // Прокручиваем вниз
    const messagesContainer = document.getElementById('assistantMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
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
    
    const clearBtn = document.getElementById('clearChatBtn');
    if (clearBtn) {
        clearBtn.onclick = () => clearChatHistory();
        clearBtn.onmouseover = () => {
            clearBtn.style.background = 'rgba(239, 68, 68, 0.2)';
            clearBtn.style.color = '#ef4444';
        };
        clearBtn.onmouseout = () => {
            clearBtn.style.background = 'none';
            clearBtn.style.color = 'var(--text-secondary)';
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
 * Отрисовать историю чата
 */
function renderChatHistory() {
    if (chatHistory.length === 0) {
        return `
            <div class="assistant-message bot" style="background: var(--bg-tertiary); padding: 12px 16px; border-radius: 16px; max-width: 85%; align-self: flex-start;">
                👋 Привет! Я твой финансовый ассистент.<br><br>
                Задай мне вопрос о твоих расходах. Например:<br><br>
                • "Сколько я потратил?"<br>
                • "Покажи расходы за этот месяц"<br>
                • "Какие категории трат?"<br>
                • "Дай совет по экономии"<br>
                • "Какие были крупные покупки?"<br>
                • "Средний чек"<br>
                • "Что я тратил вчера?"<br>
                • "Помощь"
            </div>
        `;
    }
    
    return chatHistory.map(item => {
        const sender = item.role;
        const text = item.message;
        
        if (sender === 'user') {
            return `<div class="assistant-message user" style="background: var(--accent); color: white; align-self: flex-end; margin-left: auto; padding: 12px 16px; border-radius: 16px; max-width: 85%; word-wrap: break-word; white-space: pre-wrap;">${escapeHtml(text)}</div>`;
        } else {
            return `<div class="assistant-message bot" style="background: var(--bg-tertiary); color: var(--text-primary); align-self: flex-start; padding: 12px 16px; border-radius: 16px; max-width: 85%; word-wrap: break-word; white-space: pre-wrap;">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
        }
    }).join('');
}

/**
 * Очистить историю чата
 */
function clearChatHistory() {
    chatHistory = [];
    saveChatHistory();
    
    const container = document.getElementById('assistantMessages');
    if (container) {
        container.innerHTML = `
            <div class="assistant-message bot" style="background: var(--bg-tertiary); padding: 12px 16px; border-radius: 16px; max-width: 85%; align-self: flex-start;">
                👋 Привет! Я твой финансовый ассистент.<br><br>
                История очищена. Задай мне вопрос о твоих расходах!
            </div>
        `;
    }
    
    showToast('История чата очищена', 'info');
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
    
    // Добавляем сообщение пользователя в историю и отображаем
    addToHistory('user', message);
    addAssistantMessageToUI(message, 'user');
    
    // Показываем индикатор набора
    const typingId = addTypingIndicator();
    
    // Получаем ответ (с небольшой задержкой для реализма)
    setTimeout(() => {
        const response = getAssistantResponse(message);
        addToHistory('assistant', response);
        removeTypingIndicator(typingId);
        addAssistantMessageToUI(response, 'bot');
        
        // Прокручиваем вниз
        const container = document.getElementById('assistantMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }, 500);
}

/**
 * Добавить сообщение в интерфейс
 */
function addAssistantMessageToUI(text, sender) {
    const container = document.getElementById('assistantMessages');
    if (!container) return;
    
    // Если это первое сообщение и истории нет, очищаем приветствие
    if (chatHistory.length === 1 && sender === 'user') {
        container.innerHTML = '';
    }
    
    const div = document.createElement('div');
    div.className = `assistant-message ${sender}`;
    div.style.cssText = sender === 'user' 
        ? 'background: var(--accent); color: white; align-self: flex-end; margin-left: auto; padding: 12px 16px; border-radius: 16px; max-width: 85%; word-wrap: break-word; white-space: pre-wrap;'
        : 'background: var(--bg-tertiary); color: var(--text-primary); align-self: flex-start; padding: 12px 16px; border-radius: 16px; max-width: 85%; word-wrap: break-word; white-space: pre-wrap;';
    
    div.innerHTML = text.replace(/\n/g, '<br>');
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
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
    container.scrollTop = container.scrollHeight;
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
    
    // ============ Проверка по ключевым словам ============
    
    // Помощь
    if (matchesAny(lowerQuery, KEYWORDS.help)) {
        return getHelpMessage();
    }
    
    // Приветствие
    if (matchesAny(lowerQuery, ['привет', 'здравствуй', 'добрый день', 'добрый вечер', 'hi', 'hello', 'здарова'])) {
        return getGreetingMessage();
    }
    
    // Сегодняшние расходы
    if (matchesAny(lowerQuery, KEYWORDS.today)) {
        return getTodayExpenses(receipts);
    }
    
    // Вчерашние расходы
    if (matchesAny(lowerQuery, KEYWORDS.yesterday)) {
        return getYesterdayExpenses(receipts);
    }
    
    // Расходы за неделю
    if (matchesAny(lowerQuery, KEYWORDS.week)) {
        return getWeekExpenses(receipts);
    }
    
    // Расходы за месяц
    if (matchesAny(lowerQuery, KEYWORDS.month)) {
        return getMonthExpenses(receipts);
    }
    
    // Общая сумма
    if (matchesAny(lowerQuery, KEYWORDS.total)) {
        return getTotalExpenses(receipts);
    }
    
    // Категории
    if (matchesAny(lowerQuery, KEYWORDS.categories)) {
        return getCategoryStats(receipts);
    }
    
    // Крупные покупки
    if (matchesAny(lowerQuery, KEYWORDS.large)) {
        return getLargePurchases(receipts);
    }
    
    // Средний чек
    if (matchesAny(lowerQuery, KEYWORDS.average)) {
        return getAverageCheck(receipts);
    }
    
    // Советы
    if (matchesAny(lowerQuery, KEYWORDS.advice)) {
        return getAdvice(receipts);
    }
    
    // Если ничего не подошло
    return getFallbackMessage();
}

/**
 * Проверка наличия любого ключевого слова
 */
function matchesAny(query, keywords) {
    return keywords.some(keyword => query.includes(keyword));
}

/**
 * Получить приветственное сообщение
 */
function getGreetingMessage() {
    const hour = new Date().getHours();
    let greeting = '';
    
    if (hour < 12) greeting = 'Доброе утро';
    else if (hour < 18) greeting = 'Добрый день';
    else greeting = 'Добрый вечер';
    
    return `${greeting}! 👋 Я твой финансовый ассистент. Могу рассказать о твоих расходах, дать советы по экономии или показать статистику. Что хочешь узнать?`;
}

/**
 * Получить сообщение помощи
 */
function getHelpMessage() {
    return `🤖 *Список команд*\n\n` +
           `📊 *Расходы*\n` +
           `• "Сколько я потратил?" — общая сумма\n` +
           `• "Расходы за сегодня/вчера/неделю/месяц"\n` +
           `• "Средний чек" — средняя сумма покупки\n\n` +
           `🏷️ *Аналитика*\n` +
           `• "Топ категории" — самые затратные категории\n` +
           `• "Крупные покупки" — самые дорогие чеки\n\n` +
           `💡 *Советы*\n` +
           `• "Дай совет по экономии" — персональные рекомендации\n\n` +
           `❓ *Другое*\n` +
           `• "Привет" — поздороваться\n` +
           `• "Помощь" — показать это сообщение`;
}

/**
 * Получить общую сумму расходов
 */
function getTotalExpenses(receipts) {
    const total = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
    const count = receipts.length;
    
    if (count === 0) {
        return '📭 У вас пока нет чеков. Добавьте несколько чеков, и я смогу показать статистику!';
    }
    
    return `💰 За всё время вы потратили ${formatMoney(total)} на ${count} ${declension(count, 'покупку', 'покупки', 'покупок')}.`;
}

/**
 * Получить расходы за сегодня
 */
function getTodayExpenses(receipts) {
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
    
    const todayReceipts = receipts.filter(r => r.date === todayStr);
    const total = todayReceipts.reduce((sum, r) => sum + (r.total || 0), 0);
    const count = todayReceipts.length;
    
    if (count === 0) {
        return `📭 Сегодня вы ещё ничего не тратили. Хороший день для экономии! 💪`;
    }
    
    return `📅 Сегодня вы потратили ${formatMoney(total)} на ${count} ${declension(count, 'покупку', 'покупки', 'покупок')}.`;
}

/**
 * Получить расходы за вчера
 */
function getYesterdayExpenses(receipts) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getDate().toString().padStart(2, '0')}.${(yesterday.getMonth() + 1).toString().padStart(2, '0')}.${yesterday.getFullYear()}`;
    
    const yesterdayReceipts = receipts.filter(r => r.date === yesterdayStr);
    const total = yesterdayReceipts.reduce((sum, r) => sum + (r.total || 0), 0);
    const count = yesterdayReceipts.length;
    
    if (count === 0) {
        return `📭 Вчера вы не добавляли чеки. Хотите добавить?`;
    }
    
    return `📅 Вчера вы потратили ${formatMoney(total)} на ${count} ${declension(count, 'покупку', 'покупки', 'покупок')}.`;
}

/**
 * Получить расходы за неделю
 */
function getWeekExpenses(receipts) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    let total = 0;
    let count = 0;
    
    receipts.forEach(r => {
        if (r.date) {
            const parts = r.date.split('.');
            if (parts.length === 3) {
                const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                if (date >= weekAgo) {
                    total += r.total || 0;
                    count++;
                }
            }
        }
    });
    
    if (count === 0) {
        return `📭 За последнюю неделю нет чеков. Добавьте чеки для анализа!`;
    }
    
    return `📅 За последнюю неделю вы потратили ${formatMoney(total)} на ${count} ${declension(count, 'покупку', 'покупки', 'покупок')}.`;
}

/**
 * Получить расходы за месяц
 */
function getMonthExpenses(receipts) {
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
    
    return `📊 В ${monthNames[currentMonth]} вы потратили ${formatMoney(monthTotal)} на ${monthCount} ${declension(monthCount, 'покупку', 'покупки', 'покупок')}.`;
}

/**
 * Получить статистику по категориям
 */
function getCategoryStats(receipts) {
    const categoryTotals = {};
    receipts.forEach(r => {
        const cat = r.category || 'Прочее';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (r.total || 0);
    });
    
    const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    
    if (sorted.length === 0) {
        return '📭 У вас пока нет чеков. Добавьте несколько чеков, и я смогу показать статистику по категориям!';
    }
    
    const totalAll = Object.values(categoryTotals).reduce((a, b) => a + b, 0);
    let response = '🏆 *Ваши топ категории:*\n\n';
    sorted.slice(0, 5).forEach(([cat, amount], i) => {
        const percent = ((amount / totalAll) * 100).toFixed(1);
        response += `${i+1}. ${getCategoryIcon(cat)} ${cat} — ${formatMoney(amount)} (${percent}%)\n`;
    });
    
    return response;
}

/**
 * Получить крупные покупки
 */
function getLargePurchases(receipts) {
    const sorted = [...receipts].sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 5);
    
    if (sorted.length === 0) {
        return '📭 У вас пока нет чеков. Добавьте чеки, чтобы я мог анализировать покупки.';
    }
    
    let response = '💎 *Ваши самые крупные покупки:*\n\n';
    sorted.forEach((r, i) => {
        response += `${i+1}. ${r.store || 'Магазин'} — ${formatMoney(r.total)} (${r.date || 'дата неизвестна'})\n`;
    });
    
    return response;
}

/**
 * Получить средний чек
 */
function getAverageCheck(receipts) {
    const total = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
    const avg = receipts.length ? total / receipts.length : 0;
    
    if (receipts.length === 0) {
        return '📭 У вас пока нет чеков. Добавьте чеки, чтобы я мог рассчитать средний чек.';
    }
    
    let advice = '';
    if (avg > 2000) {
        advice = ' Это выше среднего. Попробуйте планировать покупки заранее!';
    } else if (avg < 500 && receipts.length > 3) {
        advice = ' Это ниже среднего. Вы хорошо экономите!';
    } else {
        advice = ' Это хороший показатель. Продолжайте в том же духе!';
    }
    
    return `📈 Ваш средний чек составляет ${formatMoney(avg)}.${advice}`;
}

/**
 * Получить совет по экономии
 */
function getAdvice(receipts) {
    const total = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
    const avg = receipts.length ? total / receipts.length : 0;
    
    let advice = '💡 *Советы по экономии:*\n\n';
    
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
    
    advice += '• Откладывайте 10% от каждой покупки на накопления — это поможет создать финансовую подушку.\n';
    advice += '• Используйте приложения для сравнения цен перед покупкой.';
    
    return advice;
}

/**
 * Получить сообщение если ничего не понял
 */
function getFallbackMessage() {
    return `🤔 Я не совсем понял вопрос. Попробуйте спросить:

• "Сколько я потратил?" — общая сумма
• "Расходы за сегодня/вчера/неделю/месяц"
• "Топ категории" — самые затратные категории
• "Крупные покупки" — самые дорогие чеки
• "Средний чек" — средняя сумма покупки
• "Дай совет по экономии" — персональные рекомендации

Или скажите "помощь" для полного списка команд.`;
}

/**
 * Склонение существительных
 */
function declension(number, one, two, five) {
    const n = Math.abs(number) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return five;
    if (n1 > 1 && n1 < 5) return two;
    if (n1 === 1) return one;
    return five;
}
