// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===================

/**
 * Генерация уникального ID
 */
function generateId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Форматирование денег
 */
function formatMoney(value) {
    if (value === undefined || value === null) return '0 ₽';
    return new Intl.NumberFormat('ru-RU', { 
        style: 'currency', 
        currency: 'RUB',
        maximumFractionDigits: 0,
        minimumFractionDigits: 0
    }).format(value);
}

/**
 * Экранирование HTML
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Показ уведомления
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `${icon} ${escapeHtml(message)}`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Получение совета по категории
 */
function getAdviceByCategory(category) {
    return ADVICE_BY_CATEGORY[category] || ADVICE_BY_CATEGORY['Прочее'];
}

/**
 * Создание нового пустого чека
 */
function createEmptyReceipt() {
    return {
        id: generateId(),
        store: 'Новый магазин',
        date: new Date().toLocaleDateString('ru-RU'),
        category: 'Прочее',
        total: 0,
        items: [{ name: 'Новый товар', quantity: 1, price: 0, total: 0 }],
        notes: 'Добавьте описание покупки...'
    };
}

/**
 * Сохранение данных в localStorage
 */
function saveToLocalStorage(receipts) {
    localStorage.setItem('checkscan_receipts', JSON.stringify(receipts));
}

/**
 * Загрузка данных из localStorage
 */
function loadFromLocalStorage() {
    const saved = localStorage.getItem('checkscan_receipts');
    if (saved) {
        return JSON.parse(saved);
    }
    return null;
}

/**
 * Получение демо-данных с уникальными ID
 */
function getDemoReceipts() {
    return DEMO_RECEIPTS.map(receipt => ({
        ...receipt,
        id: generateId()
    }));
}

/**
 * Подсчёт статистики по чекам
 */
function calculateStats(receipts) {
    const total = receipts.reduce((sum, r) => sum + (r.total || 0), 0);
    const avg = receipts.length ? total / receipts.length : 0;
    const maxReceipt = receipts.reduce((max, r) => (!max || (r.total || 0) > (max.total || 0)) ? r : max, null);
    const uniqueCategories = new Set(receipts.map(r => r.category)).size;
    
    return { total, avg, maxReceipt, uniqueCategories };
}

/**
 * Подсчёт расходов по категориям
 */
function calculateCategoryTotals(receipts) {
    const totals = {};
    receipts.forEach(r => {
        const category = r.category || 'Прочее';
        totals[category] = (totals[category] || 0) + (r.total || 0);
    });
    return totals;
}

/**
 * Получение цвета категории
 */
function getCategoryColor(category) {
    return CATEGORIES[category]?.color || '#6b7280';
}

/**
 * Получение иконки категории
 */
function getCategoryIcon(category) {
    return CATEGORIES[category]?.icon || '📦';
}

/**
 * Создание нового пустого чека
 */
function createEmptyReceipt() {
    const today = new Date();
    const formattedDate = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
    
    return {
        id: generateId(),
        store: '',
        date: formattedDate,
        category: 'Прочее',
        total: 0,
        items: [],  // Пустой массив товаров
        notes: ''
    };
}
