import { wallyOperations, userConfig, usdWeeklyChartInstance, usdWeeklyPaymentMethodChartInstance, usdWeeklyP2pPlatformChartInstance, usdMonthlyChartInstance, usdMonthlyPaymentMethodChartInstance, usdMonthlyP2pPlatformChartInstance, currentUsdAnalysisTab, setUsdWeeklyChartInstance, setUsdWeeklyPaymentMethodChartInstance, setUsdWeeklyP2pPlatformChartInstance, setUsdMonthlyChartInstance, setUsdMonthlyPaymentMethodChartInstance, setUsdMonthlyP2pPlatformChartInstance, setCurrentUsdAnalysisTab } from './state.js';

export function openUsdAnalysisModal() {
    document.getElementById('usdAnalysisModal').classList.add('show');
    populateUsdMonthSelector();
    switchUsdAnalysisTab('weekly');
}

export function closeUsdAnalysisModal() {
    document.getElementById('usdAnalysisModal').classList.remove('show');
    if (usdWeeklyChartInstance) usdWeeklyChartInstance.destroy();
    if (usdWeeklyPaymentMethodChartInstance) usdWeeklyPaymentMethodChartInstance.destroy();
    if (usdWeeklyP2pPlatformChartInstance) usdWeeklyP2pPlatformChartInstance.destroy();
    if (usdMonthlyChartInstance) usdMonthlyChartInstance.destroy();
    if (usdMonthlyPaymentMethodChartInstance) usdMonthlyPaymentMethodChartInstance.destroy();
    if (usdMonthlyP2pPlatformChartInstance) usdMonthlyP2pPlatformChartInstance.destroy();
}

export function switchUsdAnalysisTab(tabName) {
    setCurrentUsdAnalysisTab(tabName);
    document.getElementById('usd-analysis-tab-weekly').classList.toggle('active', tabName === 'weekly');
    document.getElementById('usd-analysis-tab-monthly').classList.toggle('active', tabName === 'monthly');
    document.getElementById('usd-month-selector-container').classList.toggle('hidden', tabName !== 'monthly');
    renderUsdAnalysis();
}

function populateUsdMonthSelector() {
    const selector = document.getElementById('usdMonthSelector');
    if (!wallyOperations || wallyOperations.length === 0) return;
    selector.innerHTML = '';
    const uniqueMonths = [...new Set(wallyOperations.map(op => op.fecha.substring(0, 7)))].sort().reverse();

    uniqueMonths.forEach(monthValue => {
        const [year, month] = monthValue.split('-');
        const date = new Date(year, month - 1, 1);
        const monthName = date.toLocaleDateString('es-VE', { month: 'long', year: 'numeric' });
        const option = document.createElement('option');
        option.value = monthValue;
        option.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        selector.appendChild(option);
    });
}

export function renderUsdAnalysis() {
    const contentContainer = document.getElementById('usdAnalysisContent');
    contentContainer.innerHTML = `<div class="text-center py-8"><div class="loader mx-auto"></div><p class="mt-2 text-sm text-gray-400">Calculando análisis...</p></div>`;

    setTimeout(() => {
        let opsToAnalyze = [];
        let periodTitle = "";
        let groupBy = 'day';

        if (currentUsdAnalysisTab === 'weekly') {
            periodTitle = "Semana Actual";
            const today = new Date();
            const dayOfWeek = today.getDay();
            const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const monday = new Date();
            monday.setDate(today.getDate() - diff);
            monday.setHours(0, 0, 0, 0);
            const formatDate = (d) => d.toISOString().split('T')[0];
            const mondayStr = formatDate(monday);
            const todayStr = formatDate(today);
            opsToAnalyze = wallyOperations.filter(op => op.fecha >= mondayStr && op.fecha <= todayStr);
        } else {
            const selectedMonth = document.getElementById('usdMonthSelector').value;
            periodTitle = document.getElementById('usdMonthSelector').options[document.getElementById('usdMonthSelector').selectedIndex]?.text || "Mes Seleccionado";
            if (selectedMonth) {
                opsToAnalyze = wallyOperations.filter(op => op.fecha.startsWith(selectedMonth));
            }
            groupBy = 'week';
        }

        if (opsToAnalyze.length === 0) {
            contentContainer.innerHTML = `<p class="text-center text-gray-400 py-8">No hay operaciones en '${periodTitle}' para analizar.</p>`;
            return;
        }

        const analysisResults = analyzeUsdData(opsToAnalyze, groupBy);
        contentContainer.innerHTML = generateUsdAnalysisHTML(analysisResults, currentUsdAnalysisTab);

        if (currentUsdAnalysisTab === 'weekly') {
            renderUsdChart(analysisResults.groupedData, 'usdWeeklyChart', setUsdWeeklyChartInstance);
            renderUsdP2pPlatformChart(analysisResults.gainsByP2pPlatform, 'usdWeeklyP2pPlatformChart', setUsdWeeklyP2pPlatformChartInstance);
            renderUsdPaymentMethodChart(analysisResults.gainsByPaymentMethod, 'usdWeeklyPaymentMethodChart', setUsdWeeklyPaymentMethodChartInstance);
        } else {
            renderUsdChart(analysisResults.groupedData, 'usdMonthlyChart', setUsdMonthlyChartInstance);
            renderUsdP2pPlatformChart(analysisResults.gainsByP2pPlatform, 'usdMonthlyP2pPlatformChart', setUsdMonthlyP2pPlatformChartInstance);
            renderUsdPaymentMethodChart(analysisResults.gainsByPaymentMethod, 'usdMonthlyPaymentMethodChart', setUsdMonthlyPaymentMethodChartInstance);
        }
    }, 50);
}

