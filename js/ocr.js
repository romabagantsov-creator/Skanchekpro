// ==================== РАБОЧАЯ ВЕРСИЯ С GOOGLE VISION ====================

const GOOGLE_VISION_API_KEY = 'AIzaSyAEbk96ky82YRCxx4Y7cnjJ16z5PF4j9Ck';

/**
 * Распознавание чека через Google Cloud Vision
 */
async function recognizeReceipt(imageFile) {
    showToast('🔍 Анализируем чек через Google Vision...', 'info');
    
    try {
        // Конвертируем в base64
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(imageFile);
        });
        
        // Отправляем запрос
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    image: { content: base64 },
                    features: [{ type: 'TEXT_DETECTION' }]
                }]
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            console.error('Ошибка:', data.error);
            showToast(`❌ ${data.error.message || 'Ошибка API'}`, 'error');
            return null;
        }
        
        const fullText = data.responses[0]?.fullTextAnnotation?.text || '';
        console.log('Распознанный текст:', fullText.substring(0, 500));
        
        // Парсим текст
        const result = parseReceiptText(fullText);
        
        if (result.items.length > 0 || result.total > 0) {
            showToast(`✅ Распознано ${result.items.length} товаров на сумму ${result.total} ₽`, 'success');
            return result;
        } else {
            showToast('⚠️ Не удалось найти товары в чеке', 'warning');
            return result;
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('❌ Ошибка соединения с Google Vision', 'error');
        return null;
    }
}

/**
 * Парсер текста чека (специально для вашего формата)
 */
function parseReceiptText(text) {
    const result = {
        store: 'ГРАНДТОРГ',
        date: new Date().toLocaleDateString('ru-RU'),
        total: 0,
        items: [],
        notes: ''
    };
    
    // 1. Ищем магазин
    const storeMatch = text.match(/"([А-ЯЁ][А-ЯЁ\s]+)"/);
    if (storeMatch) result.store = storeMatch[1];
    
    // 2. Ищем дату
    const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
    if (dateMatch) {
        let year = dateMatch[3];
        if (year.length === 2) year = '20' + year;
        result.date = `${dateMatch[1]}.${dateMatch[2]}.${year}`;
    }
    
    // 3. Ищем сумму
    const totalMatch = text.match(/ИТОГО\s*К?\s*ОПЛАТЕ\s*[=:]?\s*(\d+[\s,.]*\d*)/i);
    if (totalMatch) {
        result.total = parseFloat(totalMatch[1].replace(/\s/g, '').replace(',', '.'));
    }
    
    // 4. Парсим товары (формат: КОД ЕД. НАЗВАНИЕ ЦЕНА *КОЛ=СУММА)
    const lines = text.split('\n');
    const items = [];
    
    // Регулярное выражение для поиска товаров
    const itemRegex = /(\d+)\s+([А-ЯЁ]{2,4}\.?)\s+([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/gi;
    
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
        let name = match[3].trim();
        const price = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
        const quantity = parseFloat(match[5].replace(',', '.'));
        const total = parseFloat(match[6].replace(/\s/g, '').replace(',', '.'));
        
        // Очищаем название
        name = name.replace(/\s+/g, ' ').trim();
        
        // Фильтруем служебные строки
        const exclude = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА'];
        let isExcluded = false;
        for (const word of exclude) {
            if (name.toUpperCase().includes(word)) {
                isExcluded = true;
                break;
            }
        }
        
        if (!isExcluded && name.length > 2 && name.length < 80 && price > 0) {
            items.push({
                name: name,
                quantity: quantity,
                price: price,
                total: total
            });
        }
    }
    
    result.items = items;
    
    // Если товары не найдены, пробуем упрощённый паттерн
    if (result.items.length === 0) {
        const simpleRegex = /([А-ЯЁа-яё0-9\s\/\-\.]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/gi;
        
        while ((match = simpleRegex.exec(text)) !== null) {
            let name = match[1].trim();
            const price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(match[3].replace(',', '.'));
            const total = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            
            name = name.replace(/^\d+\s+/, '');
            name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
            name = name.trim();
            
            if (name.length > 2 && name.length < 60 && price > 0) {
                items.push({
                    name: name,
                    quantity: quantity,
                    price: price,
                    total: total
                });
            }
        }
        result.items = items;
    }
    
    // Если товаров нет, но сумма есть
    if (result.items.length === 0 && result.total > 0) {
        result.items = [{
            name: 'Покупка',
            quantity: 1,
            price: result.total,
            total: result.total
        }];
    }
    
    // Генерируем совет
    if (result.total > 3000) {
        result.notes = `💰 Крупная покупка на ${result.total} ₽. `;
    }
    if (result.items.length > 10) {
        result.notes += '🛒 Большая закупка! ';
    }
    if (!result.notes) {
        result.notes = '📝 Отслеживайте расходы и планируйте бюджет.';
    }
    
    console.log(`Найдено товаров: ${result.items.length}`);
    return result;
}

/**
 * Создание чека из изображения
 */
async function createReceiptFromImage(imageFile) {
    const recognized = await recognizeReceipt(imageFile);
    
    if (!recognized) {
        if (confirm('Не удалось распознать чек. Хотите добавить вручную?')) {
            addNewReceipt();
        }
        return null;
    }
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store,
        date: recognized.date,
        category: 'Продукты',
        total: recognized.total,
        items: recognized.items,
        notes: recognized.notes
    };
    
    return newReceipt;
}

/**
 * Уведомления
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Заглушки
async function initTesseract() { return true; }
async function preprocessImage(f) { return f; }
function showLoadingToast(m) { showToast(m, 'info'); return null; }
function closeToast(t) {}
