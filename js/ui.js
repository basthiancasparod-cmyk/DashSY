export function showPage(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(`page-${pageName}`).classList.add('active');
    document.getElementById(`nav-${pageName}`).classList.add('active');
    const mainFab = document.getElementById('main-fab');
    const wallyPage = document.getElementById('page-wally');
    const wallyFab = wallyPage?.querySelector('.btn-fab');
    mainFab.style.display = (pageName === 'operate' || pageName === 'reports') ? 'flex' : 'none';
    if (wallyFab) wallyFab.style.display = pageName === 'wally' ? 'flex' : 'none';
}

export function showToast(message, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = message;
    c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => {
        t.classList.remove('show');
        t.addEventListener('transitionend', () => t.remove(), {once: true});
    }, 3000);
}

// Confirm delete modal
export function openConfirmModal(message, onConfirm) {
    document.getElementById('confirmDeleteMessage').textContent = message;
    window.confirmCallback = onConfirm;
    document.getElementById('confirmDeleteModal').classList.add('show');
}

export function closeConfirmModal() {
    document.getElementById('confirmDeleteModal')?.classList.remove('show');
    window.confirmCallback = null;
}

export function executeConfirmAction() {
    if (typeof window.confirmCallback === 'function') {
        window.confirmCallback();
    }
    closeConfirmModal();
}

// Confirm move modal
export function openConfirmMoveModal(message, onConfirm) {
    document.getElementById('confirmMoveMessage').textContent = message;
    window.moveCallback = onConfirm;
    document.getElementById('confirmMoveModal').classList.add('show');
}

export function closeConfirmMoveModal() {
    document.getElementById('confirmMoveModal')?.classList.remove('show');
    window.moveCallback = null;
}

export function executeMoveAction() {
    if (typeof window.moveCallback === 'function') {
        window.moveCallback();
    }
    closeConfirmMoveModal();
}

export function cancelMoveAction() {
    closeConfirmMoveModal();
    window.renderOperations();
}

// Operation modal
export function openModal() {
    document.getElementById('operationModal').classList.add('show');
    import('./state.js').then(m => {
        if (m.editingIndex === -1) window.clearForm();
    });
}

export function closeModal() {
    document.getElementById('operationModal').classList.remove('show');
    import('./state.js').then(m => m.setEditingIndex(-1));
}

// Generic modal openers/closers
export function openBankBreachModal() { document.getElementById('bankBreachModal').classList.add('show'); window.renderBankBreachesCards(); }
export function closeBankBreachModal() { document.getElementById('bankBreachModal').classList.remove('show'); }
export function openLotDetailsModal() { document.getElementById('lotDetailsModal').classList.add('show'); window.renderLotDetailsCards(); }
export function closeLotDetailsModal() { document.getElementById('lotDetailsModal').classList.remove('show'); }
export function openPendingDetailsModal() { document.getElementById('pendingDetailsModal').classList.add('show'); window.renderPendingDetails(); }
export function closePendingDetailsModal() { document.getElementById('pendingDetailsModal').classList.remove('show'); }
