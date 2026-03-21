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
            console.log('Google Vision распознал:', text);
            
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
 * СПЕЦИАЛЬНЫЙ ПАРСЕР ДЛЯ ЧЕКОВ ФОРМАТА "ГРАНДТОРГ"
 * 
 * Формат чека:
 * 132198    ШТ. БАТОН НАРЕЗКА 300Г    39.90    *1=39.90
 * 54017    КГ СВИНИНА ОКОРОК Б/К ОХЛ    289.90   *1.512=438.33
 */
function parseReceiptText(text) {
    console.log('Парсим текст:', text);
    
    const result = {
        store: null,
        date: null,
        time: null,
        total: 0,
        items: [],
        confidence: 0
    };
    
    // ============ 1. ПОИСК МАГАЗИНА ============
    // Ищем название в кавычках: "ГРАНДТОРГ"
    const storeMatch = text.match(/"([А-ЯЁ][А-ЯЁ\s]+)"/);
    if (storeMatch) {
        result.store = storeMatch[1].trim();
        result.confidence += 15;
        console.log('Магазин:', result.store);
    } else {
        // Альтернативный поиск: МЕСТО РАСЧЕТОВ МАГАЗИН "БЫСТРОНОМ"
        const altStoreMatch = text.match(/МЕСТО РАСЧЕТОВ\s+([А-ЯЁ\s]+)/);
        if (altStoreMatch) {
            result.store = altStoreMatch[1].trim();
            result.confidence += 10;
        }
    }
    
    // ============ 2. ПОИСК ДАТЫ И ВРЕМЕНИ ============
    // Формат: 20.03.26 18:55
    const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
    if (dateMatch) {
        let year = dateMatch[3];
        if (year.length === 2) year = '20' + year;
        result.date = `${dateMatch[1]}.${dateMatch[2]}.${year}`;
        result.time = `${dateMatch[4]}:${dateMatch[5]}`;
        result.confidence += 15;
        console.log('Дата:', result.date, 'Время:', result.time);
    } else {
        // Альтернативный формат: 20.03.2026
        const altDateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (altDateMatch) {
            result.date = `${altDateMatch[1]}.${altDateMatch[2]}.${altDateMatch[3]}`;
            result.confidence += 10;
        }
    }
    
    // ============ 3. ПОИСК ИТОГОВОЙ СУММЫ ============
    // Формат: ИТОГО =1765.31  или  ИТОГО К ОПЛАТЕ =1765.31
    const totalPatterns = [
        /ИТОГО\s*К?\s*ОПЛАТЕ\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /ИТОГО\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /СУММА\s*ЧЕКА\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /БЕЗНАЛИЧНЫМИ\s*[=:]?\s*(\d+[\s,.]*\d*)/i
    ];
    
    for (const pattern of totalPatterns) {
        const match = text.match(pattern);
        if (match) {
            const total = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
            if (total > 0 && total < 100000) {
                result.total = total;
                result.confidence += 25;
                console.log('Сумма:', result.total);
                break;
            }
        }
    }
    
    // ============ 4. ПАРСИНГ ТОВАРОВ ============
    // Разбиваем текст на строки
    const lines = text.split('\n');
    const items = [];
    
    // Основной паттерн для товаров:
    // 132198    ШТ. БАТОН НАРЕЗКА 300Г    39.90    *1=39.90
    // или
    // 54017    КГ СВИНИНА ОКОРОК Б/К ОХЛ    289.90   *1.512=438.33
    const itemPattern = /(\d+)\s+([А-ЯЁ]{2,4}\.?)\s+([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
    
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
            const code = match[1];
            const unit = match[2]; // ШТ. или КГ
            let name = match[3].trim();
            const price = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(match[5].replace(',', '.'));
            const total = parseFloat(match[6].replace(/\s/g, '').replace(',', '.'));
            
            // Очищаем название от лишних символов
            name = name.replace(/^\s+|\s+$/g, '');
            name = name.replace(/\s+/g, ' ');
            
            // Фильтруем служебные строки
            const excludeWords = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА', 'ФН', 'ККТ', 'СПАСИБО', 'БОНУС', 'ТЕЛ', 'САЙТ'];
            let isExcluded = false;
            for (const word of excludeWords) {
                if (name.toUpperCase().includes(word)) {
                    isExcluded = true;
                    break;
                }
            }
            
            if (!isExcluded && name.length > 2 && name.length < 80 && price > 0 && price < 50000) {
                items.push({
                    name: name,
                    quantity: quantity,
                    price: price,
                    total: total,
                    unit: unit
                });
                result.confidence += 5;
                console.log('Товар:', name, price, 'x', quantity, '=', total);
            }
        }
    }
    
    // Если не нашли по основному паттерну, пробуем упрощённый
    if (items.length === 0) {
        // Упрощённый паттерн: название + цена в конце строки
        const simplePattern = /([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s*$/;
        
        for (const line of lines) {
            const match = line.match(simplePattern);
            if (match) {
                let name = match[1].trim();
                let price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
                
                // Очищаем название
                name = name.replace(/^\d+\s+/, '');
                name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
                
                // Фильтруем
                const exclude = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА', 'ФН', 'ККТ'];
                let isExcluded = false;
                for (const word of exclude) {
                    if (name.toUpperCase().includes(word)) {
                        isExcluded = true;
                        break;
                    }
                }
                
                if (!isExcluded && name.length > 2 && name.length < 60 && price > 0 && price < 50000) {
                    items.push({
                        name: name,
                        quantity: 1,
                        price: price,
                        total: price
                    });
                    result.confidence += 3;
                }
            }
        }
    }
    
    result.items = items.slice(0, 30);
    console.log(`Найдено товаров: ${result.items.length}`);
    
    // ============ 5. ОПРЕДЕЛЕНИЕ КАТЕГОРИИ ============
    result.category = determineCategoryFromData(result.store, result.items);
    
    // ============ 6. ГЕНЕРАЦИЯ СОВЕТА ============
    result.notes = generateAdviceFromReceipt(result);
    
    return result;
}

/**
 * Определение категории на основе товаров
 */
function determineCategoryFromData(store, items) {
    const searchText = ((store || '') + ' ' + (items || []).map(i => i.name).join(' ')).toLowerCase();
    
    const categoryKeywords = {
        'Продукты': ['молоко', 'хлеб', 'сыр', 'мясо', 'овощи', 'фрукты', 'батон', 'картофель', 'помидор', 'свинина', 'курица', 'яйца', 'масло', 'геркулес', 'макароны', 'майонез'],
        'Рестораны': ['бургер', 'пицца', 'суши', 'кафе', 'кофе', 'чай', 'kfc', 'макдоналдс'],
        'Транспорт': ['такси', 'метро', 'бензин', 'заправка', 'яндекс'],
        'Аптека': ['аптека', 'лекарство', 'витамины', 'таблетки'],
        'Электроника': ['телефон', 'наушники', 'ноутбук', 'зарядка', 'dns', 'м.видео'],
        'Одежда': ['футболка', 'джинсы', 'обувь', 'кроссовки'],
        'Развлечения': ['кино', 'театр', 'билет', 'концерт'],
        'Дом': ['ремонт', 'мебель', 'икеа', 'посуда']
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
                return category;
            }
        }
    }
    
    return 'Продукты';
}

