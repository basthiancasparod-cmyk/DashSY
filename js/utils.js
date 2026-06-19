import { state, defaultProfitGoals, defaultDashboardGoals } from './state.js';

export function clearForm() {
    const form = document.getElementById('operationModal');
    form.querySelectorAll('input, select').forEach(i => {
        if (i.type !== 'checkbox') i.value = '';
        else i.checked = false;
    });
    document.getElementById('operacion').value = "Compra";
    document.getElementById('estatus').value = "En Curso";
    const defaultPlatform = state.userConfig.p2pPlatforms.find(p => p.isDefault);
    if (defaultPlatform) document.getElementById('p2pPlatformSelect').value = defaultPlatform.name;
    const titleEl = document.getElementById('modalTitle');
    if (titleEl) titleEl.textContent = 'Nueva Operación';
    calculateAll();
}

export function calculateAll() {
    const tasa = parseFloat(document.getElementById('tasa').value) || 0;
    const montoUsdcOriginal = parseFloat(document.getElementById('montoUsdc').value) || 0;
    const operacion = document.getElementById('operacion').value;
    const metodoPago = document.getElementById('metodoPago').value;
    const platformSelect = document.getElementById('p2pPlatformSelect');
    const platform = state.userConfig.p2pPlatforms.find(p => p.name === platformSelect.value);
    const commissionRate = platform ? platform.commission / 100 : 0;
    const montoBs = montoUsdcOriginal * tasa;
    let comisionVes = 0;
    if (operacion === 'Compra' && metodoPago === 'Pagomovil') {
        comisionVes = montoBs * 0.003;
    }
    let total = montoBs + comisionVes;
    const adCommissionRow = document.getElementById('displayAdCommissionRow');
    const adCommissionLabel = document.getElementById('displayAdCommissionLabel');
    const adCommissionDisplay = document.getElementById('displayAdCommission');
    if (commissionRate > 0 && montoUsdcOriginal > 0) {
        const commissionAmountUsdc = montoUsdcOriginal * commissionRate;
        if (operacion === 'Venta') {
            const totalDebitUsdc = montoUsdcOriginal * (1 + commissionRate);
            adCommissionLabel.textContent = `Comisión Apolo (0.2%):`;
            adCommissionDisplay.textContent = `+${commissionAmountUsdc.toFixed(4)} (Costo Total: ${totalDebitUsdc.toFixed(4)} USDT)`;
        } else {
            const netReceivedUsdc = montoUsdcOriginal * (1 - commissionRate);
            adCommissionLabel.textContent = `Comisión Apolo (0.2%):`;
            adCommissionDisplay.textContent = `-${commissionAmountUsdc.toFixed(4)} (Neto a recibir: ${netReceivedUsdc.toFixed(4)} USDT)`;
        }
        adCommissionRow.style.display = 'flex';
    } else {
        adCommissionRow.style.display = 'none';
    }
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) { if ('value' in el) el.value = val; el.textContent = val; } };
    setVal('displayMontoBs', montoBs.toFixed(2));
    setVal('montoBs', montoBs.toFixed(2));
    setVal('displayComision', comisionVes.toFixed(2));
    setVal('comisionVes', comisionVes.toFixed(2));
    setVal('displayTotal', total.toFixed(2));
    setVal('total', total.toFixed(2));
}

export function getRatingIndicator(userName) {
    const avg = calculateAverageRating(userName);
    return avg > 0 ? `<span class="text-xs text-yellow-400 font-bold ml-2">${avg.toFixed(1)} ★</span>` : '';
}

function calculateAverageRating(userName) {
    if (!state.userRatings[userName] || state.userRatings[userName].length === 0) return 0;
    let totalSum = 0, count = 0;
    state.userRatings[userName].forEach(r => {
        if (r.transaction > 0) { totalSum += r.transaction; count++; }
        if (r.speed > 0) { totalSum += r.speed; count++; }
    });
    return count > 0 ? totalSum / count : 0;
}

export function calculateBankBreaches() {
    const currentOps = state.operations.filter(op => op.fecha === state.currentDate), bankData = {};
    currentOps.forEach(op => {
        if (!bankData[op.metodoPago]) bankData[op.metodoPago] = { compras: [], ventas: [] };
        if (op.operacion === 'Compra') bankData[op.metodoPago].compras.push(op.tasa);
        else if (op.operacion === 'Venta') bankData[op.metodoPago].ventas.push(op.tasa);
    });
    const results = [];
    for (const method in bankData) {
        const { compras, ventas } = bankData[method];
        const promCompra = compras.length > 0 ? compras.reduce((a, b) => a + b, 0) / compras.length : 0;
        const promVenta = ventas.length > 0 ? ventas.reduce((a, b) => a + b, 0) / ventas.length : 0;
        const brecha = promVenta > 0 && promCompra > 0 ? ((promVenta - promCompra) / promCompra * 100) : 0;
        results.push({ metodo: method, promCompra, promVenta, brecha });
    }
    return results;
}

