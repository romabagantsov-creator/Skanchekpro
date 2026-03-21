// ==================== ДЕЙСТВИЯ ПОЛЬЗОВАТЕЛЯ ====================

/**
 * Добавление нового чека вручную - создаёт пустой чек и сразу открывает редактирование
 */
function addNewReceipt() {
    const newReceipt = createEmptyReceipt();
    window.appState.receipts.unshift(newReceipt);
    window.appState.selectedId = newReceipt.id;
    
    saveToLocalStorage(window.appState.receipts);
    renderAll(window.appState.receipts, window.appState.selectedId);
    showToast('Новый чек создан', 'success');
    
    editReceipt(newReceipt.id);
}

/**
 * Выбор чека
 */
function selectReceipt(id) {
    window.appState.selectedId = id;
    const receipt = window.appState.receipts.find(r => r.id === id);
    if (receipt) {
        renderDetail(receipt);
    }
    renderReceiptsList(window.appState.receipts, window.appState.selectedId);
}

/**
 * Удаление чека
 */
function deleteReceipt(event, id) {
    event.stopPropagation();
    
    window.appState.receipts = window.appState.receipts.filter(r => r.id !== id);
    
    if (window.appState.selectedId === id) {
        window.appState.selectedId = window.appState.receipts.length > 0 ? window.appState.receipts[0].id : null;
    }
    
    saveToLocalStorage(window.appState.receipts);
    renderAll(window.appState.receipts, window.appState.selectedId);
    showToast('Чек удалён', 'success');
}

/**
 * Редактирование чека - открывает модальное окно с календарём
 */
