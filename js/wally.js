import { state, db } from './state.js';
import { showToast } from './ui.js';
import { getRatingIndicator, sanitizeHTML, checkInitialLoadComplete } from './utils.js';
import { queueOperation, registerSync } from './bg-sync.js';

let _wallyUnsubscribe = null;

export function loadWallyOperations() {
    if (!state.currentUserId) return;
    if (_wallyUnsubscribe) { _wallyUnsubscribe(); _wallyUnsubscribe = null; }
    _wallyUnsubscribe = db.collection('users').doc(state.currentUserId).collection('wallyOperations').orderBy('timestamp', 'desc').onSnapshot(s => {
        state.wallyOperations = s.docs.map(d => ({ id: d.id, ...d.data() }));
        if (window.currentProfileUserName) window.openUserProfileModal(window.currentProfileUserName);
        updateWallySummary();
        checkInitialLoadComplete();
    }, e => { console.error(e); checkInitialLoadComplete(); });
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && _wallyUnsubscribe) {
        _wallyUnsubscribe();
        _wallyUnsubscribe = null;
    } else if (!document.hidden && state.currentUserId && !_wallyUnsubscribe) {
        loadWallyOperations();
    }
});

export function calculateWallyGainsForPeriod(periodOps) {
    const compras = periodOps.filter(op => op.operacion === 'Compra');
    const ventas = periodOps.filter(op => op.operacion === 'Venta');
    const totalGananciaUsdc = compras.reduce((s, op) => s + (op.gananciaUsdc || 0), 0);
    const totalGananciaUsd = ventas.reduce((s, op) => s + (op.gananciaUsd || 0), 0);
    return [totalGananciaUsdc, totalGananciaUsd];
}

export async function updateWallySummary() {
    if (!state.wallyOperations) return;
    const currentOps = state.wallyOperations.filter(op => op.fecha === state.currentWallyDate);
    const [totalGananciaUsdc, totalGananciaUsd] = calculateWallyGainsForPeriod(currentOps);
    state.wallyTotalGains = { usdc: totalGananciaUsdc, usd: totalGananciaUsd };
    const wallyGananciasEl = document.getElementById("wallyGanancias");
    if (wallyGananciasEl) {
        wallyGananciasEl.innerHTML = `<span class="text-orange-400">${totalGananciaUsdc.toFixed(2)}</span> <span class="text-xl font-semibold">USDC</span> / <span class="text-purple-400">${totalGananciaUsd.toFixed(2)}</span> <span class="text-xl font-semibold">USD</span>`;
    }
    renderWallyTables();
    const { updateSummary } = await import('./operations.js');
    updateSummary();
}

