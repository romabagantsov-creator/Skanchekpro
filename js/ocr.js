// ==================== УМНЫЙ ПАРСЕР ЧЕКОВ ====================

let tesseractWorker = null;
let isOCRInitialized = false;

/**
 * Инициализация Tesseract worker
 */
async function initOCR() {
    if (isOCRInitialized) return true;
    
    try {
        showToast('🔍 Загрузка движка распознавания...', 'info');
        tesseractWorker = await Tesseract.createWorker('rus');
        isOCRInitialized = true;
        showToast('✅ Движок распознавания готов!', 'success');
        return true;
    } catch (error) {
        console.error('Ошибка инициализации OCR:', error);
        showToast('❌ Не удалось загрузить движок распознавания', 'error');
        return false;
    }
}

/**
 * Предобработка изображения
 */
async function preprocessImage(imageFile) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Увеличиваем размер для лучшего распознавания
            const maxSize = 2000;
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Повышаем контрастность
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
                const contrast = 1.5;
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                let newBrightness = factor * (brightness - 128) + 128;
                newBrightness = Math.min(255, Math.max(0, newBrightness));
                
                data[i] = data[i+1] = data[i+2] = newBrightness;
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(imageFile);
    });
}

/**
 * Умный парсер чека
 */
function parseReceiptText(text) {
    console.log('Распознанный текст:', text);
    
    const result = {
        store: null,
        date: null,
        time: null,
        total: 0,
        items: [],
        confidence: 0
    };
    
    // ============ 1. ПОИСК МАГАЗИНА ============
    // Ищем название магазина в кавычках или в начале
    const storePatterns = [
        /"([А-ЯЁ][А-ЯЁ\s]+)"/,           // "ГРАНДТОРГ"
        /МАГАЗИН\s+"([^"]+)"/,             // МАГАЗИН "БЫСТРОНОМ"
        /МЕСТО РАСЧЕТОВ\s+([А-ЯЁ\s]+)/,    // МЕСТО РАСЧЕТОВ МАГАЗИН "БЫСТРОНОМ"
        /^([А-ЯЁ][А-ЯЁ\s]+)(?:\n|$)/m      // Первая строка с заглавными
    ];
    
    for (const pattern of storePatterns) {
        const match = text.match(pattern);
        if (match) {
            result.store = match[1]?.trim() || match[0]?.trim();
            result.confidence += 15;
            break;
        }
    }
    
    // Если магазин не найден, ищем по ключевым словам
    if (!result.store) {
        const storeKeywords = ['ПЯТЁРОЧКА', 'МАГНИТ', 'ПЕРЕКРЁСТОК', 'АШАН', 'ЛЕНТА', 'DNS', 'М.ВИДЕО'];
        for (const keyword of storeKeywords) {
            if (text.includes(keyword)) {
                result.store = keyword;
                result.confidence += 10;
                break;
            }
        }
    }
    
    // ============ 2. ПОИСК ДАТЫ И ВРЕМЕНИ ============
    // Формат: 20.03.26 18:55
    const datePattern = /(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/;
    const dateMatch = text.match(datePattern);
    if (dateMatch) {
        const day = dateMatch[1];
        const month = dateMatch[2];
        let year = dateMatch[3];
        // Если год двузначный, добавляем 20
        if (year.length === 2) year = '20' + year;
        result.date = `${day}.${month}.${year}`;
        result.time = `${dateMatch[4]}:${dateMatch[5]}`;
        result.confidence += 15;
    } else {
        // Альтернативный формат: DD.MM.YYYY
        const altDatePattern = /(\d{2})\.(\d{2})\.(\d{4})/;
        const altMatch = text.match(altDatePattern);
        if (altMatch) {
            result.date = `${altMatch[1]}.${altMatch[2]}.${altMatch[3]}`;
            result.confidence += 10;
        }
    }
    
    // ============ 3. ПОИСК ИТОГОВОЙ СУММЫ ============
    // Формат: ИТОГО К ОПЛАТЕ =1765.31
    const totalPatterns = [
        /ИТОГО К ОПЛАТЕ\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /ИТОГО\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /ВСЕГО\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /СУММА ЧЕКА\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /К ОПЛАТЕ\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /БЕЗНАЛИЧНЫМИ\s*[=:]?\s*(\d+[\s,.]*\d*)/i
    ];
    
    for (const pattern of totalPatterns) {
        const match = text.match(pattern);
        if (match) {
            const total = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
            if (total > 0 && total < 100000) {
                result.total = total;
                result.confidence += 25;
                break;
            }
        }
    }
    
    // ============ 4. ПАРСИНГ ТОВАРОВ ============
    // Формат строки товара:
    // 132198    ШТ. БАТОН НАРЕЗКА 300Г    39.90    *1=39.90
    // или
    // 54017    КГ СВИНИНА ОКОРОК Б/К ОХЛ    289.90   *1.512=438.33
    
    const lines = text.split('\n');
    const items = [];
    
    // Паттерн для поиска товаров
    // Ищем: код, единица измерения, название, цена, количество, итого
    const itemPattern = /(\d+)\s+([А-ЯЁ]{2,4}\.?)\s+([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
    
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
            const name = match[3].trim();
            const price = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            let quantity = parseFloat(match[5].replace(',', '.'));
            const total = parseFloat(match[6].replace(/\s/g, '').replace(',', '.'));
            
            // Проверяем, что это не служебная строка
            const excludeWords = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА', 'ФН', 'ККТ'];
            let isExcluded = false;
            for (const word of excludeWords) {
                if (name.toUpperCase().includes(word)) {
                    isExcluded = true;
                    break;
                }
            }
            
            if (!isExcluded && price > 0 && total > 0) {
                items.push({
                    name: name,
                    quantity: quantity,
                    price: price,
                    total: total
                });
                result.confidence += 5;
            }
        } else {
            // Альтернативный паттерн для строк без количества (когда *1)
            const altPattern = /(\d+)\s+([А-ЯЁ]{2,4}\.?)\s+([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s+\*\d+=(\d+[\s,.]*\d*)/i;
            const altMatch = line.match(altPattern);
            if (altMatch) {
                const name = altMatch[3].trim();
                const price = parseFloat(altMatch[4].replace(/\s/g, '').replace(',', '.'));
                const total = parseFloat(altMatch[5].replace(/\s/g, '').replace(',', '.'));
                
                const excludeWords = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА'];
                let isExcluded = false;
                for (const word of excludeWords) {
                    if (name.toUpperCase().includes(word)) {
                        isExcluded = true;
                        break;
                    }
                }
                
                if (!isExcluded && price > 0) {
                    items.push({
                        name: name,
                        quantity: 1,
                        price: price,
                        total: total || price
                    });
                    result.confidence += 5;
                }
            }
        }
    }
    
    // Если товары не найдены, пробуем другой паттерн
    if (items.length === 0) {
        // Простой паттерн: название + цена в конце строки
        const simplePattern = /([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s*$/gm;
        let match;
        while ((match = simplePattern.exec(text)) !== null) {
            const name = match[1].trim();
            const price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
            
            if (name.length > 3 && name.length < 60 && price > 0 && price < 50000) {
                items.push({
                    name: name,
                    quantity: 1,
                    price: price,
                    total: price
                });
            }
        }
    }
    
    result.items = items.slice(0, 30); // Максимум 30 товаров
    
    // ============ 5. ОПРЕДЕЛЕНИЕ КАТЕГОРИИ ============
    result.category = determineCategory(result.items, result.store);
    
    // ============ 6. ГЕНЕРАЦИЯ СОВЕТА ============
    result.notes = generateReceiptAdvice(result);
    
    return result;
}

/**
 * Определение категории на основе товаров
 */
function determineCategory(items, store) {
    const allText = (store || '') + ' ' + items.map(i => i.name).join(' ').toLowerCase();
    
    const categoryKeywords = {
        'Продукты': ['батон', 'геркулес', 'молоко', 'свинина', 'картофель', 'лук', 'лимон', 'помидор', 'яблоко', 'огурец', 'банан', 'макароны', 'майонез', 'укроп', 'петрушка'],
        'Рестораны': ['kfc', 'макдоналдс', 'бургер', 'пицца', 'суши', 'кафе'],
        'Транспорт': ['такси', 'яндекс', 'метро', 'бензин', 'заправка'],
        'Аптека': ['аптека', 'лекарство', 'витамины'],
        'Электроника': ['м.видео', 'dns', 'эльдорадо', 'телефон', 'наушники'],
        'Одежда': ['одежда', 'обувь', 'кроссовки', 'футболка'],
        'Развлечения': ['кино', 'театр', 'билет', 'концерт'],
        'Дом': ['ремонт', 'мебель', 'икеа', 'посуда']
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
            if (allText.includes(keyword)) {
                return category;
            }
        }
    }
    
    return 'Продукты'; // По умолчанию для чеков из магазинов
}

/**
 * Генерация совета по чеку
 */
function generateReceiptAdvice(receipt) {
    if (receipt.items.length === 0) return null;
    
    // Находим самые дорогие товары
    const sortedItems = [...receipt.items].sort((a, b) => b.total - a.total);
    const expensiveItems = sortedItems.slice(0, 3);
    
    let advice = '';
    
    if (receipt.total > 3000) {
        advice = `💰 Крупная покупка на ${receipt.total} ₽. `;
    }
    
    if (expensiveItems.length > 0) {
        advice += `Самые дорогие покупки: ${expensiveItems.map(i => i.name).join(', ')}. `;
    }
    
    // Проверяем на алкоголь
    const alcoholKeywords = ['вино', 'водка', 'пиво', 'ром', 'текила', 'джин', 'коньяк'];
    const hasAlcohol = expensiveItems.some(item => 
        alcoholKeywords.some(keyword => item.name.toLowerCase().includes(keyword))
    );
    
    if (hasAlcohol) {
        advice += '⚠️ Чрезмерное употребление алкоголя вредит вашему здоровью. ';
    }
    
    if (receipt.items.length > 10) {
        advice += '🛒 Большая закупка! Проверьте, все ли продукты нужны? ';
    }
    
    if (!advice) {
        advice = '📝 Отслеживайте расходы и планируйте бюджет заранее.';
    }
    
    return advice;
}

/**
 * Распознавание чека по изображению
 */
async function recognizeReceipt(imageFile) {
    const loadingToast = showLoadingToast('🔍 Анализируем чек...');
    
    try {
        const initialized = await initOCR();
        if (!initialized) {
            closeToast(loadingToast);
            return null;
        }
        
        const processedImage = await preprocessImage(imageFile);
        const { data: { text, confidence } } = await tesseractWorker.recognize(processedImage);
        
        console.log('Распознанный текст:', text);
        
        const parsed = parseReceiptText(text);
        parsed.rawText = text;
        parsed.ocrConfidence = confidence;
        
        closeToast(loadingToast);
        
        if (parsed.items.length > 0 && parsed.total > 0) {
            showToast(`✅ Распознано ${parsed.items.length} товаров на сумму ${parsed.total} ₽`, 'success');
        } else if (parsed.total > 0) {
            showToast(`✅ Распознана сумма: ${parsed.total} ₽`, 'success');
        } else {
            showToast('⚠️ Не удалось распознать чек. Попробуйте сфотографировать чётче.', 'warning');
        }
        
        return parsed;
        
    } catch (error) {
        console.error('Ошибка распознавания:', error);
        closeToast(loadingToast);
        showToast('❌ Ошибка при распознавании чека', 'error');
        return null;
    }
}

/**
 * Создание чека из распознанных данных
 */
async function createReceiptFromImage(imageFile) {
    const recognized = await recognizeReceipt(imageFile);
    
    if (!recognized || (recognized.total === 0 && recognized.items.length === 0)) {
        if (confirm('Не удалось распознать чек автоматически. Хотите добавить данные вручную?')) {
            addNewReceipt();
        }
        return null;
    }
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: recognized.category || determineCategory(recognized.items, recognized.store),
        total: recognized.total,
        items: recognized.items.length > 0 ? recognized.items : [{ name: 'Покупка', quantity: 1, price: recognized.total, total: recognized.total }],
        notes: recognized.notes || getAdviceByCategory(recognized.category || 'Продукты'),
        ocrData: {
            confidence: recognized.confidence,
            rawText: recognized.rawText?.substring(0, 500)
        }
    };
    
    return newReceipt;
}

/**
 * Показ загрузочного уведомления
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
