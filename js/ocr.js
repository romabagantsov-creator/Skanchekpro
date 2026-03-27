// ==================== GOOGLE VISION OCR ====================

// API КЛЮЧ
const GOOGLE_VISION_API_KEY = 'AIzaSyClA3O9whFxwktBZRs1XfEfl3zEyARuqE8';

/**
 * Распознавание чека через Google Vision API
 */
async function recognizeWithGoogleVision(imageFile) {
    return new Promise(async (resolve, reject) => {
        try {
            const base64 = await new Promise((res) => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result.split(',')[1]);
                reader.readAsDataURL(imageFile);
            });
            
            console.log('📤 Отправка запроса в Vision API...');
            console.log('📸 Размер фото:', (imageFile.size / 1024).toFixed(2), 'КБ');
            
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
            
            if (!response.ok) {
                console.error('❌ Ошибка Vision API:', data);
                reject(new Error(data.error?.message || 'Ошибка API'));
                return;
            }
            
            const fullText = data.responses[0]?.fullTextAnnotation?.text || '';
            console.log('✅ Текст распознан! Длина:', fullText.length);
            
            resolve(fullText);
            
        } catch (error) {
            console.error('❌ Ошибка запроса:', error);
            reject(error);
        }
    });
}

/**
 * Парсер текста чека (улучшенный для формата ГРАНДТОРГ)
 */
function parseReceiptText(text) {
    console.log('🔍 Парсинг текста...');
    
    const result = {
        store: null,
        date: null,
        total: 0,
        items: []
    };
    
    // ============ 1. ПОИСК МАГАЗИНА ============
    const storeMatch = text.match(/"([А-ЯЁ][А-ЯЁ\s]+)"/);
    if (storeMatch) {
        result.store = storeMatch[1];
    } else {
        const stores = ['ГРАНДТОРГ', 'ПЯТЁРОЧКА', 'МАГНИТ', 'ПЕРЕКРЁСТОК', 'АШАН', 'ЛЕНТА', 'БЫСТРОНОМ'];
        for (const store of stores) {
            if (text.toUpperCase().includes(store)) {
                result.store = store;
                break;
            }
        }
    }
    
    // ============ 2. ПОИСК ДАТЫ ============
    const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
    if (dateMatch) {
        let year = dateMatch[3];
        if (year.length === 2) year = '20' + year;
        result.date = `${dateMatch[1]}.${dateMatch[2]}.${year}`;
    } else {
        result.date = new Date().toLocaleDateString('ru-RU');
    }
    
    // ============ 3. ПОИСК СУММЫ ============
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
                console.log('💰 Найдена сумма:', result.total);
                break;
            }
        }
    }
    
    // ============ 4. ПОИСК ТОВАРОВ ============
    const lines = text.split('\n');
    const items = [];
    
    // Основной паттерн для формата: "132198    ШТ. БАТОН НАРЕЗКА 300Г    39.90    *1=39.90"
    const itemPattern = /(\d+)\s+([А-ЯЁ]{2,4}\.?)\s+([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
    
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
            let name = match[3].trim();
            const price = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(match[5].replace(',', '.'));
            const total = parseFloat(match[6].replace(/\s/g, '').replace(',', '.'));
            
            // Очищаем название
            name = name.replace(/^\d+\s+/, '');
            name = name.replace(/\s+/g, ' ');
            
            // Фильтруем служебные строки
            const exclude = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА', 'ФН', 'ККТ', 'СПАСИБО', 'БОНУС', 'ТЕЛ', 'САЙТ'];
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
                console.log(`📦 Товар: ${name} — ${price} x ${quantity} = ${total}`);
            }
        }
    }
    
    // Если не нашли по основному паттерну, пробуем упрощённый
    if (items.length === 0) {
        const simplePattern = /([А-ЯЁа-яё0-9\s\/\-\.]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
        
        for (const line of lines) {
            const match = line.match(simplePattern);
            if (match) {
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
    
    console.log(`📦 Найдено товаров: ${result.items.length}`);
    console.log(`💰 Сумма: ${result.total}`);
    console.log(`🏪 Магазин: ${result.store || 'не найден'}`);
    
    return result;
}

/**
 * Распознавание чека
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
        
        let errorMessage = '❌ Ошибка Google Vision: ';
        if (error.message?.includes('API key')) {
            errorMessage += 'неверный API ключ';
        } else if (error.message?.includes('billing')) {
            errorMessage += 'не активирован биллинг';
        } else if (error.message?.includes('permission')) {
            errorMessage += 'нет прав доступа';
        } else if (error.message?.includes('quota')) {
            errorMessage += 'превышен лимит запросов';
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
    
    if (searchText.includes('пятёрочка') || searchText.includes('магнит') || searchText.includes('молоко') || searchText.includes('хлеб') || searchText.includes('сыр')) {
        category = 'Продукты';
    } else if (searchText.includes('kfc') || searchText.includes('макдоналдс') || searchText.includes('бургер') || searchText.includes('пицца')) {
        category = 'Рестораны';
    } else if (searchText.includes('такси') || searchText.includes('метро') || searchText.includes('бензин') || searchText.includes('яндекс')) {
        category = 'Транспорт';
    } else if (searchText.includes('аптека') || searchText.includes('лекарство') || searchText.includes('витамины')) {
        category = 'Аптека';
    } else if (searchText.includes('м.видео') || searchText.includes('dns') || searchText.includes('эльдорадо') || searchText.includes('телефон')) {
        category = 'Электроника';
    } else if (searchText.includes('одежда') || searchText.includes('обувь') || searchText.includes('кроссовки')) {
        category = 'Одежда';
    } else if (searchText.includes('кино') || searchText.includes('театр') || searchText.includes('билет')) {
        category = 'Развлечения';
    } else if (searchText.includes('ремонт') || searchText.includes('мебель') || searchText.includes('икеа')) {
        category = 'Дом';
    }
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date,
        category: category,
        total: recognized.total,
        items: recognized.items,
        notes: '📸 Распознано через Google Vision'
    };
    
    return newReceipt;
}

/**
 * Показ уведомления
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

// Заглушка для инициализации
async function initOCR() { 
    console.log('✅ Google Vision OCR готов к работе');
    return true; 
}
