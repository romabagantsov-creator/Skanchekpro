// ==================== GOOGLE VISION OCR ====================

// ВАШ API КЛЮЧ
const GOOGLE_VISION_API_KEY = 'AIzaSyAEbk96ky82YRCxx4Y7cnjJ16z5PF4j9Ck';

/**
 * Распознавание чека через Google Vision API
 */
async function recognizeWithGoogleVision(imageFile) {
    return new Promise(async (resolve, reject) => {
        try {
            // Конвертируем изображение в base64
            const base64 = await new Promise((res) => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result.split(',')[1]);
                reader.readAsDataURL(imageFile);
            });
            
            console.log('📤 Отправка запроса в Google Vision...');
            console.log('📸 Размер файла:', (imageFile.size / 1024).toFixed(2), 'КБ');
            
            const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [{
                        image: { content: base64 },
                        features: [{ type: 'TEXT_DETECTION', maxResults: 10 }]
                    }]
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                console.error('❌ Google Vision ошибка:', data);
                const errorMsg = data.error?.message || 'Неизвестная ошибка';
                reject(new Error(errorMsg));
                return;
            }
            
            const fullText = data.responses[0]?.fullTextAnnotation?.text || '';
            const description = data.responses[0]?.textAnnotations?.[0]?.description || '';
            
            console.log('✅ Текст распознан! Длина:', fullText.length);
            console.log('📝 Первые 300 символов:', fullText.substring(0, 300));
            
            resolve(fullText || description);
            
        } catch (error) {
            console.error('❌ Ошибка запроса:', error);
            reject(error);
        }
    });
}

/**
 * Парсер текста чека
 */
