// ==================== OCR С DEEPSEEK (УЛУЧШЕННЫЙ) ====================

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
                reject(new Error(data.error?.message || 'Ошибка Vision API'));
                return;
            }
            
            const fullText = data.responses[0]?.fullTextAnnotation?.text || '';
            console.log('✅ Google Vision распознал, длина:', fullText.length);
            console.log('📝 Первые 500 символов:', fullText.substring(0, 500));
            
            resolve(fullText);
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * 2. УЛУЧШЕННЫЙ парсинг чека через DeepSeek
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
            max_tokens: 4000,
            messages: [{
                role: 'system',
                content: `Ты — экспертный парсер кассовых чеков. Твоя задача — извлечь ВСЕ товары из чека.

Вот пример правильного формата чека, который нужно распарсить:
"""
132198    ШТ. БАТОН НАРЕЗКА 300Г    39.90    *1=39.90
186969    ШТ. ГЕРКУЛЕС ПАССИМ М/У 80    119.96    *1=119.96
40766    ШТ. ПАКЕТ МАЙКА БЫСТРОНОМ    9.99    *2=19.98
54017    КГ СВИНИНА ОКОРОК Б/К ОХЛ    289.90   *1.512=438.33
"""

Каждая строка товара имеет формат:
[КОД] [ЕД.ИЗМ] [НАЗВАНИЕ ТОВАРА] [ЦЕНА] *[КОЛИЧЕСТВО]=[СУММА]

Правила:
1. Название товара может содержать буквы, цифры, пробелы, точки, дефисы
2. Единица измерения: ШТ, КГ, Л, УП и т.д.
3. Цена и количество могут быть с десятичной точкой или запятой
4. Количество может быть дробным (например 1.512)
5. Игнорируй строки с: ИТОГО, ВСЕГО, СУММА, КАССИР, СПАСИБО, БОНУС, НДС, СКИДКА, ТЕЛ, САЙТ, ФН, ФД

Верни ТОЛЬКО JSON в этом формате:
{
  "store": "название магазина",
  "date": "DD.MM.YYYY",
  "time": "HH:MM",
  "total": 0,
  "items": [
    {
      "name": "название товара",
      "unit": "ШТ",
      "price": 0,
      "quantity": 0,
      "total": 0
    }
  ]
}

Если товаров нет, верни пустой массив items.`
            }, {
                role: 'user',
                content: `Распарси этот чек и верни JSON. ВНИМАНИЕ! Извлеки ВСЕ товары из чека, не пропускай ни одной строки с товаром.\n\n${text}`
            }]
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        console.error('❌ DeepSeek ошибка:', data);
        throw new Error(data.error?.message || 'Ошибка DeepSeek API');
    }
    
    const content = data.choices[0].message.content;
    console.log('📝 DeepSeek ответ:', content);
    
    // Извлекаем JSON из ответа
    let jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
    
    // Выводим первые 5 товаров для проверки
    parsed.items.slice(0, 5).forEach((item, i) => {
        console.log(`   ${i+1}. ${item.name} — ${item.price} x ${item.quantity} = ${item.total}`);
    });
    
    return parsed;
}

/**
 * 3. Резервный regex-парсер (для вашего формата чека)
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
    
    // Магазин
    const storeMatch = text.match(/"([А-ЯЁ][А-ЯЁ\s]+)"/);
    if (storeMatch) result.store = storeMatch[1];
    else {
        const storeMatch2 = text.match(/МЕСТО РАСЧЕТОВ\s+МАГАЗИН\s+"([^"]+)"/i);
        if (storeMatch2) result.store = storeMatch2[1];
    }
    
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
    
    // ТОВАРЫ - улучшенный паттерн для вашего формата
    const lines = text.split('\n');
    const items = [];
    
    // Паттерн для формата: 132198    ШТ. БАТОН НАРЕЗКА 300Г    39.90    *1=39.90
    const itemPattern = /(\d+)\s+([А-ЯЁ]{2,4}\.?)\s+([А-ЯЁа-яё0-9\s\/\-\.\(\)\[\]]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
    
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
            let name = match[3].trim();
            const price = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(match[5].replace(',', '.'));
            const total = parseFloat(match[6].replace(/\s/g, '').replace(',', '.'));
            
            // Очищаем название от мусора
            name = name.replace(/^\d+\s+/, '');
            name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
            name = name.replace(/\[[^\]]+\]/, '');
            name = name.trim();
            
            // Фильтруем служебные строки
            const exclude = ['ИТОГО', 'ВСЕГО', 'СУММА', 'КАССА', 'СМЕНА', 'ФН', 'ККТ', 'СПАСИБО', 'БОНУС'];
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
                    unit: match[2],
                    price: price,
                    quantity: quantity,
                    total: total
                });
                console.log(`📦 Найден товар: ${name} — ${price} x ${quantity} = ${total}`);
            }
        }
    }
    
    result.items = items;
    
    if (result.items.length === 0 && result.total > 0) {
        result.items = [{
            name: 'Покупка',
            unit: 'ШТ',
            price: result.total,
            quantity: 1,
            total: result.total
        }];
    }
    
    console.log(`📦 Fallback: ${result.items.length} товаров, сумма: ${result.total} ₽`);
    
    return result;
}

/**
 * 4. Главная функция распознавания
 */
async function recognizeReceipt(imageFile) {
    showToast('🔍 Распознавание чека...', 'info');
    
    try {
        const rawText = await recognizeWithGoogleVision(imageFile);
        
        if (!rawText || rawText.length < 10) {
            throw new Error('Не удалось распознать текст на чеке');
        }
        
        showToast('🧠 DeepSeek AI анализирует...', 'info');
        
        let parsed;
        try {
            parsed = await parseWithDeepSeek(rawText);
        } catch (deepseekError) {
            console.warn('DeepSeek ошибка:', deepseekError);
            parsed = parseReceiptTextFallback(rawText);
            showToast('⚠️ Использую локальный парсер', 'warning');
        }
        
        if (parsed.items.length > 0) {
            showToast(`✅ Распознано ${parsed.items.length} товаров на сумму ${formatMoney(parsed.total)}`, 'success');
            return parsed;
        } else if (parsed.total > 0) {
            showToast(`⚠️ Распознана только сумма: ${formatMoney(parsed.total)}`, 'warning');
            return parsed;
        } else {
            showToast('❌ Не удалось распознать чек', 'error');
            return null;
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast(`❌ ${error.message}`, 'error');
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
    
    const recognized = await recognizeReceipt(imageFile);
    
    if (!recognized) {
        if (confirm('Не удалось распознать чек. Добавить вручную?')) {
            addNewReceipt();
        }
        return null;
    }
    
    const newReceipt = {
        id: generateId(),
        store: recognized.store || 'ГРАНДТОРГ',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: 'Продукты',
        total: recognized.total,
        items: recognized.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.total
        })),
        notes: `🤖 Распознано через DeepSeek AI\n🏪 ${recognized.store || 'ГРАНДТОРГ'}\n📦 ${recognized.items.length} товаров\n💰 Сумма: ${formatMoney(recognized.total)}`
    };
    
    return newReceipt;
}

async function initOCR() {
    console.log('✅ OCR готов (Google Vision + DeepSeek AI)');
    return true;
}

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `${icon} ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
