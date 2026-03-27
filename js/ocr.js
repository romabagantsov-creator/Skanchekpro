// ==================== УЛУЧШЕННЫЙ ПАРСЕР ====================

/**
 * Промпт для Claude - точно под формат БЫСТРОНОМ/ГРАНДТОРГ
 */
function buildClaudePrompt(rawText) {
    return `Ты парсер кассовых чеков российских магазинов. Извлеки данные и верни ТОЛЬКО валидный JSON без markdown.

Текст чека:
"""
${rawText}
"""

Правила извлечения:

1. МАГАЗИН - ищи в таком порядке:
   - В строке "МЕСТО РАСЧЕТОВ МАГАЗИН "ИМЯ""
   - В шапке чека в кавычках: ООО "ИМЯ"
   - В строке "САЙТ" или "ТЕЛ" рядом с названием

2. ДАТА - формат DD.MM.YY или DD.MM.YYYY (2-значный год → добавь "20" спереди)

3. ИТОГО - строка "ИТОГО К ОПЛАТЕ" или просто "ИТОГО" → последнее число

4. ТОВАРЫ - каждая строка формата:
   [артикул] [ед.изм] [НАЗВАНИЕ] [цена] *[кол-во]=[сумма]
   Примеры:
   "132198 ШТ. БАТОН НАРЕЗКА 300Г 39.90 *1=39.90"
   "54017 КГ СВИНИНА ОКОРОК Б/К ОХЛ 289.90 *1.512=438.33"
   "205830 ШТ.[М+14017] МОЛОКО ТОЛМАЧЕ 104.98 *1=104.98"
   
   Из каждой строки возьми:
   - name: только название товара (без артикула, без [М+...], очищенное)
   - unit: ШТ или КГ или Л
   - price: цена за единицу (число перед звёздочкой)
   - quantity: количество (число после звёздочки, до знака =)
   - total: итог по позиции (число после знака =)

5. ИСКЛЮЧИ строки: ИТОГО, КАССИР, СПАСИБО, БОНУС, СКИДКА, НДС, СУММА, БЕЗНАЛИЧНЫМИ, ТЕЛ, САЙТ, ФН, ФД, ФП, СМЕНА, КАССА, КАССОВЫЙ

Верни JSON:
{
  "store": "название магазина",
  "date": "DD.MM.YYYY",
  "time": "HH:MM",
  "total": 1765.31,
  "items": [
    {
      "name": "БАТОН НАРЕЗКА 300Г",
      "unit": "ШТ",
      "price": 39.90,
      "quantity": 1,
      "total": 39.90
    }
  ]
}`;
}

/**
 * Улучшенный парсер через Claude
 */
async function parseReceiptWithClaude(rawText) {
    console.log('🤖 Claude анализирует чек...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            messages: [{ role: 'user', content: buildClaudePrompt(rawText) }]
        })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Ошибка Claude API');

    const rawJson = data.content
        .map(b => b.type === 'text' ? b.text : '')
        .join('')
        .replace(/```json|```/g, '')
        .trim();

    const parsed = JSON.parse(rawJson);

    // Санитизация
    parsed.total = Number(parsed.total) || 0;
    parsed.items = (parsed.items || []).map(item => ({
        name:     String(item.name || '').trim(),
        unit:     String(item.unit || 'ШТ'),
        price:    Number(item.price)    || 0,
        quantity: Number(item.quantity) || 1,
        total:    Number(item.total)    || 0
    })).filter(i => i.price > 0 && i.name.length > 1);

    console.log(`✅ Магазин: ${parsed.store}`);
    console.log(`📅 Дата: ${parsed.date}`);
    console.log(`💰 Итого: ${parsed.total}`);
    console.log(`📦 Товаров: ${parsed.items.length}`);

    return parsed;
}

/**
 * Резервный regex-парсер (если Claude недоступен)
 * Оптимизирован под формат БЫСТРОНОМ / ГРАНДТОРГ
 */
