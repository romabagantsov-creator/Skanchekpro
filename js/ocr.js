// ==================== GOOGLE VISION + CLAUDE OCR ====================

const GOOGLE_VISION_API_KEY = 'AIzaSyClA3O9whFxwktBZRs1XfEfl3zEyARuqE8';

/**
 * Шаг 1: Распознаём сырой текст через Google Vision
 */
async function recognizeWithGoogleVision(imageFile) {
    const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.onerror = () => rej(new Error('Ошибка чтения файла'));
        reader.readAsDataURL(imageFile);
    });

    console.log('📤 Отправка в Vision API...', (imageFile.size / 1024).toFixed(1), 'КБ');

    const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    image: { content: base64 },
                    features: [{ type: 'TEXT_DETECTION' }]
                }]
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Ошибка Google Vision API');
    }

    const text = data.responses[0]?.fullTextAnnotation?.text || '';
    console.log('✅ Vision распознал текст, длина:', text.length);
    console.log('📝 Превью:', text.substring(0, 300));

    if (!text || text.length < 10) {
        throw new Error('Не удалось распознать текст на изображении');
    }

    return text;
}

/**
 * Шаг 2: Структурируем текст через Claude API
 */
async function parseReceiptWithClaude(rawText) {
    console.log('🤖 Отправка текста в Claude для парсинга...');

    const prompt = `Ты — парсер кассовых чеков. Из текста ниже извлеки данные и верни ТОЛЬКО валидный JSON без пояснений и без markdown-блоков.

Текст чека:
"""
${rawText}
"""

Верни JSON строго в таком формате:
{
  "store": "название магазина или null",
  "date": "дата в формате DD.MM.YYYY или null",
  "time": "время в формате HH:MM или null",
  "total": число (итоговая сумма, 0 если не найдена),
  "items": [
    {
      "name": "название товара (очищенное, без артикулов и кодов)",
      "quantity": число (количество или вес),
      "unit": "ШТ или КГ или Л",
      "price": число (цена за единицу),
      "total": число (сумма по позиции)
    }
  ]
}

Правила:
- Убери из названий товаров: артикулы, коды товаров (числа в начале), скобки с кодами типа [М+140]
- Не включай в items служебные строки: ИТОГО, ВСЕГО, СУММА, КАССИР, СПАСИБО, БОНУСЫ и т.д.
- total в items должен равняться price * quantity
- Если quantity = 1 и единица не указана явно — ставь "ШТ"
- store — ищи в кавычках или в шапке чека
- Верни ТОЛЬКО JSON, без любого другого текста`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || 'Ошибка Claude API');
    }

    const rawJson = data.content
        .map(block => block.type === 'text' ? block.text : '')
        .join('')
        .replace(/```json|```/g, '')
        .trim();

    console.log('🤖 Claude вернул:', rawJson.substring(0, 200));

    const parsed = JSON.parse(rawJson);

    // Санитизация: убеждаемся что числа — числа
    parsed.total = Number(parsed.total) || 0;
    parsed.items = (parsed.items || []).map(item => ({
        name: String(item.name || 'Товар').trim(),
        quantity: Number(item.quantity) || 1,
        unit: String(item.unit || 'ШТ'),
        price: Number(item.price) || 0,
        total: Number(item.total) || 0
    })).filter(item => item.price > 0 && item.name.length > 1);

    console.log(`📦 Товаров: ${parsed.items.length}, Сумма: ${parsed.total}`);
    return parsed;
}

/**
 * Главная функция распознавания чека
 */
