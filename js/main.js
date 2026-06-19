import { state, setCurrentDate, setCurrentWallyDate } from './state.js';
import { showToast, showPage, openModal, closeModal, closeConfigModal, closeInitialCapitalModal, closeWallyModal, closeGainsSummaryModal, closeWallyGainsSummaryModal, closeBankBreachModal, closeLotDetailsModal, closePendingDetailsModal, closeRatingModal, closeUserProfileModal, closeWeeklyAnalysisModal, closeMonthlyAnalysisModal, closeUsdAnalysisModal, openConfirmModal, closeConfirmModal, executeConfirmAction, openConfirmMoveModal, cancelMoveAction, executeMoveAction, toggleFilters, closeOpDetailModal } from './ui.js';
import { clearForm, calculateAll, getRatingIndicator, calculateBankBreaches, renderBankBreachesCards, renderLotDetailsCards, renderPendingDetails, checkInitialLoadComplete, toggleAuthForms } from './utils.js';
import { registerUser, loginUser, logoutUser, setupAuthListener } from './auth.js';
import { loadOperations, saveOperation, editOperation, deleteOperation, renderOperations, handleDragEnd, populateMonthSelector, populateUsdPaymentMethodsFilter } from './operations.js';
import { loadWallyOperations, calculateWallyGainsForPeriod, updateWallySummary, renderWallyForm, updateWallyFormFields, updateWallyCalculations, saveWallyOperation, deleteWallyOperation, renderWallyTables } from './wally.js';
import { loadConfig, saveConfig, renderP2PPlatforms, addOrUpdateP2PPlatform, editP2PPlatform, deleteP2PPlatform, setDefaultP2PPlatform, renderPaymentMethodsConfig, addPaymentMethod, deletePaymentMethod, renderUsdPaymentMethodsConfig, addUsdPaymentMethod, deleteUsdPaymentMethod, updateGoalToggleButtons, renderDailyGoals } from './config.js';
import { loadInitialCapital, displayInitialCapitalSummary, saveInitialCapital, addManagedAccount, deleteManagedAccount } from './capital.js';
import { loadUserRatings, loadUserProfiles, calculateAverageRating, renderRatingsPage, resetStars, submitRating, saveProfileNotes, switchProfileTab } from './ratings.js';
import { getWeeklyOperations, analyzeWeeklyData, renderWeeklyChart, renderWeeklySummary, runMonthlyAnalysis, analyzeMonthlyData, renderMonthlyChart, renderMonthlySummary, drawEmptyChartMessage } from './analysis.js';
import { populateUsdMonthSelector, switchUsdAnalysisTab, renderUsdAnalysis } from './usd-analysis.js';
import { enableAudio, showLotClosedAnimation, getShownLots, addShownLot, calculateLotProfit, setupServiceWorker } from './notifications.js';
import { pasteSpecial, pasteSpecialWally } from './paste.js';

setupAuthListener();
setupServiceWorker();

// Network status indicator
window.addEventListener('online', () => document.getElementById('offline-banner').classList.remove('show'));
window.addEventListener('offline', () => document.getElementById('offline-banner').classList.add('show'));

// === Expose all functions to window for onclick handlers ===

// Auth
window.loginUser = loginUser;
window.registerUser = registerUser;
window.logoutUser = logoutUser;
window.toggleAuthForms = toggleAuthForms;

// Navigation
window.showPage = showPage;
window.toggleFilters = toggleFilters;

// Modal operations
window.openModal = openModal;
window.closeModal = closeModal;
window.saveOperation = saveOperation;
window.editOperation = editOperation;
window.deleteOperation = deleteOperation;
window.calculateAll = calculateAll;
window.clearForm = clearForm;
window.openOperationDetailModal = (opId) => {
    const op = state.operations.find(o => o.id === opId);
    if (!op) return;
    import('./operations.js').then(m => m.renderOperationDetail(op));
    document.getElementById('opDetailModal').classList.add('show');
};

