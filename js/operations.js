import { auth, db } from './firebase-init.js';
import { currentUserId, operations, wallyOperations, userConfig, editingIndex, currentDate, currentLotsData, currentPendingData, setOperations, setEditingIndex, setCurrentLotsData, setCurrentPendingData, currentProfileUserName, setCurrentDate, setWallyTotalGains } from './state.js';
import { showToast, openModal, closeModal, openConfirmModal, openConfirmMoveModal } from './ui.js';
import { showLotClosedAnimation, getShownLots, addShownLot, calculateLotProfit } from './notifications.js';
import { getRatingIndicator, renderDailyGoals, renderBankBreachesCards, renderLotDetailsCards, renderPendingDetails } from './utils.js';
import { setSortableTableInstance, setSortableListInstance } from './state.js';

export function calculateFIFOGainsForOps(opsArray) {
    if (!opsArray || opsArray.length === 0) {
        return [0, 0];
    }
    const opsCopy = JSON.parse(JSON.stringify(opsArray));
    let totalGainVes = 0;
    let totalGainUsdc = 0;

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
    const dailyOps = operations.filter(op => op.fecha === fecha).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    dailyOps.forEach(op => {
        op.ves = 0;
        op.usdc = 0;
        op.lote = '';
        if (op.operacion === 'Venta') {
            op._unmatchedAmount = op.montoUsdc;
        }
    });

    const purchases = dailyOps.filter(op => op.operacion === 'Compra');
    const sales = dailyOps.filter(op => op.operacion === 'Venta');
    const lots = new Map();
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
            if (remainingSaleAmount < 1e-5) { break; }
        }

        if (lot.montoConsumido >= lot.montoTotal - 1e-5) {
            lot.estado = 'cerrado';
        }
        lots.set(lotId, lot);
    });

    dailyOps.forEach(op => { delete op._unmatchedAmount; });
    let totalComprado = purchases.reduce((sum, op) => sum + op.montoUsdc, 0);
    let totalVendido = sales.reduce((sum, op) => sum + op.montoUsdc, 0);
    const pendingData = { recompra: Math.max(0, totalVendido - totalComprado), reventa: Math.max(0, totalComprado - totalVendido), recompraOps: [], reventaOps: [] };

    setCurrentLotsData(lots);
    setCurrentPendingData(pendingData);
}

export function loadOperations() {
    if (!currentUserId) return;
    db.collection('users').doc(currentUserId).collection('operations').orderBy('timestamp', 'desc').onSnapshot(s => {
        setOperations(s.docs.map(d => ({ id: d.id, ...d.data() })));

        if (currentProfileUserName) window.openUserProfileModal(currentProfileUserName);

        updateSummary();
        populateMonthSelector();
        window.checkInitialLoadComplete();
    }, e => { console.error(e); window.checkInitialLoadComplete(); });
}

export function saveOperation() {
    if (!currentUserId) return;
    const saveBtn = document.getElementById('saveOperationBtn');
    saveBtn.classList.add('loading');

    const isEditing = editingIndex > -1;
    const operacion = document.getElementById('operacion').value;
    const tasa = parseFloat(document.getElementById('tasa').value) || 0;
    const metodoPago = document.getElementById('metodoPago').value;
    const platformSelect = document.getElementById('p2pPlatformSelect');
    const platform = userConfig.p2pPlatforms.find(p => p.name === platformSelect.value);
    const commissionRate = platform ? platform.commission / 100 : 0;
    const grossUsdc = parseFloat(document.getElementById('montoUsdc').value) || 0;

    const montoBs = grossUsdc * tasa;
    let comisionVes = 0;
    if (operacion === 'Compra' && metodoPago === 'Pagomovil') {
        comisionVes = montoBs * 0.003;
    }
    const total = montoBs + comisionVes;

    const operationData = {
        usuario: document.getElementById('usuario').value,
        referencia: document.getElementById('referencia').value,
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
        fecha: isEditing ? operations[editingIndex].fecha : currentDate,
        timestamp: isEditing ? operations[editingIndex].timestamp : Date.now()
    };

    if (!operationData.usuario || !operationData.tasa || !grossUsdc) {
        showToast('Por favor, complete todos los campos obligatorios.', 'error');
        saveBtn.classList.remove('loading');
        return;
    }

    const opId = isEditing ? operations[editingIndex].id : db.collection('users').doc(currentUserId).collection('operations').doc().id;

    db.collection('users').doc(currentUserId).collection('operations').doc(opId).set(operationData, { merge: true }).then(() => {
        closeModal();
        showToast('Operación guardada.', 'success');
        if (!isEditing) {
            setLastSavedUser(operationData.usuario);
            setLastSavedOperationType('main');
            openRatingModal(operationData.usuario);
        }
    }).catch(e => {
        showToast('Error al guardar.', 'error');
        console.error("Error al guardar operación:", e);
    }).finally(() => {
        saveBtn.classList.remove('loading');
    });
}

