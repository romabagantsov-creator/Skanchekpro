// ==================== OCR И РАСПОЗНАВАНИЕ ЧЕКОВ ====================

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
 * Предобработка изображения для улучшения распознавания
 */
async function preprocessImage(imageFile) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Увеличиваем размер для лучшего распознавания
            const scale = 2;
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            
            // Рисуем увеличенное изображение
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Повышаем контрастность
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // Преобразуем в оттенки серого
                const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
                
                // Повышаем контраст
                const contrast = 1.5;
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                const newBrightness = factor * (brightness - 128) + 128;
                
                const clamped = Math.min(255, Math.max(0, newBrightness));
                data[i] = data[i+1] = data[i+2] = clamped;
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            canvas.toBlob(blob => {
                resolve(blob);
            }, 'image/jpeg', 0.9);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(imageFile);
    });
}

/**
 * Проверка на наличие QR-кода
 */
async function scanQRCode(imageFile) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height);
            
            if (code && code.data) {
                try {
                    // Пробуем распарсить JSON
                    const data = JSON.parse(code.data);
                    resolve({ success: true, type: 'json', data });
                } catch (e) {
                    // Если не JSON, возвращаем как текст
                    resolve({ success: true, type: 'text', data: code.data });
                }
            } else {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = URL.createObjectURL(imageFile);
    });
}

/**
 * Парсинг текста чека
 */
function parseReceiptText(text) {
    const result = {
        store: null,
        date: null,
        total: 0,
        items: [],
        confidence: 0
    };
    
    // Паттерны для поиска магазина
    const storePatterns = [
        /^([А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)\s*(?:ООО|ИП|ЗАО)/m,
        /(ПЯТЁРОЧКА|МАГНИТ|ПЕРЕКРЁСТОК|АШАН|ЛЕНТА|DNS|М\.ВИДЕО|KFC|МАКДОНАЛДС)/i
    ];
    
    for (const pattern of storePatterns) {
        const match = text.match(pattern);
        if (match) {
            result.store = match[1] || match[0];
            result.confidence += 15;
            break;
        }
    }
    
    // Паттерны для поиска даты
    const datePatterns = [
        /(\d{2})[.\/](\d{2})[.\/](\d{4})/,
        /(\d{4})-(\d{2})-(\d{2})/
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[1].length === 4) {
                result.date = `${match[3]}.${match[2]}.${match[1]}`;
            } else {
                result.date = `${match[1]}.${match[2]}.${match[3]}`;
            }
            result.confidence += 10;
            break;
        }
    }
    
    // Паттерны для поиска итоговой суммы
    const totalPatterns = [
        /(?:ИТОГО|ВСЕГО|TOTAL)[:\s]*(\d+[\s,.]*\d*)/i,
        /(?:К ОПЛАТЕ|СУММА)[:\s]*(\d+[\s,.]*\d*)/i,
        /(\d+[\s,.]*\d*)\s*[Р₽](?:\s*[\n\r]|$)/i
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
    
    // Паттерны для поиска товаров
    const itemPattern = /([А-ЯЁа-яё0-9\s\-\.]+?)\s+(\d+[\s,.]*\d*)\s*[Р₽]/gi;
    const items = [];
    let match;
    
    while ((match = itemPattern.exec(text)) !== null) {
        const name = match[1].trim();
        const price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
        
        // Фильтруем служебные строки
        if (name.length > 2 && name.length < 50 && price > 0 && price < 50000) {
            items.push({
                name: name,
                quantity: 1,
                price: price,
                total: price
            });
            result.confidence += 5;
        }
    }
    
    result.items = items.slice(0, 20);
    
    // Нормализуем уверенность
    result.confidence = Math.min(result.confidence, 100);
    
    return result;
}

/**
 * Распознавание чека по изображению
 */
