import { state, db } from './state.js';
import { showToast, openModal, closeModal, openConfirmModal, openConfirmMoveModal } from './ui.js';
const emptyStateIcon = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-12 h-12 mx-auto mb-3 text-gray-500"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>';
import { getRatingIndicator, checkInitialLoadComplete, sanitizeHTML } from './utils.js';

export function loadOperations() {
    if (!state.currentUserId) return;
    db.collection('users').doc(state.currentUserId).collection('operations').orderBy('timestamp', 'desc').onSnapshot(s => {
        state.operations = s.docs.map(d => ({ id: d.id, ...d.data() }));
        if (window.currentProfileUserName) window.openUserProfileModal(window.currentProfileUserName);
        updateSummary();
        if (typeof populateMonthSelector === 'function') populateMonthSelector();
        checkInitialLoadComplete();
    }, e => { console.error(e); checkInitialLoadComplete(); });
}

export function saveOperation() {
    if (!state.currentUserId) return;
    const usuario = document.getElementById('usuario').value.trim();
    const referencia = document.getElementById('referencia').value.trim();
    const tasa = parseFloat(document.getElementById('tasa').value) || 0;
    const grossUsdc = parseFloat(document.getElementById('montoUsdc').value) || 0;
    if (!usuario || !tasa || !grossUsdc) {
        showToast('Por favor, complete todos los campos obligatorios.', 'error');
        return;
    }
    const saveBtn = document.getElementById('saveOperationBtn');
    saveBtn.classList.add('loading');
    const isEditing = state.editingIndex > -1;
    const operacion = document.getElementById('operacion').value;
    const metodoPago = document.getElementById('metodoPago').value;
    const platformSelect = document.getElementById('p2pPlatformSelect');
    const platform = state.userConfig.p2pPlatforms.find(p => p.name === platformSelect.value);
    const commissionRate = platform ? platform.commission / 100 : 0;
    const montoBs = grossUsdc * tasa;
    let comisionVes = 0;
    if (operacion === 'Compra' && metodoPago === 'Pagomovil') {
        comisionVes = montoBs * 0.003;
    }
    const total = montoBs + comisionVes;
    const operationData = {
        usuario,
        referencia,
        operacion,
        p2pPlatform: platformSelect.value,
        tasa,
        metodoPago,
        montoUsdc: grossUsdc,
        montoBs,
        comisionVes,
        total,
        ves: 0,
        usdc: 0,
        lote: '',
        estatus: document.getElementById('estatus').value,
        adCommissionPercent: commissionRate * 100,
        fecha: isEditing ? state.operations[state.editingIndex].fecha : state.currentDate,
        timestamp: isEditing ? state.operations[state.editingIndex].timestamp : Date.now()
    };
    const opId = isEditing ? state.operations[state.editingIndex].id : db.collection('users').doc(state.currentUserId).collection('operations').doc().id;
    db.collection('users').doc(state.currentUserId).collection('operations').doc(opId).set(operationData, { merge: true }).then(() => {
        closeModal();
        showToast('Operación guardada.', 'success');
        if (!isEditing) {
            state.lastSavedUser = operationData.usuario;
            state.lastSavedOperationType = 'main';
            window.openRatingModal(operationData.usuario);
        }
    }).catch(e => {
        showToast('Error al guardar.', 'error');
        console.error("Error al guardar operación:", e);
    }).finally(() => { saveBtn.classList.remove('loading'); });
}

export function editOperation(operationId) {
    const index = state.operations.findIndex(op => op.id === operationId);
    if (index === -1) { showToast("Error: No se encontró la operación para editar.", "error"); return; }
    state.editingIndex = index;
    const op = state.operations[index];
    document.getElementById('modalTitle').textContent = 'Editar Operación';
    document.getElementById('montoUsdc').value = op.montoUsdc.toFixed(3);
    document.getElementById('usuario').value = op.usuario;
    document.getElementById('referencia').value = op.referencia;
    document.getElementById('operacion').value = op.operacion;
    document.getElementById('tasa').value = op.tasa;
    document.getElementById('metodoPago').value = op.metodoPago;
    document.getElementById('p2pPlatformSelect').value = op.p2pPlatform || (state.userConfig.p2pPlatforms.find(p=>p.isDefault)?.name || '');
    document.getElementById('estatus').value = op.estatus;
    window.calculateAll();
    openModal();
}

export function deleteOperation(operationId) {
    if (!state.currentUserId) return;
    const opToDelete = state.operations.find(op => op.id === operationId);
    const message = opToDelete ? `¿Seguro que quieres eliminar la operación de "${opToDelete.usuario}"? Esta acción no se puede deshacer.` : '¿Estás seguro de que deseas eliminar esta operación?';
    openConfirmModal(message, () => {
        db.collection('users').doc(state.currentUserId).collection('operations').doc(operationId).delete()
            .then(() => showToast('Operación eliminada.', 'info'))
            .catch(error => showToast('Error al eliminar la operación.', 'error'));
    });
}

