// ==================== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ====================
window.appState = {
    receipts: [],
    selectedId: null
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    // Загружаем настройки (ВАЖНО: сначала загружаем настройки!)
    if (typeof loadCustomization === 'function') {
        loadCustomization();
    }
    
    // Загружаем данные
    const savedData = loadFromLocalStorage();
    
    if (savedData && savedData.length > 0) {
        window.appState.receipts = savedData;
        window.appState.selectedId = savedData[0]?.id || null;
    } else {
        window.appState.receipts = getDemoReceipts();
        window.appState.selectedId = window.appState.receipts[0]?.id || null;
        saveToLocalStorage(window.appState.receipts);
    }
    
    // Отрисовываем интерфейс
    renderAll(window.appState.receipts, window.appState.selectedId);
    
    // Инициализируем загрузку фото
    if (typeof initImageUpload === 'function') {
        initImageUpload();
    }
    
    // Навешиваем обработчики
    const manualAddBtn = document.getElementById('manualAddBtn');
    if (manualAddBtn) manualAddBtn.addEventListener('click', addNewReceipt);
    
    const addDemoBtn = document.getElementById('addDemoBtn');
    if (addDemoBtn) addDemoBtn.addEventListener('click', addDemoReceipts);
    
    const exportHTMLBtn = document.getElementById('exportHTMLBtn');
    if (exportHTMLBtn) exportHTMLBtn.addEventListener('click', exportToHTML);
    
    const exportCSVBtn = document.getElementById('exportCSVBtn');
    if (exportCSVBtn) exportCSVBtn.addEventListener('click', exportToCSV);
    
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllReceipts);
    
    // Кнопка настроек
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn && typeof openSettings === 'function') {
        settingsBtn.addEventListener('click', openSettings);
    }
    
    // Кнопка ассистента
    const assistantBtn = document.getElementById('assistantBtn');
    if (assistantBtn && typeof openAssistant === 'function') {
        assistantBtn.addEventListener('click', openAssistant);
    }
});

// Делаем функции глобальными
window.selectReceipt = selectReceipt;
window.deleteReceipt = deleteReceipt;
window.editReceipt = editReceipt;
window.saveReceiptEdit = saveReceiptEdit;
window.closeModal = closeModal;
window.addItemRow = addItemRow;
window.removeItemRow = removeItemRow;
window.openSettings = openSettings;
window.openAssistant = openAssistant;
window.sendAssistantMessage = sendAssistantMessage;
window.closeAssistant = closeAssistant;