// Config
window.openConfigModal = () => {
    document.getElementById('configModal').classList.add('show');
    document.getElementById('goalVes').value = state.userConfig.profitGoals.ves;
    document.getElementById('goalCrypto').value = state.userConfig.profitGoals.crypto;
    document.getElementById('goalUsd').value = state.userConfig.profitGoals.usd;
    updateGoalToggleButtons();
    renderP2PPlatforms();
    renderPaymentMethodsConfig();
    renderUsdPaymentMethodsConfig();
};
window.closeConfigModal = closeConfigModal;
window.saveConfig = saveConfig;
window.addOrUpdateP2PPlatform = addOrUpdateP2PPlatform;
window.editP2PPlatform = editP2PPlatform;
window.deleteP2PPlatform = deleteP2PPlatform;
window.setDefaultP2PPlatform = setDefaultP2PPlatform;
window.addPaymentMethod = addPaymentMethod;
window.deletePaymentMethod = deletePaymentMethod;
window.addUsdPaymentMethod = addUsdPaymentMethod;
window.deleteUsdPaymentMethod = deleteUsdPaymentMethod;

// Operations rendering
window.renderOperations = renderOperations;
window.handleDragEnd = handleDragEnd, window.cancelMoveAction = cancelMoveAction, window.executeMoveAction = executeMoveAction;
window.populateUsdPaymentMethodsFilter = populateUsdPaymentMethodsFilter;

// Wally operations
window.openWallyModal = (index = -1) => {
    state.editingWallyIndex = index;
    document.getElementById('wallyModalTitle').textContent = index > -1 ? 'Editar Operación USD' : 'Agregar Nueva Operación';
    renderWallyForm(index > -1 ? state.wallyOperations[index] : {});
    document.getElementById('wallyModal').classList.add('show');
};
window.closeWallyModal = closeWallyModal;
window.saveWallyOperation = saveWallyOperation;
window.deleteWallyOperation = deleteWallyOperation;
window.updateWallyFormFields = updateWallyFormFields;
window.updateWallyCalculations = updateWallyCalculations;
window.renderWallyTables = renderWallyTables;

// Paste special
window.pasteSpecial = pasteSpecial;
window.pasteSpecialWally = pasteSpecialWally;

// Gains summary
window.openGainsSummaryModal = async () => {
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const today = new Date(), startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const todayStr = formatDate(today), startOfWeekStr = formatDate(startOfWeek), startOfMonthStr = formatDate(startOfMonth);
    const dailyOps = state.operations.filter(op => op.fecha === todayStr);
    const weeklyOps = state.operations.filter(op => op.fecha >= startOfWeekStr && op.fecha <= todayStr);
    const monthlyOps = state.operations.filter(op => op.fecha >= startOfMonthStr && op.fecha <= todayStr);
    const { calculateFIFOGainsForOps } = await import('./operations.js');
    const [dgV, dgU] = calculateFIFOGainsForOps(dailyOps);
    const [wgV, wgU] = calculateFIFOGainsForOps(weeklyOps);
    const [mgV, mgU] = calculateFIFOGainsForOps(monthlyOps);
    document.getElementById('summaryGananciasHoyVes').textContent = `${dgV.toFixed(2)} VES`;
    document.getElementById('summaryGananciasHoyUsdc').textContent = `${dgU.toFixed(4)} USDC`;
    document.getElementById('summaryGananciasSemanaVes').textContent = `${wgV.toFixed(2)} VES`;
    document.getElementById('summaryGananciasSemanaUsdc').textContent = `${wgU.toFixed(4)} USDC`;
    document.getElementById('summaryGananciasMesVes').textContent = `${mgV.toFixed(2)} VES`;
    document.getElementById('summaryGananciasMesUsdc').textContent = `${mgU.toFixed(4)} USDC`;
    document.getElementById('gainsSummaryModal').classList.add('show');
};

window.closeGainsSummaryModal = closeGainsSummaryModal;

