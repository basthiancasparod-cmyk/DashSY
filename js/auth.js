import { auth, db } from './firebase-init.js';
import { setCurrentUserId } from './state.js';
import { loadConfig } from './config.js';
import { loadOperations } from './operations.js';
import { loadWallyOperations } from './wally.js';
import { loadUserRatings } from './ratings.js';
import { loadUserProfiles } from './ratings.js';
import { showPage } from './ui.js';
import { getLocalDate, checkInitialLoadComplete, resetInitialLoadCounter } from './utils.js';
import { setCurrentDate, setCurrentWallyDate } from './state.js';

const authSection = document.getElementById('authSection');
const appContainer = document.querySelector('.app-container');
const userEmailEl = document.getElementById('userEmail');
const authError = document.getElementById('authError');

auth.onAuthStateChanged(async (user) => {
    if (user) {
        document.getElementById('loading-overlay').style.display = 'flex';
        resetInitialLoadCounter();

        // Fallback: hide loading after 15s regardless of counter
        setTimeout(() => {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.style.display = 'none';
        }, 15000);

        setCurrentUserId(user.uid);
        authSection.style.display = 'none';
        appContainer.style.display = 'flex';
        userEmailEl.textContent = user.email.split('@')[0];

        if (localStorage.getItem('soundEnabled') === 'true') {
            const btn = document.getElementById('enableSoundBtn');
            if (btn) btn.style.display = 'none';
        }

        const today = getLocalDate();
        setCurrentDate(today);
        setCurrentWallyDate(today);

        await loadConfig();

        loadOperations();
        loadWallyOperations();
        loadUserRatings();
        loadUserProfiles();

        document.getElementById('selectedDate').value = today;
        document.getElementById('wallySelectedDate').value = today;
        showPage('operate');
    } else {
        setCurrentUserId(null);
        authSection.style.display = 'flex';
        appContainer.style.display = 'none';
        document.getElementById('loading-overlay').style.display = 'none';
    }
});

export function registerUser() {
    const e = document.getElementById('registerEmail').value;
    const p = document.getElementById('registerPassword').value;
    authError.textContent = '';
    auth.createUserWithEmailAndPassword(e, p).catch(err => {
        authError.textContent = 'Error: ' + err.message;
    });
}

export function loginUser() {
    const e = document.getElementById('loginEmail').value;
    const p = document.getElementById('loginPassword').value;
    authError.textContent = '';
    auth.signInWithEmailAndPassword(e, p).catch(err => {
        authError.textContent = 'Error: ' + err.message;
    });
}

export function logoutUser() {
    auth.signOut();
}

export function toggleAuthForms() {
    const l = document.getElementById('loginForm'), r = document.getElementById('registerForm');
    authError.textContent = '';
    l.style.display = l.style.display === 'none' ? 'block' : 'none';
    r.style.display = r.style.display === 'none' ? 'block' : 'none';
}