function editReceipt(id) {
    const receipt = window.appState.receipts.find(r => r.id === id);
    if (!receipt) return;
    
    const existingModal = document.querySelector('.modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    let dateForInput = '';
    if (receipt.date && receipt.date.match(/\d{2}\.\d{2}\.\d{4}/)) {
        const parts = receipt.date.split('.');
        dateForInput = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 700px;">
            <div class="modal-header">✏️ Редактировать чек</div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">🏪 Магазин</label>
                    <input type="text" id="editStore" class="form-input" value="${escapeHtml(receipt.store)}" placeholder="Например: Пятёрочка">
                </div>
                <div class="form-group">
                    <label class="form-label">📅 Дата</label>
                    <input type="date" id="editDate" class="form-input date-input" value="${dateForInput}">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        📅 Нажмите на поле, чтобы открыть календарь
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">📂 Категория</label>
                    <select id="editCategory" class="form-select">
                        ${Object.keys(CATEGORIES).map(cat => `
                            <option value="${cat}" ${receipt.category === cat ? 'selected' : ''}>${CATEGORIES[cat].icon} ${cat}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">🛍️ Товары</label>
                    <div id="itemsList" style="margin-bottom: 0.5rem; max-height: 300px; overflow-y: auto;">
                        ${receipt.items && receipt.items.length > 0 ? receipt.items.map((item, index) => `
                            <div class="item-row" data-index="${index}" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
                                <input type="text" class="item-name form-input" value="${escapeHtml(item.name)}" placeholder="Название товара" style="flex: 2;">
                                <input type="number" class="item-price form-input" value="${item.price}" placeholder="Цена" step="0.01" style="flex: 1;">
                                <input type="number" class="item-quantity form-input" value="${item.quantity}" placeholder="Кол-во" step="1" style="flex: 0.8;">
                                <button type="button" class="delete-item-btn" onclick="removeItemRow(this.parentElement)" style="background: none; border: none; color: var(--error); cursor: pointer; font-size: 1.25rem;">✕</button>
                            </div>
                        `).join('') : `
                            <div class="item-row" style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;">
                                <input type="text" class="item-name form-input" placeholder="Название товара" style="flex: 2;">
                                <input type="number" class="item-price form-input" placeholder="Цена" step="0.01" style="flex: 1;">
                                <input type="number" class="item-quantity form-input" placeholder="Кол-во" step="1" value="1" style="flex: 0.8;">
                                <button type="button" class="delete-item-btn" onclick="removeItemRow(this.parentElement)" style="background: none; border: none; color: var(--error); cursor: pointer; font-size: 1.25rem;">✕</button>
                            </div>
                        `}
                    </div>
                    <button type="button" class="btn-add-item" onclick="addItemRow()" style="background: var(--accent-light); border: 1px dashed var(--accent); border-radius: 0.5rem; padding: 0.5rem; width: 100%; cursor: pointer; color: var(--accent); font-size: 0.875rem; margin-top: 0.5rem;">
                        + Добавить товар
                    </button>
                </div>
                
                <div class="form-group" style="background: var(--accent-light); border-radius: 0.75rem; padding: 1rem; margin-top: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label class="form-label" style="margin-bottom: 0;">💰 Итоговая сумма:</label>
                        <span id="calculatedTotal" style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${formatMoney(receipt.total)}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">
                        Сумма автоматически рассчитывается из товаров
                    </div>
                </div>
                
                <div class="form-group" style="margin-top: 1rem;">
                    <label class="form-label">💡 Заметки (советы, наблюдения)</label>
                    <textarea id="editNotes" class="form-textarea" rows="3" placeholder="Например: Купили продукты на неделю...">${escapeHtml(receipt.notes || '')}</textarea>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" style="width: auto; margin: 0; padding: 0.5rem 1rem;" onclick="closeModal()">Отмена</button>
                <button class="btn btn-primary" style="width: auto; margin: 0; padding: 0.5rem 1rem;" onclick="saveReceiptEdit('${id}')">💾 Сохранить</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalRoot').appendChild(modal);
    
    setTimeout(() => {
        attachPriceListeners();
    }, 100);
}

/**
 * Добавление новой строки товара
 */
function addItemRow() {
    const itemsList = document.getElementById('itemsList');
    if (!itemsList) return;
    
    const newRow = document.createElement('div');
    newRow.className = 'item-row';
    newRow.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;';
    newRow.innerHTML = `
        <input type="text" class="item-name form-input" placeholder="Название товара" style="flex: 2;">
        <input type="number" class="item-price form-input" placeholder="Цена" step="0.01" style="flex: 1;">
        <input type="number" class="item-quantity form-input" placeholder="Кол-во" step="1" value="1" style="flex: 0.8;">
        <button type="button" class="delete-item-btn" onclick="removeItemRow(this.parentElement)" style="background: none; border: none; color: var(--error); cursor: pointer; font-size: 1.25rem;">✕</button>
    `;
    
    itemsList.appendChild(newRow);
    attachPriceListeners();
    updateTotalSum();
}

/**
 * Удаление строки товара
 */
function removeItemRow(element) {
    const row = element.tagName === 'DIV' ? element : element.closest('.item-row');
    if (row) {
        row.remove();
        updateTotalSum();
    }
}

/**
 * Прикрепление обработчиков для автоматического пересчёта
 */
function attachPriceListeners() {
    const priceInputs = document.querySelectorAll('.item-price, .item-quantity');
    priceInputs.forEach(input => {
        input.removeEventListener('input', updateTotalSum);
        input.addEventListener('input', updateTotalSum);
    });
}

/**
 * Автоматический расчёт общей суммы из товаров
 */
function updateTotalSum() {
    const itemRows = document.querySelectorAll('.item-row');
    let total = 0;
    
    itemRows.forEach(row => {
        const priceInput = row.querySelector('.item-price');
        const quantityInput = row.querySelector('.item-quantity');
        
        let price = parseFloat(priceInput?.value) || 0;
        let quantity = parseFloat(quantityInput?.value) || 1;
        
        if (quantity === 0 || isNaN(quantity)) quantity = 1;
        
        const itemTotal = price * quantity;
        total += itemTotal;
    });
    
    const totalElement = document.getElementById('calculatedTotal');
    if (totalElement) {
        totalElement.textContent = formatMoney(total);
    }
}

/**
 * Закрытие модального окна
 */
function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Сохранение отредактированного чека
 */
function saveReceiptEdit(id) {
    const receipt = window.appState.receipts.find(r => r.id === id);
    if (!receipt) return;
    
    const store = document.getElementById('editStore')?.value || 'Новый магазин';
    let dateInput = document.getElementById('editDate')?.value || '';
    
    let date = dateInput;
    if (dateInput && dateInput.match(/\d{4}-\d{2}-\d{2}/)) {
        const parts = dateInput.split('-');
        date = `${parts[2]}.${parts[1]}.${parts[0]}`;
    } else if (!dateInput) {
        const today = new Date();
        date = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
    }
    
    const category = document.getElementById('editCategory')?.value || 'Прочее';
    const notes = document.getElementById('editNotes')?.value || '';
    
    const itemRows = document.querySelectorAll('.item-row');
    const items = [];
    
    itemRows.forEach(row => {
        const nameInput = row.querySelector('.item-name');
        const priceInput = row.querySelector('.item-price');
        const quantityInput = row.querySelector('.item-quantity');
        
        const name = nameInput?.value?.trim();
        const price = parseFloat(priceInput?.value) || 0;
        let quantity = parseFloat(quantityInput?.value) || 1;
        
        if (quantity === 0 || isNaN(quantity)) quantity = 1;
        
        if (name && price > 0) {
            items.push({
                name: name,
                quantity: quantity,
                price: price,
                total: price * quantity
            });
        }
    });
    
    const total = items.reduce((sum, item) => sum + item.total, 0);
    
    if (items.length === 0 && total > 0) {
        items.push({
            name: 'Покупка',
            quantity: 1,
            price: total,
            total: total
        });
    }
    
    receipt.store = store;
    receipt.date = date;
    receipt.category = category;
    receipt.total = total;
    receipt.notes = notes || getAdviceByCategory(category);
    receipt.items = items;
    
    saveToLocalStorage(window.appState.receipts);
    renderAll(window.appState.receipts, window.appState.selectedId);
    
    closeModal();
    showToast('Чек сохранён!', 'success');
}

/**
 * Добавление демо-чеков
 */
function addDemoReceipts() {
    const demoReceipts = getDemoReceipts();
    window.appState.receipts = [...demoReceipts, ...window.appState.receipts];
    
    if (!window.appState.selectedId && window.appState.receipts.length) {
        window.appState.selectedId = window.appState.receipts[0].id;
    }
    
    saveToLocalStorage(window.appState.receipts);
    renderAll(window.appState.receipts, window.appState.selectedId);
    showToast(`Добавлено ${demoReceipts.length} демо-чеков`, 'success');
}

/**
 * Очистка всех чеков
 */
function clearAllReceipts() {
    if (confirm('Вы уверены, что хотите удалить все чеки? Это действие нельзя отменить.')) {
        window.appState.receipts = [];
        window.appState.selectedId = null;
        saveToLocalStorage(window.appState.receipts);
        renderAll(window.appState.receipts, window.appState.selectedId);
        showToast('Все чеки удалены', 'info');
    }
}

/**
 * Получение CSS класса для категории в отчёте
 */
function getCategoryClassForExport(category) {
    const classes = {
        'Продукты': 'products',
        'Рестораны': 'restaurants',
        'Транспорт': 'transport',
        'Аптека': 'pharmacy',
        'Электроника': 'electronics',
        'Одежда': 'clothing',
        'Развлечения': 'entertainment',
        'Дом': 'home',
        'Прочее': 'other'
    };
    return classes[category] || 'other';
}

/**
 * Форматирование денег для CSV (без символа рубля для чисел)
 */
function formatMoneyForCSV(value) {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return value.toFixed(2);
}

/**
 * Красивый экспорт в CSV для Excel/Google Sheets
 */
function exportToCSV() {
    if (window.appState.receipts.length === 0) {
        showToast('Нет чеков для экспорта', 'error');
        return;
    }
    
    const sortedReceipts = [...window.appState.receipts].sort((a, b) => {
        const dateA = a.date.split('.').reverse().join('-');
        const dateB = b.date.split('.').reverse().join('-');
        return dateB.localeCompare(dateA);
    });
    
    const totalSum = sortedReceipts.reduce((sum, r) => sum + (r.total || 0), 0);
    const avgSum = totalSum / sortedReceipts.length;
    const maxReceipt = sortedReceipts.reduce((max, r) => (!max || r.total > max.total) ? r : max, null);
    const minReceipt = sortedReceipts.reduce((min, r) => (!min || r.total < min.total) ? r : min, null);
    
    const categoryTotals = {};
    sortedReceipts.forEach(r => {
        categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.total;
    });
    
    const monthlyTotals = {};
    sortedReceipts.forEach(r => {
        const month = r.date.split('.').slice(1, 3).join('.');
        monthlyTotals[month] = (monthlyTotals[month] || 0) + r.total;
    });
    
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    
    const csvSections = [];
    
    csvSections.push(['"ЧекСкан Pro - Финансовый отчёт"']);
    csvSections.push([`"Дата формирования: ${new Date().toLocaleString('ru-RU')}"`]);
    csvSections.push([]);
    
    csvSections.push(['"=== ОСНОВНАЯ СТАТИСТИКА ==="']);
    csvSections.push(['Показатель', 'Значение']);
    csvSections.push(['Всего чеков', sortedReceipts.length]);
    csvSections.push(['Общая сумма', formatMoneyForCSV(totalSum)]);
    csvSections.push(['Средний чек', formatMoneyForCSV(avgSum)]);
    csvSections.push(['Максимальная покупка', maxReceipt ? formatMoneyForCSV(maxReceipt.total) : '0']);
    csvSections.push(['Магазин с максимальной покупкой', maxReceipt ? maxReceipt.store : '—']);
    csvSections.push(['Минимальная покупка', minReceipt ? formatMoneyForCSV(minReceipt.total) : '0']);
    csvSections.push(['Магазин с минимальной покупкой', minReceipt ? minReceipt.store : '—']);
    csvSections.push(['Количество категорий', new Set(sortedReceipts.map(r => r.category)).size]);
    csvSections.push([]);
    
    csvSections.push(['"=== РАСХОДЫ ПО КАТЕГОРИЯМ ==="']);
    csvSections.push(['Категория', 'Сумма', 'Процент от общих расходов']);
    
    Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .forEach(([category, amount]) => {
            const percent = ((amount / totalSum) * 100).toFixed(1);
            csvSections.push([category, formatMoneyForCSV(amount), `${percent}%`]);
        });
    csvSections.push([]);
    
    csvSections.push(['"=== ДИНАМИКА ПО МЕСЯЦАМ ==="']);
    csvSections.push(['Месяц', 'Сумма расходов', 'Количество чеков', 'Средний чек']);
    
    Object.entries(monthlyTotals)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .forEach(([month, amount]) => {
            const [monthNum, year] = month.split('.');
            const monthName = monthNames[parseInt(monthNum) - 1];
            const monthReceipts = sortedReceipts.filter(r => {
                const rMonth = r.date.split('.').slice(1, 3).join('.');
                return rMonth === month;
            });
            const monthAvg = amount / monthReceipts.length;
            csvSections.push([`${monthName} ${year}`, formatMoneyForCSV(amount), monthReceipts.length, formatMoneyForCSV(monthAvg)]);
        });
    csvSections.push([]);
    
    csvSections.push(['"=== ДЕТАЛЬНЫЙ ПЕРЕЧЕНЬ ЧЕКОВ ==="']);
    csvSections.push(['№', 'Дата', 'Магазин', 'Категория', 'Сумма', 'Кол-во товаров', 'Товары', 'Заметки']);
    
    sortedReceipts.forEach((receipt, index) => {
        const itemsList = receipt.items.map(i => `${i.name} (${formatMoneyForCSV(i.price)} x ${i.quantity})`).join('; ');
        csvSections.push([
            index + 1,
            receipt.date,
            receipt.store,
            receipt.category,
            formatMoneyForCSV(receipt.total),
            receipt.items.length,
            itemsList,
            receipt.notes || ''
        ]);
    });
    csvSections.push([]);
    
    csvSections.push(['"=== ДЕТАЛЬНЫЙ ПЕРЕЧЕНЬ ТОВАРОВ ==="']);
    csvSections.push(['Чек №', 'Дата', 'Магазин', 'Категория', 'Товар', 'Количество', 'Цена', 'Сумма']);
    
    sortedReceipts.forEach((receipt, index) => {
        receipt.items.forEach(item => {
            csvSections.push([
                index + 1,
                receipt.date,
                receipt.store,
                receipt.category,
                item.name,
                item.quantity,
                formatMoneyForCSV(item.price),
                formatMoneyForCSV(item.total)
            ]);
        });
    });
    csvSections.push([]);
    
    csvSections.push(['"=== ИТОГИ ==="']);
    csvSections.push([`"Общая сумма всех расходов: ${formatMoneyForCSV(totalSum)}"`]);
    csvSections.push([`"Всего чеков: ${sortedReceipts.length}"`]);
    csvSections.push([`"Всего товаров: ${sortedReceipts.reduce((sum, r) => sum + r.items.length, 0)}"`]);
    csvSections.push([`"Средний чек: ${formatMoneyForCSV(avgSum)}"`]);
    
    const csvContent = csvSections.map(row => 
        row.map(cell => {
            const stringCell = String(cell);
            if (stringCell.includes(',') || stringCell.includes('"') || stringCell.includes('\n') || stringCell.includes(';')) {
                return `"${stringCell.replace(/"/g, '""')}"`;
            }
            return stringCell;
        }).join(';')
    ).join('\n');
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `ЧекСкан_финансовый_отчёт_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('📊 CSV отчёт готов! Откройте в Excel для лучшего просмотра', 'success');
}

/**
 * Экспорт в красивый HTML отчёт
 */
function exportToHTML() {
    if (window.appState.receipts.length === 0) {
        showToast('Нет чеков для экспорта', 'error');
        return;
    }
    
    const sortedReceipts = [...window.appState.receipts].sort((a, b) => {
        const dateA = a.date.split('.').reverse().join('-');
        const dateB = b.date.split('.').reverse().join('-');
        return dateB.localeCompare(dateA);
    });
    
    const totalSum = sortedReceipts.reduce((sum, r) => sum + (r.total || 0), 0);
    const avgSum = totalSum / sortedReceipts.length;
    const maxReceipt = sortedReceipts.reduce((max, r) => (!max || r.total > max.total) ? r : max, null);
    const minReceipt = sortedReceipts.reduce((min, r) => (!min || r.total < min.total) ? r : min, null);
    const categoriesCount = new Set(sortedReceipts.map(r => r.category)).size;
    
    const categoryTotals = {};
    sortedReceipts.forEach(r => {
        categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.total;
    });
    
    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
    
    const monthlyTotals = {};
    sortedReceipts.forEach(r => {
        const month = r.date.split('.').slice(1, 3).join('.');
        monthlyTotals[month] = (monthlyTotals[month] || 0) + r.total;
    });
    
    const html = generateBeautifulHTML(sortedReceipts, totalSum, avgSum, maxReceipt, minReceipt, categoriesCount, categoryTotals, topCategory, monthlyTotals);
    
    const blob = new Blob([html], { type: 'text/html' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `ЧекСкан_отчёт_${new Date().toISOString().slice(0, 10)}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('📊 Красивый HTML отчёт готов!', 'success');
}