window.openWallyGainsSummaryModal = () => {
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const today = new Date(), startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const todayStr = formatDate(today), startOfWeekStr = formatDate(startOfWeek), startOfMonthStr = formatDate(startOfMonth);
    const dailyOps = state.wallyOperations.filter(op => op.fecha === todayStr);
    const weeklyOps = state.wallyOperations.filter(op => op.fecha >= startOfWeekStr && op.fecha <= todayStr);
    const monthlyOps = state.wallyOperations.filter(op => op.fecha >= startOfMonthStr && op.fecha <= todayStr);
    const [dgU, dgD] = calculateWallyGainsForPeriod(dailyOps);
    const [wgU, wgD] = calculateWallyGainsForPeriod(weeklyOps);
    const [mgU, mgD] = calculateWallyGainsForPeriod(monthlyOps);
    document.getElementById('summaryWallyGananciasHoyUsdc').textContent = `${dgU.toFixed(2)} USDC`;
    document.getElementById('summaryWallyGananciasHoyUsd').textContent = `${dgD.toFixed(2)} USD`;
    document.getElementById('summaryWallyGananciasSemanaUsdc').textContent = `${wgU.toFixed(2)} USDC`;
    document.getElementById('summaryWallyGananciasSemanaUsd').textContent = `${wgD.toFixed(2)} USD`;
    document.getElementById('summaryWallyGananciasMesUsdc').textContent = `${mgU.toFixed(2)} USDC`;
    document.getElementById('summaryWallyGananciasMesUsd').textContent = `${mgD.toFixed(2)} USD`;
    document.getElementById('wallyGainsSummaryModal').classList.add('show');
};

window.closeWallyGainsSummaryModal = closeWallyGainsSummaryModal;

// Bank breach, lot details, pending
window.openBankBreachModal = () => { renderBankBreachesCards(); document.getElementById('bankBreachModal').classList.add('show'); };
window.closeBankBreachModal = closeBankBreachModal;
window.closeOpDetailModal = closeOpDetailModal;
window.closeLotDetailsModal = closeLotDetailsModal;
window.openPendingDetailsModal = () => { renderPendingDetails(); document.getElementById('pendingDetailsModal').classList.add('show'); };
window.closePendingDetailsModal = closePendingDetailsModal;

// Confirm modals
window.openConfirmModal = openConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.executeConfirmAction = executeConfirmAction;
window.cancelMoveAction = cancelMoveAction;
window.executeMoveAction = executeMoveAction;

// Capital
window.openInitialCapitalModal = () => {
    document.getElementById('capitalModalDate').textContent = state.currentDate;
    const formContainer = document.getElementById('initialCapitalForm');
    formContainer.innerHTML = '<div class="loader mx-auto"></div>';
    const accounts = state.userConfig.managedAccounts || [];
    if (accounts.length === 0) {
        formContainer.innerHTML = '<p class="text-center text-sm text-gray-500 py-4">No has añadido ninguna cuenta. Usa el formulario de arriba para empezar.</p>';
        document.getElementById('initialCapitalModal').classList.add('show');
        return;
    }
    const todaysCapital = state.currentDayCapital && state.currentDayCapital.balances ? state.currentDayCapital.balances : [];
    let formHtml = '<div class="space-y-2">';
    accounts.forEach(account => {
        const existingEntry = todaysCapital.find(entry => entry.accountId === account.id);
        const currentValue = existingEntry ? existingEntry.amount : '';
        const name = account.name + '';
        const currency = (account.currency || '').toUpperCase();
        formHtml += `<div class="capital-form-row">
            <div class="capital-form-info">
                <span class="capital-form-name">${name}</span>
                <span class="capital-form-currency">${currency}</span>
            </div>
            <div class="capital-form-controls">
                <input type="number" step="0.01" min="0" id="capital-${account.id}" data-account-id="${account.id}" value="${currentValue}" placeholder="0.00" class="capital-form-input">
                <button class="capital-form-delete" onclick="deleteManagedAccount('${account.id}')" title="Eliminar cuenta">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.033c-1.12 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
            </div>
        </div>`;
    });
    formHtml += '</div>';
    formContainer.innerHTML = formHtml;
    document.getElementById('initialCapitalModal').classList.add('show');
};
window.closeInitialCapitalModal = closeInitialCapitalModal;
window.saveInitialCapital = saveInitialCapital;
window.addManagedAccount = addManagedAccount;
window.deleteManagedAccount = deleteManagedAccount;