export function editOperation(operationId) {
    const index = operations.findIndex(op => op.id === operationId);
    if (index === -1) {
        console.error("Operación no encontrada para editar:", operationId);
        showToast("Error: No se encontró la operación para editar.", "error");
        return;
    }

    setEditingIndex(index);
    const op = operations[index];
    document.getElementById('modalTitle').textContent = 'Editar Operación';

    document.getElementById('montoUsdc').value = op.montoUsdc.toFixed(3);
    document.getElementById('usuario').value = op.usuario;
    document.getElementById('referencia').value = op.referencia;
    document.getElementById('operacion').value = op.operacion;
    document.getElementById('tasa').value = op.tasa;
    document.getElementById('metodoPago').value = op.metodoPago;
    document.getElementById('p2pPlatformSelect').value = op.p2pPlatform || (userConfig.p2pPlatforms.find(p=>p.isDefault)?.name || '');
    document.getElementById('estatus').value = op.estatus;

    calculateAll();
    openModal();
}

export function deleteOperation(operationId) {
    if (!currentUserId) return;

    const opToDelete = operations.find(op => op.id === operationId);
    const message = opToDelete
        ? `¿Seguro que quieres eliminar la operación de "${opToDelete.usuario}"? Esta acción no se puede deshacer.`
        : '¿Estás seguro de que deseas eliminar esta operación?';

    openConfirmModal(message, () => {
        db.collection('users').doc(currentUserId).collection('operations').doc(operationId).delete()
            .then(() => showToast('Operación eliminada.', 'info'))
            .catch(error => showToast('Error al eliminar la operación.', 'error'));
    });
}