/**
 * Генерация красивого HTML отчёта
 */
function generateBeautifulHTML(sortedReceipts, totalSum, avgSum, maxReceipt, minReceipt, categoriesCount, categoryTotals, topCategory, monthlyTotals) {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ЧекСкан Pro - Финансовый отчёт</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            min-height: 100vh;
        }
        .report-container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 24px;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            overflow: hidden;
            animation: fadeIn 0.5s ease;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .report-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .report-header h1 { font-size: 32px; margin-bottom: 12px; }
        .report-header .subtitle { font-size: 16px; opacity: 0.9; margin-bottom: 8px; }
        .report-header .date { font-size: 14px; opacity: 0.8; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1px;
            background: #e5e7eb;
        }
        .stat-card {
            background: white;
            padding: 24px;
            text-align: center;
            transition: all 0.3s;
        }
        .stat-card:hover {
            background: #f9fafb;
            transform: translateY(-2px);
        }
        .stat-icon { font-size: 32px; margin-bottom: 12px; }
        .stat-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
            font-weight: 600;
        }
        .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 4px;
        }
        .stat-sub { font-size: 12px; color: #9ca3af; }
        .section { padding: 32px; border-bottom: 1px solid #f3f4f6; }
        .section-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 24px;
            color: #374151;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .section-title::before {
            content: '';
            width: 4px;
            height: 24px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 2px;
        }
        .table-wrapper {
            overflow-x: auto;
            border-radius: 12px;
            border: 1px solid #e5e7eb;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        th {
            background: #f9fafb;
            padding: 14px 16px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
            font-size: 12px;
            text-transform: uppercase;
        }
        td {
            padding: 12px 16px;
            border-bottom: 1px solid #f3f4f6;
            color: #4b5563;
        }
        tr:hover td { background: #f9fafb; }
        .category-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .products { background: #d1fae5; color: #065f46; }
        .restaurants { background: #fce7f3; color: #9d174d; }
        .transport { background: #ede9fe; color: #5b21b6; }
        .pharmacy { background: #fed7aa; color: #9a3412; }
        .electronics { background: #cffafe; color: #0e7490; }
        .clothing { background: #fee2e2; color: #991b1b; }
        .entertainment { background: #f3e8ff; color: #6b21a5; }
        .home { background: #d9f99d; color: #3f6212; }
        .other { background: #f3f4f6; color: #4b5563; }
        .amount { font-weight: 600; color: #10b981; }
        .categories-list { display: flex; flex-direction: column; gap: 12px; }
        .category-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: #f9fafb;
            border-radius: 12px;
            flex-wrap: wrap;
            gap: 12px;
        }
        .category-info { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .category-percent { font-size: 12px; color: #9ca3af; }
        .category-amount { font-weight: 600; color: #667eea; }
        .progress-bar {
            width: 100%;
            height: 6px;
            background: #e5e7eb;
            border-radius: 3px;
            overflow: hidden;
            margin-top: 8px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 3px;
        }
        .months-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
        }
        .month-card {
            padding: 16px;
            background: #f9fafb;
            border-radius: 12px;
            text-align: center;
            transition: all 0.3s;
        }
        .month-card:hover {
            background: #f3f4f6;
            transform: translateY(-2px);
        }
        .month-name { font-weight: 600; color: #374151; margin-bottom: 8px; }
        .month-amount { font-size: 18px; font-weight: 700; color: #667eea; }
        .total-row { background: #f9fafb; font-weight: 600; }
        .footer {
            background: #f9fafb;
            padding: 24px 32px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
        }
        .footer-buttons {
            margin-top: 16px;
            display: flex;
            justify-content: center;
            gap: 12px;
        }
        .print-btn, .pdf-btn {
            padding: 8px 20px;
            border: none;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s;
        }
        .print-btn { background: #667eea; color: white; }
        .print-btn:hover { background: #5a67d8; transform: translateY(-1px); }
        .pdf-btn { background: #10b981; color: white; }
        .pdf-btn:hover { background: #059669; transform: translateY(-1px); }
        @media print {
            body { background: white; padding: 0; }
            .report-container { box-shadow: none; border-radius: 0; }
            .print-btn, .pdf-btn { display: none; }
        }
        @media (max-width: 768px) {
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            .section { padding: 20px; }
            .report-header { padding: 24px; }
            .report-header h1 { font-size: 24px; }
        }
        @media (max-width: 480px) {
            .stats-grid { grid-template-columns: 1fr; }
            .months-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>🧾 ЧекСкан Pro</h1>
            <div class="subtitle">Детальный анализ расходов</div>
            <div class="date">Дата отчёта: ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-label">Всего чеков</div><div class="stat-value">${sortedReceipts.length}</div><div class="stat-sub">покупок</div></div>
            <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-label">Общая сумма</div><div class="stat-value">${formatMoney(totalSum)}</div><div class="stat-sub">за всё время</div></div>
            <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-label">Средний чек</div><div class="stat-value">${formatMoney(avgSum)}</div><div class="stat-sub">за покупку</div></div>
            <div class="stat-card"><div class="stat-icon">🏷️</div><div class="stat-label">Категорий</div><div class="stat-value">${categoriesCount}</div><div class="stat-sub">всего</div></div>
            <div class="stat-card"><div class="stat-icon">⬆️</div><div class="stat-label">Максимум</div><div class="stat-value">${maxReceipt ? formatMoney(maxReceipt.total) : '0 ₽'}</div><div class="stat-sub">${maxReceipt ? escapeHtml(maxReceipt.store) : '—'}</div></div>
            <div class="stat-card"><div class="stat-icon">⬇️</div><div class="stat-label">Минимум</div><div class="stat-value">${minReceipt ? formatMoney(minReceipt.total) : '0 ₽'}</div><div class="stat-sub">${minReceipt ? escapeHtml(minReceipt.store) : '—'}</div></div>
        </div>
        
        <div class="section">
            <div class="section-title">📊 Расходы по категориям</div>
            <div class="categories-list">
                ${Object.entries(categoryTotals).map(([cat, amount]) => {
                    const percent = ((amount / totalSum) * 100).toFixed(1);
                    const categoryClass = getCategoryClassForExport(cat);
                    return `
                        <div>
                            <div class="category-item">
                                <div class="category-info">
                                    <span class="category-badge ${categoryClass}">${getCategoryIcon(cat)} ${cat}</span>
                                    <span class="category-percent">${percent}%</span>
                                </div>
                                <div class="category-amount">${formatMoney(amount)}</div>
                            </div>
                            <div class="progress-bar"><div class="progress-fill" style="width: ${percent}%;"></div></div>
                        </div>
                    `;
                }).join('')}
            </div>
            ${topCategory ? `
                <div style="margin-top: 24px; padding: 20px; background: linear-gradient(135deg, #667eea10, #764ba210); border-radius: 16px; text-align: center;">
                    <div style="font-size: 14px; color: #6b7280;">🏆 Самая популярная категория</div>
                    <div style="font-size: 24px; font-weight: 700; color: #667eea; margin-top: 8px;">${topCategory[0]}</div>
                    <div style="font-size: 14px; color: #6b7280; margin-top: 8px;">${formatMoney(topCategory[1])} (${((topCategory[1] / totalSum) * 100).toFixed(1)}% всех расходов)</div>
                </div>
            ` : ''}
        </div>
        
        <div class="section">
            <div class="section-title">📅 Динамика по месяцам</div>
            <div class="months-grid">
                ${Object.entries(monthlyTotals).sort((a, b) => b[0].localeCompare(a[0])).map(([month, amount]) => {
                    const [monthNum, year] = month.split('.');
                    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
                    const monthName = monthNames[parseInt(monthNum) - 1];
                    return `<div class="month-card"><div class="month-name">${monthName} ${year}</div><div class="month-amount">${formatMoney(amount)}</div></div>`;
                }).join('')}
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">📋 Детальная таблица чеков</div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>№</th><th>Дата</th><th>Магазин</th><th>Категория</th><th>Товары</th><th style="text-align: right;">Сумма</th></tr>
                    </thead>
                    <tbody>
                        ${sortedReceipts.map((receipt, index) => {
                            const categoryClass = getCategoryClassForExport(receipt.category);
                            const itemsText = receipt.items.map(i => `${i.name} (${formatMoney(i.price)} x ${i.quantity})`).join('; ');
                            return `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${receipt.date}</td>
                                    <td><strong>${escapeHtml(receipt.store)}</strong></td>
                                    <td><span class="category-badge ${categoryClass}">${getCategoryIcon(receipt.category)} ${receipt.category}</span></td>
                                    <td style="max-width: 300px;">${escapeHtml(itemsText.substring(0, 80))}${itemsText.length > 80 ? '...' : ''}</td>
                                    <td style="text-align: right;" class="amount">${formatMoney(receipt.total)}</td>
                                 </tr>
                            `;
                        }).join('')}
                        <tr class="total-row"><td colspan="5" style="text-align: right; font-weight: 600;">ИТОГО:</td><td style="text-align: right; font-weight: 700;">${formatMoney(totalSum)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="footer">
            <div>📊 Отчёт сгенерирован автоматически • Данные актуальны на ${new Date().toLocaleString('ru-RU')}</div>
            <div>💡 ЧекСкан Pro — ваш финансовый помощник</div>
            <div class="footer-buttons">
                <button class="print-btn" onclick="window.print()">🖨️ Распечатать</button>
                <button class="pdf-btn" onclick="window.print()">📄 Сохранить как PDF</button>
            </div>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Обработка загруженного фото чека
 */
async function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
        showToast('Пожалуйста, выберите изображение', 'error');
        return;
    }
    
    const loadingToast = showLoadingToast('🔄 Обработка изображения...');
    
    try {
        const receiptData = await createReceiptFromImage(file);
        
        if (!receiptData) {
            closeToast(loadingToast);
            showToast('❌ Не удалось распознать чек. Попробуйте сфотографировать чётче или добавьте вручную.', 'error');
            if (confirm('Не удалось распознать чек. Хотите добавить его вручную?')) {
                addNewReceipt();
            }
            return;
        }
        
        window.appState.receipts.unshift(receiptData);
        window.appState.selectedId = receiptData.id;
        
        saveToLocalStorage(window.appState.receipts);
        renderAll(window.appState.receipts, window.appState.selectedId);
        
        closeToast(loadingToast);
        
        const confidenceMsg = receiptData.ocrData?.fromQR ? ' (из QR-кода)' : ` (уверенность: ${Math.round(receiptData.ocrData?.confidence || 0)}%)`;
        showToast(`✅ Чек распознан!${confidenceMsg}`, 'success');
        
        setTimeout(() => {
            if (confirm('Хотите проверить и отредактировать распознанные данные?')) {
                editReceipt(receiptData.id);
            }
        }, 500);
        
    } catch (error) {
        console.error('Ошибка:', error);
        closeToast(loadingToast);
        showToast('❌ Ошибка при обработке чека', 'error');
    }
}

/**
 * Инициализация загрузки фото
 */
function initImageUpload() {
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    
    if (!fileInput || !uploadZone) return;
    
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
        }
        fileInput.value = '';
    });
    
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files && files[0] && files[0].type.startsWith('image/')) {
            handleImageUpload(files[0]);
        } else {
            showToast('Пожалуйста, перетащите изображение', 'error');
        }
    });
}
