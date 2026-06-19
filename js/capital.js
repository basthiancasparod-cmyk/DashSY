import { state, db } from './state.js';
import { showToast, openConfirmModal } from './ui.js';

export function loadInitialCapital(date) {
    if (!state.currentUserId) return;
    return db.collection('users').doc(state.currentUserId).collection('dailyCapital').doc(date).get()
        .then(docSnap => {
            if (docSnap.exists) state.currentDayCapital = docSnap.data();
            else state.currentDayCapital = null;
        })
        .catch(error => { console.error("Error cargando capital inicial:", error); state.currentDayCapital = null; })
        .finally(() => displayInitialCapitalSummary());
}

function capIcon(currency) {
    if (currency.includes('USD')) return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg>';
    if (currency === 'VES') return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-blue-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>';
    return '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-400"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" /></svg>';
}

export function displayInitialCapitalSummary() {
    const container = document.getElementById('initialCapitalSummary');
    if (!state.currentDayCapital || !state.currentDayCapital.balances || state.currentDayCapital.balances.length === 0) {
        container.innerHTML = `<div class="flex items-center gap-2 py-2 text-gray-500"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg><span class="text-sm">No hay capital registrado para hoy.</span></div>`;
        return;
    }
    const totalsByCurrency = {};
    const accountsMap = new Map(state.userConfig.managedAccounts.map(acc => [acc.id, acc]));
    state.currentDayCapital.balances.forEach(balance => {
        const account = accountsMap.get(balance.accountId);
        if (account) {
            const currency = account.currency;
            if (!totalsByCurrency[currency]) totalsByCurrency[currency] = 0;
            totalsByCurrency[currency] += balance.amount;
        }
    });
    if (Object.keys(totalsByCurrency).length === 0) {
        container.innerHTML = `<div class="flex items-center gap-2 py-2 text-gray-500"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0 opacity-50"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg><span class="text-sm">No hay capital registrado para hoy.</span></div>`;
        return;
    }
    const currencyOrder = ['USDT', 'USDC', 'USD', 'VES'];
    const sortedCurrencies = Object.keys(totalsByCurrency).sort((a, b) => {
        const indexA = currencyOrder.indexOf(a);
        const indexB = currencyOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });
    const items = sortedCurrencies.map(currency => {
        const total = totalsByCurrency[currency];
        const styles = {
            'USDT': 'rgba(38,166,154,0.15) text-teal-400',
            'USDC': 'rgba(34,197,94,0.15) text-green-400',
            'USD': 'rgba(34,197,94,0.15) text-green-400',
            'VES': 'rgba(59,130,246,0.15) text-blue-400'
        };
        const [bg, color] = (styles[currency] || 'rgba(156,163,175,0.15) text-gray-400').split(' ');
        return `<div class="flex items-center gap-2.5 p-2.5 rounded-xl" style="background: ${bg}"><div class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style="background: rgba(0,0,0,0.2)">${capIcon(currency)}</div><div><div class="text-xs font-medium ${color}">${currency}</div><div class="font-bold text-base ${color}">${total.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div></div></div>`;
    });
    container.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">${items.join('')}</div>`;
}

export function saveInitialCapital() {
    const saveBtn = document.getElementById('saveCapitalBtn');
    saveBtn.classList.add('loading');
    const inputs = document.querySelectorAll('#initialCapitalForm input[type="number"]');
    const balances = [];
    inputs.forEach(input => {
        const amount = parseFloat(input.value) || 0;
        if (amount > 0) balances.push({ accountId: input.dataset.accountId, amount: amount });
    });
    const dataToSave = { date: state.currentDate, balances };
    db.collection('users').doc(state.currentUserId).collection('dailyCapital').doc(state.currentDate).set(dataToSave)
        .then(() => {
            state.currentDayCapital = dataToSave;
            displayInitialCapitalSummary();
            document.getElementById('initialCapitalModal').classList.remove('show');
            showToast('Capital inicial guardado.', 'success');
        })
        .catch(e => { console.error("Error al guardar capital: ", e); showToast('Error al guardar el capital.', 'error'); })
        .finally(() => { saveBtn.classList.remove('loading'); });
}

export function addManagedAccount() {
    const nameInput = document.getElementById('newAccountName');
    const currencyInput = document.getElementById('newAccountCurrency');
    const name = nameInput.value.trim();
    const currency = currencyInput.value.trim().toUpperCase();
    if (!name || !currency) { showToast('El nombre y la moneda son obligatorios.', 'warning'); return; }
    const newAccount = { id: Date.now().toString(), name, currency };
    state.userConfig.managedAccounts.push(newAccount);
    saveConfigAndRefreshCapitalModal('Cuenta añadida exitosamente.');
    nameInput.value = '';
    currencyInput.value = '';
    nameInput.focus();
}

export function deleteManagedAccount(accountId) {
    openConfirmModal('¿Estás seguro de que deseas eliminar esta cuenta de forma permanente?', () => {
        const accountIndex = state.userConfig.managedAccounts.findIndex(acc => acc.id === accountId);
        if (accountIndex > -1) {
            state.userConfig.managedAccounts.splice(accountIndex, 1);
            saveConfigAndRefreshCapitalModal('Cuenta eliminada.');
        }
    });
}

function saveConfigAndRefreshCapitalModal(successMessage) {
    db.collection('users').doc(state.currentUserId).collection('settings').doc('userConfig').set(state.userConfig, {merge: true})
        .then(() => { showToast(successMessage, 'success'); window.openInitialCapitalModal(); })
        .catch(e => { showToast('Error al guardar la configuración.', 'error'); });
}
