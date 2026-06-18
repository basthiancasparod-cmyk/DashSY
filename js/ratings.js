import { auth, db } from './firebase-init.js';
import { currentUserId, userRatings, userProfiles, USERS_PER_PAGE, ratingsCurrentPage, currentProfileUserOps, operations, wallyOperations, setUserRatings, setUserProfiles, setRatingsCurrentPage, setCurrentProfileUserName, setCurrentProfileUserOps, currentRatingUser, selectedRatings, setCurrentRatingUser, setSelectedRatings, currentProfileUserName } from './state.js';
import { showToast } from './ui.js';
import { calculateAverageRating } from './utils.js';

export function loadUserRatings() {
    if (!currentUserId) return;
    db.collection('users').doc(currentUserId).collection('ratings').onSnapshot(snapshot => {
        const ratings = {};
        snapshot.forEach(doc => { ratings[doc.id] = doc.data().ratings; });
        setUserRatings(ratings);

        window.renderOperations();
        window.renderWallyTables();

        if (currentProfileUserName) window.openUserProfileModal(currentProfileUserName);

        renderRatingsPage();
        window.checkInitialLoadComplete();
    }, e => { console.error("Error al cargar calificaciones:", e); window.checkInitialLoadComplete(); });
}

export function loadUserProfiles() {
    if (!currentUserId) return;
    db.collection('users').doc(currentUserId).collection('userProfiles').onSnapshot(snapshot => {
        const profiles = {};
        snapshot.forEach(doc => { profiles[doc.id] = doc.data(); });
        setUserProfiles(profiles);

        if (currentProfileUserName) window.openUserProfileModal(currentProfileUserName);

        window.checkInitialLoadComplete();
    }, e => { console.error(e); window.checkInitialLoadComplete(); });
}

export function openRatingModal(userName) {
    setCurrentRatingUser(userName);
    document.getElementById('ratingUserName').textContent = userName;
    document.getElementById('ratingModal').classList.add('show');
    resetStars();
}

export function closeRatingModal() {
    document.getElementById('ratingModal').classList.remove('show');
    setCurrentRatingUser('');
    setSelectedRatings({ transaction: 0, speed: 0 });
}

function resetStars() {
    document.querySelectorAll('.rating-stars').forEach(c =>
        c.querySelectorAll('.star').forEach(s => s.classList.remove('selected'))
    );
    setSelectedRatings({ transaction: 0, speed: 0 });
}

document.querySelectorAll('.rating-stars').forEach(container => {
    container.addEventListener('click', function(event) {
        if (event.target.classList.contains('star')) {
            const value = parseInt(event.target.dataset.value);
            const parent = event.target.parentNode;
            const ratingType = parent.id.replace('rating', '').toLowerCase();
            parent.querySelectorAll('.star').forEach(star => {
                star.classList.toggle('selected', parseInt(star.dataset.value) <= value);
            });
            selectedRatings[ratingType] = value;
        }
    });
});

export function submitRating() {
    if (selectedRatings.transaction === 0 && selectedRatings.speed === 0) {
        showToast('Por favor, califique al menos un aspecto.', 'warning');
        return;
    }
    const newRating = {
        transaction: selectedRatings.transaction,
        speed: selectedRatings.speed,
        date: new Date().toISOString().split('T')[0],
        operationType: window.lastSavedOperationType
    };
    if (!userRatings[currentRatingUser]) userRatings[currentRatingUser] = [];
    userRatings[currentRatingUser].push(newRating);
    db.collection('users').doc(currentUserId).collection('ratings').doc(currentRatingUser)
        .set({ ratings: userRatings[currentRatingUser] })
        .then(() => {
            closeRatingModal();
            showToast('Calificación guardada.', 'success');
        });
}