export function calculateFIFOGainsForOps(opsArray) {
    if (!opsArray || opsArray.length === 0) return [0, 0];
    const opsCopy = JSON.parse(JSON.stringify(opsArray));
    let totalGainVes = 0, totalGainUsdc = 0;
    const sales = opsCopy.filter(op => op.operacion === 'Venta').sort((a, b) => a.timestamp - b.timestamp);
    const purchases = opsCopy.filter(op => op.operacion === 'Compra').sort((a, b) => a.timestamp - b.timestamp);
    purchases.forEach(p => p._unmatchedAmount = p.montoUsdc);
    sales.forEach(sale => {
        let remainingSaleAmount = sale.montoUsdc;
        for (const purchase of purchases) {
            if (purchase._unmatchedAmount > 1e-5 && remainingSaleAmount > 1e-5) {
                const amountToMatch = Math.min(remainingSaleAmount, purchase._unmatchedAmount);
                const commissionRate = (purchase.adCommissionPercent || 0) / 100;
                const revenueVes = amountToMatch * sale.tasa;
                const costVes = amountToMatch * purchase.tasa;
                const bankFeeForMatch = (purchase.comisionVes / purchase.montoUsdc) * amountToMatch;
                const spreadGainInVes = revenueVes - costVes - bankFeeForMatch;
                const spreadGainInUsdt = spreadGainInVes / purchase.tasa;
                const totalCommissionCostInUsdt = (amountToMatch * commissionRate) * 2;
                const netGainInUsdt = spreadGainInUsdt - totalCommissionCostInUsdt;
                const netGainInVes = netGainInUsdt * purchase.tasa;
                totalGainVes += netGainInVes;
                totalGainUsdc += netGainInUsdt;
                remainingSaleAmount -= amountToMatch;
                purchase._unmatchedAmount -= amountToMatch;
            }
            if (remainingSaleAmount < 1e-5) break;
        }
    });
    return [totalGainVes, totalGainUsdc];
}

export function applyFIFOForDate(fecha) {
    const dailyOps = state.operations.filter(op => op.fecha === fecha).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    dailyOps.forEach(op => { op.ves = 0; op.usdc = 0; op.lote = ''; if (op.operacion === 'Venta') op._unmatchedAmount = op.montoUsdc; });
    const purchases = dailyOps.filter(op => op.operacion === 'Compra');
    const sales = dailyOps.filter(op => op.operacion === 'Venta');
    state.currentLotsData.clear();
    let lotCounter = 1;
    purchases.forEach(p => p._unmatchedAmount = p.montoUsdc);
    sales.forEach(sale => {
        const lotId = `L${lotCounter++}`;
        let remainingSaleAmount = sale.montoUsdc;
        sale.lote = lotId;
        const lot = { id: lotId, ventaOp: sale, montoTotal: sale.montoUsdc, montoConsumido: 0, comprasAsociadas: [], estado: 'activo' };
        for (const purchase of purchases) {
            if (purchase._unmatchedAmount > 1e-5 && remainingSaleAmount > 1e-5) {
                const amountToMatch = Math.min(remainingSaleAmount, purchase._unmatchedAmount);
                const commissionRate = (purchase.adCommissionPercent || 0) / 100;
                const revenueVes = amountToMatch * sale.tasa;
                const costVes = amountToMatch * purchase.tasa;
                const bankFeeForMatch = (purchase.comisionVes / purchase.montoUsdc) * amountToMatch;
                const spreadGainInVes = revenueVes - costVes - bankFeeForMatch;
                const spreadGainInUsdt = spreadGainInVes / purchase.tasa;
                const costOfSaleCommission = amountToMatch * commissionRate;
                const costOfPurchaseCommission = amountToMatch * commissionRate;
                const totalCommissionCostInUsdt = costOfSaleCommission + costOfPurchaseCommission;
                const netGainInUsdt = spreadGainInUsdt - totalCommissionCostInUsdt;
                const netGainInVes = netGainInUsdt * purchase.tasa;
                purchase.usdc += netGainInUsdt;
                purchase.ves += netGainInVes;
                const existingLote = purchase.lote ? purchase.lote + ', ' : '';
                purchase.lote = `${existingLote}${lotId}(${amountToMatch.toFixed(2)})`;
                remainingSaleAmount -= amountToMatch;
                purchase._unmatchedAmount -= amountToMatch;
                lot.montoConsumido += amountToMatch;
                lot.comprasAsociadas.push({ op: purchase, monto: amountToMatch });
            }
            if (remainingSaleAmount < 1e-5) break;
        }
        if (lot.montoConsumido >= lot.montoTotal - 1e-5) lot.estado = 'cerrado';
        state.currentLotsData.set(lotId, lot);
    });
    dailyOps.forEach(op => { delete op._unmatchedAmount; });
    let totalComprado = purchases.reduce((sum, op) => sum + op.montoUsdc, 0);
    let totalVendido = sales.reduce((sum, op) => sum + op.montoUsdc, 0);
    state.currentPendingData = { recompra: Math.max(0, totalVendido - totalComprado), reventa: Math.max(0, totalComprado - totalVendido), recompraOps: [], reventaOps: [] };
}

