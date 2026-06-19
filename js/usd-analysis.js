import { state } from './state.js';

const chartColors = {
    text: '#C9D1D9',
    muted: '#8B949E',
    grid: 'rgba(139, 148, 158, 0.16)',
    tooltipBg: 'rgba(13, 17, 23, 0.96)',
    tooltipBorder: 'rgba(88, 166, 255, 0.35)'
};

function isMobileChart() {
    return window.matchMedia('(max-width: 640px)').matches;
}

function compactTick(value) {
    const abs = Math.abs(Number(value) || 0);
    if (abs >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value;
}

function basePlugins(showLegend = false, legendPosition = 'bottom') {
    const mobile = isMobileChart();
    return {
        legend: {
            display: showLegend,
            position: legendPosition,
            labels: {
                color: chartColors.text,
                boxWidth: 10,
                boxHeight: 10,
                padding: mobile ? 10 : 14,
                font: { size: mobile ? 11 : 12 },
                usePointStyle: true
            }
        },
        tooltip: {
            backgroundColor: chartColors.tooltipBg,
            borderColor: chartColors.tooltipBorder,
            borderWidth: 1,
            titleColor: chartColors.text,
            bodyColor: chartColors.text,
            padding: 12
        }
    };
}

function drawEmptyChartMessage(ctx, message) {
    const canvas = ctx.canvas;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Inter';
    ctx.fillStyle = chartColors.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    ctx.restore();
}

export function populateUsdMonthSelector() {
    const selector = document.getElementById('usdMonthSelector');
    if (!state.wallyOperations || state.wallyOperations.length === 0) return;
    selector.innerHTML = '';
    const uniqueMonths = [...new Set(state.wallyOperations.map(op => op.fecha.substring(0, 7)))].sort().reverse();
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

export function switchUsdAnalysisTab(tabName) {
    state.currentUsdAnalysisTab = tabName;
    document.getElementById('usd-analysis-tab-weekly').classList.toggle('active', tabName === 'weekly');
    document.getElementById('usd-analysis-tab-monthly').classList.toggle('active', tabName === 'monthly');
    document.getElementById('usd-month-selector-container').classList.toggle('hidden', tabName !== 'monthly');
    renderUsdAnalysis();
}

export function renderUsdAnalysis() {
    const contentContainer = document.getElementById('usdAnalysisContent');
    contentContainer.innerHTML = `<div class="text-center py-8"><div class="loader mx-auto"></div><p class="mt-2 text-sm text-gray-400">Calculando análisis...</p></div>`;
    setTimeout(() => {
        let opsToAnalyze = [];
        let periodTitle = "";
        let groupBy = 'day';
        if (state.currentUsdAnalysisTab === 'weekly') {
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
            opsToAnalyze = state.wallyOperations.filter(op => op.fecha >= mondayStr && op.fecha <= todayStr);
        } else {
            const selectedMonth = document.getElementById('usdMonthSelector').value;
            const selEl = document.getElementById('usdMonthSelector');
            periodTitle = selEl.options[selEl.selectedIndex]?.text || "Mes Seleccionado";
            if (selectedMonth) opsToAnalyze = state.wallyOperations.filter(op => op.fecha.startsWith(selectedMonth));
            groupBy = 'week';
        }
        if (opsToAnalyze.length === 0) {
            contentContainer.innerHTML = `<p class="text-center text-gray-400 py-8">No hay operaciones en '${periodTitle}' para analizar.</p>`;
            return;
        }
        const analysisResults = analyzeUsdData(opsToAnalyze, groupBy);
        contentContainer.innerHTML = generateUsdAnalysisHTML(analysisResults, state.currentUsdAnalysisTab);
        if (state.currentUsdAnalysisTab === 'weekly') {
            renderUsdChart(analysisResults.groupedData, 'usdWeeklyChart', 'usdWeeklyChartInstance');
            renderUsdP2pPlatformChart(analysisResults.gainsByP2pPlatform, 'usdWeeklyP2pPlatformChart', 'usdWeeklyP2pPlatformChartInstance');
            renderUsdPaymentMethodChart(analysisResults.gainsByPaymentMethod, 'usdWeeklyPaymentMethodChart', 'usdWeeklyPaymentMethodChartInstance');
        } else {
            renderUsdChart(analysisResults.groupedData, 'usdMonthlyChart', 'usdMonthlyChartInstance');
            renderUsdP2pPlatformChart(analysisResults.gainsByP2pPlatform, 'usdMonthlyP2pPlatformChart', 'usdMonthlyP2pPlatformChartInstance');
            renderUsdPaymentMethodChart(analysisResults.gainsByPaymentMethod, 'usdMonthlyPaymentMethodChart', 'usdMonthlyPaymentMethodChartInstance');
        }
    }, 50);
}

function analyzeUsdData(ops, groupBy = 'day') {
    const groupedData = {}, gainsByPaymentMethod = {}, gainsByP2pPlatform = {};
    let totalProfitUsd = 0, totalProfitUsdc = 0, totalCryptoVolume = 0, totalFiatVolume = 0;
    let compraOps = 0, ventaOps = 0;
    const p2pPlatformNames = state.userConfig.p2pPlatforms.filter(p => p.type === 'CRIPTO' || p.type === 'VES').map(p => p.name);
    ops.forEach(op => {
        const opDate = new Date(op.fecha + 'T12:00:00');
        let key = groupBy === 'week' ? Math.ceil(opDate.getDate() / 7) : op.fecha;
        if (!groupedData[key]) groupedData[key] = { profitUsd: 0, profitUsdc: 0 };
        groupedData[key].profitUsd += op.gananciaUsd || 0;
        groupedData[key].profitUsdc += op.gananciaUsdc || 0;
        const paymentMethod = op.metodoPago || 'No especificado';
        if (!gainsByPaymentMethod[paymentMethod]) gainsByPaymentMethod[paymentMethod] = { profitUsd: 0, profitUsdc: 0 };
        gainsByPaymentMethod[paymentMethod].profitUsd += op.gananciaUsd || 0;
        gainsByPaymentMethod[paymentMethod].profitUsdc += op.gananciaUsdc || 0;
        if (op.platform && p2pPlatformNames.includes(op.platform)) {
            if (!gainsByP2pPlatform[op.platform]) gainsByP2pPlatform[op.platform] = { profitUsd: 0, profitUsdc: 0 };
            gainsByP2pPlatform[op.platform].profitUsd += op.gananciaUsd || 0;
            gainsByP2pPlatform[op.platform].profitUsdc += op.gananciaUsdc || 0;
        }
        totalProfitUsd += op.gananciaUsd || 0;
        totalProfitUsdc += op.gananciaUsdc || 0;
        if (op.operacion === 'Compra') { compraOps++; totalCryptoVolume += op.reciboUsdc || 0; totalFiatVolume += op.envioUsd || 0; }
        else { ventaOps++; totalCryptoVolume += op.envioUsdc || 0; totalFiatVolume += op.reciboUsd || 0; }
    });
    const topUser = Object.entries(ops.reduce((acc, op) => { acc[op.usuario] = (acc[op.usuario] || 0) + (op.reciboUsdc || op.envioUsdc || 0); return acc; }, {})).sort((a,b) => b[1]-a[1])[0];
    return {
        totalProfitUsd, totalProfitUsdc, totalCryptoVolume, totalFiatVolume,
        totalOps: ops.length, compraOps, ventaOps,
        roi: totalFiatVolume > 0 ? ((totalProfitUsd + totalProfitUsdc) / totalFiatVolume) * 100 : 0,
        groupedData, gainsByPaymentMethod, gainsByP2pPlatform,
        topUser: topUser ? { name: topUser[0], volume: topUser[1] } : { name: 'N/A', volume: 0 }
    };
}

function generateUsdAnalysisHTML(results, period) {
    const chartId = period === 'weekly' ? 'usdWeeklyChart' : 'usdMonthlyChart';
    const paymentMethodChartId = period === 'weekly' ? 'usdWeeklyPaymentMethodChart' : 'usdMonthlyPaymentMethodChart';
    const p2pPlatformChartId = period === 'weekly' ? 'usdWeeklyP2pPlatformChart' : 'usdMonthlyP2pPlatformChart';
    return `
        <div class="space-y-6">
            <div class="chart-panel chart-main chart-scroll"><div class="chart-scroll-inner"><div class="chart-panel-title"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg><p>Ganancias por ${period === 'weekly' ? 'Día' : 'Semana'}</p></div><canvas id="${chartId}"></canvas></div></div>
            <hr class="border-gray-700 !my-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10 items-center">
                <div class="chart-panel chart-compact"><div class="chart-panel-title"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-purple-400"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M8.25 8.625l1.5-3h4.5l1.5 3M9 12h6" /></svg><p>Ganancias por Plataforma P2P</p></div><canvas id="${p2pPlatformChartId}"></canvas></div>
                <div class="chart-panel chart-compact chart-scroll"><div class="chart-scroll-inner"><div class="chart-panel-title"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-yellow-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg><p>Ganancias por Método de Pago</p></div><canvas id="${paymentMethodChartId}"></canvas></div></div>
            </div>
        </div>
        <hr class="border-gray-700 !my-8">
        <div class="card p-4 bg-background space-y-3">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-sm">
                <div class="info-card !p-3 relative overflow-hidden"><div class="flex items-center gap-2 mb-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg><div class="info-card-title !text-xs !mb-0">GANANCIA NETA USD</div></div><div class="info-card-value !text-base text-green-400">${results.totalProfitUsd.toFixed(2)} USD</div></div>
                <div class="info-card !p-3 relative overflow-hidden"><div class="flex items-center gap-2 mb-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-orange-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg><div class="info-card-title !text-xs !mb-0">GANANCIA NETA CRIPTO</div></div><div class="info-card-value !text-base text-orange-400">${results.totalProfitUsdc.toFixed(4)} USDC</div></div>
                <div class="info-card !p-3 relative overflow-hidden"><div class="flex items-center gap-2 mb-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-blue-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg><div class="info-card-title !text-xs !mb-0">VOLUMEN FIAT</div></div><div class="info-card-value !text-lg">${results.totalFiatVolume.toFixed(2)} USD</div></div>
                <div class="info-card !p-3 relative overflow-hidden"><div class="flex items-center gap-2 mb-2 justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-cyan-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg><div class="info-card-title !text-xs !mb-0">ROI GENERAL</div></div><div class="info-card-value !text-lg text-blue-400">${results.roi.toFixed(2)}%</div></div>
            </div>
            <hr class="border-gray-700 !my-4">
            <div class="space-y-3 text-sm">
                <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-indigo-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg><span class="text-gray-400">Total Operaciones:</span><strong class="font-mono ml-auto">${results.totalOps} (C: ${results.compraOps} / V: ${results.ventaOps})</strong></div>
                <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-purple-400"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg><span class="text-gray-400">Usuario top (Vol.):</span><strong class="font-mono ml-auto">${results.topUser.name} (${results.topUser.volume.toFixed(2)} USDC)</strong></div>
            </div>
        </div>`;
}

function renderUsdChart(data, canvasId, instanceVarName) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (state[instanceVarName]) state[instanceVarName].destroy();
    const labelsRaw = Object.keys(data).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
    const labels = labelsRaw.map(key => !isNaN(key) ? `Semana ${key}` : new Date(key + 'T12:00:00').toLocaleDateString('es-VE', {day:'2-digit', month:'short'}));
    const profitUsd = labelsRaw.map(key => data[key].profitUsd);
    const profitUsdc = labelsRaw.map(key => data[key].profitUsdc);
    ctx.canvas.closest('.chart-scroll')?.classList.toggle('is-scrollable', labels.length > 7);
    const mobile = isMobileChart();
    state[instanceVarName] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [
            { label: 'Ganancia USD', data: profitUsd, backgroundColor: 'rgba(192, 132, 252, 0.75)', borderColor: 'rgba(192, 132, 252, 1)', borderWidth: 1, borderRadius: 8, borderSkipped: false, maxBarThickness: 42, yAxisID: 'y' },
            { label: 'Ganancia USDC', data: profitUsdc, backgroundColor: 'rgba(251, 146, 60, 0.75)', borderColor: 'rgba(251, 146, 60, 1)', borderWidth: 1, borderRadius: 8, borderSkipped: false, maxBarThickness: 42, yAxisID: 'y1' }
        ]},
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 120,
            layout: { padding: { top: 8, right: mobile ? 2 : 10, bottom: 0, left: 0 } },
            plugins: basePlugins(!mobile),
            scales: {
                x: { grid: { display: false }, ticks: { color: chartColors.muted, maxRotation: 0, autoSkip: true, font: { size: mobile ? 11 : 12 } } },
                y: { type: 'linear', display: true, position: 'left', title: { display: !mobile, text: 'USD', color: chartColors.muted }, border: { color: chartColors.grid }, grid: { color: chartColors.grid }, ticks: { color: chartColors.muted, callback: compactTick, font: { size: mobile ? 10 : 12 } } },
                y1: { type: 'linear', display: !mobile, position: 'right', title: { display: true, text: 'USDC', color: chartColors.muted }, border: { color: chartColors.grid }, grid: { drawOnChartArea: false }, ticks: { color: chartColors.muted, callback: compactTick } }
            }
        }
    });
}

