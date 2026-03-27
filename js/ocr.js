// ==================== GOOGLE VISION OCR ====================

// НОВЫЙ API КЛЮЧ
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
            console.log('🔑 Ключ:', GOOGLE_VISION_API_KEY.substring(0, 10) + '...');
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
                const errorMsg = data.error?.message || 'Неизвестная ошибка';
                reject(new Error(errorMsg));
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
 * Парсер текста чека
 */
function parseReceiptText(text) {
    console.log('🔍 Парсинг текста...');
    
    const result = {
        store: null,
        date: null,
        total: 0,
        items: []
    };
    
    // ============ ПОИСК МАГАЗИНА ============
    const storeMatch = text.match(/"([А-ЯЁ][А-ЯЁ\s]+)"/);
    if (storeMatch) {
        result.store = storeMatch[1];
    } else {
        const stores = ['ПЯТЁРОЧКА', 'МАГНИТ', 'ПЕРЕКРЁСТОК', 'АШАН', 'ЛЕНТА', 'ГРАНДТОРГ', 'БЫСТРОНОМ'];
        for (const store of stores) {
            if (text.toUpperCase().includes(store)) {
                result.store = store;
                break;
            }
        }
    }
    
    // ============ ПОИСК ДАТЫ ============
    const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
    if (dateMatch) {
        let year = dateMatch[3];
        if (year.length === 2) year = '20' + year;
        result.date = `${dateMatch[1]}.${dateMatch[2]}.${year}`;
    } else {
        result.date = new Date().toLocaleDateString('ru-RU');
    }
    
    // ============ ПОИСК СУММЫ ============
    const totalPatterns = [
        /ИТОГО\s*К?\s*ОПЛАТЕ\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /ИТОГО\s*[=:]?\s*(\d+[\s,.]*\d*)/i,
        /СУММА\s*ЧЕКА\s*[=:]?\s*(\d+[\s,.]*\d*)/i
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
    const itemPattern = /([А-ЯЁа-яё0-9\s\/\-\.]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
    
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
            let name = match[1].trim();
            const price = parseFloat(match[2].replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(match[3].replace(',', '.'));
            const total = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            
            name = name.replace(/^\d+\s+/, '');
            name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
            name = name.trim();
            
            if (name.length > 2 && name.length < 80 && price > 0) {
                items.push({ name, quantity, price, total });
            }
        }
    }
    
    result.items = items;
    
    if (result.items.length === 0 && result.total > 0) {
        result.items = [{ name: 'Покупка', quantity: 1, price: result.total, total: result.total }];
    }
    
    console.log(`📦 Товаров: ${result.items.length}, 💰 Сумма: ${result.total}, 🏪 Магазин: ${result.store || 'не найден'}`);
    
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
            showToast('❌ Не удалось распознать текст', 'error');
            return null;
        }
        
        const parsed = parseReceiptText(text);
        
        if (parsed.items.length > 0 || parsed.total > 0) {
            showToast(`✅ Распознано ${parsed.items.length} товаров на сумму ${formatMoney(parsed.total)}`, 'success');
            return parsed;
        } else {
            showToast('⚠️ Текст распознан, но товары не найдены', 'warning');
            return parsed;
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast(`❌ Ошибка: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Создание чека из фото
 */
async function createReceiptFromImage(imageFile) {
    if (!imageFile || !imageFile.type.startsWith('image/')) {
        showToast('Пожалуйста, выберите изображение', 'error');
        return null;
    }
    
    const recognized = await recognizeReceipt(imageFile);
    
    if (!recognized) {
        if (confirm('Не удалось распознать чек. Добавить вручную?')) {
            addNewReceipt();
        }
        return null;
    }
    
    // Определяем категорию
    let category = 'Прочее';
    const searchText = ((recognized.store || '') + ' ' + recognized.items.map(i => i.name).join(' ')).toLowerCase();
    
    if (searchText.includes('пятёрочка') || searchText.includes('магнит') || searchText.includes('молоко') || searchText.includes('хлеб')) {
        category = 'Продукты';
    } else if (searchText.includes('kfc') || searchText.includes('макдоналдс')) {
        category = 'Рестораны';
    } else if (searchText.includes('такси') || searchText.includes('метро')) {
        category = 'Транспорт';
    } else if (searchText.includes('аптека')) {
        category = 'Аптека';
    } else if (searchText.includes('м.видео') || searchText.includes('dns')) {
        category = 'Электроника';
    }
    
    return {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date,
        category: category,
        total: recognized.total,
        items: recognized.items,
        notes: '📸 Распознано через Google Vision'
    };
}

async function initOCR() { return true; }