export function renderWallyForm(op = {}) {
    const platforms = state.userConfig.p2pPlatforms || [];
    const defaultPlatform = state.userConfig.p2pPlatforms.find(p => p.isDefault);
    const platformOptions = platforms.map(p => {
        const isSelected = op.platform ? op.platform === p.name : (defaultPlatform && defaultPlatform.name === p.name);
        return `<option value="${p.name}" ${isSelected ? 'selected' : ''}>${p.name}</option>`;
    }).join('');
    const usdMethods = state.userConfig.paymentMethods.usd || [];
    const usdMethodOptions = usdMethods.map(m => `<option value="${m}" ${op.metodoPago === m ? 'selected' : ''}>${m}</option>`).join('');
    document.getElementById('wallyFormContent').innerHTML = `
        <div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-5 items-center">
            <label class="text-sm text-gray-400 justify-self-end">Usuario</label> <input type="text" id="wallyUsuario" value="${op.usuario || ''}" class="form-field-grid">
            <label class="text-sm text-gray-400 justify-self-end">Referencia</label> <input type="text" id="wallyReferencia" value="${op.referencia || ''}" class="form-field-grid">
            <label class="text-sm text-gray-400 justify-self-end">Método de Pago</label> <select id="wallyMetodoPago" class="form-field-grid">${usdMethodOptions}</select>
            <label class="text-sm text-gray-400 justify-self-end">Plataforma P2P</label> <select id="wallyPlatform" onchange="updateWallyCalculations()" class="form-field-grid">${platformOptions}</select>
            <label class="text-sm text-gray-400 justify-self-end">Operación</label> <select id="wallyOperacion" onchange="updateWallyFormFields()" class="form-field-grid"><option value="Compra" ${op.operacion === 'Compra' || !op.operacion ? 'selected' : ''}>Compra (Recibo Cripto)</option><option value="Venta" ${op.operacion === 'Venta' ? 'selected' : ''}>Venta (Recibo USD)</option></select>
            <hr class="border-gray-700 my-2 col-span-2">
            <label class="text-sm text-gray-400 justify-self-end wally-compra-field">Recibo Cripto</label> <input type="number" id="reciboUsdc" value="${op.reciboUsdc || ''}" onkeyup="updateWallyCalculations()" class="form-field-grid wally-compra-field">
            <label class="text-sm text-gray-400 justify-self-end wally-compra-field">Tasa Compra</label> <input type="number" id="tasaCompra" value="${op.tasaCompra || ''}" onkeyup="updateWallyCalculations()" class="form-field-grid wally-compra-field">
            <label class="text-sm text-gray-500 justify-self-end wally-compra-field">Envío USD</label> <input type="number" id="envioUsd" value="${op.envioUsd || ''}" readonly class="form-field-grid bg-gray-800 border-gray-600 wally-compra-field">
            <label class="text-sm text-gray-500 justify-self-end wally-compra-field">Comisión Cripto</label> <input type="number" id="commissionUsdc" value="${op.commissionAmount || ''}" readonly class="form-field-grid bg-gray-800 border-gray-600 wally-compra-field">
            <label class="text-sm text-green-400 font-bold justify-self-end wally-compra-field">Ganancia Neta</label> <input type="number" id="gananciaUsdc" value="${op.gananciaUsdc || ''}" readonly class="form-field-grid bg-gray-800 border-green-500/50 wally-compra-field">
            <label class="text-sm text-gray-400 justify-self-end wally-venta-field">Envío CRIPTO</label> <input type="number" id="envioUsdcVenta" value="${op.envioUsdc || ''}" onkeyup="updateWallyCalculations()" class="form-field-grid wally-venta-field">
            <label class="text-sm text-gray-400 justify-self-end wally-venta-field">Tasa Venta</label> <input type="number" id="tasaVenta" value="${op.tasaVenta || ''}" onkeyup="updateWallyCalculations()" class="form-field-grid wally-venta-field">
            <label class="text-sm text-gray-500 justify-self-end wally-venta-field">Recibo USD</label> <input type="number" id="reciboUsdCalculado" value="${op.reciboUsd || ''}" readonly class="form-field-grid bg-gray-800 border-gray-600 wally-venta-field">
            <label class="text-sm text-gray-500 justify-self-end wally-venta-field">Comisión Cripto</label> <input type="number" id="commissionUsd" value="${op.commissionAmount || ''}" readonly class="form-field-grid bg-gray-800 border-gray-600 wally-venta-field">
            <label class="text-sm text-green-400 font-bold justify-self-end wally-venta-field">Ganancia Neta</label> <input type="number" id="gananciaUsd" value="${op.gananciaUsd || ''}" readonly class="form-field-grid bg-gray-800 border-green-500/50 wally-venta-field">
        </div>`;
    updateWallyFormFields();
}

export function updateWallyFormFields() {
    const operacion = document.getElementById('wallyOperacion').value;
    document.querySelectorAll('.wally-compra-field').forEach(el => el.style.display = operacion === 'Compra' ? '' : 'none');
    document.querySelectorAll('.wally-venta-field').forEach(el => el.style.display = operacion === 'Venta' ? '' : 'none');
    updateWallyCalculations();
}

