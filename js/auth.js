import { state, db, TOTAL_INITIAL_LOADS } from './state.js';
import { showToast } from './ui.js';

function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.innerHTML = loading ? '<span class="loader-sm mx-auto"></span>' : btn.dataset.originalText;
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getFirebaseErrorMessage(err) {
    const map = {
        'auth/user-not-found': 'Usuario no encontrado.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/invalid-credential': 'Credenciales inválidas.',
        'auth/email-already-in-use': 'Este correo ya está registrado.',
        'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
        'auth/invalid-email': 'Correo electrónico inválido.',
        'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
        'auth/network-request-failed': 'Error de conexión. Verifica tu internet.'
    };
    return map[err.code] || 'Error inesperado. Intenta de nuevo.';
}

function showError(msg) {
    const el = document.getElementById('authError');
    el.textContent = msg;
    el.style.opacity = '1';
}

export function registerUser() {
    const e = document.getElementById('registerEmail').value.trim();
    const p = document.getElementById('registerPassword').value;
    const c = document.getElementById('registerConfirm').value;

    showError('');
    if (!validateEmail(e)) return showError('Correo electrónico inválido.');
    if (p.length < 6) return showError('La contraseña debe tener al menos 6 caracteres.');
    if (p !== c) return showError('Las contraseñas no coinciden.');

    setLoading('registerBtn', true);
    state.auth.createUserWithEmailAndPassword(e, p)
        .then(() => showToast('Cuenta creada exitosamente.', 'success'))
        .catch(err => showError(getFirebaseErrorMessage(err)))
        .finally(() => setLoading('registerBtn', false));
}

export function loginUser() {
    const e = document.getElementById('loginEmail').value.trim();
    const p = document.getElementById('loginPassword').value;

    showError('');
    if (!validateEmail(e)) return showError('Correo electrónico inválido.');
    if (!p) return showError('Ingresa tu contraseña.');

    setLoading('loginBtn', true);
    state.auth.signInWithEmailAndPassword(e, p)
        .catch(err => showError(getFirebaseErrorMessage(err)))
        .finally(() => setLoading('loginBtn', false));
}

export function logoutUser() { state.auth.signOut(); }

// Caps Lock detection
document.querySelectorAll('input[type="password"]').forEach(input => {
    input.addEventListener('keydown', (e) => {
        const warn = document.getElementById('capsLockWarning');
        if (!warn) return;
        if (e.getModifierState('CapsLock')) {
            warn.classList.remove('hidden');
        } else {
            warn.classList.add('hidden');
        }
    });
    input.addEventListener('keyup', (e) => {
        const warn = document.getElementById('capsLockWarning');
        if (!warn) return;
        if (e.getModifierState('CapsLock')) {
            warn.classList.remove('hidden');
        } else {
            warn.classList.add('hidden');
        }
    });
});

export function setupAuthListener() {
    state.auth.onAuthStateChanged(async (user) => {
        if (user) {
            document.getElementById('loading-overlay').style.display = 'flex';
            state.initialLoadCounter = 0;
            state.currentUserId = user.uid;
            document.getElementById('authSection').style.display = 'none';
            document.querySelector('.app-container').style.display = 'flex';
            document.getElementById('userEmail').textContent = user.email.split('@')[0];

            if (localStorage.getItem('soundEnabled') === 'true') {
                const btn = document.getElementById('enableSoundBtn');
                if (btn) btn.style.display = 'none';
            }

            const { loadConfig } = await import('./config.js');
            await loadConfig();

            // Safety timeout: hide loading after 10s regardless
            setTimeout(() => {
                const overlay = document.getElementById('loading-overlay');
                if (overlay && overlay.style.display !== 'none') overlay.style.display = 'none';
            }, 10000);

            window.loadOperations();
            window.loadWallyOperations();
            window.loadUserRatings();
            window.loadUserProfiles();

            document.getElementById('selectedDate').value = state.currentDate;
            document.getElementById('wallySelectedDate').value = state.currentWallyDate;
            window.showPage('operate');
            const { setupFCM } = await import('./notifications.js');
            setupFCM();
        } else {
            state.currentUserId = null;
            document.getElementById('authSection').style.display = 'flex';
            document.querySelector('.app-container').style.display = 'none';
            document.getElementById('loading-overlay').style.display = 'none';
            const { removeFCMToken } = await import('./notifications.js');
            removeFCMToken();
        }
    });
}
