// ==================== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ====================
window.appState = {
    receipts: [],
    selectedId: null
};

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', () => {
    // Загружаем данные
    const savedData = loadFromLocalStorage();
    document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
    document.getElementById('assistantBtn')?.addEventListener('click', openAssistant);
    
    if (savedData && savedData.length > 0) {
        window.appState.receipts = savedData;
        window.appState.selectedId = savedData[0]?.id || null;
    } else {
        // Добавляем демо-данные при первом запуске
        window.appState.receipts = getDemoReceipts();
        window.appState.selectedId = window.appState.receipts[0]?.id || null;
        saveToLocalStorage(window.appState.receipts);
    }
    
    // Отрисовываем интерфейс
    renderAll(window.appState.receipts, window.appState.selectedId);
    renderAdvancedAnalytics(window.appState.receipts);
    
    // Инициализируем загрузку фото
    initImageUpload();
    
    // Навешиваем обработчики
    document.getElementById('manualAddBtn')?.addEventListener('click', addNewReceipt);
    document.getElementById('addDemoBtn')?.addEventListener('click', addDemoReceipts);
    document.getElementById('exportHTMLBtn')?.addEventListener('click', exportToHTML);
    document.getElementById('exportCSVBtn')?.addEventListener('click', exportToCSV);
    document.getElementById('clearAllBtn')?.addEventListener('click', clearAllReceipts);
});

// Делаем функции глобальными для доступа из HTML
window.selectReceipt = selectReceipt;
window.deleteReceipt = deleteReceipt;
window.editReceipt = editReceipt;
window.saveReceiptEdit = saveReceiptEdit;
window.closeModal = closeModal;
window.addItemRow = addItemRow;
window.removeItemRow = removeItemRow;
