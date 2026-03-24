// ==================== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ====================
window.appState = {
    receipts: [],
    selectedId: null
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
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
    
    // Настройки и ассистент (если кнопки есть)
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (typeof openSettings === 'function') {
                openSettings();
            } else {
                showToast('⚙️ Настройки будут доступны в следующем обновлении', 'info');
            }
        });
    }
    
    const assistantBtn = document.getElementById('assistantBtn');
    if (assistantBtn) {
        assistantBtn.addEventListener('click', () => {
            if (typeof openAssistant === 'function') {
                openAssistant();
            } else {
                showToast('🤖 ИИ-ассистент будет доступен в следующем обновлении', 'info');
            }
        });
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
