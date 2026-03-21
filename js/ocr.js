// ==================== OCR С GOOGLE CLOUD VISION ====================

let tesseractWorker = null;
let useGoogleVision = true;

// ВАШ API КЛЮЧ
const GOOGLE_VISION_API_KEY = 'AIzaSyAEbk96ky82YRCxx4Y7cnjJ16z5PF4j9Ck';

/**
 * Распознавание чека через Google Cloud Vision API
 */
async function recognizeWithGoogleVision(imageFile) {
    return new Promise(async (resolve, reject) => {
        try {
            const base64 = await fileToBase64(imageFile);
            
            const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requests: [{
                        image: {
                            content: base64
                        },
                        features: [{
                            type: 'TEXT_DETECTION',
                            maxResults: 10
                        }]
                    }]
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                console.error('Google Vision ошибка:', data.error);
                reject(data.error);
                return;
            }
            
            const text = data.responses[0]?.fullTextAnnotation?.text || '';
            console.log('Google Vision распознал текст длиной:', text.length);
            console.log('Первые 500 символов:', text.substring(0, 500));
            
            const parsed = parseReceiptText(text);
            parsed.confidence = 95;
            parsed.fromGoogleVision = true;
            
            resolve(parsed);
            
        } catch (error) {
            console.error('Google Vision ошибка:', error);
            reject(error);
        }
    });
}

/**
 * Конвертация файла в base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * СПЕЦИАЛЬНЫЙ ПАРСЕР ДЛЯ ФОРМАТА:
 * 132198  ШТ. БАТОН НАРЕЗКА ЗОГОГ    39.90    *1=39.90
 */
