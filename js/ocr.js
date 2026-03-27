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
            console.log('📝 Первые 500 символов:', fullText.substring(0, 500));
            
            resolve(fullText);
            
        } catch (error) {
            console.error('❌ Ошибка запроса:', error);
            reject(error);
        }
    });
}

/**
 * ИДЕАЛЬНЫЙ ПАРСЕР для чеков формата ГРАНДТОРГ
 */
function parseReceiptText(text) {
    console.log('🔍 Парсинг текста...');
    
    const result = {
        store: null,
        date: null,
        time: null,
        total: 0,
        items: []
    };
    
    // ============ 1. МАГАЗИН ============
    // Ищем в кавычках: "ГРАНДТОРГ"
    const storeMatch = text.match(/"([А-ЯЁ][А-ЯЁ\s]+)"/);
    if (storeMatch) {
        result.store = storeMatch[1];
    } else {
        const storeMatch2 = text.match(/МЕСТО РАСЧЕТОВ\s+МАГАЗИН\s+"([^"]+)"/);
        if (storeMatch2) result.store = storeMatch2[1];
    }
    
    // ============ 2. ДАТА И ВРЕМЯ ============
    // Формат: 20.03.26 18:55
    const dateTimeMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
    if (dateTimeMatch) {
        let year = dateTimeMatch[3];
        if (year.length === 2) year = '20' + year;
        result.date = `${dateTimeMatch[1]}.${dateTimeMatch[2]}.${year}`;
        result.time = `${dateTimeMatch[4]}:${dateTimeMatch[5]}`;
    } else {
        const altDateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        if (altDateMatch) {
            result.date = `${altDateMatch[1]}.${altDateMatch[2]}.${altDateMatch[3]}`;
        }
    }
    
    // ============ 3. СУММА ============
    // Ищем: ИТОГО =1765.31
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
    
    // ============ 4. ТОВАРЫ ============
    const lines = text.split('\n');
    const items = [];
    
    // Точный паттерн для формата:
    // 132198    ШТ. БАТОН НАРЕЗКА 300Г    39.90    *1=39.90
    // 54017    КГ СВИНИНА ОКОРОК Б/К ОХЛ    289.90   *1.512=438.33
    const itemPattern = /(\d+)\s+([А-ЯЁ]{2,4}\.?)\s+([А-ЯЁа-яё0-9\s\/\-\.\(\)\[\]]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
    
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
            let name = match[3].trim();
            const price = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(match[5].replace(',', '.'));
            const total = parseFloat(match[6].replace(/\s/g, '').replace(',', '.'));
            
            // Очищаем название от кода в начале и лишних символов
            name = name.replace(/^\d+\s+/, '');
            name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
            name = name.replace(/\[[^\]]+\]/, ''); // убираем [М+140]
            name = name.replace(/\s+/g, ' ').trim();
            
            // Фильтруем служебные строки
            const exclude = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА', 'ФН', 'ККТ', 'СПАСИБО', 'БОНУС', 'ТЕЛ', 'САЙТ', 'КАССИР'];
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
        const simplePattern = /([А-ЯЁа-яё0-9\s\/\-\.\(\)\[\]]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
        
        for (const line of lines) {
            const match = line.match(simplePattern);
            if (match) {
                let name = match[1].trim();
                const price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
                const quantity = parseFloat(match[3].replace(',', '.'));
                const total = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
                
                name = name.replace(/^\d+\s+/, '');
                name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
                name = name.replace(/\[[^\]]+\]/, '');
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
    console.log(`💰 Сумма: ${result.total} ₽`);
    console.log(`🏪 Магазин: ${result.store || 'не найден'}`);
    console.log(`📅 Дата: ${result.date || 'не найдена'}`);
    
    return result;
}

/**
 * Распознавание чека
 */
async function recognizeReceipt(imageFile) {
    showToast('🔍 Распознавание чека через Google Vision...', 'info');
    
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
        showToast(`❌ Ошибка: ${error.message}`, 'error');
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
    
    // Определяем категорию (все товары из чека — продукты)
    let category = 'Продукты';
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'ГРАНДТОРГ',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: category,
        total: recognized.total,
        items: recognized.items,
        notes: '📸 Распознано через Google Vision\n🏪 Магазин: ГРАНДТОРГ\n🛍️ Всего товаров: ' + recognized.items.length
    };
    
    return newReceipt;
}

async function initOCR() { 
    console.log('✅ Google Vision OCR готов к работе');
    return true; 
}