export function renderRatingsPage() {
    const container = document.getElementById('ratingsListContainer');
    const paginationControls = document.getElementById('ratings-pagination');
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    const searchTerm = document.getElementById('searchRatings').value.toLowerCase();

    const filteredUsers = Object.keys(userRatings)
        .filter(user => user.toLowerCase().includes(searchTerm))
        .sort((a, b) => calculateAverageRating(b) - calculateAverageRating(a));

    if (filteredUsers.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500">No se encontraron usuarios.</p>';
        paginationControls.style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
    const start = (ratingsCurrentPage - 1) * USERS_PER_PAGE;
    const end = start + USERS_PER_PAGE;
    const paginatedUsers = filteredUsers.slice(start, end);

    container.innerHTML = paginatedUsers.map(userName => {
        const avgRating = calculateAverageRating(userName);
        const totalCount = userRatings[userName].length;
        return `<div class="card clickable flex justify-between items-center" onclick="openUserProfileModal('${userName}')"><div><p class="font-bold text-lg">${userName}</p><p class="text-xs text-gray-400">${totalCount} operaciones</p></div><div class="text-xl font-bold text-yellow-400">${avgRating.toFixed(1)} ★</div></div>`;
    }).join('');

    paginationControls.style.display = 'flex';
    pageInfo.textContent = `Página ${ratingsCurrentPage} de ${totalPages}`;
    prevBtn.disabled = ratingsCurrentPage === 1;
    nextBtn.disabled = ratingsCurrentPage === totalPages;
}

export function openUserProfileModal(userName) {
    setCurrentProfileUserName(userName);
    document.getElementById('profileUserName').textContent = userName;

    const avgRating = calculateAverageRating(userName);
    const totalRatings = userRatings[userName] ? userRatings[userName].length : 0;
    document.getElementById('profileAvgRating').textContent = `${avgRating.toFixed(1)} ★`;
    document.getElementById('profileTotalRatings').textContent = `${totalRatings} calificaciones`;
    document.getElementById('profileNotes').value = userProfiles[userName]?.notes || '';

    const vesOps = operations.filter(op => op.usuario === userName).sort((a,b) => b.timestamp - a.timestamp);
    const usdOps = wallyOperations.filter(op => op.usuario === userName).sort((a,b) => b.timestamp - a.timestamp);
    setCurrentProfileUserOps({ ves: vesOps, usd: usdOps });
    const allUserOps = [...vesOps, ...usdOps].sort((a,b) => b.timestamp - a.timestamp);

    const totalUsdc = allUserOps.reduce((sum, op) => sum + (op.montoUsdc || op.reciboUsdc || op.envioUsdc || 0), 0);
    const totalVes = vesOps.reduce((sum, op) => sum + (op.montoBs || 0), 0);
    document.getElementById('profileTotalUsdc').textContent = totalUsdc.toFixed(2);
    document.getElementById('profileTotalVes').textContent = totalVes.toFixed(2);
    document.getElementById('profileNumOps').textContent = allUserOps.length;
    document.getElementById('profileLastOpDate').textContent = allUserOps.length > 0 ? new Date(allUserOps[0].timestamp).toLocaleDateString() : 'N/A';

    document.getElementById('userProfileModal').classList.add('show');
    switchProfileTab('ves');
}

export function closeUserProfileModal() {
    document.getElementById('userProfileModal').classList.remove('show');
}

export function switchProfileTab(tabName) {
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.toLowerCase().includes(tabName));
    });

    const contentDiv = document.getElementById('profile-tab-content');
    const opsToShow = (tabName === 'ves') ? currentProfileUserOps.ves : currentProfileUserOps.usd;

    if (opsToShow.length === 0) {
        contentDiv.innerHTML = `<p class="text-center text-sm text-gray-500 py-4">No hay operaciones de este tipo.</p>`;
        return;
    }

    let tableHtml = '';
    if (tabName === 'ves') {
        tableHtml = `
            <div class="table-container max-h-48">
                <table class="w-full min-w-[300px]"><thead class="text-xs"><tr><th>Fecha</th><th>Op</th><th>USDC</th><th>Tasa</th></tr></thead>
                <tbody class="text-xs">${opsToShow.map(op => `<tr><td>${op.fecha}</td><td>${op.operacion.substring(0,1)}</td><td>${op.montoUsdc.toFixed(2)}</td><td>${op.tasa.toFixed(2)}</td></tr>`).join('')}</tbody>
                </table></div>`;
    } else {
        tableHtml = `
            <div class="table-container max-h-48">
                <table class="w-full min-w-[300px]"><thead class="text-xs"><tr><th>Fecha</th><th>Op</th><th>Monto</th><th>Ganancia</th></tr></thead>
                <tbody class="text-xs">${opsToShow.map(op => `<tr><td>${op.fecha}</td><td>${op.operacion.substring(0,1)}</td><td class="font-semibold">${op.operacion === 'Compra' ? (op.reciboUsdc || 0).toFixed(2) : (op.envioUsdc || 0).toFixed(2)}</td><td class="font-semibold text-green-400">${op.operacion === 'Compra' ? (op.gananciaUsdc || 0).toFixed(3) : (op.gananciaUsd || 0).toFixed(3)}</td></tr>`).join('')}</tbody>
                </table></div>`;
    }
    contentDiv.innerHTML = tableHtml;
}

export function saveProfileNotes() {
    if (!currentUserId || !currentProfileUserName) return;
    const notes = document.getElementById('profileNotes').value;
    db.collection('users').doc(currentUserId).collection('userProfiles').doc(currentProfileUserName).set({ notes: notes }, { merge: true })
        .then(() => showToast('Notas guardadas.', 'success'))
        .catch(() => showToast('Error al guardar notas.', 'error'));
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('prev-page-btn')?.addEventListener('click', () => {
        if (ratingsCurrentPage > 1) {
            setRatingsCurrentPage(ratingsCurrentPage - 1);
            renderRatingsPage();
        }
    });

    document.getElementById('next-page-btn')?.addEventListener('click', () => {
        const searchTerm = document.getElementById('searchRatings').value.toLowerCase();
        const totalUsers = Object.keys(userRatings).filter(user => user.toLowerCase().includes(searchTerm));
        const totalPages = Math.ceil(totalUsers.length / USERS_PER_PAGE);
        if (ratingsCurrentPage < totalPages) {
            setRatingsCurrentPage(ratingsCurrentPage + 1);
            renderRatingsPage();
        }
    });

    const searchInput = document.getElementById('searchRatings');
    if (searchInput) {
        searchInput.addEventListener('keyup', () => {
            setRatingsCurrentPage(1);
        });
    }
});

// Event listeners for star ratings
document.querySelectorAll('.rating-stars').forEach(container => {
    container.addEventListener('click', function(event) {
        if (event.target.classList.contains('star')) {
            const value = parseInt(event.target.dataset.value);
            const parent = event.target.parentNode;
            const ratingType = parent.id.replace('rating', '').toLowerCase();
            parent.querySelectorAll('.star').forEach(star => {
                star.classList.toggle('selected', parseInt(star.dataset.value) <= value);
            });
            selectedRatings[ratingType] = value;
        }
    });
});
