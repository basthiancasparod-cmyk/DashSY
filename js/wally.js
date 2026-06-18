import { auth, db } from './firebase-init.js';
import { currentUserId, wallyOperations, userConfig, editingWallyIndex, currentWallyDate, setWallyOperations, setEditingWallyIndex, setLastSavedUser, setLastSavedOperationType, currentProfileUserName } from './state.js';
import { showToast } from './ui.js';
import { getRatingIndicator } from './utils.js';

export function calculateWallyGainsForPeriod(periodOps) {
    const compras = periodOps.filter(op => op.operacion === 'Compra');
    const ventas = periodOps.filter(op => op.operacion === 'Venta');
    const totalGananciaUsdc = compras.reduce((s, op) => s + (op.gananciaUsdc || 0), 0);
    const totalGananciaUsd = ventas.reduce((s, op) => s + (op.gananciaUsd || 0), 0);
    return [totalGananciaUsdc, totalGananciaUsd];
}

export function loadWallyOperations() {
    if (!currentUserId) return;
    db.collection('users').doc(currentUserId).collection('wallyOperations').orderBy('timestamp', 'desc').onSnapshot(s => {
        setWallyOperations(s.docs.map(d => ({ id: d.id, ...d.data() })));

        if (currentProfileUserName) window.openUserProfileModal(currentProfileUserName);

        updateWallySummary();
        window.checkInitialLoadComplete();
    }, e => { console.error(e); window.checkInitialLoadComplete(); });
}

export function openWallyModal(index = -1) {
    setEditingWallyIndex(index);
    document.getElementById('wallyModalTitle').textContent = index > -1 ? 'Editar Operación USD' : 'Agregar Nueva Operación';
    renderWallyForm(index > -1 ? wallyOperations[index] : {});
    document.getElementById('wallyModal').classList.add('show');
}

export function closeWallyModal() {
    document.getElementById('wallyModal').classList.remove('show');
}

