import { state, db, messaging } from './state.js';
import { showToast } from './ui.js';

const FCM_TOKEN_KEY = 'dashsyFcmToken';

export async function setupFCM() {
    if (!messaging || !state.currentUserId) return;
    if (Notification.permission === 'denied') return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    try {
        const currentToken = await messaging.getToken({ vapidKey: 'BKsQrPn3JPiyJjKPiMA3xYqnLr4eZFKuMG-EIwlLRK9-4L_b0Z40bjVAY_0wwszOQl1VKC95XdqIk25nfWbbOmQ' });
        localStorage.setItem(FCM_TOKEN_KEY, currentToken);
        await db.collection('users').doc(state.currentUserId).collection('fcmTokens').doc(currentToken).set({
            token: currentToken,
            userAgent: navigator.userAgent,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) {
        console.warn('FCM token registration failed:', e);
    }
}

export async function removeFCMToken() {
    const saved = localStorage.getItem(FCM_TOKEN_KEY);
    if (!saved || !messaging || !state.currentUserId) return;
    try {
        await messaging.deleteToken(saved);
        await db.collection('users').doc(state.currentUserId).collection('fcmTokens').doc(saved).delete();
    } catch (e) {
        console.warn('FCM token removal failed:', e);
    }
    localStorage.removeItem(FCM_TOKEN_KEY);
}

export function enableAudio() {
    const sound = document.getElementById('notificationSound');
    sound.play().then(() => {
        sound.pause();
        sound.currentTime = 0;
        localStorage.setItem('soundEnabled', 'true');
        showToast('¡Sonido habilitado!', 'success');
        const btn = document.getElementById('enableSoundBtn');
        if (btn) btn.style.display = 'none';
    }).catch(error => {
        console.error("Error al habilitar audio:", error);
        showToast('El navegador bloqueó la activación del audio.', 'error');
    });
}

export function showLotClosedAnimation(profit) {
    const container = document.getElementById('lotClosedAnimation');
    const profitEl = document.getElementById('lotAnimationProfit');
    const sound = document.getElementById('notificationSound');
    profitEl.textContent = `${profit.toFixed(2)} VES`;
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    sound.currentTime = 0;
    sound.play().catch(error => {
        console.log("Audio bloqueado. El usuario debe habilitarlo en Ajustes.", error);
        showToast('Sonido bloqueado. Habilítalo en Ajustes.', 'warning');
    });
    container.classList.remove('hide');
    container.classList.add('show');
    setTimeout(() => {
        container.classList.remove('show');
        container.classList.add('hide');
    }, 3500);
}

export function getShownLots() {
    const shownLotsJSON = localStorage.getItem('shownLotNotifications');
    return shownLotsJSON ? new Set(JSON.parse(shownLotsJSON)) : new Set();
}

export function addShownLot(lotId) {
    const shownLots = getShownLots();
    shownLots.add(lotId);
    localStorage.setItem('shownLotNotifications', JSON.stringify(Array.from(shownLots)));
}

export function calculateLotProfit(lot) {
    if (lot.ventaOp && lot.ventaOp.ves) return lot.ventaOp.ves;
    return lot.comprasAsociadas.reduce((totalProfit, compra) => totalProfit + (compra.op.ves || 0), 0);
}

let deferredPrompt = null;

export function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(result => {
        if (result.outcome === 'accepted') {
            showToast('App instalada correctamente.', 'success');
            document.getElementById('installAppBtn')?.remove();
        }
        deferredPrompt = null;
    });
}

export function setupServiceWorker() {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('installAppBtn');
        if (installBtn) installBtn.style.display = '';
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            let newWorker;
            navigator.serviceWorker.register('./sw.js').then(reg => {
                reg.addEventListener('updatefound', () => {
                    newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            const notification = document.getElementById('update-notification');
                            notification.classList.add('show');
                            const reloadButton = document.getElementById('update-reload-button');
                            reloadButton.addEventListener('click', () => {
                                reloadButton.classList.add('loading');
                                const textSpan = reloadButton.querySelector('.btn-text');
                                if (textSpan) textSpan.textContent = 'Actualizando...';
                                newWorker.postMessage({ type: 'SKIP_WAITING' });
                            });
                        }
                    });
                });
            });
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                window.location.reload();
            });
        });
    }
}