async function recognizeReceipt(imageFile) {
    // Показываем индикатор загрузки
    const loadingToast = showLoadingToast('🔍 Анализируем чек...');
    
    try {
        // 1. Инициализируем OCR
        await initOCR();
        
        // 2. Проверяем QR-код
        const qrResult = await scanQRCode(imageFile);
        if (qrResult && qrResult.success) {
            closeToast(loadingToast);
            showToast('✅ QR-код распознан!', 'success');
            return processQRData(qrResult);
        }
        
        // 3. Предобрабатываем изображение
        const processedImage = await preprocessImage(imageFile);
        
        // 4. Распознаём текст
        const { data: { text, confidence } } = await tesseractWorker.recognize(processedImage);
        
        // 5. Парсим текст
        const parsed = parseReceiptText(text);
        parsed.rawText = text;
        parsed.ocrConfidence = confidence;
        
        closeToast(loadingToast);
        
        if (parsed.confidence > 40) {
            showToast(`✅ Чек распознан! Уверенность: ${Math.round(parsed.confidence)}%`, 'success');
        } else {
            showToast('⚠️ Чек распознан частично. Пожалуйста, проверьте данные.', 'warning');
        }
        
        return parsed;
        
    } catch (error) {
        console.error('Ошибка распознавания:', error);
        closeToast(loadingToast);
        showToast('❌ Не удалось распознать чек. Попробуйте сфотографировать чётче.', 'error');
        return null;
    }
}

/**
 * Обработка данных из QR-кода
 */
function processQRData(qrResult) {
    let data = {};
    
    if (qrResult.type === 'json') {
        data = qrResult.data;
    } else {
        // Пробуем распарсить текст
        const lines = qrResult.data.split('\n');
        lines.forEach(line => {
            const parts = line.split(':');
            if (parts.length === 2) {
                data[parts[0].toLowerCase().trim()] = parts[1].trim();
            }
        });
    }
    
    // Извлекаем товары, если есть
    const items = [];
    if (data.items) {
        if (Array.isArray(data.items)) {
            data.items.forEach(item => {
                items.push({
                    name: item.name || item.title || 'Товар',
                    quantity: item.quantity || 1,
                    price: item.price || item.amount || 0,
                    total: (item.price || item.amount || 0) * (item.quantity || 1)
                });
            });
        }
    }
    
    return {
        store: data.store || data.shop || data.merchant || 'Магазин',
        date: data.date || new Date().toLocaleDateString('ru-RU'),
        total: data.total || data.sum || data.amount || 0,
        items: items.length ? items : [{ name: 'Покупка', quantity: 1, price: data.total || 0, total: data.total || 0 }],
        confidence: 100,
        fromQR: true
    };
}

/**
 * Создание чека из распознанных данных
 */
async function createReceiptFromImage(imageFile) {
    const recognized = await recognizeReceipt(imageFile);
    
    if (!recognized) {
        return null;
    }
    
    // Определяем категорию
    const category = determineCategoryFromData(recognized.store, recognized.items);
    
    // Создаём чек
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: category,
        total: recognized.total || 0,
        items: recognized.items.length ? recognized.items : [{ name: 'Покупка', quantity: 1, price: recognized.total || 0, total: recognized.total || 0 }],
        notes: getAdviceByCategory(category),
        ocrData: {
            confidence: recognized.confidence,
            rawText: recognized.rawText,
            fromQR: recognized.fromQR || false
        }
    };
    
    return newReceipt;
}

/**
 * Определение категории на основе данных
 */
function determineCategoryFromData(store, items) {
    const searchText = (store + ' ' + items.map(i => i.name).join(' ')).toLowerCase();
    
    const categoryKeywords = {
        'Продукты': ['пятёрочка', 'магнит', 'перекрёсток', 'ашан', 'лента', 'молоко', 'хлеб', 'сыр', 'мясо'],
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
            if (searchText.includes(keyword)) {
                return category;
            }
        }
    }
    
    return 'Прочее';
}

/**
 * Показ загрузочного уведомления
 */
function showLoadingToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast info';
    toast.innerHTML = `
        <span class="spinner" style="width: 16px; height: 16px; border: 2px solid var(--text-secondary); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite; display: inline-block;"></span>
        ${message}
    `;
    container.appendChild(toast);
    
    return toast;
}

/**
 * Закрытие уведомления
 */
function closeToast(toast) {
    if (toast) {
        toast.remove();
    }
}