function parseReceiptTextFallback(text) {
    const result = { store: null, date: null, time: null, total: 0, items: [] };
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // --- Магазин ---
    // "МЕСТО РАСЧЕТОВ МАГАЗИН "БЫСТРОНОМ""
    const storePlace = text.match(/МЕСТО\s+РАСЧЕТОВ\s+МАГАЗИН\s+"([^"]+)"/i);
    if (storePlace) {
        result.store = storePlace[1].trim();
    } else {
        // ООО "ГРАНДТОРГ"
        const storeOOO = text.match(/ООО\s+"([^"]+)"/i);
        if (storeOOO) result.store = storeOOO[1].trim();
    }

    // --- Дата и время ---
    // Формат: 20.03.26 18:55
    const dtMatch = text.match(/(\d{2})\.(\d{2})\.(\d{2,4})\s+(\d{2}):(\d{2})/);
    if (dtMatch) {
        const y = dtMatch[3].length === 2 ? '20' + dtMatch[3] : dtMatch[3];
        result.date = `${dtMatch[1]}.${dtMatch[2]}.${y}`;
        result.time = `${dtMatch[4]}:${dtMatch[5]}`;
    }

    // --- Итого ---
    // "ИТОГО К ОПЛАТЕ =1765.31"
    const totalMatch = text.match(/ИТОГО\s*К\s*ОПЛАТЕ\s*[=]?\s*(\d+[.,]\d{2})/i)
                    || text.match(/ИТОГО\s*[=]\s*(\d+[.,]\d{2})/i);
    if (totalMatch) result.total = parseFloat(totalMatch[1].replace(',', '.'));

    // --- Товары ---
    // Паттерн: 132198 ШТ. БАТОН НАРЕЗКА 300Г   39.90  *1=39.90
    // Паттерн: 54017 КГ СВИНИНА ОКОРОК Б/К ОХЛ  289.90 *1.512=438.33
    // Паттерн: 205830 ШТ.[М+14017] МОЛОКО ТОЛМАЧЕ 104.98 *1=104.98
    const itemRe = /^\d+\s+(ШТ|КГ|Л)[\.\s]*(?:\[[^\]]*\])?\s*(.+?)\s+(\d+[.,]\d{2})\s*\*([\d.,]+)=(\d+[.,]\d{2})/i;

    const SKIP = ['ИТОГО','ВСЕГО','СУММА','КАССИР','СПАСИБО','БОНУС','СКИДКА','НДС','БЕЗНАЛИЧНЫМИ','ТЕЛ','САЙТ','ФН','ФД','ФП','СМЕНА','КАССА','КАССОВЫЙ','ПРИХОД'];

    for (const line of lines) {
        const m = line.match(itemRe);
        if (!m) continue;

        const unit  = m[1].toUpperCase();
        let name    = m[2].replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
        const price = parseFloat(m[3].replace(',', '.'));
        const qty   = parseFloat(m[4].replace(',', '.'));
        const total = parseFloat(m[5].replace(',', '.'));

        if (SKIP.some(w => name.toUpperCase().startsWith(w))) continue;
        if (name.length < 2 || price <= 0 || price > 50000) continue;

        result.items.push({ name, unit, price, quantity: qty, total });
    }

    // Если ничего не распознали — создаём общую запись
    if (result.items.length === 0 && result.total > 0) {
        result.items = [{ name: 'Покупка', unit: 'ШТ', price: result.total, quantity: 1, total: result.total }];
    }

    console.log(`📦 Fallback: ${result.items.length} товаров, ${result.total} ₽, ${result.store}`);
    return result;
}

/**
 * Заполняем форму редактирования чека данными из OCR
 */
function fillReceiptForm(parsed) {
    // Магазин
    const storeInput = document.querySelector('input[placeholder="Например: Пятёрочка"]');
    if (storeInput && parsed.store) storeInput.value = parsed.store;

    // Дата (формат input[type=date] = YYYY-MM-DD)
    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput && parsed.date) {
        const [d, m, y] = parsed.date.split('.');
        dateInput.value = `${y}-${m}-${d}`;
    }

    // Категория — если все товары продукты, ставим "Продукты"
    const categorySelect = document.querySelector('select');
    if (categorySelect) {
        const options = Array.from(categorySelect.options);
        const продукты = options.find(o => o.text.includes('Продукт'));
        if (продукты) categorySelect.value = продукты.value;
    }

    // Товары — очищаем и добавляем новые
    // (логика зависит от твоего фреймворка — адаптируй под свой код)
    console.log('📋 Данные для формы:', parsed);
    // Пример данных которые получишь:
    // parsed.store   → "БЫСТРОНОМ"
    // parsed.date    → "20.03.2026"
    // parsed.total   → 1765.31
    // parsed.items   → [{name, unit, price, quantity, total}, ...]
}

/**
 * Главная функция — распознать и заполнить
 */
async function recognizeAndFill(imageFile) {
    showToast('🔍 Читаем чек...', 'info');

    let rawText;
    try {
        rawText = await recognizeWithGoogleVision(imageFile);
    } catch (err) {
        showToast(`❌ Ошибка Vision: ${err.message}`, 'error');
        return null;
    }

    showToast('🤖 Анализируем данные...', 'info');

    let parsed;
    try {
        parsed = await parseReceiptWithClaude(rawText);
    } catch (err) {
        console.warn('Claude недоступен, используем fallback:', err.message);
        parsed = parseReceiptTextFallback(rawText);
    }

    fillReceiptForm(parsed);

    showToast(
        `✅ ${parsed.store || 'Магазин'} · ${parsed.items.length} товаров · ${parsed.total} ₽`,
        'success'
    );

    return parsed;
}

async function initOCR() {
    console.log('✅ OCR готов (Vision + Claude + Fallback)');
    return true;
}
