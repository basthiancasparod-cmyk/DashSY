import { state, db, defaultProfitGoals, defaultDashboardGoals } from './state.js';
import { showToast } from './ui.js';
import { sanitizeHTML } from './utils.js';

export async function loadConfig() {
    if (!state.currentUserId) return;
    try {
        const defaultConfig = {
            profitGoals: defaultProfitGoals,
            dashboardGoals: defaultDashboardGoals,
            wallyInitialValue: 0,
            p2pPlatforms: [
                { name: "Syklo", commission: 0, isDefault: true, type: "CRIPTO" },
                { name: "Apolo", commission: 0.2, isDefault: false, type: "CRIPTO" },
                { name: "Wally", commission: 0, isDefault: false, type: "USD" },
                { name: "Zinli", commission: 1.5, isDefault: false, type: "USD" }
            ],
            paymentMethods: {
                ves: ["Pagomovil", "Banesco", "Venezuela", "Bancamiga", "BNC"],
                usd: ["Wally", "Zinli"]
            },
            managedAccounts: [],
            bankFees: [
                { metodoPago: 'Pagomovil', operacion: 'Compra', rate: 0.003 }
            ]
        };
        const doc = await db.collection('users').doc(state.currentUserId).collection('settings').doc('userConfig').get();
        state.userConfig = doc.exists ? { ...defaultConfig, ...doc.data() } : defaultConfig;
        if (!state.userConfig.profitGoals) state.userConfig.profitGoals = defaultConfig.profitGoals;
        if (!state.userConfig.dashboardGoals) state.userConfig.dashboardGoals = defaultConfig.dashboardGoals;
        if (!state.userConfig.p2pPlatforms) state.userConfig.p2pPlatforms = defaultConfig.p2pPlatforms;
        if (!state.userConfig.paymentMethods) state.userConfig.paymentMethods = defaultConfig.paymentMethods;
        if (!state.userConfig.managedAccounts) state.userConfig.managedAccounts = defaultConfig.managedAccounts;
        if (!state.userConfig.bankFees) state.userConfig.bankFees = defaultConfig.bankFees;
        await applyConfig();
        checkInitialLoadComplete();
    } catch (e) {
        console.error(e);
        checkInitialLoadComplete();
        throw e;
    }
}

export async function applyConfig() {
    populatePaymentMethods();
    const { populateUsdPaymentMethodsFilter } = await import('./operations.js');
    populateUsdPaymentMethodsFilter();
    populateP2PPlatformSelects();
    const { updateSummary } = await import('./operations.js');
    updateSummary();
    const { updateWallySummary } = await import('./wally.js');
    updateWallySummary();
}

function populatePaymentMethods() {
    const methods = state.userConfig.paymentMethods ? state.userConfig.paymentMethods.ves || [] : [];
    const mainSelect = document.getElementById('metodoPago');
    const filterSelect = document.getElementById('filterMetodoPago');
    mainSelect.innerHTML = methods.map(m => `<option value="${m}">${m}</option>`).join('');
    filterSelect.innerHTML = '<option value="">Todos los Métodos</option>' + methods.map(m => `<option value="${m}">${m}</option>`).join('');
}

function populateP2PPlatformSelects() {
    const platforms = state.userConfig.p2pPlatforms || [];
    const optionsHtml = platforms.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    document.getElementById('p2pPlatformSelect').innerHTML = optionsHtml;
}

export function saveConfig() {
    const saveBtn = document.getElementById('saveConfigBtn');
    saveBtn.classList.add('loading');
    state.userConfig.profitGoals.ves = parseFloat(document.getElementById('goalVes').value) || defaultProfitGoals.ves;
    state.userConfig.profitGoals.crypto = parseFloat(document.getElementById('goalCrypto').value) || defaultProfitGoals.crypto;
    state.userConfig.profitGoals.usd = parseFloat(document.getElementById('goalUsd').value) || defaultProfitGoals.usd;
    db.collection('users').doc(state.currentUserId).collection('settings').doc('userConfig').set(state.userConfig, {merge: true}).then(() => {
        applyConfig();
        showToast('Configuración guardada.', 'success');
    }).catch(e => {
        showToast('Error al guardar configuración.', 'error');
    }).finally(() => {
        saveBtn.classList.remove('loading');
        document.getElementById('configModal').classList.remove('show');
    });
}