export function renderBankBreachesCards() {
    const container = document.getElementById('bankBreachCards');
    const bankBreaches = calculateBankBreaches();
    if (bankBreaches.length === 0) { container.innerHTML = '<div class="flex flex-col items-center justify-center py-8 text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 mb-3 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg><p class="text-sm">No hay datos de brecha disponibles.</p></div>'; return; }
    container.innerHTML = bankBreaches.map(d => `<div class="info-card"><div class="flex items-center gap-3 mb-3"><div class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(250,204,21,0.15)"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-yellow-400"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg></div><div class="flex-1 min-w-0"><div class="info-card-title text-sm mb-0">${sanitizeHTML(d.metodo)}</div><div class="info-card-value text-lg" style="color: ${d.brecha > 0 ? 'var(--success)' : 'var(--danger)'}">${d.brecha.toFixed(2)}%</div></div></div><div class="grid grid-cols-2 gap-2 text-xs"><div class="flex items-center gap-1.5 bg-gray-800/50 rounded-lg px-3 py-2"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-red-400"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" /></svg><span><span class="text-gray-400">Compra:</span> <strong>${d.promCompra.toFixed(2)}</strong></span></div><div class="flex items-center gap-1.5 bg-gray-800/50 rounded-lg px-3 py-2"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg><span><span class="text-gray-400">Venta:</span> <strong>${d.promVenta.toFixed(2)}</strong></span></div></div></div>`).join('');
}

export function renderLotDetailsCards() {
    const container = document.getElementById('lotDetailsCards');
    const activeLots = Array.from(state.currentLotsData.values()).filter(l => l.estado === 'activo');
    if (activeLots.length === 0) { container.innerHTML = '<div class="flex flex-col items-center justify-center py-8 text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 mb-3 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg><p class="text-sm">No hay lotes activos.</p></div>'; return; }
    container.innerHTML = activeLots.map(lot => {
        const percentConsumed = lot.montoTotal > 0 ? (lot.montoConsumido / lot.montoTotal) * 100 : 0;
        const restante = lot.montoTotal - lot.montoConsumido;
        return `<div class="info-card p-4 flex flex-col justify-between"><div><div class="flex items-center gap-3 mb-3"><div class="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style="background: rgba(168,85,247,0.15)"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-purple-400"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M8.25 8.625l1.5-3h4.5l1.5 3M9 12h6" /></svg></div><div><div class="info-card-title text-base mb-0">Lote #${sanitizeHTML(String(lot.id))}</div><div class="info-card-value text-xl" style="color: var(--primary);">${percentConsumed.toFixed(1)}% <span class="text-sm font-normal text-gray-400">consumido</span></div></div></div><div class="space-y-2 mb-4"><div class="flex justify-between items-center px-2 py-1.5 bg-gray-800/30 rounded-lg"><span class="text-sm text-gray-400">Total:</span> <strong class="font-mono text-sm">${lot.montoTotal.toFixed(2)} USDC</strong></div><div class="flex justify-between items-center px-2 py-1.5 bg-gray-800/30 rounded-lg"><span class="text-sm text-gray-400">Consumido:</span> <strong class="font-mono text-sm text-green-400">${lot.montoConsumido.toFixed(2)} USDC</strong></div><div class="flex justify-between items-center px-2 py-1.5 bg-gray-800/30 rounded-lg"><span class="text-sm text-gray-400">Restante:</span> <strong class="font-mono text-sm text-yellow-400">${restante.toFixed(2)} USDC</strong></div></div></div><div class="w-full bg-gray-700 rounded-full h-2"><div class="rounded-full h-2 transition-all duration-500" style="width: ${percentConsumed}%; background: linear-gradient(90deg, var(--primary), #a78bfa)"></div></div></div>`;
    }).join('');
}

export function renderPendingDetails() {
    document.getElementById('pendingRepurchaseSummary').textContent = `${state.currentPendingData.recompra.toFixed(2)} USDC`;
    document.getElementById('pendingResaleSummary').textContent = `${state.currentPendingData.reventa.toFixed(2)} USDC`;
    const repurchaseList = document.getElementById('pendingRepurchaseList');
    repurchaseList.innerHTML = state.currentPendingData.recompra === 0
        ? '<div class="flex flex-col items-center py-6 text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 mb-2 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" /></svg><p class="text-xs">No hay recompra pendiente.</p></div>'
        : `<div class="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/50"><span class="text-sm text-gray-400">Monto Total</span><span class="font-semibold font-mono">${state.currentPendingData.recompra.toFixed(2)} USDC</span></div>`;
    const resaleList = document.getElementById('pendingResaleList');
    resaleList.innerHTML = state.currentPendingData.reventa === 0
        ? '<div class="flex flex-col items-center py-6 text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 mb-2 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg><p class="text-xs">No hay reventa pendiente.</p></div>'
        : `<div class="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/50"><span class="text-sm text-gray-400">Monto Total</span><span class="font-semibold font-mono">${state.currentPendingData.reventa.toFixed(2)} USDC</span></div>`;
}

export function sanitizeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (c) => {
        const m = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return m[c] || c;
    });
}

export function checkInitialLoadComplete() {
    state.initialLoadCounter++;
    if (state.initialLoadCounter >= 5) {
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

export function toggleAuthForms() {
    const l = document.getElementById('loginForm'), r = document.getElementById('registerForm');
    const isLogin = l.style.display !== 'none';
    document.getElementById('authError').textContent = '';
    document.getElementById('authError').style.opacity = '0';

    const fadeOut = isLogin ? l : r;
    const fadeIn = isLogin ? r : l;

    fadeOut.classList.add('fade-out');
    setTimeout(() => {
        fadeOut.style.display = 'none';
        fadeOut.classList.remove('fade-out');
        fadeIn.style.display = 'block';
        fadeIn.classList.add('fade-in');
        setTimeout(() => fadeIn.classList.remove('fade-in'), 300);
        const firstInput = fadeIn.querySelector('input');
        if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }, 200);
}