export async function updateSummary() {
    const { loadInitialCapital, displayInitialCapitalSummary } = await import('./capital.js');
    loadInitialCapital(state.currentDate);
    const currentOps = state.operations.filter(op => op.fecha === state.currentDate);
    if (state.operations && state.operations.length > 0) {
        applyMonthlyFIFO(state.currentDate);
        const { getShownLots, addShownLot, showLotClosedAnimation, calculateLotProfit } = await import('./notifications.js');
        const shownLots = getShownLots();
        const newlyClosedLots = [];
        for (const [lotId, lot] of state.currentLotsData.entries()) {
            if (lot.estado === 'cerrado' && !shownLots.has(lotId)) newlyClosedLots.push(lot);
        }
        if (newlyClosedLots.length > 0) {
            newlyClosedLots.forEach((lot, index) => {
                setTimeout(() => {
                    const profit = calculateLotProfit(lot);
                    if (profit > 0) { showLotClosedAnimation(profit); addShownLot(lot.id); }
                }, index * 1000);
            });
        }
        const compras = currentOps.filter(op => op.operacion === 'Compra');
        const ventas = currentOps.filter(op => op.operacion === 'Venta');
        const promCompra = compras.length ? compras.reduce((s, o) => s + o.tasa, 0) / compras.length : 0;
        const promVenta = ventas.length ? ventas.reduce((s, o) => s + o.tasa, 0) / ventas.length : 0;
        const brecha = promCompra > 0 ? ((promVenta - promCompra) / promCompra * 100) : 0;
        document.getElementById('promCompra').textContent = promCompra.toFixed(2);
        document.getElementById('promVenta').textContent = promVenta.toFixed(2);
        document.getElementById('brecha').textContent = brecha.toFixed(2) + '%';
        document.getElementById('totalOps').textContent = currentOps.length;
        const activeLotsCount = Array.from(state.currentLotsData.values()).filter(lot => lot.estado === 'activo').length;
        document.getElementById('activeLotsSummary').textContent = activeLotsCount;
        document.getElementById('pendingSummary').textContent = `${(state.currentPendingData.recompra + state.currentPendingData.reventa).toFixed(2)} USDC`;
        renderOperations();
    }
    const gananciasVes = currentOps.reduce((total, op) => total + (op.ves || 0), 0);
    const gananciasUsdc = currentOps.reduce((total, op) => total + (op.usdc || 0), 0);
    const { calculateWallyGainsForPeriod } = await import('./wally.js');
    const [wallyGainsUsdcForDate, wallyGainsUsdForDate] = calculateWallyGainsForPeriod(state.wallyOperations.filter(op => op.fecha === state.currentDate));
    document.getElementById('ganancias').innerHTML = `${gananciasVes.toFixed(2)} <span class="font-medium">VES</span>`;
    document.getElementById('ganancias_usdc').innerHTML = `${gananciasUsdc.toFixed(4)} <span class="text-2xl font-semibold">USDC</span>`;
    document.getElementById('wallyDashboardGainsUsdc').innerHTML = `${wallyGainsUsdcForDate.toFixed(2)} <span class="text-xl font-semibold">USDC</span>`;
    document.getElementById('wallyDashboardGainsUsd').innerHTML = `${wallyGainsUsdForDate.toFixed(2)} <span class="text-xl font-semibold">USD</span>`;
    const { renderDailyGoals } = await import('./config.js');
    renderDailyGoals(gananciasVes, gananciasUsdc, wallyGainsUsdcForDate, wallyGainsUsdForDate);
}

