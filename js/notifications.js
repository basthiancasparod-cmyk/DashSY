import { showToast } from './ui.js';

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
    return lot.comprasAsociadas.reduce((totalProfit, compra) => {
        return totalProfit + (compra.op.ves || 0);
    }, 0);
}