export function renderP2PPlatforms() {
    const container = document.getElementById('p2pPlatformsList');
    container.innerHTML = state.userConfig.p2pPlatforms.map((platform, index) => {
        let typeColor = 'text-gray-400 border-gray-600';
        if (platform.type === 'CRIPTO') typeColor = 'text-orange-400 border-orange-400/50';
        if (platform.type === 'USD') typeColor = 'text-green-400 border-green-400/50';
        if (platform.type === 'VES') typeColor = 'text-blue-400 border-blue-400/50';
        const sName = sanitizeHTML(platform.name);
        const editIcon = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>';
        const deleteIcon = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.033c-1.12 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>';
        return `<div class="platform-item"><input type="radio" name="defaultPlatform" onchange="setDefaultP2PPlatform(${index})" ${platform.isDefault ? 'checked' : ''}><div class="platform-item-info"><div class="flex items-center gap-2"><span class="platform-item-name">${sName}</span><span class="text-xs font-semibold px-2 py-0.5 rounded-full border ${typeColor}">${sanitizeHTML(platform.type) || 'SIN TIPO'}</span></div><div class="platform-item-details">Comisión: ${platform.commission}% ${platform.isDefault ? '<strong>(Predeterminada)</strong>' : ''}</div></div><div class="platform-item-actions"><button onclick="editP2PPlatform(${index})" aria-label="Editar ${sName}">${editIcon}</button><button onclick="deleteP2PPlatform(${index})" aria-label="Eliminar ${sName}">${deleteIcon}</button></div></div>`;
    }).join('');
}

export function addOrUpdateP2PPlatform() {
    const nameInput = document.getElementById('newPlatformName');
    const commissionInput = document.getElementById('newPlatformCommission');
    const typeInput = document.getElementById('newPlatformType');
    const indexInput = document.getElementById('editingPlatformIndex');
    const name = nameInput.value.trim();
    const commission = parseFloat(commissionInput.value) || 0;
    const type = typeInput.value;
    const index = parseInt(indexInput.value);
    if (!name) { showToast('El nombre de la plataforma es requerido.', 'warning'); return; }
    if (index > -1) {
        state.userConfig.p2pPlatforms[index].name = name;
        state.userConfig.p2pPlatforms[index].commission = commission;
        state.userConfig.p2pPlatforms[index].type = type;
    } else {
        if (state.userConfig.p2pPlatforms.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            showToast('Ya existe una plataforma con ese nombre.', 'warning');
            return;
        }
        state.userConfig.p2pPlatforms.push({ name, commission, type, isDefault: state.userConfig.p2pPlatforms.length === 0 });
    }
    nameInput.value = '';
    commissionInput.value = '';
    typeInput.value = 'CRIPTO';
    indexInput.value = -1;
    document.getElementById('platformFormTitle').textContent = 'Añadir Nueva Plataforma';
    document.getElementById('addPlatformBtn').textContent = 'Añadir Plataforma';
    renderP2PPlatforms();
}

export function editP2PPlatform(index) {
    const platform = state.userConfig.p2pPlatforms[index];
    document.getElementById('newPlatformName').value = platform.name;
    document.getElementById('newPlatformCommission').value = platform.commission;
    document.getElementById('newPlatformType').value = platform.type || 'CRIPTO';
    document.getElementById('editingPlatformIndex').value = index;
    document.getElementById('platformFormTitle').textContent = 'Editando Plataforma';
    document.getElementById('addPlatformBtn').textContent = 'Actualizar';
}

export function deleteP2PPlatform(index) {
    if (state.userConfig.p2pPlatforms.length === 1) { showToast('No puedes eliminar la última plataforma. Debes tener al menos una.', 'error'); return; }
    if (state.userConfig.p2pPlatforms[index].isDefault && state.userConfig.p2pPlatforms.length > 1) { showToast('No puedes eliminar la plataforma predeterminada. Elige otra primero.', 'error'); return; }
    const sName = sanitizeHTML(state.userConfig.p2pPlatforms[index].name);
    window.openConfirmModal(`¿Seguro que quieres eliminar la plataforma "${sName}"?`, () => {
        state.userConfig.p2pPlatforms.splice(index, 1);
        renderP2PPlatforms();
    });
}

export function setDefaultP2PPlatform(index) {
    state.userConfig.p2pPlatforms.forEach((p, i) => { p.isDefault = i === index; });
    renderP2PPlatforms();
}

export function renderPaymentMethodsConfig() {
    const container = document.getElementById('paymentMethodsList');
    container.innerHTML = (state.userConfig.paymentMethods.ves || []).map((method, index) => `<div class="method-tag"><span>${method}</span><button class="delete-method-btn" onclick="deletePaymentMethod(${index})">&times;</button></div>`).join('');
}

export function addPaymentMethod() {
    const input = document.getElementById('newPaymentMethod');
    const newMethod = input.value.trim();
    if (!newMethod) return;
    if (!state.userConfig.paymentMethods.ves) state.userConfig.paymentMethods.ves = [];
    state.userConfig.paymentMethods.ves.push(newMethod);
    input.value = '';
    renderPaymentMethodsConfig();
}

export function deletePaymentMethod(index) {
    state.userConfig.paymentMethods.ves.splice(index, 1);
    renderPaymentMethodsConfig();
}