// Ratings
window.openRatingModal = (userName) => {
    state.currentRatingUser = userName;
    document.getElementById('ratingUserName').textContent = userName;
    document.getElementById('ratingModal').classList.add('show');
    resetStars();
};
window.closeRatingModal = closeRatingModal;
window.submitRating = submitRating;
window.renderRatingsPage = renderRatingsPage;

// User profiles
window.openUserProfileModal = (userName) => {
    state.currentProfileUserName = userName;
    document.getElementById('profileUserName').textContent = userName;
    const avg = calculateAverageRating(userName);
    const total = state.userRatings[userName] ? state.userRatings[userName].length : 0;
    document.getElementById('profileAvgRating').textContent = `${avg.toFixed(1)} ★`;
    document.getElementById('profileTotalRatings').textContent = `${total} calificaciones`;
    document.getElementById('profileNotes').value = state.userProfiles[userName]?.notes || '';
    state.currentProfileUserOps.ves = state.operations.filter(op => op.usuario === userName).sort((a,b) => b.timestamp - a.timestamp);
    state.currentProfileUserOps.usd = state.wallyOperations.filter(op => op.usuario === userName).sort((a,b) => b.timestamp - a.timestamp);
    const allUserOps = [...state.currentProfileUserOps.ves, ...state.currentProfileUserOps.usd];
    const totalUsdc = allUserOps.reduce((sum, op) => sum + (op.montoUsdc || op.reciboUsdc || op.envioUsdc || 0), 0);
    document.getElementById('profileTotalUsdc').textContent = totalUsdc.toFixed(2);
    document.getElementById('profileTotalVes').textContent = state.currentProfileUserOps.ves.reduce((sum, op) => sum + (op.montoBs || 0), 0).toFixed(2);
    document.getElementById('profileNumOps').textContent = allUserOps.length;
    document.getElementById('profileLastOpDate').textContent = allUserOps.length > 0 ? new Date(allUserOps[0].timestamp).toLocaleDateString() : 'N/A';
    document.getElementById('userProfileModal').classList.add('show');
    switchProfileTab('ves');
};
window.closeUserProfileModal = closeUserProfileModal;
window.saveProfileNotes = saveProfileNotes;
window.switchProfileTab = switchProfileTab;

// Analysis
window.openWeeklyAnalysisModal = () => {
    const modal = document.getElementById('weeklyAnalysisModal');
    const summaryContainer = document.getElementById('weeklyAnalysisSummary');
    modal.classList.add('show');
    summaryContainer.innerHTML = `<div class="text-center py-4"><div class="loader mx-auto"></div><p class="mt-2 text-sm text-gray-400">Analizando datos de la semana...</p></div>`;
    setTimeout(() => {
        const weeklyOps = getWeeklyOperations();
        if (weeklyOps.length === 0) {
            summaryContainer.innerHTML = `<p class="text-center text-gray-400 py-4">No hay operaciones en los últimos 7 días para analizar.</p>`;
            if (state.weeklyChartInstance) state.weeklyChartInstance.destroy();
            drawEmptyChartMessage('weeklyChart', 'Sin operaciones en la semana');
            return;
        }
        const analysisResults = analyzeWeeklyData(weeklyOps);
        renderWeeklyChart(analysisResults.dailyData);
        renderWeeklySummary(analysisResults);
    }, 50);
};
window.closeWeeklyAnalysisModal = closeWeeklyAnalysisModal;
window.openMonthlyAnalysisModal = () => {
    document.getElementById('monthlyAnalysisModal').classList.add('show');
    if (document.getElementById('monthSelector').options.length > 0) runMonthlyAnalysis();
};
window.closeMonthlyAnalysisModal = closeMonthlyAnalysisModal;
window.runMonthlyAnalysis = runMonthlyAnalysis;
window.openUsdAnalysisModal = () => {
    document.getElementById('usdAnalysisModal').classList.add('show');
    populateUsdMonthSelector();
    switchUsdAnalysisTab('weekly');
};
window.closeUsdAnalysisModal = closeUsdAnalysisModal;
window.switchUsdAnalysisTab = switchUsdAnalysisTab;
window.renderUsdAnalysis = renderUsdAnalysis;

