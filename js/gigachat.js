// ==================== GigaChat API ====================

// ВАШИ ДАННЫЕ
const CLIENT_ID = '019d2fca-c47e-7b20-bcd2-7c33d666cd4b';
const CLIENT_SECRET = 'MDE5ZDJmY2EtYzQ3ZS03YjIwLWJjZDItN2MzM2Q2NjZjZDRiOjQzYmNhNTkyLWYwZDMtNDVmYi05Mjg1LWE0ZTMyMWUzODEzOQ==';

let GIGACHAT_TOKEN = null;
let TOKEN_EXPIRY = null;

/**
 * Получение токена доступа
 */
async function getGigaChatToken() {
    console.log('🔑 Получаем токен GigaChat...');
    
    // Для авторизации используем Basic Auth с client_id:client_secret
    const authString = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    
    try {
        const response = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'RqUID': crypto.randomUUID(),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'scope=GIGACHAT_API_PERS'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Ошибка получения токена:', errorText);
            throw new Error(`Ошибка получения токена: ${response.status}`);
        }
        
        const data = await response.json();
        GIGACHAT_TOKEN = data.access_token;
        TOKEN_EXPIRY = Date.now() + (data.expires_in * 1000);
        
        console.log('✅ Токен GigaChat получен, expires_in:', data.expires_in);
        return GIGACHAT_TOKEN;
        
    } catch (error) {
        console.error('❌ Ошибка получения токена:', error);
        throw error;
    }
}

/**
 * Получить актуальный токен
 */
async function ensureToken() {
    if (!GIGACHAT_TOKEN || Date.now() >= TOKEN_EXPIRY) {
        await getGigaChatToken();
    }
    return GIGACHAT_TOKEN;
}

/**
 * Парсинг чека через GigaChat
 */
async function parseWithGigaChat(text) {
    console.log('🤖 GigaChat анализирует чек...');
    
    const token = await ensureToken();
    
    const response = await fetch('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'GigaChat',
            temperature: 0.1,
            max_tokens: 2000,
            messages: [{
                role: 'user',
                content: `Ты парсер кассовых чеков. Извлеки данные из этого чека и верни ТОЛЬКО JSON.

Формат ответа:
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

Правила:
1. Магазин ищи в кавычках "ГРАНДТОРГ" или "БЫСТРОНОМ"
2. Дата: формат DD.MM.YYYY
3. Сумма: строка "ИТОГО К ОПЛАТЕ"
4. Товары: каждая строка имеет формат: [код] [ед.изм] [название] [цена] *[кол-во]=[сумма]
5. Название товара очисти от кода и лишних символов

Чек:
${text}`
            }]
        })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        console.error('❌ GigaChat ошибка:', data);
        throw new Error(data.error?.message || data.detail || 'Ошибка GigaChat API');
    }
    
    const content = data.choices[0].message.content;
    console.log('📝 GigaChat ответ:', content.substring(0, 300) + '...');
    
    // Извлекаем JSON из ответа
    let jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    
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
    console.log(`💰 Сумма: ${parsed.total} ₽`);
    console.log(`📦 Товаров: ${parsed.items.length}`);
    
    return parsed;
}
