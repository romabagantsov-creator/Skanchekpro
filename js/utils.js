// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

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
    if (value === undefined || value === null || isNaN(value)) return '0 ₽';
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
    const adviceMap = {
        'Продукты': '📝 Покупайте продукты оптом и следите за акциями. Используйте карты лояльности магазинов — это экономит до 10-15% бюджета.',
        'Рестораны': '🍽️ Готовьте дома чаще. Если обедаете вне дома, ищите бизнес-ланчи — они на 30-50% дешевле обычного меню.',
        'Транспорт': '🚗 Для регулярных поездок рассмотрите проездной билет. Каршеринг может быть выгоднее такси при поездках более 30 минут.',
        'Аптека': '💊 Проверяйте наличие дженериков — они дешевле брендовых препаратов. Ведите здоровый образ жизни, чтобы реже болеть.',
        'Электроника': '💻 Сравнивайте цены в 3-4 магазинах перед покупкой. Используйте кэшбэк-сервисы — можно вернуть до 15% от суммы.',
        'Одежда': '👗 Покупайте в конце сезона — скидки достигают 70%. Составляйте капсульный гардероб, чтобы меньше тратить.',
        'Развлечения': '🎮 Ищите бесплатные мероприятия в городе. Многие музеи имеют бесплатные дни посещения.',
        'Дом': '🏠 Планируйте крупные покупки заранее и откладывайте на них. Ремонт делайте поэтапно.',
        'Прочее': '💡 Ведите учет расходов — это первый шаг к финансовой свободе. Откладывайте 10-20% от каждой покупки.'
    };
    return adviceMap[category] || adviceMap['Прочее'];
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
        items: [],
        notes: ''
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
    const DEMO_RECEIPTS = [
        {
            store: 'Пятёрочка',
            date: '15.03.2026',
            category: 'Продукты',
            total: 1247.50,
            items: [
                { name: 'Молоко 3.2%', quantity: 2, price: 89.90, total: 179.80 },
                { name: 'Хлеб бородинский', quantity: 1, price: 54.90, total: 54.90 },
                { name: 'Сыр российский', quantity: 0.3, price: 890.00, total: 267.00 },
                { name: 'Яйца С0', quantity: 1, price: 189.90, total: 189.90 },
                { name: 'Масло сливочное', quantity: 1, price: 129.90, total: 129.90 },
                { name: 'Курица филе', quantity: 1, price: 426.00, total: 426.00 }
            ],
            notes: 'Средний чек в магазине у дома. Обратите внимание на акции по карте лояльности.'
        },
        {
            store: 'Яндекс.Такси',
            date: '14.03.2026',
            category: 'Транспорт',
            total: 389,
            items: [
                { name: 'Поездка до работы', quantity: 1, price: 389, total: 389 }
            ],
            notes: 'Вечерний тариф. При поездках в часы пик стоимость выше на 30%.'
        },
        {
            store: 'М.Видео',
            date: '13.03.2026',
            category: 'Электроника',
            total: 2172,
            items: [
                { name: 'Наушники Bluetooth', quantity: 1, price: 2172, total: 2172 }
            ],
            notes: 'Перед покупкой техники сравните цены в 3-4 магазинах. Используйте кэшбэк-сервисы.'
        },
        {
            store: 'KFC',
            date: '12.03.2026',
            category: 'Рестораны',
            total: 845,
            items: [
                { name: 'Бокс', quantity: 1, price: 499, total: 499 },
                { name: 'Картошка фри', quantity: 1, price: 149, total: 149 },
                { name: 'Наггетсы 6 шт', quantity: 1, price: 197, total: 197 }
            ],
            notes: 'Фастфуд — дорогое удовольствие. Домашний обед обойдётся в 2-3 раза дешевле.'
        },
        {
            store: 'Аптека Апрель',
            date: '11.03.2026',
            category: 'Аптека',
            total: 567,
            items: [
                { name: 'Витамины', quantity: 1, price: 567, total: 567 }
            ],
            notes: 'Проверяйте наличие дженериков — они дешевле брендовых препаратов.'
        }
    ];
    
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
 * Получение цвета категории (с учётом пользовательских настроек)
 */
function getCategoryColor(category) {
    // Проверяем, есть ли пользовательские настройки цветов
    if (typeof window !== 'undefined' && window.categoryColors && window.categoryColors[category]) {
        return window.categoryColors[category];
    }
    
    // Стандартные цвета (fallback)
    const defaultColors = {
        'Продукты': '#4ade80',
        'Рестораны': '#f472b6',
        'Транспорт': '#8b5cf6',
        'Аптека': '#f59e0b',
        'Электроника': '#06b6d4',
        'Одежда': '#ef4444',
        'Развлечения': '#d946ef',
        'Дом': '#14b8a6',
        'Прочее': '#6b7280'
    };
    
    return defaultColors[category] || '#6b7280';
}

/**
 * Получение иконки категории
 */
function getCategoryIcon(category) {
    const icons = {
        'Продукты': '🛒',
        'Рестораны': '🍽️',
        'Транспорт': '🚗',
        'Аптека': '💊',
        'Электроника': '💻',
        'Одежда': '👗',
        'Развлечения': '🎮',
        'Дом': '🏠',
        'Прочее': '📦'
    };
    return icons[category] || '📦';
}