function renderUsdP2pPlatformChart(data, canvasId, instanceVarName) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (state[instanceVarName]) state[instanceVarName].destroy();
    const labels = Object.keys(data).filter(key => key !== 'No especificado' && (data[key].profitUsd + data[key].profitUsdc) > 0);
    const chartData = labels.map(p => (data[p].profitUsd || 0) + (data[p].profitUsdc || 0));
    if (labels.length === 0) { drawEmptyChartMessage(ctx, 'Sin datos de plataformas P2P'); return; }
    const mobile = isMobileChart();
    state[instanceVarName] = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: chartData, backgroundColor: ['rgba(59, 130, 246, 0.82)', 'rgba(239, 68, 68, 0.82)', 'rgba(245, 158, 11, 0.82)', 'rgba(34, 197, 94, 0.82)', 'rgba(34, 211, 238, 0.82)', 'rgba(192, 132, 252, 0.82)'], borderColor: '#161B22', borderWidth: 3, hoverOffset: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: mobile ? '62%' : '66%', plugins: basePlugins(true) }
    });
}

function renderUsdPaymentMethodChart(data, canvasId, instanceVarName) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;
    if (state[instanceVarName]) state[instanceVarName].destroy();
    const labels = Object.keys(data).filter(key => key !== 'No especificado' && (data[key].profitUsd + data[key].profitUsdc) > 0);
    const chartData = labels.map(p => (data[p].profitUsd || 0) + (data[p].profitUsdc || 0));
    if (labels.length === 0) { drawEmptyChartMessage(ctx, 'Sin datos de metodos de pago'); return; }
    ctx.canvas.closest('.chart-scroll')?.classList.toggle('is-scrollable', labels.length > 5);
    const mobile = isMobileChart();
    state[instanceVarName] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Ganancia Equivalente (USD)', data: chartData, backgroundColor: 'rgba(34, 211, 238, 0.72)', borderColor: 'rgba(34, 211, 238, 1)', borderWidth: 1, borderRadius: 8, borderSkipped: false, maxBarThickness: 34 }] },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 120,
            layout: { padding: { right: 8 } },
            plugins: basePlugins(false),
            scales: {
                y: { grid: { display: false }, ticks: { color: chartColors.text, font: { size: mobile ? 10 : 12 }, callback: function(value) { const label = this.getLabelForValue(value); return mobile && label.length > 14 ? `${label.slice(0, 14)}...` : label; } } },
                x: { border: { color: chartColors.grid }, grid: { color: chartColors.grid }, ticks: { color: chartColors.muted, callback: compactTick, font: { size: mobile ? 10 : 12 } } }
            }
        }
    });
}