function renderWallyForm(op = {}) {
    const platforms = userConfig.p2pPlatforms || [];
    const defaultPlatform = userConfig.p2pPlatforms.find(p => p.isDefault);
    const platformOptions = platforms.map(p => {
        const isSelected = op.platform ? op.platform === p.name : (defaultPlatform && defaultPlatform.name === p.name);
        return `<option value="${p.name}" ${isSelected ? 'selected' : ''}>${p.name}</option>`;
    }).join('');

    const usdMethods = userConfig.paymentMethods.usd || [];
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
        </div>
    `;
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
    const platform = userConfig.p2pPlatforms.find(p => p.name === platformName);
    const commissionRate = platform ? platform.commission : 0;

    if (operacion === 'Compra') {
        const r = parseFloat(document.getElementById('reciboUsdc').value) || 0;
        const t = parseFloat(document.getElementById('tasaCompra').value) || 0;
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
    if (!currentUserId) return;
    const saveBtn = document.getElementById('saveWallyBtn');
    saveBtn.classList.add('loading');

    const isEditing = editingWallyIndex > -1;
    const operacion = document.getElementById('wallyOperacion').value;

    let opData = {
        usuario: document.getElementById('wallyUsuario').value,
        referencia: document.getElementById('wallyReferencia').value,
        operacion,
        platform: document.getElementById('wallyPlatform').value,
        metodoPago: document.getElementById('wallyMetodoPago').value,
        fecha: isEditing ? wallyOperations[editingWallyIndex].fecha : currentWallyDate,
        timestamp: isEditing ? wallyOperations[editingWallyIndex].timestamp : Date.now()
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

    const opId = isEditing ? wallyOperations[editingWallyIndex].id : db.collection('users').doc(currentUserId).collection('wallyOperations').doc().id;

    db.collection('users').doc(currentUserId).collection('wallyOperations').doc(opId).set(opData, { merge: true }).then(() => {
        closeWallyModal();
        showToast('Op. USD guardada.', 'success');
        if (!isEditing) {
            setLastSavedUser(opData.usuario);
            setLastSavedOperationType('wally');
            window.openRatingModal(opData.usuario);
        }
    }).catch(e => {
        showToast('Error.', 'error');
        console.error("Error al guardar op USD:", e);
    }).finally(() => {
        saveBtn.classList.remove('loading');
    });
}

export function deleteWallyOperation(operationId) {
    if (!currentUserId) return;

    const opToDelete = wallyOperations.find(op => op.id === operationId);
    const message = opToDelete
        ? `¿Seguro que quieres eliminar la operación USD de "${opToDelete.usuario}"?`
        : '¿Estás seguro de que deseas eliminar esta operación USD?';

    openConfirmModal(message, () => {
        db.collection('users').doc(currentUserId).collection('wallyOperations').doc(operationId).delete()
            .then(() => showToast('Operación USD eliminada.', 'info'))
            .catch(error => showToast('Error al eliminar la operación.', 'error'));
    });
}

export async function updateWallySummary() {
    if(!wallyOperations) return;
    const currentOps = wallyOperations.filter(op => op.fecha === currentWallyDate);
    const [totalGananciaUsdc, totalGananciaUsd] = calculateWallyGainsForPeriod(currentOps);

    const wallyGananciasEl = document.getElementById("wallyGanancias");
    if (wallyGananciasEl) {
        wallyGananciasEl.innerHTML = `
            <span class="text-orange-400">${totalGananciaUsdc.toFixed(2)}</span> <span class="text-xl font-semibold">USDC</span> / 
            <span class="text-purple-400">${totalGananciaUsd.toFixed(2)}</span> <span class="text-xl font-semibold">USD</span>`;
    }

    renderWallyTables();
    const { updateSummary } = await import('./operations.js');
    updateSummary();
}

export function renderWallyTables() {
    const searchTerm = document.getElementById('searchWallyOperations').value.toLowerCase();
    const filterOperacion = document.getElementById('filterWallyOperacion').value;
    const filterMetodo = document.getElementById('filterWallyMetodoPago').value;

    const filteredOps = wallyOperations.filter(op => {
        const searchMatch = op.usuario.toLowerCase().includes(searchTerm) || (op.referencia && op.referencia.toLowerCase().includes(searchTerm));
        const operacionMatch = filterOperacion === '' || op.operacion === filterOperacion;
        const metodoMatch = filterMetodo === '' || op.metodoPago === filterMetodo;
        return op.fecha === currentWallyDate && searchMatch && operacionMatch && metodoMatch;
    });

    const compraTableBody = document.getElementById('wallyCompraTable');
    const compraListContainer = document.getElementById('wallyCompraList');
    const ventaTableBody = document.getElementById('wallyVentaTable');
    const ventaListContainer = document.getElementById('wallyVentaList');
    const comprasEmptyState = document.getElementById('wally-compras-empty-state');
    const ventasEmptyState = document.getElementById('wally-ventas-empty-state');
    const comprasCardContainer = document.querySelector('#wallyCompraList').closest('.card');
    const ventasCardContainer = document.querySelector('#wallyVentaList').closest('.card');

    compraTableBody.innerHTML = '';
    compraListContainer.innerHTML = '';
    ventaTableBody.innerHTML = '';
    ventaListContainer.innerHTML = '';

    const compras = filteredOps.filter(op => op.operacion === 'Compra');
    const ventas = filteredOps.filter(op => op.operacion === 'Venta');

    if (compras.length === 0) {
        comprasCardContainer.style.display = 'none';
        comprasEmptyState.style.display = 'block';
    } else {
        comprasCardContainer.style.display = 'block';
        comprasEmptyState.style.display = 'none';
        compras.forEach((op) => {
            const globalIndex = wallyOperations.findIndex(wOp => wOp.id === op.id);
            const relationIndicator = `${op.metodoPago} ➡️ ${op.platform || ''}`;
            const tableRowHtml = `<tr><td class="text-left"><div class="font-semibold flex items-center">${op.usuario} ${getRatingIndicator(op.usuario)}</div><div class="text-xs text-gray-400">${relationIndicator}</div></td><td>${(op.reciboUsdc||0).toFixed(2)}</td><td>${(op.tasaCompra||0).toFixed(4)}</td><td>${(op.envioUsd||0).toFixed(2)}</td><td class="font-semibold text-green-400">${(op.gananciaUsdc||0).toFixed(4)}</td><td><button class="text-blue-400 p-1" onclick="openWallyModal(${globalIndex})">✏️</button><button class="text-red-400 p-1" onclick="deleteWallyOperation('${op.id}')">🗑️</button></td></tr>`;
            const cardHtml = `<div class="operation-card compra"><div class="card-header"><div class="user-info flex items-center">${op.usuario} ${getRatingIndicator(op.usuario)}<div class="payment-method ml-auto">${relationIndicator}</div></div></div><div class="card-grid"><div class="grid-item"><span class="label">Recibo Cripto</span><span class="value">${(op.reciboUsdc||0).toFixed(2)}</span></div><div class="grid-item"><span class="label">Envío USD</span><span class="value">${(op.envioUsd||0).toFixed(2)}</span></div><div class="grid-item"><span class="label">Tasa</span><span class="value">${(op.tasaCompra||0).toFixed(4)}</span></div><div class="grid-item"><span class="label">Ganancia Cripto</span><span class="value profit-green">${(op.gananciaUsdc||0).toFixed(4)}</span></div></div><div class="card-footer"><div class="ref-info">REF: ${op.referencia || 'N/A'}</div><div class="actions"><button class="action-btn edit" onclick="openWallyModal(${globalIndex})">✏️</button><button class="action-btn delete" onclick="deleteWallyOperation('${op.id}')">🗑️</button></div></div></div>`;
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
            const globalIndex = wallyOperations.findIndex(wOp => wOp.id === op.id);
            const relationIndicator = `${op.metodoPago} ⬅️ ${op.platform || ''}`;
            const tableRowHtml = `<tr><td class="text-left"><div class="font-semibold flex items-center">${op.usuario} ${getRatingIndicator(op.usuario)}</div><div class="text-xs text-gray-400">${relationIndicator}</div></td><td>${(op.envioUsdc||0).toFixed(2)}</td><td>${(op.tasaVenta||0).toFixed(4)}</td><td>${(op.reciboUsd||0).toFixed(2)}</td><td class="font-semibold text-green-400">${(op.gananciaUsd||0).toFixed(4)}</td><td><button class="text-blue-400 p-1" onclick="openWallyModal(${globalIndex})">✏️</button><button class="text-red-400 p-1" onclick="deleteWallyOperation('${op.id}')">🗑️</button></td></tr>`;
            const cardHtml = `<div class="operation-card venta"><div class="card-header"><div class="user-info flex items-center">${op.usuario} ${getRatingIndicator(op.usuario)}<div class="payment-method ml-auto">${relationIndicator}</div></div></div><div class="card-grid"><div class="grid-item"><span class="label">Envío Cripto</span><span class="value">${(op.envioUsdc||0).toFixed(2)}</span></div><div class="grid-item"><span class="label">Recibo USD</span><span class="value">${(op.reciboUsd||0).toFixed(2)}</span></div><div class="grid-item"><span class="label">Tasa</span><span class="value">${(op.tasaVenta||0).toFixed(4)}</span></div><div class="grid-item"><span class="label">Ganancia USD</span><span class="value profit-green">${(op.gananciaUsd||0).toFixed(4)}</span></div></div><div class="card-footer"><div class="ref-info">REF: ${op.referencia || 'N/A'}</div><div class="actions"><button class="action-btn edit" onclick="openWallyModal(${globalIndex})">✏️</button><button class="action-btn delete" onclick="deleteWallyOperation('${op.id}')">🗑️</button></div></div></div>`;
            ventaTableBody.innerHTML += tableRowHtml;
            ventaListContainer.innerHTML += cardHtml;
        });
    }
}

export function openWallyGainsSummaryModal() {
    const formatDate = (dateObj) => {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const todayStr = formatDate(today), startOfWeekStr = formatDate(startOfWeek), startOfMonthStr = formatDate(startOfMonth);
    const dailyOps = wallyOperations.filter(op => op.fecha === todayStr);
    const weeklyOps = wallyOperations.filter(op => op.fecha >= startOfWeekStr && op.fecha <= todayStr);
    const monthlyOps = wallyOperations.filter(op => op.fecha >= startOfMonthStr && op.fecha <= todayStr);
    const [dailyGainsUsdc, dailyGainsUsd] = calculateWallyGainsForPeriod(dailyOps);
    const [weeklyGainsUsdc, weeklyGainsUsd] = calculateWallyGainsForPeriod(weeklyOps);
    const [monthlyGainsUsdc, monthlyGainsUsd] = calculateWallyGainsForPeriod(monthlyOps);
    document.getElementById('summaryWallyGananciasHoyUsdc').textContent = `${dailyGainsUsdc.toFixed(2)} USDC`;
    document.getElementById('summaryWallyGananciasHoyUsd').textContent = `${dailyGainsUsd.toFixed(2)} USD`;
    document.getElementById('summaryWallyGananciasSemanaUsdc').textContent = `${weeklyGainsUsdc.toFixed(2)} USDC`;
    document.getElementById('summaryWallyGananciasSemanaUsd').textContent = `${weeklyGainsUsd.toFixed(2)} USD`;
    document.getElementById('summaryWallyGananciasMesUsdc').textContent = `${monthlyGainsUsdc.toFixed(2)} USDC`;
    document.getElementById('summaryWallyGananciasMesUsd').textContent = `${monthlyGainsUsd.toFixed(2)} USD`;
    document.getElementById('wallyGainsSummaryModal').classList.add('show');
}

export function closeWallyGainsSummaryModal() {
    document.getElementById('wallyGainsSummaryModal').classList.remove('show');
}

export function populateUsdPaymentMethodsFilter() {
    const methods = userConfig.paymentMethods ? userConfig.paymentMethods.usd || [] : [];
    const filterSelect = document.getElementById('filterWallyMetodoPago');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Todos los Métodos</option>' + methods.map(m => `<option value="${m}">${m}</option>`).join('');
    }
}
