// ==================== ОТРИСОВКА ИНТЕРФЕЙСА ====================

/**
 * Отрисовка списка чеков
 */
function renderReceiptsList(receipts, selectedId) {
    const container = document.getElementById('receiptsList');
    if (!container) return;
    
    if (receipts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-text">Нет чеков. Добавьте первый!</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = receipts.map(receipt => `
        <div class="receipt-item ${selectedId === receipt.id ? 'active' : ''}" onclick="window.selectReceipt('${receipt.id}')">
            <div class="receipt-icon">
                ${getCategoryIcon(receipt.category)}
            </div>
            <div class="receipt-info">
                <div class="receipt-name">${escapeHtml(receipt.store)}</div>
                <div class="receipt-date">${receipt.date} • ${receipt.category}</div>
            </div>
            <div class="receipt-amount">${formatMoney(receipt.total)}</div>
            <button class="delete-btn" onclick="window.deleteReceipt(event, '${receipt.id}')">✕</button>
        </div>
    `).join('');
}

/**
 * Отрисовка статистических карточек
 */
function renderStats(receipts) {
    const stats = calculateStats(receipts);
    
    document.getElementById('statTotal').textContent = formatMoney(stats.total);
    document.getElementById('statAvg').textContent = formatMoney(stats.avg);
    document.getElementById('statCategories').textContent = stats.uniqueCategories;
    document.getElementById('statMax').textContent = stats.maxReceipt ? formatMoney(stats.maxReceipt.total) : '0 ₽';
    
    // Обновляем хедер
    document.getElementById('totalReceipts').textContent = receipts.length;
    document.getElementById('totalAmount').textContent = formatMoney(stats.total);
    document.getElementById('avgAmount').textContent = formatMoney(stats.avg);
}

/**
 * Отрисовка графика
 */
let categoryChart = null;

function renderChart(receipts) {
    const categoryTotals = calculateCategoryTotals(receipts);
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;
    
    if (categoryChart) {
        categoryChart.destroy();
    }
    
    const labels = Object.keys(categoryTotals);
    const data = Object.values(categoryTotals);
    const colors = labels.map(cat => getCategoryColor(cat));
    
    if (labels.length === 0) {
        // Показываем пустой график
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Нет данных'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#6b7280'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: () => 'Нет данных для отображения' } }
                }
            }
        });
        return;
    }
    
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af', font: { size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.raw;
                            const total = data.reduce((a, b) => a + b, 0);
                            const percent = ((value / total) * 100).toFixed(1);
                            return `${context.label}: ${formatMoney(value)} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Отрисовка деталей чека
 */
function renderDetail(receipt) {
    const container = document.getElementById('detailPanel');
    if (!container) return;
    
    if (!receipt) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>🧾 Детали чека</span>
                <button class="delete-btn" onclick="window.editReceipt('${receipt.id}')" style="background: rgba(139, 92, 246, 0.2); padding: 0.25rem 0.75rem; border-radius: 0.5rem;">
                    ✏️ Редактировать
                </button>
            </div>
            <div class="chart-container">
                <div style="margin-bottom: 1.5rem;">
                    <h2 style="font-size: 1.25rem; margin-bottom: 0.25rem;">${escapeHtml(receipt.store)}</h2>
                    <div style="color: var(--text-secondary); font-size: 0.875rem;">📅 ${receipt.date}</div>
                    <div style="font-size: 2rem; font-weight: 700; color: var(--success); margin-top: 0.5rem;">
                        ${formatMoney(receipt.total)}
                    </div>
                    <div style="margin-top: 0.5rem;">
                        <span style="background: ${getCategoryColor(receipt.category)}20; padding: 0.25rem 0.75rem; border-radius: 2rem; font-size: 0.75rem;">
                            ${getCategoryIcon(receipt.category)} ${receipt.category}
                        </span>
                    </div>
                </div>
                
                <h4 style="margin-bottom: 1rem;">🛍️ Товары (${receipt.items.length})</h4>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Наименование</th>
                            <th>Кол-во</th>
                            <th style="text-align: right;">Цена</th>
                            <th style="text-align: right;">Сумма</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${receipt.items.map(item => `
                            <tr>
                                <td>${escapeHtml(item.name)}</td>
                                <td>${item.quantity}</td>
                                <td style="text-align: right;">${formatMoney(item.price)}</td>
                                <td style="text-align: right; font-weight: 600;">${formatMoney(item.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                ${receipt.notes ? `
                    <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(139, 92, 246, 0.1); border-radius: 0.75rem;">
                        <div style="font-weight: 600; margin-bottom: 0.5rem;">💡 Совет:</div>
                        <div style="color: var(--text-secondary); line-height: 1.5;">${escapeHtml(receipt.notes)}</div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Обновление всего интерфейса
 */
function renderAll(receipts, selectedId) {
    renderReceiptsList(receipts, selectedId);
    renderStats(receipts);
    renderChart(receipts);
    
    if (selectedId) {
        const selectedReceipt = receipts.find(r => r.id === selectedId);
        if (selectedReceipt) {
            renderDetail(selectedReceipt);
        }
    } else if (receipts.length > 0) {
        renderDetail(receipts[0]);
    } else {
        renderDetail(null);
    }
}