export function renderOperations() {
    if (state.sortableTableInstance) { state.sortableTableInstance.destroy(); state.sortableTableInstance = null; }
    if (state.sortableListInstance) { state.sortableListInstance.destroy(); state.sortableListInstance = null; }
    const tableBody = document.getElementById('operationsTable');
    const listContainer = document.getElementById('operationsList');
    const emptyState = document.getElementById('reports-empty-state');
    // Invalidate monthly FIFO cache so detail modal shows fresh data
    _monthlyFIFOCache = { monthKey: '', data: null };
    const desktopTableContainer = document.querySelector('#page-reports .table-container');
    const mobileListContainer = document.querySelector('#page-reports .operations-list-container');
    const scrollContainer = document.getElementById('scroll-container');
    const searchTerm = document.getElementById('searchOperations').value.toLowerCase();
    const filterOperacion = document.getElementById('filterOperacion').value;
    const filterMetodo = document.getElementById('filterMetodoPago').value;
    const filteredOps = state.operations.filter(op =>
        (op.fecha === state.currentDate) &&
        (op.usuario.toLowerCase().includes(searchTerm) || (op.referencia && op.referencia.toLowerCase().includes(searchTerm))) &&
        (filterOperacion === '' || op.operacion === filterOperacion) &&
        (filterMetodo === '' || op.metodoPago === filterMetodo)
    );
    filteredOps.sort((a, b) => b.timestamp - a.timestamp);
    const badge = document.getElementById('ops-count-badge');
    if (badge) badge.textContent = filteredOps.length;
    if (filteredOps.length === 0) {
        emptyState.style.display = 'block';
        desktopTableContainer.style.display = 'none';
        mobileListContainer.style.display = 'none';
        return;
    } else {
        emptyState.style.display = 'none';
        desktopTableContainer.style.display = '';
        mobileListContainer.style.display = '';
    }
    tableBody.innerHTML = '';
    listContainer.innerHTML = '';
    filteredOps.forEach(op => {
        let cryptoValueToDisplay = op.montoUsdc;
        if (op.operacion === 'Venta' && op.adCommissionPercent > 0) {
            cryptoValueToDisplay = op.montoUsdc * (1 + (op.adCommissionPercent / 100));
        }
        const sUsuario = sanitizeHTML(op.usuario);
        const sReferencia = sanitizeHTML(op.referencia);
        const sMetodo = sanitizeHTML(op.metodoPago);
        const sPlatform = sanitizeHTML(op.p2pPlatform);
        const sLote = sanitizeHTML(op.lote);
        const sEstatus = sanitizeHTML(op.estatus);
        const relationIndicator = `${sMetodo} ${op.operacion === 'Compra' ? '➡️' : '⬅️'} ${sPlatform || ''}`;
        const commissionIndicator = op.adCommissionPercent > 0 ? `<span class="text-xs ${op.operacion === 'Venta' ? 'text-green-400' : 'text-red-400'}">(${op.operacion === 'Venta' ? '+' : '-'}${op.adCommissionPercent}%)</span>` : '';
        const mobileCommissionIndicator = op.adCommissionPercent > 0 ? `<span class="commission">(${op.operacion === 'Venta' ? '+' : '-'}${op.adCommissionPercent}%)</span>` : '';
        const tableRowHtml = `<tr data-id="${op.id}" class="hover:bg-[var(--surface)] cursor-grab"><td class="text-left"><div class="font-semibold flex items-center">${sUsuario} ${getRatingIndicator(op.usuario)}</div><div class="text-xs text-gray-400">${relationIndicator}</div></td><td>${sReferencia || ''}</td><td>${op.operacion.substring(0,1)}</td><td>${(op.tasa || 0).toFixed(2)}</td><td><div class="flex flex-col items-center">${(cryptoValueToDisplay || 0).toFixed(3)} ${commissionIndicator}</div></td><td>${(op.montoBs || 0).toFixed(2)}</td><td><span class="${op.ves >= 0 ? 'text-green-400' : 'text-red-400'} font-semibold">${(op.ves || 0).toFixed(2)} Bs</span><span class="text-gray-500 mx-1">/</span><span class="${op.usdc >= 0 ? 'text-green-400' : 'text-red-400'} font-semibold">${(op.usdc || 0).toFixed(2)} $</span></td><td class="font-semibold ${op.usdc >= 0 ? 'text-green-400':'text-red-400'}">${(op.usdc || 0).toFixed(4)}</td><td>${sLote || ''}</td><td><span class="px-2 py-1 text-xs font-semibold rounded-full ${op.estatus === 'Completado' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}"><span class="sr-only">Estado: </span>${sEstatus}</span></td><td><button type="button" class="text-blue-400 p-2 min-w-[44px] min-h-[44px]" onclick="editOperation('${op.id}')" aria-label="Editar operación de ${sUsuario}">✏️</button><button type="button" class="text-red-400 p-2 min-w-[44px] min-h-[44px]" onclick="deleteOperation('${op.id}')" aria-label="Eliminar operación de ${sUsuario}">🗑️</button></td></tr>`;
        const avatar = (sUsuario.charAt(0) || '?').toUpperCase();
        const isCompletado = sEstatus === 'Completado';
        const vesClass = op.ves >= 0 ? 'profit-green' : 'profit-red';
        const usdcClass = op.usdc >= 0 ? 'profit-green' : 'profit-red';
        const vesSign = op.ves >= 0 ? '+' : '';
        const usdcSign = op.usdc >= 0 ? '+' : '';
        const cardHtml = `<div data-id="${op.id}" class="operation-card ${op.operacion.toLowerCase()} cursor-pointer" role="button" tabindex="0" aria-label="Operación de ${sUsuario}" onclick="openOperationDetailModal('${op.id}')" onkeydown="if(event.key==='Enter'||event.key===' ')event.preventDefault(),openOperationDetailModal('${op.id}')">
  <div class="op-head">
    <div class="op-user">
      <span class="op-avatar" aria-hidden="true">${avatar}</span>
      <div class="op-user-meta">
        <span class="op-name">${sUsuario} ${getRatingIndicator(op.usuario)}</span>
        <span class="op-route"><span class="op-route-method">${sMetodo}</span><span class="op-route-arrow">${op.operacion === 'Compra' ? '→' : '←'}</span><span class="op-route-platform">${sPlatform || '—'}</span></span>
      </div>
    </div>
    <span class="op-type ${op.operacion.toLowerCase()}">${op.operacion}</span>
  </div>
  <div class="op-body">
    <div class="op-data-row">
      <div class="op-data-cell">
        <span class="op-data-label">Monto USDC</span>
        <span class="op-data-value">${(cryptoValueToDisplay || 0).toFixed(3)} ${mobileCommissionIndicator}</span>
      </div>
      <div class="op-data-cell">
        <span class="op-data-label">Monto Bs</span>
        <span class="op-data-value">${(op.montoBs || 0).toFixed(2)}</span>
      </div>
    </div>
    <div class="op-data-row">
      <div class="op-data-cell">
        <span class="op-data-label">Tasa</span>
        <span class="op-data-value">${(op.tasa || 0).toFixed(2)}</span>
      </div>
      <div class="op-data-cell">
        <span class="op-data-label">Ganancia</span>
        <span class="op-data-value ${vesClass}">${vesSign}${(op.ves || 0).toFixed(2)} <span class="op-currency">VES</span></span>
        <span class="op-data-eq">≈ ${usdcSign}${(op.usdc || 0).toFixed(2)} <span class="op-currency">USDC</span></span>
      </div>
    </div>
  </div>
  <div class="op-foot">
    <div class="op-meta">
      <span>REF: ${sReferencia || '—'}</span>
      <span class="op-meta-sep" aria-hidden="true">•</span>
      <span>LOTE: ${sLote || '—'}</span>
    </div>
    <div class="op-foot-right">
      <span class="op-status ${isCompletado ? 'done' : 'pending'}"><span class="op-status-dot"></span>${sEstatus}</span>
      <div class="op-actions">
        <button type="button" class="op-action-btn edit" onclick="event.stopPropagation();editOperation('${op.id}')" aria-label="Editar operación de ${sUsuario}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg></button>
        <button type="button" class="op-action-btn delete" onclick="event.stopPropagation();deleteOperation('${op.id}')" aria-label="Eliminar operación de ${sUsuario}"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.033c-1.12 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button>
      </div>
    </div>
  </div>
</div>`;
        tableBody.innerHTML += tableRowHtml;
        listContainer.innerHTML += cardHtml;
    });
    if (tableBody.children.length > 0) {
        state.sortableTableInstance = new Sortable(tableBody, {
            animation: 150, delay: 300, delayOnTouchOnly: true,
            forceFallback: true, fallbackOnBody: true,
            scroll: scrollContainer, bubbleScroll: true,
            onEnd: handleDragEnd
        });
    }
    if (listContainer.children.length > 0) {
        state.sortableListInstance = new Sortable(listContainer, {
            animation: 150, delay: 300, delayOnTouchOnly: true,
            forceFallback: true, fallbackOnBody: true,
            scroll: scrollContainer, bubbleScroll: true,
            onEnd: handleDragEnd
        });
    }
}