function parseReceiptText(text) {
    console.log('Начинаем парсинг...');
    
    const result = {
        store: null,
        date: null,
        total: 0,
        items: [],
        confidence: 0
    };
    
    // ============ 1. ПОИСК МАГАЗИНА ============
    // Ищем в начале текста
    const lines = text.split('\n');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];
        if (line.includes('"') && line.match(/"([А-ЯЁ][А-ЯЁ\s]+)"/)) {
            const match = line.match(/"([А-ЯЁ][А-ЯЁ\s]+)"/);
            if (match) {
                result.store = match[1].trim();
                break;
            }
        }
    }
    
    if (!result.store) {
        // Ищем "ГРАНДТОРГ" или "БЫСТРОНОМ"
        if (text.includes('ГРАНДТОРГ')) result.store = 'ГРАНДТОРГ';
        else if (text.includes('БЫСТРОНОМ')) result.store = 'БЫСТРОНОМ';
        else result.store = 'Магазин';
    }
    
    // ============ 2. ПОИСК ДАТЫ ============
    const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
    if (dateMatch) {
        let year = dateMatch[3];
        if (year.length === 2) year = '20' + year;
        result.date = `${dateMatch[1]}.${dateMatch[2]}.${year}`;
    } else {
        const today = new Date();
        result.date = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.${today.getFullYear()}`;
    }
    
    // ============ 3. ПОИСК ИТОГОВОЙ СУММЫ ============
    const totalPatterns = [
        /ИТОГО\s*К?\s*ОПЛАТЕ\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /ИТОГО\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /БЕЗНАЛИЧНЫМИ\s*[=:]?\s*(\d+[\s,.]*\d*)/i
    ];
    
    for (const pattern of totalPatterns) {
        const match = text.match(pattern);
        if (match) {
            const total = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
            if (total > 0 && total < 100000) {
                result.total = total;
                break;
            }
        }
    }
    
    // ============ 4. ПАРСИНГ ТОВАРОВ ============
    // Паттерн для вашего формата:
    // КОД    ЕД. НАЗВАНИЕ    ЦЕНА    *КОЛ=ИТОГО
    const itemPattern = /(\d+)\s+([А-ЯЁ]{2,4}\.?)\s+([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/gi;
    
    let match;
    while ((match = itemPattern.exec(text)) !== null) {
        const code = match[1];
        const unit = match[2];
        let name = match[3].trim();
        const price = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
        const quantity = parseFloat(match[5].replace(',', '.'));
        const total = parseFloat(match[6].replace(/\s/g, '').replace(',', '.'));
        
        // Очищаем название
        name = name.replace(/\s+/g, ' ').trim();
        
        // Фильтруем мусор
        const excludeWords = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА'];
        let isExcluded = false;
        for (const word of excludeWords) {
            if (name.toUpperCase().includes(word)) {
                isExcluded = true;
                break;
            }
        }
        
        if (!isExcluded && name.length > 2 && name.length < 80 && price > 0 && price < 50000) {
            result.items.push({
                name: name,
                quantity: quantity,
                price: price,
                total: total,
                unit: unit
            });
        }
    }
    
    // Если не нашли по основному паттерну, пробуем упрощённый
    if (result.items.length === 0) {
        // Упрощённый паттерн для строк с *
        const simplePattern = /([А-ЯЁа-яё0-9\s\/\-\.]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/gi;
        
        while ((match = simplePattern.exec(text)) !== null) {
            let name = match[1].trim();
            const price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(match[3].replace(',', '.'));
            const total = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            
            // Очищаем название от кода и единицы измерения
            name = name.replace(/^\d+\s+/, '');
            name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
            name = name.trim();
            
            if (name.length > 2 && name.length < 60 && price > 0 && price < 50000) {
                result.items.push({
                    name: name,
                    quantity: quantity,
                    price: price,
                    total: total
                });
            }
        }
    }
    
    console.log(`Найдено товаров: ${result.items.length}`);
    
    // Если товаров всё равно нет, выводим первые строки для отладки
    if (result.items.length === 0) {
        console.log('Первые 10 строк текста:');
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            console.log(`[${i}]: ${lines[i]}`);
        }
    }
    
    // ============ 5. ОПРЕДЕЛЕНИЕ КАТЕГОРИИ ============
    result.category = 'Продукты'; // По умолчанию для продуктового чека
    
    // ============ 6. ГЕНЕРАЦИЯ СОВЕТА ============
    if (result.items.length > 0) {
        const totalSum = result.items.reduce((sum, item) => sum + item.total, 0);
        const expensiveItems = [...result.items].sort((a, b) => b.total - a.total).slice(0, 3);
        
        let advice = '';
        if (totalSum > 3000) {
            advice = `💰 Крупная покупка на ${totalSum} ₽. `;
        }
        if (expensiveItems.length > 0) {
            advice += `Самые дорогие: ${expensiveItems.map(i => i.name).join(', ')}. `;
        }
        if (result.items.length > 15) {
            advice += '🛒 Большая закупка! Проверьте, все ли продукты нужны? ';
        }
        if (!advice) {
            advice = '📝 Отслеживайте расходы и планируйте бюджет.';
        }
        result.notes = advice;
    } else {
        result.notes = '📝 Отслеживайте расходы и планируйте бюджет.';
    }
    
    return result;
}

/**
 * Распознавание чека (основная функция)
 */
async function recognizeReceipt(imageFile) {
    const loadingToast = showLoadingToast('🔍 Анализируем чек через Google Vision...');
    
    try {
        let parsed = null;
        
        if (useGoogleVision && GOOGLE_VISION_API_KEY) {
            try {
                parsed = await recognizeWithGoogleVision(imageFile);
                closeToast(loadingToast);
                
                if (parsed && (parsed.items.length > 0 || parsed.total > 0)) {
                    showToast(`✅ Распознано ${parsed.items.length} товаров на сумму ${parsed.total || 'неизвестно'} ₽`, 'success');
                    return parsed;
                } else {
                    showToast('⚠️ Товары не распознаны, но сумма найдена', 'warning');
                    return parsed;
                }
            } catch (googleError) {
                console.error('Google Vision ошибка:', googleError);
                closeToast(loadingToast);
                showToast('❌ Ошибка Google Vision. Добавьте чек вручную.', 'error');
                return null;
            }
        }
        
        closeToast(loadingToast);
        showToast('❌ Не удалось распознать чек', 'error');
        return null;
        
    } catch (error) {
        console.error('Ошибка распознавания:', error);
        closeToast(loadingToast);
        showToast('❌ Ошибка при распознавании чека', 'error');
        return null;
    }
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
    
    // Если товаров нет, но сумма есть
    if (recognized.items.length === 0 && recognized.total > 0) {
        recognized.items = [{
            name: 'Покупка',
            quantity: 1,
            price: recognized.total,
            total: recognized.total
        }];
    }
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: recognized.category || 'Продукты',
        total: recognized.total || recognized.items.reduce((sum, i) => sum + i.total, 0),
        items: recognized.items,
        notes: recognized.notes || getAdviceByCategory('Продукты'),
        ocrData: {
            confidence: recognized.confidence,
            fromGoogleVision: recognized.fromGoogleVision
        }
    };
    
    return newReceipt;
}

/**
 * Показ уведомления загрузки
 */
function showLoadingToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return null;
    
    const toast = document.createElement('div');
    toast.className = 'toast info';
    toast.innerHTML = `
        <span style="display: inline-block; width: 16px; height: 16px; border: 2px solid var(--text-secondary); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></span>
        ${message}
    `;
    container.appendChild(toast);
    return toast;
}

/**
 * Закрытие уведомления
 */
function closeToast(toast) {
    if (toast) toast.remove();
}
