import { auth, db } from './firebase-init.js';
import { currentUserId, userConfig, setUserConfig } from './state.js';
import { showToast } from './ui.js';

const defaultProfitGoals = { ves: 1000.00, crypto: 50.00, usd: 50.00 };
const defaultDashboardGoals = { ves: true, crypto: false, usd: false };

export function loadConfig() {
    if (!currentUserId) return;
    return new Promise((resolve, reject) => {
        db.collection('users').doc(currentUserId).collection('settings').doc('userConfig').get().then(doc => {
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
                managedAccounts: []
            };
            const config = doc.exists ? { ...defaultConfig, ...doc.data() } : defaultConfig;

            if (!config.profitGoals) config.profitGoals = defaultConfig.profitGoals;
            if (!config.dashboardGoals) config.dashboardGoals = defaultConfig.dashboardGoals;
            if (!config.p2pPlatforms) config.p2pPlatforms = defaultConfig.p2pPlatforms;
            if (!config.paymentMethods) config.paymentMethods = defaultConfig.paymentMethods;
            if (!config.managedAccounts) config.managedAccounts = defaultConfig.managedAccounts;

            setUserConfig(config);
            applyConfig();
            window.checkInitialLoadComplete();
            resolve();
        }).catch(e => { console.error(e); window.checkInitialLoadComplete(); reject(e); });
    });
}

export async function applyConfig() {
    populatePaymentMethods();
    populateUsdPaymentMethodsFilter();
    populateP2PPlatformSelects();
    const { updateSummary } = await import('./operations.js');
    const { updateWallySummary } = await import('./wally.js');
    updateSummary();
    updateWallySummary();
}

export function openConfigModal() {
    document.getElementById('configModal').classList.add('show');
    document.getElementById('goalVes').value = userConfig.profitGoals.ves;
    document.getElementById('goalCrypto').value = userConfig.profitGoals.crypto;
    document.getElementById('goalUsd').value = userConfig.profitGoals.usd;
    updateGoalToggleButtons();
    renderP2PPlatforms();
    renderPaymentMethodsConfig();
    renderUsdPaymentMethodsConfig();
}

export function closeConfigModal() {
    document.getElementById('configModal').classList.remove('show');
}

export function saveConfig() {
    const saveBtn = document.getElementById('saveConfigBtn');
    saveBtn.classList.add('loading');

    userConfig.profitGoals.ves = parseFloat(document.getElementById('goalVes').value) || defaultProfitGoals.ves;
    userConfig.profitGoals.crypto = parseFloat(document.getElementById('goalCrypto').value) || defaultProfitGoals.crypto;
    userConfig.profitGoals.usd = parseFloat(document.getElementById('goalUsd').value) || defaultProfitGoals.usd;

    db.collection('users').doc(currentUserId).collection('settings').doc('userConfig').set(userConfig, {merge: true}).then(() => {
        applyConfig();
        showToast('Configuración guardada.', 'success');
    }).catch(e => {
        showToast('Error al guardar configuración.', 'error');
    }).finally(() => {
        saveBtn.classList.remove('loading');
        closeConfigModal();
    });
}

function updateGoalToggleButtons() {
    const toggles = document.querySelectorAll('#dashboardGoalToggles .goal-toggle-btn');
    toggles.forEach(btn => {
        const goalType = btn.dataset.goal;
        if (userConfig.dashboardGoals[goalType]) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

document.getElementById('dashboardGoalToggles')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('goal-toggle-btn')) {
        const goalType = e.target.dataset.goal;
        userConfig.dashboardGoals[goalType] = !userConfig.dashboardGoals[goalType];
        e.target.classList.toggle('active');
    }
});

