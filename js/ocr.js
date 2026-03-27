// ==================== OCR С DEEPSEEK (ИИ-РАСПОЗНАВАНИЕ) ====================

// API КЛЮЧИ
const GOOGLE_VISION_API_KEY = 'AIzaSyClA3O9whFxwktBZRs1XfEfl3zEyARuqE8';
const DEEPSEEK_API_KEY = 'sk-c1d61b0541374863b0dcf9f51f93793b';

/**
 * 1. Распознавание текста через Google Vision
 */
async function recognizeWithGoogleVision(imageFile) {
    return new Promise(async (resolve, reject) => {
        try {
            const base64 = await new Promise((res) => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result.split(',')[1]);
                reader.readAsDataURL(imageFile);
            });
            
            console.log('📤 Google Vision распознаёт текст...');
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
                console.error('❌ Google Vision ошибка:', data);
                reject(new Error(data.error?.message || 'Ошибка Vision API'));
                return;
            }
            
            const fullText = data.responses[0]?.fullTextAnnotation?.text || '';
            console.log('✅ Google Vision распознал, длина:', fullText.length);
            console.log('📝 Первые 500 символов:', fullText.substring(0, 500));
            
            resolve(fullText);
            
        } catch (error) {
            console.error('❌ Ошибка Google Vision:', error);
            reject(error);
        }
    });
}

/**
 * 2. Парсинг чека через DeepSeek (ИИ)
 */
async function parseWithDeepSeek(text) {
    console.log('🤖 DeepSeek анализирует чек...');
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            temperature: 0.1,
            max_tokens: 2000,
            messages: [{
                role: 'system',
                content: `Ты — экспертный парсер кассовых чеков российских магазинов (Пятёрочка, Магнит, ГРАНДТОРГ, БЫСТРОНОМ). 
Твоя задача — извлечь структурированные данные из текста чека и вернуть ТОЛЬКО JSON без пояснений.

Формат ответа:
{
  "store": "название магазина",
  "date": "DD.MM.YYYY",
  "time": "HH:MM",
  "total": 0,
  "items": [
    {
      "name": "название товара",
      "unit": "ШТ/КГ/Л",
      "price": 0,
      "quantity": 0,
      "total": 0
    }
  ]
}

Правила:
1. Магазин: ищи в кавычках "ГРАНДТОРГ", или в строке "МЕСТО РАСЧЕТОВ МАГАЗИН"
2. Дата: формат DD.MM.YYYY (если год двузначный, добавь 20)
3. Сумма: ищи "ИТОГО К ОПЛАТЕ" или "ИТОГО"
4. Товары: формат "КОД ЕД. НАЗВАНИЕ ЦЕНА *КОЛ=СУММА"
5. Игнорируй строки: КАССИР, СПАСИБО, БОНУС, НДС, СКИДКА, ТЕЛ, САЙТ
6. Если товаров нет, верни пустой массив
7. Если данные не найдены, верни null`
            }, {
                role: 'user',
                content: `Распарси этот чек и верни JSON:\n\n${text}`
            }]
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        console.error('❌ DeepSeek ошибка:', data);
        throw new Error(data.error?.message || 'Ошибка DeepSeek API');
    }
    
    const content = data.choices[0].message.content;
    console.log('📝 DeepSeek ответ:', content.substring(0, 300) + (content.length > 300 ? '...' : ''));
    
    // Извлекаем JSON из ответа
    let jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Ищем JSON в тексте, если есть лишние символы
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        jsonStr = jsonMatch[0];
    }
    
    const parsed = JSON.parse(jsonStr);
    
    // Нормализуем данные
    parsed.total = Number(parsed.total) || 0;
    parsed.items = (parsed.items || []).map(item => ({
        name: String(item.name || '').trim(),
        unit: String(item.unit || 'ШТ'),
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        total: Number(item.total) || (Number(item.price) * Number(item.quantity))
    })).filter(item => item.price > 0 && item.name.length > 1);
    
    console.log(`✅ Магазин: ${parsed.store || 'не найден'}`);
    console.log(`📅 Дата: ${parsed.date || 'не найдена'}`);
    console.log(`💰 Сумма: ${parsed.total} ₽`);
    console.log(`📦 Товаров: ${parsed.items.length}`);
    
    return parsed;
}

/**
 * 3. Резервный regex-парсер (если DeepSeek недоступен)
 */