export function handleDragEnd(evt) {
    const { newIndex, oldIndex, item } = evt;
    if (oldIndex === newIndex) return;
    const operationId = item.dataset.id;
    if (!operationId) { renderOperations(); return; }
    const searchTerm = document.getElementById('searchOperations').value.toLowerCase();
    const filterOperacion = document.getElementById('filterOperacion').value;
    const filterMetodo = document.getElementById('filterMetodoPago').value;
    const currentSortedOps = state.operations
        .filter(op => op.fecha === state.currentDate &&
            (op.usuario.toLowerCase().includes(searchTerm) || (op.referencia && op.referencia.toLowerCase().includes(searchTerm))) &&
            (filterOperacion === '' || op.operacion === filterOperacion) &&
            (filterMetodo === '' || op.metodoPago === filterMetodo))
        .sort((a, b) => b.timestamp - a.timestamp);
    if (currentSortedOps.length < 1) { renderOperations(); return; }
    let newTimestamp;
    if (newIndex === 0) {
        newTimestamp = (currentSortedOps[0]?.timestamp || Date.now()) + 30000;
    } else if (newIndex >= currentSortedOps.length) {
        newTimestamp = (currentSortedOps[currentSortedOps.length - 1]?.timestamp || Date.now()) - 30000;
    } else {
        const neighborBefore = currentSortedOps[newIndex - 1];
        const neighborAfter = currentSortedOps[newIndex];
        if (!neighborBefore || !neighborAfter) { renderOperations(); return; }
        newTimestamp = Math.floor((neighborBefore.timestamp + neighborAfter.timestamp) / 2);
    }
    if (!newTimestamp) { renderOperations(); return; }
    openConfirmMoveModal('¿Estás seguro de que quieres cambiar el orden de esta operación? Esto recalculará todas las ganancias del día.', () => {
        db.collection('users').doc(state.currentUserId).collection('operations').doc(operationId)
            .update({ timestamp: newTimestamp })
            .then(() => showToast('Orden actualizado. Recalculando...', 'success'))
            .catch(err => { showToast('Error al actualizar el orden.', 'error'); console.error(err); renderOperations(); });
    });
}

export function populateMonthSelector() {
    const selector = document.getElementById('monthSelector');
    if (!state.operations || state.operations.length === 0) return;
    selector.innerHTML = '';
    const oldestOp = state.operations.reduce((oldest, op) => op.timestamp < oldest.timestamp ? op : oldest, state.operations[0]);
    const startDate = new Date(oldestOp.timestamp);
    const currentDate = new Date();
    let loopDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    while (loopDate >= new Date(startDate.getFullYear(), startDate.getMonth(), 1)) {
        const monthName = loopDate.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
        const monthValue = `${loopDate.getFullYear()}-${String(loopDate.getMonth() + 1).padStart(2, '0')}`;
        const option = document.createElement('option');
        option.value = monthValue;
        option.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        selector.appendChild(option);
        loopDate.setMonth(loopDate.getMonth() - 1);
    }
}

export function populateUsdPaymentMethodsFilter() {
    const methods = state.userConfig.paymentMethods ? state.userConfig.paymentMethods.usd || [] : [];
    const filterSelect = document.getElementById('filterWallyMetodoPago');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Todos los Métodos</option>' + methods.map(m => `<option value="${m}">${m}</option>`).join('');
    }
}