function analyzeUsdData(ops, groupBy = 'day') {
    const groupedData = {};
    const gainsByPaymentMethod = {};
    const gainsByP2pPlatform = {};
    let totalProfitUsd = 0, totalProfitUsdc = 0, totalCryptoVolume = 0, totalFiatVolume = 0;
    let compraOps = 0, ventaOps = 0;

    const p2pPlatformNames = userConfig.p2pPlatforms
        .filter(p => p.type === 'CRIPTO' || p.type === 'VES')
        .map(p => p.name);

    ops.forEach(op => {
        const opDate = new Date(op.fecha + 'T12:00:00');
        let key;
        if (groupBy === 'week') {
            key = Math.ceil(opDate.getDate() / 7);
        } else {
            key = op.fecha;
        }

        if (!groupedData[key]) {
            groupedData[key] = { profitUsd: 0, profitUsdc: 0 };
        }
        groupedData[key].profitUsd += op.gananciaUsd || 0;
        groupedData[key].profitUsdc += op.gananciaUsdc || 0;

        const paymentMethod = op.metodoPago || 'No especificado';
        if (!gainsByPaymentMethod[paymentMethod]) {
            gainsByPaymentMethod[paymentMethod] = { profitUsd: 0, profitUsdc: 0 };
        }
        gainsByPaymentMethod[paymentMethod].profitUsd += op.gananciaUsd || 0;
        gainsByPaymentMethod[paymentMethod].profitUsdc += op.gananciaUsdc || 0;

        if (op.platform && p2pPlatformNames.includes(op.platform)) {
            const p2pPlatform = op.platform;
            if (!gainsByP2pPlatform[p2pPlatform]) {
                gainsByP2pPlatform[p2pPlatform] = { profitUsd: 0, profitUsdc: 0 };
            }
            gainsByP2pPlatform[p2pPlatform].profitUsd += op.gananciaUsd || 0;
            gainsByP2pPlatform[p2pPlatform].profitUsdc += op.gananciaUsdc || 0;
        }

        totalProfitUsd += op.gananciaUsd || 0;
        totalProfitUsdc += op.gananciaUsdc || 0;

        if(op.operacion === 'Compra') {
            compraOps++;
            totalCryptoVolume += op.reciboUsdc || 0;
            totalFiatVolume += op.envioUsd || 0;
        } else {
            ventaOps++;
            totalCryptoVolume += op.envioUsdc || 0;
            totalFiatVolume += op.reciboUsd || 0;
        }
    });

    const topUser = Object.entries(ops.reduce((acc, op) => {
        acc[op.usuario] = (acc[op.usuario] || 0) + (op.reciboUsdc || op.envioUsdc || 0);
        return acc;
    }, {})).sort((a,b) => b[1]-a[1])[0];

    return {
        totalProfitUsd, totalProfitUsdc,
        totalCryptoVolume, totalFiatVolume,
        totalOps: ops.length, compraOps, ventaOps,
        roi: totalFiatVolume > 0 ? ((totalProfitUsd + totalProfitUsdc) / totalFiatVolume) * 100 : 0,
        groupedData,
        gainsByPaymentMethod,
        gainsByP2pPlatform,
        topUser: topUser ? { name: topUser[0], volume: topUser[1] } : { name: 'N/A', volume: 0 }
    };
}