// Data loading (used in auth flow)
window.loadOperations = loadOperations;
window.loadWallyOperations = loadWallyOperations;
window.loadUserRatings = loadUserRatings;
window.loadUserProfiles = loadUserProfiles;

// Sound
window.enableAudio = enableAudio;

// Logout with confirmation
window.confirmLogout = () => {
    openConfirmModal('¿Estás seguro de que quieres cerrar sesión?', () => {
        const btn = document.getElementById('logoutBtn');
        btn.innerHTML = '<span class="loader-sm mx-auto"></span>';
        btn.disabled = true;
        logoutUser();
    });
};

// Helper for checkInitialLoadComplete (called from firestore callbacks)
window.checkInitialLoadComplete = checkInitialLoadComplete;
window.currentProfileUserName = '';

// Star rating click handler
document.querySelectorAll('.rating-stars').forEach(container => {
    container.addEventListener('click', function(event) {
        if (event.target.classList.contains('star')) {
            const value = parseInt(event.target.dataset.value);
            const parent = event.target.parentNode;
            const ratingType = parent.id.replace('rating', '').toLowerCase();
            parent.querySelectorAll('.star').forEach(star => {
                star.classList.toggle('selected', parseInt(star.dataset.value) <= value);
            });
            state.selectedRatings[ratingType] = value;
        }
    });
});

// Date change listeners
document.getElementById('selectedDate').addEventListener('change', async function() {
    setCurrentDate(this.value);
    state.currentDate = this.value;
    const { updateSummary } = await import('./operations.js');
    updateSummary();
});

document.getElementById('wallySelectedDate').addEventListener('change', async function() {
    setCurrentWallyDate(this.value);
    state.currentWallyDate = this.value;
    const { updateWallySummary } = await import('./wally.js');
    updateWallySummary();
});

// Config modal event
document.getElementById('addPlatformBtn')?.addEventListener('click', addOrUpdateP2PPlatform);
// saveOperationBtn usa onclick en HTML

// Dashboard goal toggles
document.getElementById('dashboardGoalToggles')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('goal-toggle-btn')) {
        const goalType = e.target.dataset.goal;
        state.userConfig.dashboardGoals[goalType] = !state.userConfig.dashboardGoals[goalType];
        e.target.classList.toggle('active');
    }
});

// Ratings pagination
document.getElementById('prev-page-btn')?.addEventListener('click', () => {
    if (state.ratingsCurrentPage > 1) { state.ratingsCurrentPage--; renderRatingsPage(); }
});
document.getElementById('next-page-btn')?.addEventListener('click', () => {
    const totalUsers = Object.keys(state.userRatings).filter(user => user.toLowerCase().includes(document.getElementById('searchRatings').value.toLowerCase()));
    const totalPages = Math.ceil(totalUsers.length / 20);
    if (state.ratingsCurrentPage < totalPages) { state.ratingsCurrentPage++; renderRatingsPage(); }
});
document.getElementById('searchRatings')?.addEventListener('keyup', () => { state.ratingsCurrentPage = 1; });

// Password toggle
window.togglePassword = (inputId, btn) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword
        ? '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>'
        : '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
};

// Focus trap for modals
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const modal = document.querySelector('.modal.show');
    if (!modal) return;
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// Enter key submission for auth forms
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const authSection = document.getElementById('authSection');
    if (!authSection || authSection.style.display === 'none') return;
    if (document.getElementById('loginForm').style.display !== 'none') {
        loginUser();
    } else {
        registerUser();
    }
});