function parseReceiptText(text) {
    console.log('🔍 Парсинг текста...');
    
    const result = {
        store: null,
        date: null,
        total: 0,
        items: [],
        notes: ''
    };
    
    // ============ ПОИСК МАГАЗИНА ============
    const storePatterns = [
        /"([А-ЯЁ][А-ЯЁ\s]+)"/,
        /МАГАЗИН\s+"([^"]+)"/,
        /([А-ЯЁ][А-ЯЁ\s]{3,30})(?:\n|$)/
    ];
    
    for (const pattern of storePatterns) {
        const match = text.match(pattern);
        if (match) {
            result.store = match[1]?.trim() || match[0]?.trim();
            if (result.store && result.store.length > 2) break;
        }
    }
    
    if (!result.store) {
        const knownStores = ['ПЯТЁРОЧКА', 'МАГНИТ', 'ПЕРЕКРЁСТОК', 'АШАН', 'ЛЕНТА', 'DNS', 'М.ВИДЕО', 'ГРАНДТОРГ', 'БЫСТРОНОМ', 'KFC'];
        for (const store of knownStores) {
            if (text.toUpperCase().includes(store)) {
                result.store = store;
                break;
            }
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
                break;
            }
        }
    }
    
    // ============ ПОИСК ТОВАРОВ ============
    const lines = text.split('\n');
    const items = [];
    
    // Основной паттерн для формата: "Название    123.45    *1=123.45"
    const itemPattern = /([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
    
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
            let name = match[1].trim();
            const price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(match[3].replace(',', '.'));
            const total = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            
            // Очищаем название от мусора
            name = name.replace(/^\d+\s+/, '');
            name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
            name = name.replace(/\s+/g, ' ').trim();
            
            // Фильтруем служебные строки
            const exclude = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА', 'ФН', 'ККТ', 'СПАСИБО'];
            let isExcluded = false;
            for (const word of exclude) {
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
                    total: total 
                });
            }
        }
    }
    
    // Если не нашли по основному паттерну, пробуем упрощённый
    if (items.length === 0) {
        const simplePattern = /([А-ЯЁа-яё0-9\s\/\-\.]+?)\s+(\d+[\s,.]*\d*)\s*$/;
        for (const line of lines) {
            const match = line.match(simplePattern);
            if (match) {
                let name = match[1].trim();
                const price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
                
                name = name.replace(/^\d+\s+/, '');
                name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
                name = name.trim();
                
                const exclude = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА'];
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
                }
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
    
    console.log(`📦 Найдено товаров: ${result.items.length}`);
    console.log(`💰 Сумма: ${result.total}`);
    console.log(`🏪 Магазин: ${result.store || 'не найден'}`);
    
    return result;
}

/**
 * Основная функция распознавания
 */
async function recognizeReceipt(imageFile) {
    const toastId = showToast('🔍 Распознавание чека через Google Vision...', 'info', 0);
    
    try {
        const text = await recognizeWithGoogleVision(imageFile);
        
        if (!text || text.length < 10) {
            showToast('❌ Не удалось распознать текст на чеке', 'error');
            return null;
        }
        
        const parsed = parseReceiptText(text);
        
        if (parsed.items.length > 0 || parsed.total > 0) {
            showToast(`✅ Распознано ${parsed.items.length} товаров на сумму ${formatMoney(parsed.total)}`, 'success');
            return parsed;
        } else {
            showToast('⚠️ Текст распознан, но не найдены товары или сумма', 'warning');
            return parsed;
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        
        let errorMessage = '❌ Ошибка: ';
        if (error.message?.includes('API key')) {
            errorMessage += 'неверный API ключ. Проверьте настройки в Google Cloud Console';
        } else if (error.message?.includes('billing')) {
            errorMessage += 'не активирован биллинг. Привяжите карту в Google Cloud';
        } else if (error.message?.includes('permission')) {
            errorMessage += 'нет прав доступа. Включите Cloud Vision API';
        } else if (error.message?.includes('quota')) {
            errorMessage += 'превышен лимит запросов (1000/месяц)';
        } else {
            errorMessage += error.message || 'неизвестная ошибка';
        }
        
        showToast(errorMessage, 'error');
        return null;
    }
}

/**
 * Создание чека из изображения
 */
async function createReceiptFromImage(imageFile) {
    if (!imageFile || !imageFile.type.startsWith('image/')) {
        showToast('Пожалуйста, выберите изображение', 'error');
        return null;
    }
    
    // Проверка размера (макс 10 МБ)
    if (imageFile.size > 10 * 1024 * 1024) {
        showToast('Файл слишком большой (макс 10 МБ)', 'error');
        return null;
    }
    
    const recognized = await recognizeReceipt(imageFile);
    
    if (!recognized) {
        if (confirm('Не удалось распознать чек. Хотите добавить вручную?')) {
            addNewReceipt();
        }
        return null;
    }
    
    // Определяем категорию
    let category = 'Прочее';
    const searchText = ((recognized.store || '') + ' ' + recognized.items.map(i => i.name).join(' ')).toLowerCase();
    
    if (searchText.includes('пятёрочка') || searchText.includes('магнит') || searchText.includes('молоко') || searchText.includes('хлеб')) {
        category = 'Продукты';
    } else if (searchText.includes('kfc') || searchText.includes('макдоналдс') || searchText.includes('бургер')) {
        category = 'Рестораны';
    } else if (searchText.includes('такси') || searchText.includes('метро') || searchText.includes('бензин')) {
        category = 'Транспорт';
    } else if (searchText.includes('аптека') || searchText.includes('лекарство')) {
        category = 'Аптека';
    } else if (searchText.includes('м.видео') || searchText.includes('dns') || searchText.includes('телефон')) {
        category = 'Электроника';
    }
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: category,
        total: recognized.total,
        items: recognized.items,
        notes: '📸 Распознано через Google Vision'
    };
    
    return newReceipt;
}

/**
 * Показ уведомления (улучшенная версия)
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return null;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `${icon} ${message}`;
    
    container.appendChild(toast);
    
    if (duration > 0) {
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    return toast;
}

// Заглушки для совместимости
async function initOCR() { return true; }
