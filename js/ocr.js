// ==================== GOOGLE VISION OCR ====================

const GOOGLE_VISION_API_KEY = 'AIzaSyAEbk96ky82YRCxx4Y7cnjJ16z5PF4j9Ck';

/**
 * Распознавание чека через Google Vision API
 */
async function recognizeWithGoogleVision(imageFile) {
    return new Promise(async (resolve, reject) => {
        try {
            // Конвертируем в base64
            const base64 = await new Promise((res) => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result.split(',')[1]);
                reader.readAsDataURL(imageFile);
            });
            
            console.log('📤 Отправка запроса в Google Vision...');
            
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
                console.error('❌ Ошибка:', data);
                reject(new Error(data.error?.message || 'Ошибка API'));
                return;
            }
            
            const fullText = data.responses[0]?.fullTextAnnotation?.text || '';
            console.log('✅ Текст распознан! Длина:', fullText.length);
            
            resolve(fullText);
            
        } catch (error) {
            console.error('❌ Ошибка:', error);
            reject(error);
        }
    });
}

/**
 * Парсер текста чека
 */
function parseReceiptText(text) {
    const result = {
        store: null,
        date: null,
        total: 0,
        items: [],
        notes: ''
    };
    
    // Магазин
    const storeMatch = text.match(/"([А-ЯЁ][А-ЯЁ\s]+)"/);
    if (storeMatch) result.store = storeMatch[1];
    
    // Дата
    const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
    if (dateMatch) {
        let year = dateMatch[3];
        if (year.length === 2) year = '20' + year;
        result.date = `${dateMatch[1]}.${dateMatch[2]}.${year}`;
    }
    
    // Сумма
    const totalMatch = text.match(/ИТОГО\s*К?\s*ОПЛАТЕ\s*[=:]?\s*(\d+[\s,.]*\d*)/i);
    if (totalMatch) {
        result.total = parseFloat(totalMatch[1].replace(/\s/g, '').replace(',', '.'));
    }
    
    // Товары
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
            
            if (name.length > 2 && price > 0) {
                items.push({ name, quantity, price, total });
            }
        }
    }
    
    result.items = items;
    
    if (result.items.length === 0 && result.total > 0) {
        result.items = [{ name: 'Покупка', quantity: 1, price: result.total, total: result.total }];
    }
    
    return result;
}

/**
 * Основная функция
 */
async function recognizeReceipt(imageFile) {
    showToast('🔍 Распознавание чека...', 'info');
    
    try {
        const text = await recognizeWithGoogleVision(imageFile);
        
        if (!text) {
            showToast('❌ Не удалось распознать текст', 'error');
            return null;
        }
        
        const parsed = parseReceiptText(text);
        
        if (parsed.items.length > 0) {
            showToast(`✅ Распознано ${parsed.items.length} товаров`, 'success');
            return parsed;
        } else {
            showToast('⚠️ Товары не найдены', 'warning');
            return parsed;
        }
        
    } catch (error) {
        showToast(`❌ Ошибка: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Создание чека из фото
 */
async function createReceiptFromImage(imageFile) {
    const recognized = await recognizeReceipt(imageFile);
    
    if (!recognized) {
        if (confirm('Не удалось распознать чек. Добавить вручную?')) {
            addNewReceipt();
        }
        return null;
    }
    
    return {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: 'Продукты',
        total: recognized.total,
        items: recognized.items,
        notes: '📸 Распознано через Google Vision'
    };
}

async function initOCR() { return true; }
