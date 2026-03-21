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
            const maxSize = 1500;
            let width = img.width;
            let height = img.height;
            
            if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
            }
            if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Рисуем изображение
            ctx.drawImage(img, 0, 0, width, height);
            
            // Повышаем контрастность и преобразуем в ч/б для лучшего распознавания
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // Преобразуем в оттенки серого
                const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
                
                // Повышаем контраст
                const contrast = 1.3;
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                let newBrightness = factor * (brightness - 128) + 128;
                newBrightness = Math.min(255, Math.max(0, newBrightness));
                
                data[i] = data[i+1] = data[i+2] = newBrightness;
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
        /(ПЯТЁРОЧКА|МАГНИТ|ПЕРЕКРЁСТОК|АШАН|ЛЕНТА|DNS|М\.ВИДЕО|KFC|МАКДОНАЛДС|OZON|WILDBERRIES)/i
    ];
    
    for (const pattern of storePatterns) {
        const match = text.match(pattern);
        if (match) {
            result.store = match[1] || match[0];
            result.confidence += 15;
            break;
        }
    }
    
    // Если магазин не найден, пробуем взять первую строку
    if (!result.store) {
        const firstLine = text.split('\n')[0]?.trim();
        if (firstLine && firstLine.length > 2 && firstLine.length < 50) {
            result.store = firstLine;
            result.confidence += 5;
        }
    }
    
    // Паттерны для поиска даты
    const datePatterns = [
        /(\d{2})[.\/](\d{2})[.\/](\d{4})/,
        /(\d{4})-(\d{2})-(\d{2})/,
        /(\d{2})[.\/](\d{2})[.\/](\d{2})/
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[1].length === 4) {
                result.date = `${match[3]}.${match[2]}.${match[1]}`;
            } else if (match[3] && match[3].length === 2) {
                const year = 2000 + parseInt(match[3]);
                result.date = `${match[1]}.${match[2]}.${year}`;
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
        /(?:К ОПЛАТЕ|СУММА|SUM)[:\s]*(\d+[\s,.]*\d*)/i,
        /(\d+[\s,.]*\d*)\s*[Р₽](?:\s*[\n\r]|$)/i,
        /[=\-]\s*(\d+[\s,.]*\d*)\s*[Р₽]/i
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
    
    // Паттерны для поиска товаров (название + цена)
    const itemPatterns = [
        /([А-ЯЁа-яё0-9\s\-\.]{2,50})\s+(\d+[\s,.]*\d*)\s*[Р₽]/gi,
        /([А-ЯЁа-яё0-9\s\-\.]{2,50})\s+(\d+[\s,.]*\d*)\s*$/gim
    ];
    
    const items = [];
    
    for (const pattern of itemPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const name = match[1].trim();
            const price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
            
            // Фильтруем служебные строки
            const excludeWords = ['КАССА', 'СМЕНА', 'СПАСИБО', 'БОНУС', 'ИТОГО', 'ВСЕГО', 'КАССИР', 'ЧЕК', 'СЧЁТ'];
            let isExcluded = false;
            for (const word of excludeWords) {
                if (name.toUpperCase().includes(word)) {
                    isExcluded = true;
                    break;
                }
            }
            
            if (name.length > 2 && name.length < 60 && price > 0 && price < 50000 && !isExcluded) {
                items.push({
                    name: name.substring(0, 50),
                    quantity: 1,
                    price: price,
                    total: price
                });
                result.confidence += 5;
            }
        }
    }
    
    // Удаляем дубликаты товаров
    const uniqueItems = [];
    const seenNames = new Set();
    for (const item of items) {
        if (!seenNames.has(item.name)) {
            seenNames.add(item.name);
            uniqueItems.push(item);
        }
    }
    
    result.items = uniqueItems.slice(0, 20);
    
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
        const initialized = await initOCR();
        if (!initialized) {
            closeToast(loadingToast);
            return null;
        }
        
        // 2. Предобрабатываем изображение
        const processedImage = await preprocessImage(imageFile);
        
        // 3. Распознаём текст
        const { data: { text, confidence } } = await tesseractWorker.recognize(processedImage);
        
        console.log('Распознанный текст:', text); // Для отладки
        
        // 4. Парсим текст
        const parsed = parseReceiptText(text);
        parsed.rawText = text;
        parsed.ocrConfidence = confidence;
        
        closeToast(loadingToast);
        
        if (parsed.confidence > 30) {
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
            rawText: recognized.rawText?.substring(0, 500)
        }
    };
    
    return newReceipt;
}

/**
 * Определение категории на основе данных
 */
function determineCategoryFromData(store, items) {
    const searchText = ((store || '') + ' ' + (items || []).map(i => i.name).join(' ')).toLowerCase();
    
    const categoryKeywords = {
        'Продукты': ['пятёрочка', 'магнит', 'перекрёсток', 'ашан', 'лента', 'молоко', 'хлеб', 'сыр', 'мясо', 'овощи', 'фрукты'],
        'Рестораны': ['kfc', 'макдоналдс', 'бургер', 'пицца', 'суши', 'кафе', 'ресторан', 'кофе', 'чай'],
        'Транспорт': ['такси', 'яндекс', 'метро', 'бензин', 'заправка', 'транспорт', 'автобус'],
        'Аптека': ['аптека', 'лекарство', 'витамины', 'таблетки', 'здоровье'],
        'Электроника': ['м.видео', 'dns', 'эльдорадо', 'телефон', 'наушники', 'ноутбук', 'зарядка'],
        'Одежда': ['одежда', 'обувь', 'кроссовки', 'футболка', 'джинсы', 'h&m', 'zara'],
        'Развлечения': ['кино', 'театр', 'билет', 'концерт', 'игры', 'steam'],
        'Дом': ['ремонт', 'мебель', 'икеа', 'посуда', 'хозтовары']
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
    if (toast) {
        toast.remove();
    }
}
