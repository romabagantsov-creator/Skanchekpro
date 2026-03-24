// ==================== РАСШИРЕННАЯ АНАЛИТИКА ====================

let trendChart = null;
let weeklyChart = null;

/**
 * Создание графика тренда расходов
 */
function renderTrendChart(receipts) {
    const ctx = document.getElementById('trendChart')?.getContext('2d');
    if (!ctx) return;
    
    // Группируем по дням
    const dailyTotals = {};
    receipts.forEach(r => {
        const date = r.date;
        dailyTotals[date] = (dailyTotals[date] || 0) + r.total;
    });
    
    const sortedDates = Object.keys(dailyTotals).sort((a, b) => {
        const [d1, m1, y1] = a.split('.');
        const [d2, m2, y2] = b.split('.');
        return new Date(y1, m1-1, d1) - new Date(y2, m2-1, d2);
    });
    
    const amounts = sortedDates.map(d => dailyTotals[d]);
    
    if (trendChart) trendChart.destroy();
    
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sortedDates,
            datasets: [{
                label: 'Расходы',
                data: amounts,
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `${formatMoney(context.raw)}`
                    }
                }
            }
        }
    });
}

/**
 * Создание графика по дням недели
 */
function renderWeeklyChart(receipts) {
    const ctx = document.getElementById('weeklyChart')?.getContext('2d');
    if (!ctx) return;
    
    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
    
    receipts.forEach(r => {
        const [day, month, year] = r.date.split('.');
        const date = new Date(year, month-1, day);
        const weekday = date.getDay();
        const idx = weekday === 0 ? 6 : weekday - 1;
        weekdayTotals[idx] += r.total;
    });
    
    if (weeklyChart) weeklyChart.destroy();
    
    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weekdays,
            datasets: [{
                label: 'Расходы',
                data: weekdayTotals,
                backgroundColor: 'rgba(139, 92, 246, 0.6)',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: (context) => `${formatMoney(context.raw)}`
                    }
                }
            }
        }
    });
}

/**
 * Сравнение с прошлым месяцем
 */
function compareWithLastMonth(receipts) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    let currentTotal = 0;
    let lastTotal = 0;
    
    receipts.forEach(r => {
        const [day, month, year] = r.date.split('.');
        const monthNum = parseInt(month) - 1;
        const yearNum = parseInt(year);
        
        if (yearNum === currentYear && monthNum === currentMonth) {
            currentTotal += r.total;
        }
        if (yearNum === lastYear && monthNum === lastMonth) {
            lastTotal += r.total;
        }
    });
    
    const change = lastTotal === 0 ? 0 : ((currentTotal - lastTotal) / lastTotal) * 100;
    
    return {
        current: currentTotal,
        last: lastTotal,
        change: change,
        trend: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'stable'
    };
}

/**
 * Топ категорий
 */
function getTopCategories(receipts, limit = 5) {
    const categoryTotals = {};
    receipts.forEach(r => {
        categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.total;
    });
    
    return Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, amount]) => ({ name, amount }));
}

/**
 * Аномалии (необычно большие покупки)
 */
function detectAnomalies(receipts, threshold = 2) {
    const totals = receipts.map(r => r.total);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const stdDev = Math.sqrt(totals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / totals.length);
    const anomalyThreshold = avg + threshold * stdDev;
    
    return receipts.filter(r => r.total > anomalyThreshold);
}