function renderP2PPlatforms() {
    const container = document.getElementById('p2pPlatformsList');
    container.innerHTML = userConfig.p2pPlatforms.map((platform, index) => {
        let typeColor = 'text-gray-400 border-gray-600';
        if (platform.type === 'CRIPTO') typeColor = 'text-orange-400 border-orange-400/50';
        if (platform.type === 'USD') typeColor = 'text-green-400 border-green-400/50';
        if (platform.type === 'VES') typeColor = 'text-blue-400 border-blue-400/50';

        return `
        <div class="platform-item">
            <input type="radio" name="defaultPlatform" onchange="setDefaultP2PPlatform(${index})" ${platform.isDefault ? 'checked' : ''}>
            <div class="platform-item-info">
                <div class="flex items-center gap-2">
                    <span class="platform-item-name">${platform.name}</span>
                    <span class="text-xs font-semibold px-2 py-0.5 rounded-full border ${typeColor}">${platform.type || 'SIN TIPO'}</span>
                </div>
                <div class="platform-item-details">Comisión: ${platform.commission}% ${platform.isDefault ? '<strong>(Predeterminada)</strong>' : ''}</div>
            </div>
            <div class="platform-item-actions">
                <button onclick="editP2PPlatform(${index})">✏️</button>
                <button onclick="deleteP2PPlatform(${index})">🗑️</button>
            </div>
        </div>
    `}).join('');
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

    if (!name) {
        showToast('El nombre de la plataforma es requerido.', 'warning');
        return;
    }

    if (index > -1) {
        userConfig.p2pPlatforms[index].name = name;
        userConfig.p2pPlatforms[index].commission = commission;
        userConfig.p2pPlatforms[index].type = type;
    } else {
        if (userConfig.p2pPlatforms.some(p => p.name.toLowerCase() === name.toLowerCase())) {
            showToast('Ya existe una plataforma con ese nombre.', 'warning');
            return;
        }
        userConfig.p2pPlatforms.push({ name, commission, type, isDefault: userConfig.p2pPlatforms.length === 0 });
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
    const platform = userConfig.p2pPlatforms[index];
    document.getElementById('newPlatformName').value = platform.name;
    document.getElementById('newPlatformCommission').value = platform.commission;
    document.getElementById('newPlatformType').value = platform.type || 'CRIPTO';
    document.getElementById('editingPlatformIndex').value = index;
    document.getElementById('platformFormTitle').textContent = 'Editando Plataforma';
    document.getElementById('addPlatformBtn').textContent = 'Actualizar';
}

export function deleteP2PPlatform(index) {
    if (userConfig.p2pPlatforms.length === 1) {
        showToast('No puedes eliminar la última plataforma. Debes tener al menos una.', 'error');
        return;
    }

    if (userConfig.p2pPlatforms[index].isDefault && userConfig.p2pPlatforms.length > 1) {
        showToast('No puedes eliminar la plataforma predeterminada. Elige otra primero.', 'error');
        return;
    }

    if (!confirm(`¿Seguro que quieres eliminar la plataforma "${userConfig.p2pPlatforms[index].name}"?`)) return;

    userConfig.p2pPlatforms.splice(index, 1);
    renderP2PPlatforms();
}

export function setDefaultP2PPlatform(index) {
    userConfig.p2pPlatforms.forEach((p, i) => {
        p.isDefault = i === index;
    });
    renderP2PPlatforms();
}

function populateP2PPlatformSelects() {
    const platforms = userConfig.p2pPlatforms || [];
    const optionsHtml = platforms.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    document.getElementById('p2pPlatformSelect').innerHTML = optionsHtml;
}

function renderPaymentMethodsConfig() {
    const container = document.getElementById('paymentMethodsList');
    container.innerHTML = (userConfig.paymentMethods.ves || []).map((method, index) =>
        `<div class="method-tag"><span>${method}</span><button class="delete-method-btn" onclick="deletePaymentMethod(${index})">&times;</button></div>`
    ).join('');
}

export function addPaymentMethod() {
    const input = document.getElementById('newPaymentMethod');
    const newMethod = input.value.trim();
    if (!newMethod) return;
    if(!userConfig.paymentMethods.ves) userConfig.paymentMethods.ves = [];
    userConfig.paymentMethods.ves.push(newMethod);
    input.value = '';
    renderPaymentMethodsConfig();
}

export function deletePaymentMethod(index) {
    userConfig.paymentMethods.ves.splice(index, 1);
    renderPaymentMethodsConfig();
}

function renderUsdPaymentMethodsConfig() {
    const container = document.getElementById('usdPaymentMethodsList');
    container.innerHTML = (userConfig.paymentMethods.usd || []).map((method, index) =>
        `<div class="method-tag"><span>${method}</span><button class="delete-method-btn" onclick="deleteUsdPaymentMethod(${index})">&times;</button></div>`
    ).join('');
}

export function addUsdPaymentMethod() {
    const input = document.getElementById('newUsdPaymentMethod');
    const newMethod = input.value.trim();
    if (!newMethod) return;
    if(!userConfig.paymentMethods.usd) userConfig.paymentMethods.usd = [];
    userConfig.paymentMethods.usd.push(newMethod);
    input.value = '';
    renderUsdPaymentMethodsConfig();
}

export function deleteUsdPaymentMethod(index) {
    userConfig.paymentMethods.usd.splice(index, 1);
    renderUsdPaymentMethodsConfig();
}

function populatePaymentMethods() {
    const methods = userConfig.paymentMethods ? userConfig.paymentMethods.ves || [] : [];
    const mainSelect = document.getElementById('metodoPago');
    const filterSelect = document.getElementById('filterMetodoPago');
    mainSelect.innerHTML = methods.map(m => `<option value="${m}">${m}</option>`).join('');
    filterSelect.innerHTML = '<option value="">Todos los Métodos</option>' + methods.map(m => `<option value="${m}">${m}</option>`).join('');
}