function parseReceiptTextFallback(text) {
    console.log('🔄 Использую fallback парсер...');
    
    const result = {
        store: null,
        date: null,
        time: null,
        total: 0,
        items: []
    };
    
    // ============ МАГАЗИН ============
    const storeMatch = text.match(/"([А-ЯЁ][А-ЯЁ\s]+)"/);
    if (storeMatch) {
        result.store = storeMatch[1];
    } else {
        const storeMatch2 = text.match(/МЕСТО РАСЧЕТОВ\s+МАГАЗИН\s+"([^"]+)"/i);
        if (storeMatch2) result.store = storeMatch2[1];
    }
    
    // ============ ДАТА И ВРЕМЯ ============
    const dateTimeMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2,4})\s+(\d{2}):(\d{2})/);
    if (dateTimeMatch) {
        let year = dateTimeMatch[3];
        if (year.length === 2) year = '20' + year;
        result.date = `${dateTimeMatch[1]}.${dateTimeMatch[2]}.${year}`;
        result.time = `${dateTimeMatch[4]}:${dateTimeMatch[5]}`;
    } else {
        const dateMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
        if (dateMatch) {
            let year = dateMatch[3];
            if (year.length === 2) year = '20' + year;
            result.date = `${dateMatch[1]}.${dateMatch[2]}.${year}`;
        }
    }
    
    // ============ СУММА ============
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
    
    // ============ ТОВАРЫ ============
    const lines = text.split('\n');
    const itemPattern = /(\d+)\s+([А-ЯЁ]{2,4}\.?)\s+([А-ЯЁа-яё0-9\s\/\-\.\(\)\[\]]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
    
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
            let name = match[3].trim();
            const price = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(match[5].replace(',', '.'));
            const total = parseFloat(match[6].replace(/\s/g, '').replace(',', '.'));
            
            // Очищаем название
            name = name.replace(/^\d+\s+/, '');
            name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
            name = name.replace(/\[[^\]]+\]/, '');
            name = name.trim();
            
            const exclude = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА', 'ФН', 'ККТ', 'СПАСИБО', 'БОНУС'];
            let isExcluded = false;
            for (const word of exclude) {
                if (name.toUpperCase().includes(word)) {
                    isExcluded = true;
                    break;
                }
            }
            
            if (!isExcluded && name.length > 2 && name.length < 80 && price > 0 && price < 50000) {
                result.items.push({
                    name: name,
                    unit: match[2],
                    price: price,
                    quantity: quantity,
                    total: total
                });
            }
        }
    }
    
    if (result.items.length === 0 && result.total > 0) {
        result.items = [{
            name: 'Покупка',
            unit: 'ШТ',
            price: result.total,
            quantity: 1,
            total: result.total
        }];
    }
    
    console.log(`📦 Fallback: ${result.items.length} товаров, ${result.total} ₽`);
    
    return result;
}

/**
 * 4. Главная функция распознавания чека
 */
async function recognizeReceipt(imageFile) {
    showToast('🔍 Распознавание чека через Google Vision...', 'info');
    
    try {
        // Шаг 1: Google Vision распознаёт текст
        const rawText = await recognizeWithGoogleVision(imageFile);
        
        if (!rawText || rawText.length < 10) {
            throw new Error('Не удалось распознать текст на чеке');
        }
        
        // Шаг 2: DeepSeek парсит текст
        showToast('🧠 DeepSeek AI анализирует данные...', 'info');
        
        let parsed;
        try {
            parsed = await parseWithDeepSeek(rawText);
        } catch (deepseekError) {
            console.warn('DeepSeek ошибка, использую fallback:', deepseekError);
            parsed = parseReceiptTextFallback(rawText);
            showToast('⚠️ Использую локальный парсер', 'warning');
        }
        
        if (parsed.items.length > 0 || parsed.total > 0) {
            showToast(`✅ Распознано ${parsed.items.length} товаров на сумму ${formatMoney(parsed.total)}`, 'success');
            return parsed;
        } else {
            showToast('⚠️ Не удалось найти товары в чеке', 'warning');
            return parsed;
        }
        
    } catch (error) {
        console.error('Ошибка распознавания:', error);
        showToast(`❌ ${error.message || 'Ошибка распознавания'}`, 'error');
        return null;
    }
}

/**
 * 5. Создание чека из изображения
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
    
    // Определяем категорию
    let category = 'Прочее';
    const searchText = ((recognized.store || '') + ' ' + recognized.items.map(i => i.name).join(' ')).toLowerCase();
    
    if (searchText.includes('пятёрочка') || searchText.includes('магнит') || searchText.includes('молоко') || searchText.includes('хлеб') || searchText.includes('сыр')) {
        category = 'Продукты';
    } else if (searchText.includes('kfc') || searchText.includes('макдоналдс') || searchText.includes('бургер')) {
        category = 'Рестораны';
    } else if (searchText.includes('такси') || searchText.includes('метро') || searchText.includes('бензин')) {
        category = 'Транспорт';
    } else if (searchText.includes('аптека') || searchText.includes('лекарство')) {
        category = 'Аптека';
    } else if (searchText.includes('м.видео') || searchText.includes('dns') || searchText.includes('телефон')) {
        category = 'Электроника';
    } else if (searchText.includes('одежда') || searchText.includes('обувь')) {
        category = 'Одежда';
    } else if (searchText.includes('кино') || searchText.includes('театр') || searchText.includes('билет')) {
        category = 'Развлечения';
    } else if (searchText.includes('ремонт') || searchText.includes('мебель')) {
        category = 'Дом';
    }
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: category,
        total: recognized.total,
        items: recognized.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.total
        })),
        notes: `🤖 Распознано через DeepSeek AI\n🏪 ${recognized.store || 'Магазин'}\n📦 ${recognized.items.length} товаров\n💰 Сумма: ${formatMoney(recognized.total)}`
    };
    
    return newReceipt;
}

/**
 * 6. Инициализация OCR
 */
async function initOCR() {
    console.log('✅ OCR готов (Google Vision + DeepSeek AI + Fallback)');
    return true;
}

/**
 * 7. Вспомогательная функция для уведомлений
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
