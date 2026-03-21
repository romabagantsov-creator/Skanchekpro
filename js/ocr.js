// ==================== ПРОСТАЯ ВЕРСИЯ OCR ====================

let tesseractWorker = null;

/**
 * Распознавание чека через Google Cloud Vision API
 */
async function recognizeWithGoogleVision(imageFile) {
    const GOOGLE_VISION_API_KEY = 'AIzaSyAEbk96ky82YRCxx4Y7cnjJ16z5PF4j9Ck';
    
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
            console.error('Ошибка Google Vision:', data.error);
            return null;
        }
        
        const fullText = data.responses[0]?.fullTextAnnotation?.text || '';
        console.log('Распознанный текст:', fullText);
        
        // Парсим текст
        const result = parseSimpleReceipt(fullText);
        return result;
        
    } catch (error) {
        console.error('Ошибка:', error);
        return null;
    }
}

/**
 * Простой парсер чека
 */
function parseSimpleReceipt(text) {
    const result = {
        store: 'Магазин',
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
    } else {
        const altTotal = text.match(/ИТОГО\s*[=:]?\s*(\d+[\s,.]*\d*)/i);
        if (altTotal) {
            result.total = parseFloat(altTotal[1].replace(/\s/g, '').replace(',', '.'));
        }
    }
    
    // 4. Ищем товары (простым способом)
    const lines = text.split('\n');
    const items = [];
    
    for (const line of lines) {
        // Ищем строки с ценой
        const priceMatch = line.match(/(\d+[\s,.]*\d*)\s*\*[\d.]+=(\d+[\s,.]*\d*)/i);
        if (priceMatch) {
            // Ищем название перед ценой
            let name = line.replace(priceMatch[0], '').trim();
            // Очищаем название от кода и единиц измерения
            name = name.replace(/^\d+\s+/, '');
            name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
            name = name.replace(/\s+/g, ' ').trim();
            
            const price = parseFloat(priceMatch[1].replace(/\s/g, '').replace(',', '.'));
            const total = parseFloat(priceMatch[2].replace(/\s/g, '').replace(',', '.'));
            
            if (name.length > 2 && name.length < 60 && price > 0) {
                items.push({
                    name: name,
                    quantity: 1,
                    price: price,
                    total: total
                });
            }
        }
    }
    
    result.items = items;
    
    // Если товаров нет, но сумма есть
    if (result.items.length === 0 && result.total > 0) {
        result.items = [{
            name: 'Покупка',
            quantity: 1,
            price: result.total,
            total: result.total
        }];
    }
    
    // Добавляем совет
    if (result.total > 3000) {
        result.notes = `💰 Крупная покупка на ${result.total} ₽. `;
    }
    if (result.items.length > 10) {
        result.notes += '🛒 Большая закупка! ';
    }
    if (!result.notes) {
        result.notes = '📝 Отслеживайте расходы и планируйте бюджет.';
    }
    
    console.log('Распознано товаров:', result.items.length);
    console.log('Сумма:', result.total);
    
    return result;
}

/**
 * Основная функция распознавания
 */
async function recognizeReceipt(imageFile) {
    showToast('🔍 Анализируем чек через Google Vision...', 'info');
    
    try {
        const result = await recognizeWithGoogleVision(imageFile);
        
        if (result && result.items.length > 0) {
            showToast(`✅ Распознано ${result.items.length} товаров на сумму ${result.total} ₽`, 'success');
            return result;
        } else if (result && result.total > 0) {
            showToast(`⚠️ Распознана только сумма: ${result.total} ₽`, 'warning');
            return result;
        } else {
            showToast('❌ Не удалось распознать чек', 'error');
            return null;
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast('❌ Ошибка распознавания', 'error');
        return null;
    }
}

/**
 * Создание чека из изображения
 */
async function createReceiptFromImage(imageFile) {
    const recognized = await recognizeReceipt(imageFile);
    
    if (!recognized || (recognized.total === 0 && recognized.items.length === 0)) {
        if (confirm('Не удалось распознать чек. Хотите добавить вручную?')) {
            addNewReceipt();
        }
        return null;
    }
    
    const category = determineCategory(recognized.items);
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date,
        category: category,
        total: recognized.total,
        items: recognized.items,
        notes: recognized.notes || getAdviceByCategory(category)
    };
    
    return newReceipt;
}

/**
 * Определение категории
 */
function determineCategory(items) {
    const names = items.map(i => i.name.toLowerCase()).join(' ');
    
    if (names.includes('молоко') || names.includes('хлеб') || names.includes('сыр') || names.includes('мясо')) {
        return 'Продукты';
    }
    if (names.includes('бургер') || names.includes('пицца')) {
        return 'Рестораны';
    }
    if (names.includes('такси') || names.includes('бензин')) {
        return 'Транспорт';
    }
    
    return 'Прочее';
}

/**
 * Инициализация (заглушка)
 */
async function initTesseract() {
    return true;
}

/**
 * Предобработка (заглушка)
 */
async function preprocessImage(imageFile) {
    return imageFile;
}

/**
 * Показ уведомления
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    container.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

function showLoadingToast(message) {
    showToast(message, 'info');
    return null;
}

function closeToast(toast) {}