function generateUsdAnalysisHTML(results, period) {
    const chartId = period === 'weekly' ? 'usdWeeklyChart' : 'usdMonthlyChart';
    const paymentMethodChartId = period === 'weekly' ? 'usdWeeklyPaymentMethodChart' : 'usdMonthlyPaymentMethodChart';
    const p2pPlatformChartId = period === 'weekly' ? 'usdWeeklyP2pPlatformChart' : 'usdMonthlyP2pPlatformChart';

    return `
        <div class="space-y-6">
            <div class="h-80 w-full">
                <p class="text-center font-semibold text-sm text-gray-400 mb-2">Ganancias por ${period === 'weekly' ? 'Día' : 'Semana'}</p>
                <canvas id="${chartId}"></canvas>
            </div>
            <hr class="border-gray-700 !my-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10 items-center">
                <div class="h-64">
                    <p class="text-center font-semibold text-sm text-gray-400 mb-2">Ganancias por Plataforma P2P</p>
                    <canvas id="${p2pPlatformChartId}"></canvas>
                </div>
                <div class="h-72">
                     <p class="text-center font-semibold text-sm text-gray-400 mb-2">Ganancias por Método de Pago</p>
                    <canvas id="${paymentMethodChartId}"></canvas>
                </div>
            </div>
        </div>
        <hr class="border-gray-700 !my-8">
        <div class="card p-4 bg-background space-y-3">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
                <div class="info-card !p-2"><div class="info-card-title !text-xs">GANANCIA NETA USD</div><div class="info-card-value !text-base text-green-400">${results.totalProfitUsd.toFixed(2)} USD</div></div>
                <div class="info-card !p-2"><div class="info-card-title !text-xs">GANANCIA NETA CRIPTO</div><div class="info-card-value !text-base text-orange-400">${results.totalProfitUsdc.toFixed(4)} USDC</div></div>
                <div class="info-card !p-2"><div class="info-card-title !text-xs">VOLUMEN FIAT</div><div class="info-card-value !text-lg">${results.totalFiatVolume.toFixed(2)} USD</div></div>
                <div class="info-card !p-2"><div class="info-card-title !text-xs">ROI GENERAL</div><div class="info-card-value !text-lg text-blue-400">${results.roi.toFixed(2)}%</div></div>
            </div>
            <hr class="border-gray-700 !my-4">
            <div class="space-y-2 text-sm">
                <div class="flex justify-between items-center"><span><strong>Total Operaciones:</strong></span><span class="font-mono">${results.totalOps} (C: ${results.compraOps} / V: ${results.ventaOps})</span></div>
                <div class="flex justify-between items-center"><span><strong>Usuario más valioso (Vol.):</strong></span><span class="font-mono">${results.topUser.name} (${results.topUser.volume.toFixed(2)} USDC)</span></div>
            </div>
        </div>`;
}

function renderUsdChart(data, canvasId, setter) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    setter(null);

    const labelsRaw = Object.keys(data).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));

    const labels = labelsRaw.map(key => {
        if (!isNaN(key)) {
            return `Semana ${key}`;
        }
        return new Date(key + 'T12:00:00').toLocaleDateString('es-VE', {day:'2-digit', month:'short'});
    });

    const profitUsd = labelsRaw.map(key => data[key].profitUsd);
    const profitUsdc = labelsRaw.map(key => data[key].profitUsdc);

    setter(new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Ganancia USD', data: profitUsd, backgroundColor: 'rgba(192, 132, 252, 0.7)', yAxisID: 'y' },
                { label: 'Ganancia USDC', data: profitUsdc, backgroundColor: 'rgba(251, 146, 60, 0.7)', yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'USD' } },
                y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'USDC' }, grid: { drawOnChartArea: false } }
            }
        }
    }));
}

function renderUsdP2pPlatformChart(data, canvasId, setter) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    setter(null);

    const labels = Object.keys(data).filter(key => key !== 'No especificado' && (data[key].profitUsd + data[key].profitUsdc) > 0);
    const chartData = labels.map(p => (data[p].profitUsd || 0) + (data[p].profitUsdc || 0));

    if (labels.length === 0) {
        ctx.font = "14px Inter";
        ctx.fillStyle = "grey";
        ctx.textAlign = "center";
        ctx.fillText("Sin datos de plataformas P2P", ctx.canvas.width/2, ctx.canvas.height/2);
        return;
    }

    setter(new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: chartData,
                backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(239, 68, 68, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(34, 197, 94, 0.8)'],
                borderColor: 'var(--surface)', borderWidth: 3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom', labels: { color: '#C9D1D9', boxWidth: 12 } } } }
    }));
}

function renderUsdPaymentMethodChart(data, canvasId, setter) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    setter(null);

    const labels = Object.keys(data).filter(key => key !== 'No especificado' && (data[key].profitUsd + data[key].profitUsdc) > 0);
    const chartData = labels.map(p => (data[p].profitUsd || 0) + (data[p].profitUsdc || 0));

    if (labels.length === 0) {
        ctx.font = "14px Inter";
        ctx.fillStyle = "grey";
        ctx.textAlign = "center";
        ctx.fillText("Sin datos de métodos de pago", ctx.canvas.width/2, ctx.canvas.height/2);
        return;
    }

    setter(new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Ganancia Equivalente (USD)',
                data: chartData,
                backgroundColor: 'rgba(34, 211, 238, 0.7)',
                borderColor: 'rgba(34, 211, 238, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { color: '#C9D1D9' } },
                x: { ticks: { color: '#C9D1D9' } }
            }
        }
    }));
}