/* ── Operation Detail Modal ── */
export function renderOperationDetail(op) {
    const sUsuario = sanitizeHTML(op.usuario);
    const sReferencia = sanitizeHTML(op.referencia);
    const sMetodo = sanitizeHTML(op.metodoPago);
    const sPlatform = sanitizeHTML(op.p2pPlatform);
    const sLote = sanitizeHTML(op.lote);
    const sEstatus = sanitizeHTML(op.estatus);
    const avatar = (sUsuario.charAt(0) || '?').toUpperCase();
    const isCompletado = sEstatus === 'Completado';
    const vesClass = op.ves >= 0 ? 'profit-green' : 'profit-red';
    const usdcClass = op.usdc >= 0 ? 'profit-green' : 'profit-red';
    const vesSign = op.ves >= 0 ? '+' : '';
    const usdcSign = op.usdc >= 0 ? '+' : '';
    const fechaFormatted = op.fecha ? new Date(op.fecha + 'T00:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const opDirection = op.operacion === 'Compra' ? '→' : '←';
    const opRoute = `${sMetodo} ${opDirection} ${sPlatform || '—'}`;

    const html = `
<div class="op-detail-grid">
  <div class="op-detail-section">
    <div class="op-detail-user">
      <span class="op-detail-avatar">${avatar}</span>
      <div>
        <div class="op-detail-name">${sUsuario} ${getRatingIndicator(op.usuario)}</div>
        <div class="op-detail-route">${opRoute}</div>
      </div>
    </div>
    <div class="op-detail-meta-grid">
      <div class="op-detail-meta-item">
        <span class="op-detail-label">Referencia</span>
        <span class="op-detail-value">${sReferencia || '—'}</span>
      </div>
      <div class="op-detail-meta-item">
        <span class="op-detail-label">Fecha</span>
        <span class="op-detail-value">${fechaFormatted}</span>
      </div>
      <div class="op-detail-meta-item">
        <span class="op-detail-label">Tipo</span>
        <span class="op-detail-value"><span class="op-type ${op.operacion.toLowerCase()}">${op.operacion}</span></span>
      </div>
      <div class="op-detail-meta-item">
        <span class="op-detail-label">Estado</span>
        <span class="op-status ${isCompletado ? 'done' : 'pending'}"><span class="op-status-dot"></span>${sEstatus}</span>
      </div>
    </div>
  </div>
  <div class="op-detail-section">
    <div class="op-detail-amounts-row">
      <div class="op-detail-amount-cell">
        <span class="op-detail-label">Monto USDC</span>
        <span class="op-detail-amount">${(op.montoUsdc || 0).toFixed(3)}</span>
      </div>
      <div class="op-detail-amount-cell">
        <span class="op-detail-label">Monto Bs</span>
        <span class="op-detail-amount">${(op.montoBs || 0).toFixed(2)}</span>
      </div>
      <div class="op-detail-amount-cell">
        <span class="op-detail-label">Tasa</span>
        <span class="op-detail-amount">${(op.tasa || 0).toFixed(2)}</span>
      </div>
    </div>
    <div class="op-detail-profit">
      <span class="op-detail-label">Ganancia</span>
      <div class="op-detail-profit-values">
        <span class="op-detail-amount ${vesClass}">${vesSign}${(op.ves || 0).toFixed(2)} <span class="op-currency">VES</span></span>
        <span class="op-detail-profit-eq">≈ ${usdcSign}${(op.usdc || 0).toFixed(2)} <span class="op-currency">USDC</span></span>
      </div>
    </div>
  </div>
  <div class="op-detail-section">
    <div class="op-detail-section-title">FIFO / Lotes</div>
    <div id="op-detail-fifo-content">${buildFIFODetail(op)}</div>
  </div>
</div>`;
    document.getElementById('opDetailContent').innerHTML = html;

    /* re-apply status styles that are scoped inside the modal */
    const statusEls = document.querySelectorAll('#opDetailContent .op-status');
    statusEls.forEach(el => {
        if (el.textContent.trim() === 'Completado') el.classList.add('done');
        else el.classList.add('pending');
    });
}

/* ── Monthly FIFO with cross-day support ── */
let _monthlyFIFOCache = { monthKey: '', data: null };

export function getMonthlyFIFO(year, month) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    if (_monthlyFIFOCache.monthKey === monthKey && _monthlyFIFOCache.data) return _monthlyFIFOCache.data;

    const monthOps = state.operations
        .filter(op => op.fecha && op.fecha.startsWith(monthKey))
        .sort((a, b) => a.timestamp - b.timestamp);

    if (monthOps.length === 0) {
        _monthlyFIFOCache = { monthKey, data: { lots: [], opMatches: new Map() } };
        return _monthlyFIFOCache.data;
    }

    // Clone purchases with remaining capacity, sorted by timestamp
    const purchases = monthOps.filter(op => op.operacion === 'Compra')
        .map(op => ({ op, remaining: op.montoUsdc || 0 }));

    const sales = monthOps.filter(op => op.operacion === 'Venta');
    const lots = [];
    const opMatches = new Map(); // opId -> { lots: [{ lotId, amount, role }], pendingAfter: 0 }
    let lotCounter = 1;

    // Each op starts with empty match record
    monthOps.forEach(op => opMatches.set(op.id, { lots: [], pendingAfter: 0 }));

    sales.forEach(saleOp => {
        const saleAmount = saleOp.montoUsdc || 0;
        let remaining = saleAmount;
        const comprasForThisSale = [];
        const saleRecord = opMatches.get(saleOp.id);

        // FIFO: iterate over purchases in chronological order
        for (const p of purchases) {
            if (remaining <= 0) break;
            if (p.remaining <= 0) continue;

            const amount = Math.min(remaining, p.remaining);
            p.remaining -= amount;
            remaining -= amount;

            comprasForThisSale.push({ op: p.op, amount, fecha: p.op.fecha });
            saleRecord.lots.push({ lotId: `L${lotCounter}`, amount, role: 'venta' });

            // Also record on the purchase side
            const purchaseRecord = opMatches.get(p.op.id);
            purchaseRecord.lots.push({ lotId: `L${lotCounter}`, amount, role: 'compra' });
        }

        if (comprasForThisSale.length > 0) {
            const lotId = `L${lotCounter++}`;
            // Update lotIds to match the single lot
            saleRecord.lots = saleRecord.lots.map(l => ({ ...l, lotId }));
            comprasForThisSale.forEach(c => {
                const pr = opMatches.get(c.op.id);
                // Remove old entry and add updated one
                const oldIdx = pr.lots.findIndex(l => l.lotId === lotId);
                if (oldIdx >= 0) pr.lots[oldIdx] = { lotId, amount: c.amount, role: 'compra' };
                else pr.lots.push({ lotId, amount: c.amount, role: 'compra' });
            });

            const totalMatched = comprasForThisSale.reduce((s, c) => s + c.amount, 0);
            lots.push({
                id: lotId,
                ventaOp: saleOp,
                compras: comprasForThisSale,
                montoTotal: saleAmount,
                montoConsumido: totalMatched,
                estado: remaining <= 0 ? 'cerrado' : 'activo'
            });
        }

        saleRecord.pendingAfter = remaining;
    });

    // After processing all sales, purchases with remaining capacity are standalone
    purchases.forEach(p => {
        if (p.remaining > 0) {
            const lotId = `L${lotCounter++}`;
            lots.push({
                id: lotId,
                ventaOp: null,
                compras: [{ op: p.op, amount: p.remaining, fecha: p.op.fecha }],
                montoTotal: p.remaining,
                montoConsumido: 0,
                estado: 'activo'
            });
            const pr = opMatches.get(p.op.id);
            pr.lots.push({ lotId, amount: p.remaining, role: 'compra' });
        }
    });

    const data = { lots, opMatches };
    _monthlyFIFOCache = { monthKey, data };
    return data;
}