/**
 * Генерация совета по чеку
 */
function generateAdviceFromReceipt(receipt) {
    if (!receipt.items || receipt.items.length === 0) {
        return 'Отслеживайте свои расходы, чтобы лучше понимать куда уходят деньги.';
    }
    
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
    const alcoholKeywords = ['вино', 'водка', 'пиво', 'ром', 'текила', 'джин', 'коньяк', 'алкоголь'];
    const hasAlcohol = expensiveItems.some(item => 
        alcoholKeywords.some(keyword => item.name.toLowerCase().includes(keyword))
    );
    
    if (hasAlcohol) {
        advice += '⚠️ Чрезмерное употребление алкоголя вредит вашему здоровью. ';
    }
    
    if (receipt.items.length > 15) {
        advice += '🛒 Большая закупка! Проверьте, все ли продукты нужны? ';
    }
    
    if (!advice) {
        advice = '📝 Отслеживайте расходы и планируйте бюджет заранее.';
    }
    
    return advice;
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
                    showToast(`✅ Распознано ${parsed.items.length} товаров на сумму ${parsed.total} ₽`, 'success');
                    return parsed;
                }
            } catch (googleError) {
                console.warn('Google Vision не сработал:', googleError);
            }
        }
        
        closeToast(loadingToast);
        showToast('❌ Не удалось распознать чек. Добавьте вручную.', 'error');
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
    
    if (!recognized || (recognized.total === 0 && recognized.items.length === 0)) {
        if (confirm('Не удалось распознать чек. Хотите добавить вручную?')) {
            addNewReceipt();
        }
        return null;
    }
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: recognized.category || 'Продукты',
        total: recognized.total,
        items: recognized.items,
        notes: recognized.notes || getAdviceByCategory(recognized.category || 'Продукты'),
        ocrData: {
            confidence: recognized.confidence,
            fromGoogleVision: recognized.fromGoogleVision
        }
    };
    
    return newReceipt;
}

/**
 * Инициализация Tesseract (fallback)
 */
async function initTesseract() {
    if (tesseractWorker) return true;
    
    try {
        tesseractWorker = await Tesseract.createWorker('rus');
        return true;
    } catch (error) {
        console.error('Tesseract init error:', error);
        return false;
    }
}

/**
 * Предобработка изображения для Tesseract
 */
async function preprocessImage(imageFile) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(imageFile);
    });
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
