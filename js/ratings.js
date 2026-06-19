import { state, db, USERS_PER_PAGE } from './state.js';
import { showToast } from './ui.js';

export function loadUserRatings() {
    if (!state.currentUserId) return;
    db.collection('users').doc(state.currentUserId).collection('ratings').onSnapshot(snapshot => {
        state.userRatings = {};
        snapshot.forEach(doc => { state.userRatings[doc.id] = doc.data().ratings; });
        if (typeof window.renderOperations === 'function') window.renderOperations();
        if (typeof window.renderWallyTables === 'function') window.renderWallyTables();
        if (state.currentProfileUserName) window.openUserProfileModal(state.currentProfileUserName);
        renderRatingsPage();
        checkInitialLoadComplete();
    }, e => { console.error("Error al cargar calificaciones:", e); checkInitialLoadComplete(); });
}

export function loadUserProfiles() {
    if (!state.currentUserId) return;
    db.collection('users').doc(state.currentUserId).collection('userProfiles').onSnapshot(snapshot => {
        state.userProfiles = {};
        snapshot.forEach(doc => { state.userProfiles[doc.id] = doc.data(); });
        if (state.currentProfileUserName) window.openUserProfileModal(state.currentProfileUserName);
        checkInitialLoadComplete();
    }, e => { console.error(e); checkInitialLoadComplete(); });
}

export function calculateAverageRating(userName) {
    if (!state.userRatings[userName] || state.userRatings[userName].length === 0) return 0;
    let totalSum = 0, count = 0;
    state.userRatings[userName].forEach(r => {
        if (r.transaction > 0) { totalSum += r.transaction; count++; }
        if (r.speed > 0) { totalSum += r.speed; count++; }
    });
    return count > 0 ? totalSum / count : 0;
}

export function renderRatingsPage() {
    const container = document.getElementById('ratingsListContainer');
    const paginationControls = document.getElementById('ratings-pagination');
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const searchTerm = document.getElementById('searchRatings').value.toLowerCase();
    const filteredUsers = Object.keys(state.userRatings)
        .filter(user => user.toLowerCase().includes(searchTerm))
        .sort((a, b) => calculateAverageRating(b) - calculateAverageRating(a));
    if (filteredUsers.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500">No se encontraron usuarios.</p>';
        paginationControls.style.display = 'none';
        return;
    }
    const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
    const start = (state.ratingsCurrentPage - 1) * USERS_PER_PAGE;
    const end = start + USERS_PER_PAGE;
    const paginatedUsers = filteredUsers.slice(start, end);
    container.innerHTML = paginatedUsers.map(userName => {
        const avgRating = calculateAverageRating(userName);
        const totalCount = state.userRatings[userName].length;
        return `<div class="card clickable flex justify-between items-center" onclick="openUserProfileModal('${userName}')"><div><p class="font-bold text-lg">${userName}</p><p class="text-xs text-gray-400">${totalCount} operaciones</p></div><div class="text-xl font-bold text-yellow-400">${avgRating.toFixed(1)} ★</div></div>`;
    }).join('');
    paginationControls.style.display = 'flex';
    pageInfo.textContent = `Página ${state.ratingsCurrentPage} de ${totalPages}`;
    prevBtn.disabled = state.ratingsCurrentPage === 1;
    nextBtn.disabled = state.ratingsCurrentPage === totalPages;
}

export function resetStars() {
    document.querySelectorAll('.rating-stars').forEach(c => c.querySelectorAll('.star').forEach(s => s.classList.remove('selected')));
    state.selectedRatings = { transaction: 0, speed: 0 };
}

export function submitRating() {
    if (state.selectedRatings.transaction === 0 && state.selectedRatings.speed === 0) { showToast('Por favor, califique al menos un aspecto.', 'warning'); return; }
    const newRating = { transaction: state.selectedRatings.transaction, speed: state.selectedRatings.speed, date: new Date().toISOString().split('T')[0], operationType: state.lastSavedOperationType };
    if (!state.userRatings[state.currentRatingUser]) state.userRatings[state.currentRatingUser] = [];
    state.userRatings[state.currentRatingUser].push(newRating);
    db.collection('users').doc(state.currentUserId).collection('ratings').doc(state.currentRatingUser).set({ ratings: state.userRatings[state.currentRatingUser] }).then(() => { document.getElementById('ratingModal').classList.remove('show'); showToast('Calificación guardada.', 'success'); });
}

export function saveProfileNotes() {
    if (!state.currentUserId || !state.currentProfileUserName) return;
    const notes = document.getElementById('profileNotes').value;
    db.collection('users').doc(state.currentUserId).collection('userProfiles').doc(state.currentProfileUserName).set({ notes }, { merge: true })
        .then(() => showToast('Notas guardadas.', 'success'))
        .catch(() => showToast('Error al guardar notas.', 'error'));
}

export function switchProfileTab(tabName) {
    document.querySelectorAll('.profile-tab').forEach(tab => { tab.classList.toggle('active', tab.textContent.toLowerCase().includes(tabName)); });
    const contentDiv = document.getElementById('profile-tab-content');
    const opsToShow = (tabName === 'ves') ? state.currentProfileUserOps.ves : state.currentProfileUserOps.usd;
    if (opsToShow.length === 0) { contentDiv.innerHTML = `<p class="text-center text-sm text-gray-500 py-4">No hay operaciones de este tipo.</p>`; return; }
    let tableHtml = '';
    if (tabName === 'ves') {
        tableHtml = `<div class="table-container max-h-48"><table class="w-full min-w-[300px]"><thead class="text-xs"><tr><th>Fecha</th><th>Op</th><th>USDC</th><th>Tasa</th></tr></thead><tbody class="text-xs">${opsToShow.map(op => `<tr><td>${op.fecha}</td><td>${op.operacion.substring(0,1)}</td><td>${op.montoUsdc.toFixed(2)}</td><td>${op.tasa.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`;
    } else {
        tableHtml = `<div class="table-container max-h-48"><table class="w-full min-w-[300px]"><thead class="text-xs"><tr><th>Fecha</th><th>Op</th><th>Monto</th><th>Ganancia</th></tr></thead><tbody class="text-xs">${opsToShow.map(op => `<tr><td>${op.fecha}</td><td>${op.operacion.substring(0,1)}</td><td class="font-semibold">${op.operacion === 'Compra' ? (op.reciboUsdc || 0).toFixed(2) : (op.envioUsdc || 0).toFixed(2)}</td><td class="font-semibold text-green-400">${op.operacion === 'Compra' ? (op.gananciaUsdc || 0).toFixed(3) : (op.gananciaUsd || 0).toFixed(3)}</td></tr>`).join('')}</tbody></table></div>`;
    }
    contentDiv.innerHTML = tableHtml;
}
