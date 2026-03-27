// ==================== OCR С GOOGLE VISION + GigaChat ====================

const GOOGLE_VISION_API_KEY = 'AIzaSyClA3O9whFxwktBZRs1XfEfl3zEyARuqE8';

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
            
            resolve(fullText);
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * 2. Резервный парсер (если GigaChat недоступен)
 */
function parseReceiptTextFallback(text) {
    console.log('🔄 Использую резервный парсер...');
    
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
    const itemPattern = /(\d+)\s+([А-ЯЁ]{2,4}\.?)\s+([А-ЯЁа-яё0-9\s\/\-\.\(\)]+?)\s+(\d+[\s,.]*\d*)\s+\*([\d.]+)=(\d+[\s,.]*\d*)/i;
    
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match) {
            let name = match[3].trim();
            const price = parseFloat(match[4].replace(/\s/g, '').replace(',', '.'));
            const quantity = parseFloat(match[5].replace(',', '.'));
            const total = parseFloat(match[6].replace(/\s/g, '').replace(',', '.'));
            
            name = name.replace(/^\d+\s+/, '');
            name = name.replace(/^[А-ЯЁ]{2,4}\.?/, '');
            name = name.trim();
            
            if (name.length > 2 && price > 0) {
                items.push({ name, unit: match[2], price, quantity, total });
            }
        }
    }
    
    result.items = items;
    
    if (result.items.length === 0 && result.total > 0) {
        result.items = [{ name: 'Покупка', unit: 'ШТ', price: result.total, quantity: 1, total: result.total }];
    }
    
    return result;
}

/**
 * 3. Главная функция распознавания
 */
async function recognizeReceipt(imageFile) {
    showToast('🔍 Распознавание чека...', 'info');
    
    try {
        const rawText = await recognizeWithGoogleVision(imageFile);
        
        if (!rawText || rawText.length < 10) {
            throw new Error('Не удалось распознать текст');
        }
        
        showToast('🧠 GigaChat анализирует...', 'info');
        
        let parsed;
        try {
            parsed = await parseWithGigaChat(rawText);
            showToast(`✅ GigaChat распознал ${parsed.items.length} товаров`, 'success');
        } catch (gigaError) {
            console.warn('GigaChat ошибка:', gigaError);
            parsed = parseReceiptTextFallback(rawText);
            showToast('⚠️ Использую локальный парсер', 'warning');
        }
        
        if (parsed.items.length > 0 || parsed.total > 0) {
            return parsed;
        }
        
        return null;
        
    } catch (error) {
        console.error('Ошибка:', error);
        showToast(`❌ ${error.message}`, 'error');
        return null;
    }
}

/**
 * 4. Создание чека из изображения
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
        store: recognized.store || 'Магазин',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        category: 'Продукты',
        total: recognized.total,
        items: recognized.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.total
        })),
        notes: `🤖 Распознано через GigaChat\n🏪 ${recognized.store || 'Магазин'}\n📦 ${recognized.items.length} товаров`
    };
    
    return newReceipt;
}

async function initOCR() {
    console.log('✅ OCR готов (Google Vision + GigaChat)');
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
