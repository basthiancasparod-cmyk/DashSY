import { state } from './state.js';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(el) {
    return Array.from(el.querySelectorAll(FOCUSABLE)).filter(f => f.offsetParent !== null);
}

function trapFocus(el) {
    requestAnimationFrame(() => {
        const first = getFocusable(el)[0];
        if (first && !el.contains(document.activeElement)) first.focus();
    });
}

function closeModalById(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('show');
        el.dispatchEvent(new CustomEvent('modalclose', { bubbles: true }));
    }
}

const MODAL_CLOSE_MAP = new Map([
    ['operationModal', () => { closeModalById('operationModal'); state.editingIndex = -1; }],
    ['opDetailModal', () => closeModalById('opDetailModal')],
    ['configModal', () => closeModalById('configModal')],
    ['initialCapitalModal', () => closeModalById('initialCapitalModal')],
    ['wallyModal', () => closeModalById('wallyModal')],
    ['gainsSummaryModal', () => closeModalById('gainsSummaryModal')],
    ['wallyGainsSummaryModal', () => closeModalById('wallyGainsSummaryModal')],
    ['bankBreachModal', () => closeModalById('bankBreachModal')],
    ['lotDetailsModal', () => closeModalById('lotDetailsModal')],
    ['pendingDetailsModal', () => closeModalById('pendingDetailsModal')],
    ['confirmDeleteModal', () => closeModalById('confirmDeleteModal')],
    ['confirmMoveModal', () => closeModalById('confirmMoveModal')],
    ['ratingModal', () => { closeModalById('ratingModal'); state.currentRatingUser = ''; state.selectedRatings = { transaction: 0, speed: 0 }; }],
    ['userProfileModal', () => closeModalById('userProfileModal')],
    ['weeklyAnalysisModal', () => { closeModalById('weeklyAnalysisModal'); if (state.weeklyChartInstance) state.weeklyChartInstance.destroy(); }],
    ['monthlyAnalysisModal', () => { closeModalById('monthlyAnalysisModal'); if (state.monthlyChartInstance) state.monthlyChartInstance.destroy(); }],
    ['usdAnalysisModal', () => { closeModalById('usdAnalysisModal'); ['usdWeeklyChartInstance','usdWeeklyPaymentMethodChartInstance','usdWeeklyP2pPlatformChartInstance','usdMonthlyChartInstance','usdMonthlyPaymentMethodChartInstance','usdMonthlyP2pPlatformChartInstance'].forEach(k => { if (state[k]) state[k].destroy(); }); }]
]);

// Global keydown: Escape → close top modal, Tab → trap focus
document.addEventListener('keydown', e => {
    const openModals = document.querySelectorAll('.modal.show');
    if (openModals.length === 0) return;
    const topModal = openModals[openModals.length - 1];
    if (e.key === 'Escape' && topModal.id) {
        const closeFn = MODAL_CLOSE_MAP.get(topModal.id);
        if (closeFn) closeFn();
        return;
    }
    if (e.key === 'Tab') {
        const focusable = getFocusable(topModal);
        if (focusable.length === 0) { e.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
});

// MutationObserver: trap focus when any modal gains .show
const _modalObserver = new MutationObserver(mutations => {
    for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'class' && m.target.classList?.contains('modal')) {
            if (m.target.classList.contains('show')) trapFocus(m.target);
        }
    }
});
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal').forEach(el => {
        _modalObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
    });
});

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
    closeModalById('confirmDeleteModal');
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
    closeModalById('confirmMoveModal');
    state.moveAction = null;
    showToast('Movimiento cancelado.', 'info');
    window.renderOperations();
}

export function executeMoveAction() {
    if (typeof state.moveAction === 'function') state.moveAction();
    closeModalById('confirmMoveModal');
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

export function closeOpDetailModal() { closeModalById('opDetailModal'); }
export function closeModal() { closeModalById('operationModal'); state.editingIndex = -1; }
export function closeConfigModal() { closeModalById('configModal'); }
export function closeInitialCapitalModal() { closeModalById('initialCapitalModal'); }
export function closeWallyModal() { closeModalById('wallyModal'); }
export function closeGainsSummaryModal() { closeModalById('gainsSummaryModal'); }
export function closeWallyGainsSummaryModal() { closeModalById('wallyGainsSummaryModal'); }
export function closeBankBreachModal() { closeModalById('bankBreachModal'); }
export function closeLotDetailsModal() { closeModalById('lotDetailsModal'); }
export function closePendingDetailsModal() { closeModalById('pendingDetailsModal'); }
export function closeRatingModal() { closeModalById('ratingModal'); state.currentRatingUser = ''; state.selectedRatings = { transaction: 0, speed: 0 }; }
export function closeUserProfileModal() { closeModalById('userProfileModal'); }
export function closeWeeklyAnalysisModal() { closeModalById('weeklyAnalysisModal'); if (state.weeklyChartInstance) state.weeklyChartInstance.destroy(); }
export function closeMonthlyAnalysisModal() { closeModalById('monthlyAnalysisModal'); if (state.monthlyChartInstance) state.monthlyChartInstance.destroy(); }
export function closeUsdAnalysisModal() {
    closeModalById('usdAnalysisModal');
    ['usdWeeklyChartInstance','usdWeeklyPaymentMethodChartInstance','usdWeeklyP2pPlatformChartInstance','usdMonthlyChartInstance','usdMonthlyPaymentMethodChartInstance','usdMonthlyP2pPlatformChartInstance'].forEach(k => { if (state[k]) state[k].destroy(); });
}