export function applyMonthlyFIFO(fecha) {
    if (!fecha) return;
    const parts = fecha.split('-');
    if (parts.length < 2) return;
    const [y, m] = parts;
    const fifo = getMonthlyFIFO(parseInt(y), parseInt(m));
    if (!fifo || fifo.lots.length === 0) return;

    // Reset FIFO fields for all ops in the month
    const monthOps = state.operations.filter(op => op.fecha && op.fecha.startsWith(`${y}-${m}`));
    monthOps.forEach(op => { op.ves = 0; op.usdc = 0; op.lote = ''; });

    // Build state.currentLotsData for the given date
    state.currentLotsData.clear();

    fifo.lots.forEach(lot => {
        if (!lot.ventaOp) {
            // Standalone purchase lot — still show it for the purchase's day
            const isForToday = lot.compras.some(c => c.op.fecha === fecha);
            if (isForToday) {
                state.currentLotsData.set(lot.id, {
                    id: lot.id,
                    ventaOp: null,
                    comprasAsociadas: lot.compras.map(c => ({ op: c.op, monto: c.amount })),
                    montoTotal: lot.montoTotal,
                    montoConsumido: 0,
                    estado: 'activo'
                });
            }
            return;
        }

        // Calculate gain for this lot (belongs to the sale's day)
        const saleAmount = lot.montoTotal || 0;
        if (saleAmount === 0) return;

        let totalCostVes = 0;
        let totalCommissionUsdc = 0;
        const comprasAsociadas = [];

        lot.compras.forEach(c => {
            const amount = c.amount || 0;
            const tasa = c.op.tasa || 0;
            const commissionRate = (c.op.adCommissionPercent || 0) / 100;
            const bankFee = (c.op.comisionVes && c.op.montoUsdc) ? (c.op.comisionVes / c.op.montoUsdc) * amount : 0;
            totalCostVes += amount * tasa + bankFee;
            totalCommissionUsdc += amount * commissionRate * 2;
            comprasAsociadas.push({ op: c.op, monto: amount });
        });

        const revenueVes = saleAmount * (lot.ventaOp.tasa || 0);
        const spreadVes = revenueVes - totalCostVes;
        const avgTasa = lot.ventaOp.tasa || 1;
        const netGainUsdc = spreadVes / avgTasa - totalCommissionUsdc;
        const netGainVes = netGainUsdc * avgTasa;

        // Assign gain to the sale operation
        lot.ventaOp.ves = netGainVes;
        lot.ventaOp.usdc = netGainUsdc;
        lot.ventaOp.lote = lot.id;

        // Assign lot refs to purchase ops
        lot.compras.forEach(c => {
            const existing = c.op.lote ? c.op.lote + ', ' : '';
            c.op.lote = `${existing}${lot.id}(${c.amount.toFixed(2)})`;
        });

        const isClosed = Math.abs(saleAmount - lot.compras.reduce((s, c) => s + (c.amount || 0), 0)) < 1e-5;
        const match = fifo.opMatches.get(lot.ventaOp.id);
        const isForToday = lot.ventaOp.fecha === fecha;
        if (isForToday) {
            state.currentLotsData.set(lot.id, {
                id: lot.id,
                ventaOp: lot.ventaOp,
                comprasAsociadas,
                montoTotal: saleAmount,
                montoConsumido: saleAmount,
                estado: isClosed ? 'cerrado' : 'activo'
            });
        } else {
            // Check if any purchase is from today
            const hasTodayPurchase = lot.compras.some(c => c.op.fecha === fecha);
            if (hasTodayPurchase) {
                state.currentLotsData.set(lot.id, {
                    id: lot.id,
                    ventaOp: lot.ventaOp,
                    comprasAsociadas,
                    montoTotal: saleAmount,
                    montoConsumido: saleAmount,
                    estado: isClosed ? 'cerrado' : 'activo'
                });
            }
        }
    });

    // Pending data (unmatched sales/purchases for the given date)
    const dailyOps = monthOps.filter(op => op.fecha === fecha);
    const dailyPurchases = dailyOps.filter(op => op.operacion === 'Compra');
    const dailySales = dailyOps.filter(op => op.operacion === 'Venta');
    const totalComprado = dailyPurchases.reduce((s, op) => s + (op.montoUsdc || 0), 0);
    const totalVendido = dailySales.reduce((s, op) => s + (op.montoUsdc || 0), 0);
    state.currentPendingData = {
        recompra: Math.max(0, totalVendido - totalComprado),
        reventa: Math.max(0, totalComprado - totalVendido),
        recompraOps: [],
        reventaOps: []
    };
}

