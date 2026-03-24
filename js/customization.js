// ==================== СИСТЕМА КАСТОМИЗАЦИИ ====================

const CUSTOMIZATION = {
    theme: 'dark',
    fontSize: 'medium',
    compactMode: false,
    showCharts: true,
    defaultCategoryColors: {
        'Продукты': '#4ade80',
        'Рестораны': '#f472b6',
        'Транспорт': '#8b5cf6',
        'Аптека': '#f59e0b',
        'Электроника': '#06b6d4',
        'Одежда': '#ef4444',
        'Развлечения': '#d946ef',
        'Дом': '#14b8a6',
        'Прочее': '#6b7280'
    }
};

/**
 * Загрузка настроек из localStorage
 */
function loadCustomization() {
    const saved = localStorage.getItem('checksan_customization');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(CUSTOMIZATION, parsed);
        } catch(e) {
            console.warn('Ошибка загрузки настроек', e);
        }
    }
    applyCustomization();
}

/**
 * Применение настроек к странице
 */
function applyCustomization() {
    // Тема
    document.body.setAttribute('data-theme', CUSTOMIZATION.theme);
    console.log('Применена тема:', CUSTOMIZATION.theme); // для отладки

    // Размер шрифта
    const fontSizeMap = {
        small: '14px',
        medium: '16px',
        large: '18px',
        xlarge: '20px'
    };
    document.body.style.fontSize = fontSizeMap[CUSTOMIZATION.fontSize] || '16px';

    // Компактный режим
    if (CUSTOMIZATION.compactMode) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }

    // Сохраняем настройки в localStorage
    localStorage.setItem('checksan_customization', JSON.stringify(CUSTOMIZATION));
}

/**
 * Открыть панель настроек
 */
function openSettings() {
    // Удаляем существующее модальное окно, если есть
    const existingModal = document.querySelector('.modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">⚙️ Настройки</div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">🎨 Тема оформления</label>
                    <select id="themeSelect" class="form-select">
                        <option value="dark" ${CUSTOMIZATION.theme === 'dark' ? 'selected' : ''}>🌙 Тёмная</option>
                        <option value="light" ${CUSTOMIZATION.theme === 'light' ? 'selected' : ''}>☀️ Светлая</option>
                        <option value="forest" ${CUSTOMIZATION.theme === 'forest' ? 'selected' : ''}>🌲 Лесная</option>
                        <option value="ocean" ${CUSTOMIZATION.theme === 'ocean' ? 'selected' : ''}>🌊 Океанская</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">📏 Размер шрифта</label>
                    <select id="fontSizeSelect" class="form-select">
                        <option value="small" ${CUSTOMIZATION.fontSize === 'small' ? 'selected' : ''}>Маленький</option>
                        <option value="medium" ${CUSTOMIZATION.fontSize === 'medium' ? 'selected' : ''}>Средний</option>
                        <option value="large" ${CUSTOMIZATION.fontSize === 'large' ? 'selected' : ''}>Большой</option>
                        <option value="xlarge" ${CUSTOMIZATION.fontSize === 'xlarge' ? 'selected' : ''}>Очень большой</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">📦 Компактный режим</label>
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="compactMode" ${CUSTOMIZATION.compactMode ? 'checked' : ''}>
                        Уменьшить отступы и элементы
                    </label>
                </div>
                
                <div class="form-group">
                    <label class="form-label">🎨 Цвета категорий</label>
                    <div id="colorSettings" style="display: flex; flex-direction: column; gap: 8px;">
                        ${Object.entries(CUSTOMIZATION.defaultCategoryColors).map(([cat, color]) => `
                            <div class="color-setting" style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: var(--bg-tertiary); border-radius: 8px;">
                                <span>${cat}</span>
                                <input type="color" data-category="${cat}" value="${color}" style="width: 50px; height: 30px; border: none; border-radius: 6px; cursor: pointer; background: transparent;">
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" style="width: auto; margin: 0; padding: 0.5rem 1rem;" onclick="closeModal()">Отмена</button>
                <button class="btn btn-primary" style="width: auto; margin: 0; padding: 0.5rem 1rem;" id="saveSettingsBtn">💾 Сохранить</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalRoot').appendChild(modal);
    
    // Добавляем обработчик для кнопки сохранения
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
        saveBtn.onclick = () => saveSettings();
    }
    
    // Добавляем обработчики для цветов
    document.querySelectorAll('input[type="color"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const category = e.target.dataset.category;
            CUSTOMIZATION.defaultCategoryColors[category] = e.target.value;
        });
    });
}

/**
 * Сохранение настроек
 */
function saveSettings() {
    const themeSelect = document.getElementById('themeSelect');
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    const compactModeCheck = document.getElementById('compactMode');
    
    if (themeSelect) CUSTOMIZATION.theme = themeSelect.value;
    if (fontSizeSelect) CUSTOMIZATION.fontSize = fontSizeSelect.value;
    if (compactModeCheck) CUSTOMIZATION.compactMode = compactModeCheck.checked;
    
    // Сохраняем цвета категорий (они уже обновлены в CUSTOMIZATION через обработчики)
    
    // Применяем настройки
    applyCustomization();
    
    // Закрываем модальное окно
    closeModal();
    
    // Обновляем график с новыми цветами (если функция существует)
    if (typeof renderChart === 'function' && window.appState) {
        renderChart(window.appState.receipts);
    }
    
    showToast('Настройки сохранены!', 'success');
}
