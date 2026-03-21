// ==================== OCR С GOOGLE CLOUD VISION ====================

let tesseractWorker = null;
let useGoogleVision = true; // Используем Google Vision

// ВАШ API КЛЮЧ (вставлен)
const GOOGLE_VISION_API_KEY = 'AIzaSyAEbk96ky82YRCxx4Y7cnjJ16z5PF4j9Ck';

/**
 * Распознавание чека через Google Cloud Vision API
 */
async function recognizeWithGoogleVision(imageFile) {
    return new Promise(async (resolve, reject) => {
        try {
            // Конвертируем изображение в base64
            const base64 = await fileToBase64(imageFile);
            
            // Отправляем запрос к Google Vision
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
            
            // Извлекаем текст
            const text = data.responses[0]?.fullTextAnnotation?.text || '';
            const description = data.responses[0]?.textAnnotations?.[0]?.description || '';
            
            console.log('Google Vision распознал:', text || description);
            
            // Парсим текст
            const parsed = parseReceiptText(text || description);
            parsed.confidence = 95; // Google Vision очень точный
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
            // Убираем префикс "data:image/jpeg;base64,"
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Распознавание чека (основная функция)
 */
async function recognizeReceipt(imageFile) {
    const loadingToast = showLoadingToast('🔍 Анализируем чек через Google Vision...');
    
    try {
        let parsed = null;
        
        // Пробуем Google Vision
        if (useGoogleVision && GOOGLE_VISION_API_KEY) {
            try {
                parsed = await recognizeWithGoogleVision(imageFile);
                closeToast(loadingToast);
                
                if (parsed && (parsed.items.length > 0 || parsed.total > 0)) {
                    showToast(`✅ Google Vision распознал ${parsed.items.length} товаров на сумму ${parsed.total} ₽`, 'success');
                    return parsed;
                }
            } catch (googleError) {
                console.warn('Google Vision не сработал, пробуем Tesseract:', googleError);
            }
        }
        
        // Fallback: Tesseract.js
        closeToast(loadingToast);
        const tesseractToast = showLoadingToast('🔍 Пробуем локальное распознавание...');
        
        const initialized = await initTesseract();
        if (!initialized) {
            closeToast(tesseractToast);
            showToast('❌ Не удалось распознать чек. Добавьте вручную.', 'error');
            return null;
        }
        
        const processedImage = await preprocessImage(imageFile);
        const { data: { text } } = await tesseractWorker.recognize(processedImage);
        
        parsed = parseReceiptText(text);
        parsed.confidence = 50; // Tesseract менее точный
        
        closeToast(tesseractToast);
        
        if (parsed.items.length > 0 && parsed.total > 0) {
            showToast(`⚠️ Локальное распознавание: ${parsed.items.length} товаров, ${parsed.total} ₽`, 'warning');
        } else {
            showToast('❌ Не удалось распознать чек. Добавьте вручную.', 'error');
            return null;
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
 * Умный парсер текста чека
 */
function parseReceiptText(text) {
    console.log('Распознанный текст:', text);
    
    const result = {
        store: null,
        date: null,
        total: 0,
        items: [],
        confidence: 0
    };
    
    // ============ ПОИСК МАГАЗИНА ============
    const storePatterns = [
        /"([А-ЯЁ][А-ЯЁ\s]+)"/,
        /МАГАЗИН\s+"([^"]+)"/,
        /МЕСТО РАСЧЕТОВ\s+([А-ЯЁ\s]+)/,
        /([А-ЯЁ][А-ЯЁ\s]{3,30})(?:\n|$)/
    ];
    
    for (const pattern of storePatterns) {
        const match = text.match(pattern);
        if (match) {
            result.store = match[1]?.trim() || match[0]?.trim();
            if (result.store && result.store.length > 2) break;
        }
    }
    
    // ============ ПОИСК ДАТЫ ============
    const datePatterns = [
        /(\d{2})\.(\d{2})\.(\d{2,4})/,
        /(\d{2})\/(\d{2})\/(\d{4})/,
        /(\d{4})-(\d{2})-(\d{2})/
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            let day, month, year;
            if (match[1].length === 4) {
                year = match[1];
                month = match[2];
                day = match[3];
            } else {
                day = match[1];
                month = match[2];
                year = match[3];
                if (year.length === 2) year = '20' + year;
            }
            result.date = `${day}.${month}.${year}`;
            result.confidence += 15;
            break;
        }
    }
    
    // ============ ПОИСК СУММЫ ============
    const totalPatterns = [
        /ИТОГО\s*К?\s*ОПЛАТЕ\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /ИТОГО\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /СУММА\s*ЧЕКА\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /БЕЗНАЛИЧНЫМИ\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /К ОПЛАТЕ\s*[=:]?\s*(\d+[\s,.]*\d*)/i
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
    
    // ============ ПОИСК ТОВАРОВ ============
    const lines = text.split('\n');
    const items = [];
    
    // Паттерн для строк с ценой в конце
    const itemPattern = /([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s*$/;
    
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
            let name = match[1].trim();
            let price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
            
            // Очищаем название от мусора
            name = name.replace(/^\d+\s+/, ''); // Убираем код товара
            name = name.replace(/^[А-ЯЁ]{2,4}\.?/, ''); // Убираем единицы измерения
            
            // Фильтруем служебные строки
            const exclude = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА', 'ФН', 'ККТ', 'СПАСИБО', 'БОНУС', 'ТЕЛ', 'САЙТ'];
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
                result.confidence += 5;
            }
        }
    }
    
    result.items = items.slice(0, 30);
    
    // Если товаров нет, но сумма есть
    if (result.items.length === 0 && result.total > 0) {
        result.items = [{
            name: 'Покупка',
            quantity: 1,
            price: result.total,
            total: result.total
        }];
    }
    
    return result;
}

/**
 * Определение категории
 */
function determineCategoryFromData(store, items) {
    const searchText = ((store || '') + ' ' + (items || []).map(i => i.name).join(' ')).toLowerCase();
    
    const categoryKeywords = {
        'Продукты': ['молоко', 'хлеб', 'сыр', 'мясо', 'овощи', 'фрукты', 'батон', 'картофель', 'помидор', 'свинина', 'курица', 'яйца', 'масло'],
        'Рестораны': ['бургер', 'пицца', 'суши', 'кафе', 'кофе', 'чай', 'kfc', 'макдоналдс'],
        'Транспорт': ['такси', 'метро', 'бензин', 'заправка', 'яндекс'],
        'Аптека': ['аптека', 'лекарство', 'витамины', 'таблетки'],
        'Электроника': ['телефон', 'наушники', 'ноутбук', 'зарядка', 'dns', 'м.видео'],
        'Одежда': ['футболка', 'джинсы', 'обувь', 'кроссовки', 'одежда'],
        'Развлечения': ['кино', 'театр', 'билет', 'концерт', 'игры'],
        'Дом': ['ремонт', 'мебель', 'икеа', 'посуда', 'хозтовары']
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
    
    const category = determineCategoryFromData(recognized.store, recognized.items);
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: category,
        total: recognized.total,
        items: recognized.items,
        notes: getAdviceByCategory(category),
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
