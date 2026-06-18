import { userConfig, currentDate, operations, currentLotsData, currentPendingData, editingIndex, defaultDashboardGoals, defaultProfitGoals, setCurrentLotsData, setCurrentPendingData, userRatings } from './state.js';
import { showToast } from './ui.js';

let initialLoadCounter = 0;
const TOTAL_INITIAL_LOADS = 5;

export function resetInitialLoadCounter() {
    initialLoadCounter = 0;
}

export function checkInitialLoadComplete() {
    initialLoadCounter++;
    if (initialLoadCounter >= TOTAL_INITIAL_LOADS) {
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

export const getLocalDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export function calculateAll() {
    const tasa = parseFloat(document.getElementById('tasa').value) || 0;
    const montoUsdcOriginal = parseFloat(document.getElementById('montoUsdc').value) || 0;
    const operacion = document.getElementById('operacion').value;
    const metodoPago = document.getElementById('metodoPago').value;
    const platformSelect = document.getElementById('p2pPlatformSelect');
    const platform = userConfig.p2pPlatforms.find(p => p.name === platformSelect.value);
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

    ['displayMontoBs', 'montoBs'].forEach(id => document.getElementById(id).textContent = document.getElementById(id).value = montoBs.toFixed(2));
    ['displayComision', 'comisionVes'].forEach(id => document.getElementById(id).textContent = document.getElementById(id).value = comisionVes.toFixed(2));
    ['displayTotal', 'total'].forEach(id => document.getElementById(id).textContent = document.getElementById(id).value = total.toFixed(2));
}

export function clearForm() {
    const form = document.getElementById('operationModal');
    form.querySelectorAll('input, select').forEach(i => {
        if(i.type !== 'checkbox') i.value = '';
        else i.checked = false;
    });
    document.getElementById('operacion').value = "Compra";
    document.getElementById('estatus').value = "En Curso";
    const defaultPlatform = userConfig.p2pPlatforms.find(p => p.isDefault);
    if(defaultPlatform) {
        document.getElementById('p2pPlatformSelect').value = defaultPlatform.name;
    }
    calculateAll();
}

export function getRatingIndicator(userName) {
    const avg = calculateAverageRating(userName);
    return avg > 0 ? `<span class="text-xs text-yellow-400 font-bold ml-2">${avg.toFixed(1)} ★</span>` : '';
}

export function calculateAverageRating(userName) {
    if (!userRatings[userName] || userRatings[userName].length === 0) return 0;
    let totalSum = 0, count = 0;
    userRatings[userName].forEach(r => {
        if (r.transaction > 0) { totalSum += r.transaction; count++; }
        if (r.speed > 0) { totalSum += r.speed; count++; }
    });
    return count > 0 ? totalSum / count : 0;
}

export function calculateBankBreaches() {
    const currentOps = operations.filter(op => op.fecha === currentDate), bankData = {};
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
    if (bankBreaches.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">No hay datos.</p>';
        return;
    }
    container.innerHTML = bankBreaches.map(d =>
        `<div class="info-card"><div class="info-card-title">${d.metodo}</div><div class="info-card-value" style="color: ${d.brecha > 0 ? 'var(--success)' : 'var(--danger)'}">${d.brecha.toFixed(2)}%</div><div class="info-card-details">C:${d.promCompra.toFixed(2)}|V:${d.promVenta.toFixed(2)}</div></div>`
    ).join('');
}

export function renderLotDetailsCards() {
    const container = document.getElementById('lotDetailsCards');
    const activeLots = Array.from(currentLotsData.values()).filter(l => l.estado === 'activo');
    if(activeLots.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">No hay lotes activos.</p>';
        return;
    }
    container.innerHTML = activeLots.map(lot => {
        const percentConsumed = lot.montoTotal > 0 ? (lot.montoConsumido / lot.montoTotal) * 100 : 0;
        const restante = lot.montoTotal - lot.montoConsumido;
        return `<div class="info-card p-4 flex flex-col justify-between"><div><div class="info-card-title text-base">Lote ${lot.id}</div><div class="info-card-value text-2xl" style="color: var(--primary); margin-bottom: 0.75rem;">${percentConsumed.toFixed(1)}% <span class="text-lg font-normal">Consumido</span></div><div class="info-card-details space-y-1 text-left"><div class="flex justify-between"><span>Total:</span> <strong class="font-mono">${lot.montoTotal.toFixed(2)} USDC</strong></div><div class="flex justify-between"><span>Consumido:</span> <strong class="font-mono text-green-400">${lot.montoConsumido.toFixed(2)} USDC</strong></div><div class="flex justify-between"><span>Restante:</span> <strong class="font-mono text-yellow-400">${restante.toFixed(2)} USDC</strong></div></div></div><div class="w-full bg-gray-700 rounded-full h-2.5 mt-4"><div class="bg-blue-500 h-2.5 rounded-full" style="width: ${percentConsumed}%"></div></div></div>`;
    }).join('');
}

export function renderPendingDetails() {
    document.getElementById('pendingRepurchaseSummary').textContent = `${currentPendingData.recompra.toFixed(2)} USDC`;
    document.getElementById('pendingResaleSummary').textContent = `${currentPendingData.reventa.toFixed(2)} USDC`;
    const repurchaseList = document.getElementById('pendingRepurchaseList');
    repurchaseList.innerHTML = currentPendingData.recompra === 0
        ? '<p class="text-xs text-gray-400">No hay recompra pendiente.</p>'
        : `<div class="operation-list-item">Monto Total: <span class="font-semibold">${currentPendingData.recompra.toFixed(2)} USDC</span></div>`;
    const resaleList = document.getElementById('pendingResaleList');
    resaleList.innerHTML = currentPendingData.reventa === 0
        ? '<p class="text-xs text-gray-400">No hay reventa pendiente.</p>'
        : `<div class="operation-list-item">Monto Total: <span class="font-semibold">${currentPendingData.reventa.toFixed(2)} USDC</span></div>`;
}

export function renderDailyGoals(currentVes, currentUsdcFromVes, currentCrypto, currentUsd) {
    const container = document.getElementById('dailyGoalsContainer');
    container.innerHTML = '';

    const goalsToShow = userConfig.dashboardGoals || defaultDashboardGoals;
    const profitGoals = userConfig.profitGoals || defaultProfitGoals;

    let visibleGoalsCount = 0;

    if (goalsToShow.ves) {
        visibleGoalsCount++;
        const goal = profitGoals.ves || 0;
        const percentage = Math.min(goal > 0 ? (currentUsdcFromVes / goal) * 100 : 0, 100);
        container.innerHTML += `
            <div>
                <div class="flex justify-between items-center text-sm mb-2">
                    <span class="font-medium text-gray-400">META OP (CRIPTO)</span>
                    <span class="font-semibold">${currentUsdcFromVes.toFixed(2)} / ${goal.toFixed(2)} USDC</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2">
                    <div class="bg-blue-500 h-2 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
            </div>`;
    }

    if (goalsToShow.crypto) {
        visibleGoalsCount++;
        const goal = profitGoals.crypto || 0;
        const percentage = Math.min(goal > 0 ? (currentCrypto / goal) * 100 : 0, 100);
        container.innerHTML += `
            <div>
                <div class="flex justify-between items-center text-sm mb-2">
                    <span class="font-medium text-gray-400">META OP WALLET (CRIPTO)</span>
                    <span class="font-semibold">${currentCrypto.toFixed(2)} / ${goal.toFixed(2)} USDC</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2">
                    <div class="bg-orange-400 h-2 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
            </div>`;
    }

    if (goalsToShow.usd) {
        visibleGoalsCount++;
        const goal = profitGoals.usd || 0;
        const percentage = Math.min(goal > 0 ? (currentUsd / goal) * 100 : 0, 100);
        container.innerHTML += `
            <div>
                <div class="flex justify-between items-center text-sm mb-2">
                    <span class="font-medium text-gray-400">META OP WALLET (USD)</span>
                    <span class="font-semibold">${currentUsd.toFixed(2)} / ${goal.toFixed(2)} USD</span>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2">
                    <div class="bg-purple-400 h-2 rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
            </div>`;
    }

    if (visibleGoalsCount === 0) {
        container.innerHTML = `<p class="text-center text-sm text-gray-500">No hay metas seleccionadas. Ve a Ajustes para activar alguna.</p>`;
    }
}