async function recognizeReceipt(imageFile) {
    showToast('🔍 Распознавание текста...', 'info');

    let rawText;
    try {
        rawText = await recognizeWithGoogleVision(imageFile);
    } catch (err) {
        console.error('Vision ошибка:', err);
        showToast(`❌ Ошибка Vision: ${err.message}`, 'error');
        return null;
    }

    showToast('🤖 Claude анализирует чек...', 'info');

    let parsed;
    try {
        parsed = await parseReceiptWithClaude(rawText);
    } catch (err) {
        console.error('Claude ошибка:', err);
        showToast('⚠️ Ошибка Claude, пробуем резервный парсер...', 'warning');
        // Резерв — старый regex-парсер
        parsed = parseReceiptTextFallback(rawText);
    }

    if (parsed.items.length > 0 || parsed.total > 0) {
        showToast(
            `✅ Распознано ${parsed.items.length} товаров на ${formatMoney(parsed.total)}`,
            'success'
        );
        return parsed;
    } else {
        showToast('⚠️ Чек распознан, но данные не найдены', 'warning');
        return parsed;
    }
}

/**
 * Создание объекта чека из изображения
 */
async function createReceiptFromImage(imageFile) {
    if (!imageFile?.type.startsWith('image/')) {
        showToast('Пожалуйста, выберите изображение', 'error');
        return null;
    }
    if (imageFile.size > 10 * 1024 * 1024) {
        showToast('Файл слишком большой (макс 10 МБ)', 'error');
        return null;
    }

    const recognized = await recognizeReceipt(imageFile);

    if (!recognized) {
        if (confirm('Не удалось распознать чек. Добавить вручную?')) addNewReceipt();
        return null;
    }

    return {
        id: generateId(),
        store: recognized.store || 'Магазин',
        date: recognized.date || new Date().toLocaleDateString('ru-RU'),
        time: recognized.time || null,
        category: 'Продукты',
        total: recognized.total,
        items: recognized.items,
        notes: `📸 Распознано через Vision + Claude\n🛍️ Товаров: ${recognized.items.length}`
    };
}

/**
 * Резервный regex-парсер (работает без Claude, для оффлайн/ошибок)
 */
function parseReceiptTextFallback(text) {
    const result = { store: null, date: null, time: null, total: 0, items: [] };

    const storeMatch = text.match(/"([А-ЯЁ][А-ЯЁ\s\-]+)"/);
    if (storeMatch) result.store = storeMatch[1].trim();

    const dtMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2,4})\s+(\d{2}):(\d{2})/);
    if (dtMatch) {
        const y = dtMatch[3].length === 2 ? '20' + dtMatch[3] : dtMatch[3];
        result.date = `${dtMatch[1]}.${dtMatch[2]}.${y}`;
        result.time = `${dtMatch[4]}:${dtMatch[5]}`;
    }

    const totalMatch = text.match(/ИТОГО\s*[=:]?\s*(\d+[.,]\d{2})/i)
        || text.match(/БЕЗНАЛИЧНЫМИ\s*[=:]?\s*(\d+[.,]\d{2})/i);
    if (totalMatch) result.total = parseFloat(totalMatch[1].replace(',', '.'));

    // Паттерн: 132198 ШТ. БАТОН НАРЕЗКА 300Г 39.90 *1=39.90
    const lines = text.split('\n');
    for (const line of lines) {
        const m = line.match(
            /\d+\s+([А-ЯЁ]{2,3}\.?)\s+(.+?)\s+(\d+[.,]\d{2})\s+\*([\d.]+)=(\d+[.,]\d{2})/
        );
        if (!m) continue;
        const name = m[2].replace(/\[[^\]]+\]/g, '').trim();
        const price = parseFloat(m[3].replace(',', '.'));
        const qty = parseFloat(m[4]);
        const total = parseFloat(m[5].replace(',', '.'));
        const skip = ['ИТОГО','КАССИР','СПАСИБО','БОНУС','СМЕНА','ФН','ККТ'];
        if (skip.some(w => name.toUpperCase().includes(w))) continue;
        if (name.length > 2 && price > 0) {
            result.items.push({ name, quantity: qty, unit: m[1].replace('.',''), price, total });
        }
    }

    if (result.items.length === 0 && result.total > 0) {
        result.items = [{ name: 'Покупка', quantity: 1, unit: 'ШТ', price: result.total, total: result.total }];
    }

    return result;
}

async function initOCR() {
    console.log('✅ Vision + Claude OCR готов');
    return true;
}
