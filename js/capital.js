import { auth, db } from './firebase-init.js';
import { currentUserId, userConfig, currentDate, currentDayCapital, setCurrentDayCapital } from './state.js';
import { showToast } from './ui.js';

export function openInitialCapitalModal() {
    document.getElementById('capitalModalDate').textContent = currentDate;
    const formContainer = document.getElementById('initialCapitalForm');
    formContainer.innerHTML = '<div class="loader mx-auto"></div>';

    const accounts = userConfig.managedAccounts || [];

    if (accounts.length === 0) {
        formContainer.innerHTML = '<p class="text-center text-sm text-gray-500 py-4">No has añadido ninguna cuenta. Usa el formulario de arriba para empezar.</p>';
        document.getElementById('initialCapitalModal').classList.add('show');
        return;
    }

    const todaysCapital = currentDayCapital && currentDayCapital.balances ? currentDayCapital.balances : [];

    let formHtml = '';
    accounts.forEach(account => {
        const existingEntry = todaysCapital.find(entry => entry.accountId === account.id);
        const currentValue = existingEntry ? existingEntry.amount : '';

        formHtml += `
            <div class="grid grid-cols-[1fr_120px_auto] items-center gap-3">
                <label for="capital-${account.id}" class="font-medium text-sm">
                    ${account.name} <span class="text-xs text-gray-400">(${account.currency})</span>
                </label>
                <input type="number" step="0.01" id="capital-${account.id}"
                       data-account-id="${account.id}"
                       value="${currentValue}"
                       placeholder="0.00" class="form-field-grid text-right">
                <button class="text-red-400 p-2 hover:bg-red-500/10 rounded-full" onclick="deleteManagedAccount('${account.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.033c-1.12 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                </button>
            </div>
        `;
    });

    formContainer.innerHTML = formHtml;
    document.getElementById('initialCapitalModal').classList.add('show');
}

export function closeInitialCapitalModal() {
    document.getElementById('initialCapitalModal').classList.remove('show');
}

export function addManagedAccount() {
    const nameInput = document.getElementById('newAccountName');
    const currencyInput = document.getElementById('newAccountCurrency');
    const name = nameInput.value.trim();
    const currency = currencyInput.value.trim().toUpperCase();

    if (!name || !currency) {
        showToast('El nombre y la moneda son obligatorios.', 'warning');
        return;
    }

    const newAccount = {
        id: Date.now().toString(),
        name: name,
        currency: currency
    };

    userConfig.managedAccounts.push(newAccount);
    saveConfigAndRefreshCapitalModal('Cuenta añadida exitosamente.');

    nameInput.value = '';
    currencyInput.value = '';
    nameInput.focus();
}

export function deleteManagedAccount(accountId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta cuenta de forma permanente?')) {
        return;
    }

    const accountIndex = userConfig.managedAccounts.findIndex(acc => acc.id === accountId);
    if (accountIndex > -1) {
        userConfig.managedAccounts.splice(accountIndex, 1);
        saveConfigAndRefreshCapitalModal('Cuenta eliminada.');
    }
}

function saveConfigAndRefreshCapitalModal(successMessage) {
    db.collection('users').doc(currentUserId).collection('settings').doc('userConfig').set(userConfig, {merge: true})
    .then(() => {
        showToast(successMessage, 'success');
        openInitialCapitalModal();
    })
    .catch(e => {
        showToast('Error al guardar la configuración.', 'error');
    });
}

export function saveInitialCapital() {
    const saveBtn = document.getElementById('saveCapitalBtn');
    saveBtn.classList.add('loading');

    const inputs = document.querySelectorAll('#initialCapitalForm input[type="number"]');
    const balances = [];

    inputs.forEach(input => {
        const amount = parseFloat(input.value) || 0;
        if (amount > 0) {
            balances.push({
                accountId: input.dataset.accountId,
                amount: amount
            });
        }
    });

    const dataToSave = {
        date: currentDate,
        balances: balances
    };

    db.collection('users').doc(currentUserId).collection('dailyCapital').doc(currentDate).set(dataToSave)
        .then(() => {
            setCurrentDayCapital(dataToSave);
            displayInitialCapitalSummary();
            closeInitialCapitalModal();
            showToast('Capital inicial guardado.', 'success');
        })
        .catch(e => {
            console.error("Error al guardar capital: ", e);
            showToast('Error al guardar el capital.', 'error');
        })
        .finally(() => {
            saveBtn.classList.remove('loading');
        });
}

export async function loadInitialCapital(date) {
    if (!currentUserId) return;
    try {
        const docRef = db.collection('users').doc(currentUserId).collection('dailyCapital').doc(date);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
            setCurrentDayCapital(docSnap.data());
        } else {
            setCurrentDayCapital(null);
        }
    } catch (error) {
        console.error("Error cargando capital inicial:", error);
        setCurrentDayCapital(null);
    }
    displayInitialCapitalSummary();
}

function displayInitialCapitalSummary() {
    const container = document.getElementById('initialCapitalSummary');

    if (!currentDayCapital || !currentDayCapital.balances || currentDayCapital.balances.length === 0) {
        container.innerHTML = `<p class="text-gray-500">No hay capital registrado para hoy.</p>`;
        return;
    }

    const totalsByCurrency = {};
    const accountsMap = new Map(userConfig.managedAccounts.map(acc => [acc.id, acc]));

    currentDayCapital.balances.forEach(balance => {
        const account = accountsMap.get(balance.accountId);
        if (account) {
            const currency = account.currency;
            if (!totalsByCurrency[currency]) {
                totalsByCurrency[currency] = 0;
            }
            totalsByCurrency[currency] += balance.amount;
        }
    });

    if (Object.keys(totalsByCurrency).length === 0) {
        container.innerHTML = `<p class="text-gray-500">No hay capital registrado para hoy.</p>`;
        return;
    }

    let summaryHtml = '<div class="grid grid-cols-3 gap-x-4 gap-y-2">';
    const currencyOrder = ['USDT', 'USDC', 'USD', 'VES'];
    const sortedCurrencies = Object.keys(totalsByCurrency).sort((a, b) => {
        const indexA = currencyOrder.indexOf(a);
        const indexB = currencyOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    sortedCurrencies.forEach(currency => {
        const total = totalsByCurrency[currency];
        let typeColor = 'text-gray-200';
        if (currency.includes('USD')) typeColor = 'text-green-400';
        if (currency === 'VES') typeColor = 'text-blue-400';

        summaryHtml += `
            <div class="text-center">
                <span class="text-xs text-gray-400">${currency}</span>
                <p class="font-bold text-lg ${typeColor}">${total.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
            </div>
        `;
    });

    summaryHtml += '</div>';
    container.innerHTML = summaryHtml;
}