export function updateWallyCalculations() {
    const operacion = document.getElementById('wallyOperacion').value;
    const platformName = document.getElementById('wallyPlatform').value;
    const platform = state.userConfig.p2pPlatforms.find(p => p.name === platformName);
    const commissionRate = platform ? platform.commission : 0;
    if (operacion === 'Compra') {
        const r = parseFloat(document.getElementById('reciboUsdc').value) || 0;
        const t = parseFloat(document.getElementById('tasaCompra').value) || 0;
        if (t && (t < 0.9 || t > 1.1)) {
            console.warn(`Tasa inusual USD/USDC: ${t}. Verifica el valor ingresado.`);
        }
        const envio = r * t;
        const grossGain = r - envio;
        const commissionAmount = r * (commissionRate / 100);
        const netGain = grossGain - commissionAmount;
        document.getElementById('envioUsd').value = envio.toFixed(2);
        document.getElementById('commissionUsdc').value = commissionAmount.toFixed(4);
        document.getElementById('gananciaUsdc').value = netGain.toFixed(4);
    } else {
        const e = parseFloat(document.getElementById('envioUsdcVenta').value) || 0;
        const t = parseFloat(document.getElementById('tasaVenta').value) || 0;
        if (t && (t < 0.9 || t > 1.1)) {
            console.warn(`Tasa inusual USD/USDC: ${t}. Verifica el valor ingresado.`);
        }
        const recibo = e * t;
        const grossGain = recibo - e;
        const commissionAmount = e * (commissionRate / 100);
        const netGain = grossGain - commissionAmount;
        document.getElementById('reciboUsdCalculado').value = recibo.toFixed(2);
        document.getElementById('commissionUsd').value = commissionAmount.toFixed(4);
        document.getElementById('gananciaUsd').value = netGain.toFixed(4);
    }
}

export function saveWallyOperation() {
    if (!state.currentUserId) return;
    const saveBtn = document.getElementById('saveWallyBtn');
    saveBtn.classList.add('loading');
    const isEditing = state.editingWallyIndex > -1;
    const operacion = document.getElementById('wallyOperacion').value;
    let opData = {
        usuario: document.getElementById('wallyUsuario').value,
        referencia: document.getElementById('wallyReferencia').value,
        operacion,
        platform: document.getElementById('wallyPlatform').value,
        metodoPago: document.getElementById('wallyMetodoPago').value,
        fecha: isEditing ? state.wallyOperations[state.editingWallyIndex].fecha : state.currentWallyDate,
        timestamp: isEditing ? state.wallyOperations[state.editingWallyIndex].timestamp : Date.now()
    };
    if (operacion === 'Compra') {
        Object.assign(opData, {
            reciboUsdc: parseFloat(document.getElementById('reciboUsdc').value) || 0,
            tasaCompra: parseFloat(document.getElementById('tasaCompra').value) || 0,
            envioUsd: parseFloat(document.getElementById('envioUsd').value) || 0,
            gananciaUsdc: parseFloat(document.getElementById('gananciaUsdc').value) || 0,
            commissionAmount: parseFloat(document.getElementById('commissionUsdc').value) || 0
        });
    } else {
        Object.assign(opData, {
            envioUsdc: parseFloat(document.getElementById('envioUsdcVenta').value) || 0,
            tasaVenta: parseFloat(document.getElementById('tasaVenta').value) || 0,
            reciboUsd: parseFloat(document.getElementById('reciboUsdCalculado').value) || 0,
            gananciaUsd: parseFloat(document.getElementById('gananciaUsd').value) || 0,
            commissionAmount: parseFloat(document.getElementById('commissionUsd').value) || 0
        });
    }
    if (!opData.usuario || !opData.metodoPago) {
        showToast('Usuario y Método de Pago son requeridos.', 'error');
        saveBtn.classList.remove('loading');
        return;
    }
    const opId = isEditing ? state.wallyOperations[state.editingWallyIndex].id : db.collection('users').doc(state.currentUserId).collection('wallyOperations').doc().id;
    db.collection('users').doc(state.currentUserId).collection('wallyOperations').doc(opId).set(opData, { merge: true }).then(() => {
        document.getElementById('closeWallyBtn')?.click();
        window.closeWallyModal();
        showToast('Op. USD guardada.', 'success');
        if (!isEditing) {
            state.lastSavedUser = opData.usuario;
            state.lastSavedOperationType = 'wally';
            window.openRatingModal(opData.usuario);
        }
    }).catch(e => {
        console.error("Error al guardar op USD:", e);
        queueOperation(state.currentUserId, 'wallyOperations', opId, opData).then(() => {
            registerSync();
            document.getElementById('closeWallyBtn')?.click();
            window.closeWallyModal();
            showToast('Sin conexión. Se sincronizará automáticamente.', 'warning');
        }).catch(qe => {
            showToast('Error. Verifica tu conexión.', 'error');
            console.error("Error al encolar op USD:", qe);
        });
    }).finally(() => { saveBtn.classList.remove('loading'); });
}

