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
 * Загрузка настроек
 */
function loadCustomization() {
    const saved = localStorage.getItem('checksan_customization');
    if (saved) {
        Object.assign(CUSTOMIZATION, JSON.parse(saved));
    }
    applyCustomization();
}

/**
 * Применение настроек
 */
function applyCustomization() {
    // Тема
    document.body.setAttribute('data-theme', CUSTOMIZATION.theme);
    
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
    
    // Сохраняем
    localStorage.setItem('checksan_customization', JSON.stringify(CUSTOMIZATION));
}

/**
 * Открыть панель настроек
 */
function openSettings() {
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
                    <label class="form-label">📊 Компактный режим</label>
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" id="compactMode" ${CUSTOMIZATION.compactMode ? 'checked' : ''}>
                        Уменьшить отступы и элементы
                    </label>
                </div>
                
                <div class="form-group">
                    <label class="form-label">🎨 Цвета категорий</label>
                    <div id="colorSettings" style="display: flex; flex-direction: column; gap: 8px;">
                        ${Object.entries(CUSTOMIZATION.defaultCategoryColors).map(([cat, color]) => `
                            <div style="display: flex; align-items: center; gap: 8px; justify-content: space-between;">
                                <span>${cat}</span>
                                <input type="color" data-category="${cat}" value="${color}" class="category-color-input" style="width: 50px; height: 30px; border-radius: 8px;">
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                <button class="btn btn-primary" onclick="saveSettings()">Сохранить</button>
            </div>
        </div>
    `;
    
    document.getElementById('modalRoot').appendChild(modal);
    
    // Добавляем обработчики для цветов
    document.querySelectorAll('.category-color-input').forEach(input => {
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
    CUSTOMIZATION.theme = document.getElementById('themeSelect').value;
    CUSTOMIZATION.fontSize = document.getElementById('fontSizeSelect').value;
    CUSTOMIZATION.compactMode = document.getElementById('compactMode').checked;
    
    applyCustomization();
    closeModal();
    
    // Обновляем график с новыми цветами
    renderChart(window.appState.receipts);
    
    showToast('Настройки сохранены!', 'success');
}
