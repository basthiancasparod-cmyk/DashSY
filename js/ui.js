import { state } from './state.js';

const TOAST_ICONS = {
    success: '<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
    error: '<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
    warning: '<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
    info: '<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2h.01a1 1 0 000-2H9z" clip-rule="evenodd"/></svg>'
};

let toastCount = 0;

export function showToast(message, type = 'info') {
    const c = document.getElementById('toast-container');
    if (c.children.length >= 3) c.removeChild(c.firstChild);
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `${TOAST_ICONS[type] || TOAST_ICONS.info}<span>${message}</span>`;
    t.setAttribute('role', 'alert');
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
        t.classList.remove('show');
        t.addEventListener('transitionend', () => t.remove(), {once: true});
    }, 4000);
}

export function openConfirmModal(message, onConfirmCallback) {
    document.getElementById('confirmDeleteMessage').textContent = message;
    state.confirmAction = onConfirmCallback;
    document.getElementById('confirmDeleteModal').classList.add('show');
}

export function closeConfirmModal() {
    document.getElementById('confirmDeleteModal').classList.remove('show');
    state.confirmAction = null;
}

export function executeConfirmAction() {
    if (typeof state.confirmAction === 'function') state.confirmAction();
    closeConfirmModal();
}

export function openConfirmMoveModal(message, onConfirmCallback) {
    document.getElementById('confirmMoveMessage').textContent = message;
    state.moveAction = onConfirmCallback;
    document.getElementById('confirmMoveModal').classList.add('show');
}

export function cancelMoveAction() {
    document.getElementById('confirmMoveModal').classList.remove('show');
    state.moveAction = null;
    showToast('Movimiento cancelado.', 'info');
    window.renderOperations();
}

export function executeMoveAction() {
    if (typeof state.moveAction === 'function') state.moveAction();
    document.getElementById('confirmMoveModal').classList.remove('show');
    state.moveAction = null;
}

export function showPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(`page-${pageName}`).classList.add('active');
    document.getElementById(`nav-${pageName}`).classList.add('active');
    const mainFab = document.getElementById('main-fab');
    const wallyFab = document.getElementById('page-wally').querySelector('.btn-fab');
    mainFab.style.display = pageName === 'operate' ? 'flex' : 'none';
    wallyFab.style.display = pageName === 'wally' ? 'flex' : 'none';
}

export function openModal() {
    document.getElementById('operationModal').classList.add('show');
    if (state.editingIndex === -1) window.clearForm();
}

export function toggleFilters() {
    const panel = document.getElementById('filter-controls-panel');
    const btn = document.getElementById('filter-toggle-btn');
    if (!panel || !btn) return;
    const hidden = panel.getAttribute('data-hidden') === 'true';
    panel.setAttribute('data-hidden', hidden ? 'false' : 'true');
    btn.setAttribute('aria-expanded', hidden ? 'true' : 'false');
}

export function closeOpDetailModal() {
    document.getElementById('opDetailModal').classList.remove('show');
}

export function closeModal() {
    document.getElementById('operationModal').classList.remove('show');
    state.editingIndex = -1;
}

export function closeConfigModal() { document.getElementById('configModal').classList.remove('show'); }
export function closeInitialCapitalModal() { document.getElementById('initialCapitalModal').classList.remove('show'); }
export function closeWallyModal() { document.getElementById('wallyModal').classList.remove('show'); }
export function closeGainsSummaryModal() { document.getElementById('gainsSummaryModal').classList.remove('show'); }
export function closeWallyGainsSummaryModal() { document.getElementById('wallyGainsSummaryModal').classList.remove('show'); }
export function closeBankBreachModal() { document.getElementById('bankBreachModal').classList.remove('show'); }
export function closeLotDetailsModal() { document.getElementById('lotDetailsModal').classList.remove('show'); }
export function closePendingDetailsModal() { document.getElementById('pendingDetailsModal').classList.remove('show'); }
export function closeRatingModal() { document.getElementById('ratingModal').classList.remove('show'); state.currentRatingUser = ''; state.selectedRatings = { transaction: 0, speed: 0 }; }
export function closeUserProfileModal() { document.getElementById('userProfileModal').classList.remove('show'); }
export function closeWeeklyAnalysisModal() { document.getElementById('weeklyAnalysisModal').classList.remove('show'); if (state.weeklyChartInstance) state.weeklyChartInstance.destroy(); }
export function closeMonthlyAnalysisModal() { document.getElementById('monthlyAnalysisModal').classList.remove('show'); if (state.monthlyChartInstance) state.monthlyChartInstance.destroy(); }
export function closeUsdAnalysisModal() {
    document.getElementById('usdAnalysisModal').classList.remove('show');
    ['usdWeeklyChartInstance','usdWeeklyPaymentMethodChartInstance','usdWeeklyP2pPlatformChartInstance','usdMonthlyChartInstance','usdMonthlyPaymentMethodChartInstance','usdMonthlyP2pPlatformChartInstance'].forEach(k => { if (state[k]) state[k].destroy(); });
}