export function deleteWallyOperation(operationId) {
    if (!state.currentUserId) return;
    const opToDelete = state.wallyOperations.find(op => op.id === operationId);
    const message = opToDelete ? `¿Seguro que quieres eliminar la operación USD de "${opToDelete.usuario}"?` : '¿Estás seguro de que deseas eliminar esta operación USD?';
    window.openConfirmModal(message, () => {
        db.collection('users').doc(state.currentUserId).collection('wallyOperations').doc(operationId).delete()
            .then(() => showToast('Operación USD eliminada.', 'info'))
            .catch(error => showToast('Error al eliminar la operación.', 'error'));
    });
}

export function renderWallyTables() {
    const searchTerm = document.getElementById('searchWallyOperations').value.toLowerCase();
    const filterOperacion = document.getElementById('filterWallyOperacion').value;
    const filterMetodo = document.getElementById('filterWallyMetodoPago').value;
    const filteredOps = state.wallyOperations.filter(op => {
        const searchMatch = op.usuario.toLowerCase().includes(searchTerm) || (op.referencia && op.referencia.toLowerCase().includes(searchTerm));
        const operacionMatch = filterOperacion === '' || op.operacion === filterOperacion;
        const metodoMatch = filterMetodo === '' || op.metodoPago === filterMetodo;
        return op.fecha === state.currentWallyDate && searchMatch && operacionMatch && metodoMatch;
    });
    const compraTableBody = document.getElementById('wallyCompraTable'), compraListContainer = document.getElementById('wallyCompraList');
    const ventaTableBody = document.getElementById('wallyVentaTable'), ventaListContainer = document.getElementById('wallyVentaList');
    const comprasEmptyState = document.getElementById('wally-compras-empty-state');
    const ventasEmptyState = document.getElementById('wally-ventas-empty-state');
    const comprasCardContainer = document.querySelector('#wallyCompraList').closest('.card');
    const ventasCardContainer = document.querySelector('#wallyVentaList').closest('.card');
    compraTableBody.innerHTML = ''; compraListContainer.innerHTML = '';
    ventaTableBody.innerHTML = ''; ventaListContainer.innerHTML = '';
    const compras = filteredOps.filter(op => op.operacion === 'Compra');
    const ventas = filteredOps.filter(op => op.operacion === 'Venta');
    if (compras.length === 0) {
        comprasCardContainer.style.display = 'none';
        comprasEmptyState.style.display = 'block';
    } else {
        comprasCardContainer.style.display = 'block';
        comprasEmptyState.style.display = 'none';
        compras.forEach((op) => {
            const globalIndex = state.wallyOperations.findIndex(wOp => wOp.id === op.id);
            const sUsuario = sanitizeHTML(op.usuario);
            const sReferencia = sanitizeHTML(op.referencia);
            const sMetodo = sanitizeHTML(op.metodoPago);
            const sPlatform = sanitizeHTML(op.platform);
            const relationIndicator = `${sMetodo} ➡️ ${sPlatform || ''}`;
            const tableRowHtml = `<tr><td class="text-left"><div class="font-semibold flex items-center">${sUsuario} ${getRatingIndicator(op.usuario)}</div><div class="text-xs text-gray-400">${relationIndicator}</div></td><td>${(op.reciboUsdc||0).toFixed(2)}</td><td>${(op.tasaCompra||0).toFixed(4)}</td><td>${(op.envioUsd||0).toFixed(2)}</td><td class="font-semibold text-green-400">${(op.gananciaUsdc||0).toFixed(4)}</td><td><button type="button" class="text-blue-400 p-2 min-w-[44px] min-h-[44px]" onclick="openWallyModal(${globalIndex})" aria-label="Editar operación de ${sUsuario}">✏️</button><button type="button" class="text-red-400 p-2 min-w-[44px] min-h-[44px]" onclick="deleteWallyOperation('${op.id}')" aria-label="Eliminar operación de ${sUsuario}">🗑️</button></td></tr>`;
            const cardHtml = `<div class="operation-card compra"><div class="card-header"><div class="user-info flex items-center">${sUsuario} ${getRatingIndicator(op.usuario)}<div class="payment-method ml-auto">${relationIndicator}</div></div></div><div class="card-grid"><div class="grid-item"><span class="label">Recibo Cripto</span><span class="value">${(op.reciboUsdc||0).toFixed(2)}</span></div><div class="grid-item"><span class="label">Envío USD</span><span class="value">${(op.envioUsd||0).toFixed(2)}</span></div><div class="grid-item"><span class="label">Tasa</span><span class="value">${(op.tasaCompra||0).toFixed(4)}</span></div><div class="grid-item"><span class="label">Ganancia Cripto</span><span class="value profit-green">${(op.gananciaUsdc||0).toFixed(4)}</span></div></div><div class="card-footer"><div class="ref-info">REF: ${sReferencia || 'N/A'}</div><div class="actions"><button type="button" class="action-btn edit" onclick="openWallyModal(${globalIndex})" aria-label="Editar"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg></button><button type="button" class="action-btn delete" onclick="deleteWallyOperation('${op.id}')" aria-label="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.033c-1.12 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button></div></div></div>`;
            compraTableBody.innerHTML += tableRowHtml;
            compraListContainer.innerHTML += cardHtml;
        });
    }
    if (ventas.length === 0) {
        ventasCardContainer.style.display = 'none';
        ventasEmptyState.style.display = 'block';
    } else {
        ventasCardContainer.style.display = 'block';
        ventasEmptyState.style.display = 'none';
        ventas.forEach((op) => {
            const globalIndex = state.wallyOperations.findIndex(wOp => wOp.id === op.id);
            const sUsuario = sanitizeHTML(op.usuario);
            const sReferencia = sanitizeHTML(op.referencia);
            const sMetodo = sanitizeHTML(op.metodoPago);
            const sPlatform = sanitizeHTML(op.platform);
            const relationIndicator = `${sMetodo} ⬅️ ${sPlatform || ''}`;
            const tableRowHtml = `<tr><td class="text-left"><div class="font-semibold flex items-center">${sUsuario} ${getRatingIndicator(op.usuario)}</div><div class="text-xs text-gray-400">${relationIndicator}</div></td><td>${(op.envioUsdc||0).toFixed(2)}</td><td>${(op.tasaVenta||0).toFixed(4)}</td><td>${(op.reciboUsd||0).toFixed(2)}</td><td class="font-semibold text-green-400">${(op.gananciaUsd||0).toFixed(4)}</td><td><button type="button" class="text-blue-400 p-2 min-w-[44px] min-h-[44px]" onclick="openWallyModal(${globalIndex})" aria-label="Editar operación de ${sUsuario}">✏️</button><button type="button" class="text-red-400 p-2 min-w-[44px] min-h-[44px]" onclick="deleteWallyOperation('${op.id}')" aria-label="Eliminar operación de ${sUsuario}">🗑️</button></td></tr>`;
            const cardHtml = `<div class="operation-card venta"><div class="card-header"><div class="user-info flex items-center">${sUsuario} ${getRatingIndicator(op.usuario)}<div class="payment-method ml-auto">${relationIndicator}</div></div></div><div class="card-grid"><div class="grid-item"><span class="label">Envío Cripto</span><span class="value">${(op.envioUsdc||0).toFixed(2)}</span></div><div class="grid-item"><span class="label">Recibo USD</span><span class="value">${(op.reciboUsd||0).toFixed(2)}</span></div><div class="grid-item"><span class="label">Tasa</span><span class="value">${(op.tasaVenta||0).toFixed(4)}</span></div><div class="grid-item"><span class="label">Ganancia USD</span><span class="value profit-green">${(op.gananciaUsd||0).toFixed(4)}</span></div></div><div class="card-footer"><div class="ref-info">REF: ${sReferencia || 'N/A'}</div><div class="actions"><button type="button" class="action-btn edit" onclick="openWallyModal(${globalIndex})" aria-label="Editar"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg></button><button type="button" class="action-btn delete" onclick="deleteWallyOperation('${op.id}')" aria-label="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.033c-1.12 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button></div></div></div>`;
            ventaTableBody.innerHTML += tableRowHtml;
            ventaListContainer.innerHTML += cardHtml;
        });
    }
}