function buildFIFODetail(op) {
    if (!op.fecha) return '<div class="op-detail-fifo-empty">Sin datos disponibles.</div>';
    const [y, m] = op.fecha.split('-');
    const fifo = getMonthlyFIFO(parseInt(y), parseInt(m));
    if (!fifo || fifo.lots.length === 0) return '<div class="op-detail-fifo-empty">Sin datos FIFO disponibles.</div>';

    const match = fifo.opMatches.get(op.id);
    if (!match || match.lots.length === 0) return '<div class="op-detail-fifo-empty">Esta operación no tiene asignación FIFO.</div>';

    const myLotIds = new Set(match.lots.map(l => l.lotId));
    const myLots = fifo.lots.filter(l => myLotIds.has(l.id));

    // Pending/unmatched indicator
    let pendingHtml = '';
    if (op.operacion === 'Venta' && match.pendingAfter > 0) {
        pendingHtml = `<div class="op-detail-pending"><span class="op-detail-pending-icon">⏳</span> ${match.pendingAfter.toFixed(3)} USDC pendientes por comprar</div>`;
    }
    if (op.operacion === 'Compra') {
        // Check if any associated lot has no venta (standalone)
        const hasPending = myLots.some(l => !l.ventaOp);
        if (hasPending) {
            pendingHtml = `<div class="op-detail-pending"><span class="op-detail-pending-icon">⏳</span> Disponible para futuras ventas</div>`;
        }
    }

    // Build the actual lot cards shown in the FIFO section for THIS operation's perspective
    const lotCards = match.lots.filter(lm => {
        const lot = fifo.lots.find(l => l.id === lm.lotId);
        return lot && lot.ventaOp; // only show lots that have a sale (closed/active lots)
    }).map(lm => {
        const lot = fifo.lots.find(l => l.id === lm.lotId);
        if (!lot) return '';

        let comprasHtml = '';
        let totalGainVes = 0;
        let totalGainUsdc = 0;
        if (lot.compras) {
            lot.compras.forEach(c => {
                const cUser = sanitizeHTML(c.op.usuario);
                const cAmount = (c.amount || 0).toFixed(3);
                const cGainVes = c.op.ves || 0;
                const cGainUsdc = c.op.usdc || 0;
                const cFecha = c.op.fecha ? new Date(c.op.fecha + 'T00:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) : '—';
                const isCrossDay = c.op.fecha !== (lot.ventaOp ? lot.ventaOp.fecha : op.fecha);
                const crossBadge = isCrossDay ? '<span class="op-detail-cross-badge">↗ cross-day</span>' : '';
                totalGainVes += cGainVes;
                totalGainUsdc += cGainUsdc;
                comprasHtml += `<div class="op-detail-lot-compra">${cUser} — ${cAmount} USDC ${crossBadge}<span class="op-detail-lot-fecha">${cFecha}</span></div>`;
            });
        }

        const gainValue = `${totalGainVes >= 0 ? '+' : ''}${totalGainVes.toFixed(2)} VES`;
        const gainClass = totalGainVes >= 0 ? 'profit-green' : 'profit-red';
        const estado = lot.estado === 'cerrado'
            ? '<span class="op-detail-lot-status done">Cerrado</span>'
            : '<span class="op-detail-lot-status pending">Activo</span>';
        const ventaInfo = lot.ventaOp ? `${sanitizeHTML(lot.ventaOp.usuario)} — ${(lot.montoTotal || 0).toFixed(3)} USDC` : '—';

        return `<div class="op-detail-lot-card">
          <div class="op-detail-lot-head">
            <span class="op-detail-lot-id">${lot.id}</span>
            ${estado}
          </div>
          <div class="op-detail-lot-body">
            <div class="op-detail-lot-row"><span class="op-detail-lot-label">Venta:</span><span>${ventaInfo}</span></div>
            ${comprasHtml ? `<div class="op-detail-lot-compras"><span class="op-detail-lot-label">Compras:</span><div class="op-detail-lot-compras-list">${comprasHtml}</div></div>` : ''}
            <div class="op-detail-lot-row op-detail-lot-gain"><span class="op-detail-lot-label">Ganancia:</span><span class="${gainClass}">${gainValue}</span></div>
          </div>
        </div>`;
    }).join('');

    // Also show standalone purchases (for compras with no venta yet)
    const standaloneCards = match.lots.filter(lm => {
        const lot = fifo.lots.find(l => l.id === lm.lotId);
        return lot && !lot.ventaOp;
    }).map(lm => {
        const lot = fifo.lots.find(l => l.id === lm.lotId);
        if (!lot) return '';
        return `<div class="op-detail-lot-card">
          <div class="op-detail-lot-head">
            <span class="op-detail-lot-id">${lot.id}</span>
            <span class="op-detail-lot-status pending">Disponible</span>
          </div>
          <div class="op-detail-lot-body">
            <div class="op-detail-lot-row"><span class="op-detail-lot-label">Compra:</span><span>${sanitizeHTML(lot.compras[0]?.op?.usuario || '—')} — ${(lm.amount || 0).toFixed(3)} USDC</span></div>
          </div>
        </div>`;
    }).join('');

    const hasContent = lotCards || standaloneCards || pendingHtml;
    return (pendingHtml || '') + (lotCards || '') + (standaloneCards || '') || '<div class="op-detail-fifo-empty">Sin datos FIFO disponibles.</div>';
}