export async function updateSummary() {
    const { loadInitialCapital } = await import('./capital.js');
    await loadInitialCapital(currentDate);

    const currentOps = operations.filter(op => op.fecha === currentDate);

    if (operations && operations.length > 0) {
        applyFIFOForDate(currentDate);

        const shownLots = getShownLots();
        const newlyClosedLots = [];
        for (const [lotId, lot] of currentLotsData.entries()) {
            if (lot.estado === 'cerrado' && !shownLots.has(lotId)) {
                newlyClosedLots.push(lot);
            }
        }
        if (newlyClosedLots.length > 0) {
            newlyClosedLots.forEach((lot, index) => {
                setTimeout(() => {
                    const profit = calculateLotProfit(lot);
                    if (profit > 0) {
                        showLotClosedAnimation(profit);
                        addShownLot(lot.id);
                    }
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

        const activeLotsCount = Array.from(currentLotsData.values()).filter(lot => lot.estado === 'activo').length;
        document.getElementById('activeLotsSummary').textContent = activeLotsCount;
        document.getElementById('pendingSummary').textContent = `${(currentPendingData.recompra + currentPendingData.reventa).toFixed(2)} USDC`;

        renderOperations();
    }

    const gananciasVes = currentOps.reduce((total, op) => total + (op.ves || 0), 0);
    const gananciasUsdc = currentOps.reduce((total, op) => total + (op.usdc || 0), 0);

    const { calculateWallyGainsForPeriod } = await import('./wally.js');
    const [wallyGainsUsdcForDate, wallyGainsUsdForDate] = calculateWallyGainsForPeriod(wallyOperations.filter(op => op.fecha === currentDate));

    document.getElementById('ganancias').innerHTML = `${gananciasVes.toFixed(2)} <span class="font-medium">VES</span>`;
    document.getElementById('ganancias_usdc').innerHTML = `${gananciasUsdc.toFixed(4)} <span class="text-2xl font-semibold">USDC</span>`;
    document.getElementById('wallyDashboardGainsUsdc').innerHTML = `${wallyGainsUsdcForDate.toFixed(2)} <span class="text-xl font-semibold">USDC</span>`;
    document.getElementById('wallyDashboardGainsUsd').innerHTML = `${wallyGainsUsdForDate.toFixed(2)} <span class="text-xl font-semibold">USD</span>`;

    renderDailyGoals(gananciasVes, gananciasUsdc, wallyGainsUsdcForDate, wallyGainsUsdForDate);
}

export function renderOperations() {
    if (sortableTableInstance) {
        sortableTableInstance.destroy();
    }
    if (sortableListInstance) {
        sortableListInstance.destroy();
    }

    const tableBody = document.getElementById('operationsTable');
    const listContainer = document.getElementById('operationsList');
    const emptyState = document.getElementById('reports-empty-state');
    const desktopTableContainer = document.querySelector('#page-reports .table-container');
    const mobileListContainer = document.querySelector('#page-reports .operations-list-container');
    const scrollContainer = document.getElementById('scroll-container');

    const searchTerm = document.getElementById('searchOperations').value.toLowerCase();
    const filterOperacion = document.getElementById('filterOperacion').value;
    const filterMetodo = document.getElementById('filterMetodoPago').value;
    const filteredOps = operations.filter(op =>
        (op.fecha === currentDate) &&
        (op.usuario.toLowerCase().includes(searchTerm) || (op.referencia && op.referencia.toLowerCase().includes(searchTerm))) &&
        (filterOperacion === '' || op.operacion === filterOperacion) &&
        (filterMetodo === '' || op.metodoPago === filterMetodo)
    );

    filteredOps.sort((a, b) => b.timestamp - a.timestamp);

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
        const relationIndicator = op.operacion === 'Compra' ? `${op.metodoPago} ➡️ ${op.p2pPlatform || ''}` : `${op.metodoPago} ⬅️ ${op.p2pPlatform || ''}`;
        const commissionIndicator = op.adCommissionPercent > 0 ? `<span class="text-xs ${op.operacion === 'Venta' ? 'text-green-400' : 'text-red-400'}">(${op.operacion === 'Venta' ? '+' : '-'}${op.adCommissionPercent}%)</span>` : '';
        const mobileCommissionIndicator = op.adCommissionPercent > 0 ? `<span class="commission">(${op.operacion === 'Venta' ? '+' : '-'}${op.adCommissionPercent}%)</span>` : '';
        const tableRowHtml = `<tr data-id="${op.id}" class="hover:bg-[var(--surface)] cursor-grab"><td class="text-left"><div class="font-semibold flex items-center">${op.usuario} ${getRatingIndicator(op.usuario)}</div><div class="text-xs text-gray-400">${relationIndicator}</div></td><td>${op.referencia || ''}</td><td>${op.operacion.substring(0,1)}</td><td>${(op.tasa || 0).toFixed(2)}</td><td><div class="flex flex-col items-center">${(cryptoValueToDisplay || 0).toFixed(3)} ${commissionIndicator}</div></td><td>${(op.montoBs || 0).toFixed(2)}</td><td>
    <span class="${op.ves >= 0 ? 'text-green-400' : 'text-red-400'} font-semibold">${(op.ves || 0).toFixed(2)} Bs</span>
    <span class="text-gray-500 mx-1">/</span>
    <span class="${op.usdc >= 0 ? 'text-green-400' : 'text-red-400'} font-semibold">${(op.usdc || 0).toFixed(2)} $</span>
</td><td class="font-semibold ${op.usdc >= 0 ? 'text-green-400':'text-red-400'}">${(op.usdc || 0).toFixed(4)}</td><td>${op.lote || ''}</td><td><span class="px-2 py-1 text-xs font-semibold rounded-full ${op.estatus === 'Completado' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}">${op.estatus}</span></td><td><button class="text-blue-400 p-1" onclick="editOperation('${op.id}')">✏️</button><button class="text-red-400 p-1" onclick="deleteOperation('${op.id}')">🗑️</button></td></tr>`;
        const cardHtml = `<div data-id="${op.id}" class="operation-card ${op.operacion.toLowerCase()} cursor-grab"><div class="card-header"><div class="user-info flex items-center">${op.usuario} ${getRatingIndicator(op.usuario)}<div class="payment-method ml-auto">${relationIndicator}</div></div><span class="status-badge ${op.estatus === 'Completado' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}">${op.estatus}</span></div><div class="card-grid"><div class="grid-item"><span class="label">Monto USDC</span><span class="value">${(cryptoValueToDisplay || 0).toFixed(3)} ${mobileCommissionIndicator}</span></div><div class="grid-item"><span class="label">Monto BS</span><span class="value">${(op.montoBs || 0).toFixed(2)}</span></div><div class="grid-item"><span class="label">Tasa</span><span class="value">${(op.tasa || 0).toFixed(2)}</span></div><div class="grid-item">
    <span class="label">Ganancia VES / USD</span>
    <div class="value">
        <span class="${op.ves >= 0 ? 'profit-green' : 'profit-red'}">${(op.ves || 0).toFixed(2)}</span>
        <span class="text-gray-500"> / </span>
        <span class="${op.usdc >= 0 ? 'profit-green' : 'profit-red'}">${(op.usdc || 0).toFixed(2)}</span>
    </div>
</div></div><div class="card-footer"><div class="ref-info">REF: ${op.referencia || 'N/A'}<br>LOTE: ${op.lote || 'N/A'}</div><div class="actions"><button class="action-btn edit" onclick="editOperation('${op.id}')"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg></button><button class="action-btn delete" onclick="deleteOperation('${op.id}')"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.033c-1.12 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg></button></div></div></div>`;
        tableBody.innerHTML += tableRowHtml;
        listContainer.innerHTML += cardHtml;
    });

    const sortableOptions = {
        animation: 150, delay: 300, delayOnTouchOnly: true,
        forceFallback: true, fallbackOnBody: true,
        scroll: scrollContainer, bubbleScroll: true,
        onEnd: handleDragEnd
    };

    if (tableBody.children.length > 0) {
        setSortableTableInstance(new Sortable(tableBody, sortableOptions));
    }
    if (listContainer.children.length > 0) {
        setSortableListInstance(new Sortable(listContainer, sortableOptions));
    }
}

export function handleDragEnd(evt) {
    const { newIndex, oldIndex, item } = evt;

    if (oldIndex === newIndex) {
        return;
    }

    const operationId = item.dataset.id;
    if (!operationId) {
        renderOperations();
        return;
    }

    const searchTerm = document.getElementById('searchOperations').value.toLowerCase();
    const filterOperacion = document.getElementById('filterOperacion').value;
    const filterMetodo = document.getElementById('filterMetodoPago').value;
    const currentSortedOps = operations
        .filter(op =>
            op.fecha === currentDate &&
            (op.usuario.toLowerCase().includes(searchTerm) || (op.referencia && op.referencia.toLowerCase().includes(searchTerm))) &&
            (filterOperacion === '' || op.operacion === filterOperacion) &&
            (filterMetodo === '' || op.metodoPago === filterMetodo)
        )
        .sort((a, b) => b.timestamp - a.timestamp);

    if (currentSortedOps.length < 1) {
        renderOperations();
        return;
    }

    let newTimestamp;

    if (newIndex === 0) {
        newTimestamp = (currentSortedOps[0]?.timestamp || Date.now()) + 30000;
    } else if (newIndex >= currentSortedOps.length) {
        newTimestamp = (currentSortedOps[currentSortedOps.length - 1]?.timestamp || Date.now()) - 30000;
    } else {
        const neighborBefore = currentSortedOps[newIndex - 1];
        const neighborAfter = currentSortedOps[newIndex];
        if (!neighborBefore || !neighborAfter) {
            renderOperations();
            return;
        }
        newTimestamp = Math.floor((neighborBefore.timestamp + neighborAfter.timestamp) / 2);
    }

    if (!newTimestamp) {
        renderOperations();
        return;
    }

    const confirmCallback = () => {
        db.collection('users').doc(currentUserId).collection('operations').doc(operationId)
        .update({ timestamp: newTimestamp })
        .then(() => {
            showToast('Orden actualizado. Recalculando...', 'success');
        })
        .catch(err => {
            showToast('Error al actualizar el orden.', 'error');
            console.error(err);
            renderOperations();
        });
    };

    openConfirmMoveModal(
        '¿Estás seguro de que quieres cambiar el orden de esta operación? Esto recalculará todas las ganancias del día.',
        confirmCallback
    );
}

export function openGainsSummaryModal() {
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

    const dailyOps = operations.filter(op => op.fecha === todayStr);
    const weeklyOps = operations.filter(op => op.fecha >= startOfWeekStr && op.fecha <= todayStr);
    const monthlyOps = operations.filter(op => op.fecha >= startOfMonthStr && op.fecha <= todayStr);

    const [dailyGainsVes, dailyGainsUsdc] = calculateFIFOGainsForOps(dailyOps);
    const [weeklyGainsVes, weeklyGainsUsdc] = calculateFIFOGainsForOps(weeklyOps);
    const [monthlyGainsVes, monthlyGainsUsdc] = calculateFIFOGainsForOps(monthlyOps);

    document.getElementById('summaryGananciasHoyVes').textContent = `${dailyGainsVes.toFixed(2)} VES`;
    document.getElementById('summaryGananciasHoyUsdc').textContent = `${dailyGainsUsdc.toFixed(4)} USDC`;
    document.getElementById('summaryGananciasSemanaVes').textContent = `${weeklyGainsVes.toFixed(2)} VES`;
    document.getElementById('summaryGananciasSemanaUsdc').textContent = `${weeklyGainsUsdc.toFixed(4)} USDC`;
    document.getElementById('summaryGananciasMesVes').textContent = `${monthlyGainsVes.toFixed(2)} VES`;
    document.getElementById('summaryGananciasMesUsdc').textContent = `${monthlyGainsUsdc.toFixed(4)} USDC`;

    document.getElementById('gainsSummaryModal').classList.add('show');
}

export function closeGainsSummaryModal() {
    document.getElementById('gainsSummaryModal').classList.remove('show');
}

function populateMonthSelector() {
    const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const select = document.getElementById('monthSelector');
    if (select) {
        const months = [...new Set(operations.map(op => op.fecha ? op.fecha.substring(0,7) : null).filter(Boolean))].sort();
        select.innerHTML = '<option value="">Seleccionar Mes</option>';
        if (months.length > 0) {
            const grouped = {};
            months.forEach(m => {
                const [y, mo] = m.split('-');
                const label = `${monthNames[parseInt(mo)-1]} ${y}`;
                if (!grouped[y]) grouped[y] = [];
                grouped[y].push({ value: m, label });
            });
            Object.keys(grouped).sort().reverse().forEach(year => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = year;
                grouped[year].forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.value;
                    option.textContent = item.label;
                    optgroup.appendChild(option);
                });
                select.appendChild(optgroup);
            });
        }
    }
}