export function renderUsdPaymentMethodsConfig() {
    const container = document.getElementById('usdPaymentMethodsList');
    container.innerHTML = (state.userConfig.paymentMethods.usd || []).map((method, index) => `<div class="method-tag"><span>${method}</span><button class="delete-method-btn" onclick="deleteUsdPaymentMethod(${index})">&times;</button></div>`).join('');
}

export function addUsdPaymentMethod() {
    const input = document.getElementById('newUsdPaymentMethod');
    const newMethod = input.value.trim();
    if (!newMethod) return;
    if (!state.userConfig.paymentMethods.usd) state.userConfig.paymentMethods.usd = [];
    state.userConfig.paymentMethods.usd.push(newMethod);
    input.value = '';
    renderUsdPaymentMethodsConfig();
}

export function deleteUsdPaymentMethod(index) {
    state.userConfig.paymentMethods.usd.splice(index, 1);
    renderUsdPaymentMethodsConfig();
}

export function updateGoalToggleButtons() {
    const toggles = document.querySelectorAll('#dashboardGoalToggles .goal-toggle-btn');
    toggles.forEach(btn => {
        const goalType = btn.dataset.goal;
        if (state.userConfig.dashboardGoals[goalType]) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

function goalCard(label, current, goal, unit, iconSvg, barColor, reachedColor) {
    const pct = Math.min(goal > 0 ? (current / goal) * 100 : 0, 100);
    const reached = pct >= 100;
    const barBg = reached ? reachedColor : barColor;
    return `<div class="relative overflow-hidden rounded-xl border ${reached ? 'border-green-500/30' : 'border-gray-700/50'}" style="background: ${reached ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)'}">
        <div class="p-3">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${reached ? 'rgba(34,197,94,0.15)' : 'rgba(88,166,255,0.1)'}">${iconSvg}</div>
                    <span class="text-xs font-semibold uppercase tracking-wider ${reached ? 'text-green-400' : 'text-gray-400'}">${label}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold font-mono">${current.toFixed(2)} <span class="text-gray-400 font-normal">/</span> ${goal.toFixed(2)} ${unit}</span>
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full ${reached ? 'bg-green-500/20 text-green-400' : pct >= 75 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/50 text-gray-400'}" style="min-width: 3rem; text-align: center;">${pct.toFixed(0)}%</span>
                </div>
            </div>
            <div class="w-full rounded-full" style="height: 6px; background: rgba(255,255,255,0.08)">
                <div class="h-full rounded-full transition-all duration-700 ease-out" style="width: ${pct}%; background: ${barBg}"></div>
            </div>
            ${reached ? '<div class="flex items-center gap-1 mt-1.5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span class="text-xs text-green-400 font-medium">Meta alcanzada</span></div>' : ''}
        </div>
    </div>`;
}

export function renderDailyGoals(currentVes, currentUsdcFromVes, currentCrypto, currentUsd) {
    const container = document.getElementById('dailyGoalsContainer');
    container.innerHTML = '';
    const goalsToShow = state.userConfig.dashboardGoals || defaultDashboardGoals;
    const profitGoals = state.userConfig.profitGoals || defaultProfitGoals;
    let visibleGoalsCount = 0;
    if (goalsToShow.ves) {
        visibleGoalsCount++;
        container.innerHTML += goalCard('Meta OP (Cripto)', currentUsdcFromVes, profitGoals.ves || 0, 'USDC',
            '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-blue-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg>',
            'linear-gradient(90deg, #3b82f6, #60a5fa)', 'linear-gradient(90deg, #22c55e, #4ade80)');
    }
    if (goalsToShow.crypto) {
        visibleGoalsCount++;
        container.innerHTML += goalCard('Meta Wallet (Cripto)', currentCrypto, profitGoals.crypto || 0, 'USDC',
            '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-orange-400"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /></svg>',
            'linear-gradient(90deg, #f97316, #fb923c)', 'linear-gradient(90deg, #22c55e, #4ade80)');
    }
    if (goalsToShow.usd) {
        visibleGoalsCount++;
        container.innerHTML += goalCard('Meta Wallet (USD)', currentUsd, profitGoals.usd || 0, 'USD',
            '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-purple-400"><path stroke-linecap="round" stroke-linejoin="round" d="M14.25 7.756a4.5 4.5 0 100 8.488M7.5 10.5h5.25m-5.25 3h5.25" /></svg>',
            'linear-gradient(90deg, #a855f7, #c084fc)', 'linear-gradient(90deg, #22c55e, #4ade80)');
    }
    if (visibleGoalsCount === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-6 text-gray-400"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-10 h-10 mb-2 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg><p class="text-sm">No hay metas seleccionadas. Ve a Ajustes para activar alguna.</p></div>`;
    }
}
