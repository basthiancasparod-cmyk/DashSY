import { state } from './state.js';
import { calculateFIFOGainsForOps } from './operations.js';

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

function currencyTick(value) {
    const abs = Math.abs(Number(value) || 0);
    if (abs >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value;
}

export function drawEmptyChartMessage(canvasId, message) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = canvas.offsetHeight || 240;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = chartColors.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2);
    ctx.restore();
}

function getProfitChartOptions(yTitle, profitUsdcData) {
    const mobile = isMobileChart();
    return {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 120,
        layout: { padding: { top: mobile ? 8 : 20, right: mobile ? 4 : 12, bottom: 0, left: 0 } },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: chartColors.muted, maxRotation: 0, autoSkip: true, font: { size: mobile ? 11 : 12 } }
            },
            y: {
                beginAtZero: true,
                title: { display: !mobile, text: yTitle, color: chartColors.muted },
                border: { color: chartColors.grid },
                grid: { color: chartColors.grid },
                ticks: { color: chartColors.muted, callback: currencyTick, font: { size: mobile ? 10 : 12 } }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: chartColors.tooltipBg,
                borderColor: chartColors.tooltipBorder,
                borderWidth: 1,
                titleColor: chartColors.text,
                bodyColor: chartColors.text,
                padding: 12,
                displayColors: false,
                callbacks: {
                    label: function(context) {
                        const i = context.dataIndex;
                        const usdcVal = profitUsdcData && profitUsdcData[i] !== undefined ? profitUsdcData[i] : null;
                        const vesVal = context.parsed ? context.parsed.y : context.raw;
                        let lines = [`${context.dataset.label}: ${typeof vesVal === 'number' ? vesVal.toFixed(2) : vesVal} VES`];
                        if (usdcVal !== null) lines.push(`USDC: ${usdcVal.toFixed(4)} USDC`);
                        return lines;
                    }
                }
            },
            datalabels: { display: !mobile }
        }
    };
}

export function getWeeklyOperations() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(today.getDate() - diff);
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const startStr = formatDate(monday);
    const endStr = formatDate(today);
    return state.operations.filter(op => op.fecha >= startStr && op.fecha <= endStr);
}

export function analyzeWeeklyData(ops) {
    const dailyData = {};
    const paymentMethodCount = {};
    const userVolume = {};
    const hourlyOps = Array(24).fill(0).map(() => ({ count: 0, buyRates: [], sellRates: [] }));
    const groupedByDay = ops.reduce((acc, op) => { const date = op.fecha; if (!acc[date]) acc[date] = []; acc[date].push(op); return acc; }, {});
    const sortedDates = Object.keys(groupedByDay).sort();
    let cumulativeOps = [];
    let lastDayCumulativeProfitVes = 0;
    let lastDayCumulativeProfitUsdc = 0;
    sortedDates.forEach(date => {
        const opsOfTheDay = groupedByDay[date];
        cumulativeOps.push(...opsOfTheDay);
        const [cumulativeProfitVes, cumulativeProfitUsdc] = calculateFIFOGainsForOps(cumulativeOps);
        const dailyProfitVes = cumulativeProfitVes - lastDayCumulativeProfitVes;
        const dailyProfitUsdc = cumulativeProfitUsdc - lastDayCumulativeProfitUsdc;
        const dailyVolume = opsOfTheDay.reduce((sum, op) => sum + (op.montoUsdc || 0), 0);
        dailyData[date] = { volume: dailyVolume, profitVes: dailyProfitVes, profitUsdc: dailyProfitUsdc, opCount: opsOfTheDay.length };
        lastDayCumulativeProfitVes = cumulativeProfitVes;
        lastDayCumulativeProfitUsdc = cumulativeProfitUsdc;
    });
    let totalVolume = 0, totalProfitVes = 0, totalProfitUsdc = 0;
    ops.forEach(op => {
        totalVolume += op.montoUsdc || 0;
        paymentMethodCount[op.metodoPago] = (paymentMethodCount[op.metodoPago] || 0) + 1;
        userVolume[op.usuario] = (userVolume[op.usuario] || 0) + op.montoUsdc;
        const hour = new Date(op.timestamp).getHours();
        hourlyOps[hour].count++;
        if (op.operacion === 'Compra') hourlyOps[hour].buyRates.push(op.tasa);
        if (op.operacion === 'Venta') hourlyOps[hour].sellRates.push(op.tasa);
    });
    totalProfitVes = lastDayCumulativeProfitVes;
    totalProfitUsdc = lastDayCumulativeProfitUsdc;
    const dayWithMostVolume = Object.entries(dailyData).sort((a, b) => b[1].volume - a[1].volume)[0];
    const dayWithMostProfit = Object.entries(dailyData).sort((a, b) => b[1].profitVes - a[1].profitVes)[0];
    const mostUsedPaymentMethod = Object.entries(paymentMethodCount).sort((a, b) => b[1] - a[1])[0];
    const mostValuableUserByVolume = Object.entries(userVolume).sort((a, b) => b[1] - a[1])[0];
    const hourlyBrecha = hourlyOps.map((hourData, hour) => {
        if (hourData.buyRates.length === 0 || hourData.sellRates.length === 0) return { hour, brecha: -1 };
        const avgBuy = hourData.buyRates.reduce((a, b) => a + b, 0) / hourData.buyRates.length;
        const avgSell = hourData.sellRates.reduce((a, b) => a + b, 0) / hourData.sellRates.length;
        return { hour, brecha: avgBuy > 0 ? ((avgSell - avgBuy) / avgBuy * 100) : 0 };
    }).filter(h => h.brecha !== -1);
    return {
        totalOps: ops.length, totalVolume, totalProfitVes, totalProfitUsdc,
        avgRate: ops.length > 0 ? ops.reduce((sum, op) => sum + op.tasa, 0) / ops.length : 0,
        dailyData,
        dayWithMostVolume: dayWithMostVolume ? { date: dayWithMostVolume[0], value: dayWithMostVolume[1].volume } : { date: 'N/A', value: 0 },
        dayWithMostProfit: dayWithMostProfit ? { date: dayWithMostProfit[0], valueVes: dayWithMostProfit[1].profitVes, valueUsdc: dayWithMostProfit[1].profitUsdc } : { date: 'N/A', valueVes: 0, valueUsdc: 0 },
        mostUsedPaymentMethod: mostUsedPaymentMethod ? { method: mostUsedPaymentMethod[0], count: mostUsedPaymentMethod[1] } : { method: 'N/A', count: 0 },
        mostValuableUser: mostValuableUserByVolume ? { user: mostValuableUserByVolume[0], volume: mostValuableUserByVolume[1] } : { user: 'N/A', volume: 0 },
        hottestHour: hourlyOps.map((h, i) => ({hour: i, count: h.count})).sort((a, b) => b.count - a.count)[0],
        hourWithMinBrecha: hourlyBrecha.length > 0 ? hourlyBrecha.sort((a,b) => a.brecha - b.brecha)[0] : null,
        hourWithMaxBrecha: hourlyBrecha.length > 0 ? hourlyBrecha.sort((a,b) => b.brecha - a.brecha)[0] : null,
    };
}

export function renderWeeklyChart(dailyData) {
    Chart.register(ChartDataLabels);
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sortedDates = Object.keys(dailyData).sort();
    if (sortedDates.length === 0) { drawEmptyChartMessage('weeklyChart', 'Sin datos semanales'); return; }
    const labels = sortedDates.map(date => new Date(date+'T00:00:00').toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric'}));
    const profitDataVes = sortedDates.map(date => dailyData[date].profitVes);
    const profitDataUsdc = sortedDates.map(date => dailyData[date].profitUsdc);
    if (state.weeklyChartInstance) state.weeklyChartInstance.destroy();
    state.weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Ganancia (VES)',
                data: profitDataVes,
                backgroundColor: profitDataVes.map(v => v >= 0 ? 'rgba(52, 211, 153, 0.75)' : 'rgba(239, 68, 68, 0.65)'),
                borderColor: profitDataVes.map(v => v >= 0 ? 'rgba(52, 211, 153, 1)' : 'rgba(239, 68, 68, 1)'),
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 48,
                datalabels: {
                    labels: { usdc: { formatter: (value, context) => `${profitDataUsdc[context.dataIndex].toFixed(3)} USDC`, color: '#FBBF24', anchor: 'end', align: 'end', offset: -5, font: { weight: 'bold', size: 11 } } }
                }
            }]
        },
        options: getProfitChartOptions('Ganancia (VES)', profitDataUsdc)
    });
}

function iconCard(title, body, detail, iconSvg, accentColor) {
    return `<div class="info-card !p-3 relative overflow-hidden"><div class="flex items-center gap-3 mb-2"><div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style="background: ${accentColor}15">${iconSvg}</div><div class="info-card-title !text-xs !mb-0">${title}</div></div><div class="info-card-value !text-base">${body}</div>${detail ? `<div class="info-card-details">${detail}</div>` : ''}</div>`;
}

export function renderWeeklySummary(results) {
    const container = document.getElementById('weeklyAnalysisSummary');
    const formatHour = h => `${h}:00 - ${h}:59`;
    container.innerHTML = `
        <h3 class="text-base font-semibold text-center mb-3 flex items-center justify-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-purple-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>Resumen General de la Semana</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${iconCard('GANANCIA NETA', `${results.totalProfitVes.toFixed(2)} VES`, `${results.totalProfitUsdc.toFixed(4)} USDC`,
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>', '#22c55e')}
            ${iconCard('VOLUMEN TOTAL', `${results.totalVolume.toFixed(2)} USDC`, '',
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-blue-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>', '#3b82f6')}
            ${iconCard('RENTABILIDAD', `${(results.totalVolume > 0 ? (results.totalProfitUsdc / results.totalVolume * 100) : 0).toFixed(2)}%`, '',
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-cyan-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>', '#06b6d4')}
            ${iconCard('OPERACIONES', `${results.totalOps}`, '',
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-indigo-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>', '#6366f1')}
        </div>
        <hr class="border-gray-700 !my-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-blue-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg><span class="text-gray-400">Mayor volumen:</span> <strong class="font-mono ml-auto">${new Date(results.dayWithMostVolume.date+'T00:00:00').toLocaleDateString()} (${results.dayWithMostVolume.value.toFixed(2)} USDC)</strong></div>
            <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg><span class="text-gray-400">Mayor ganancia:</span> <strong class="font-mono ml-auto text-green-400">${new Date(results.dayWithMostProfit.date+'T00:00:00').toLocaleDateString()} (${results.dayWithMostProfit.valueVes.toFixed(2)} VES)</strong></div>
            <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-yellow-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg><span class="text-gray-400">Método más usado:</span> <strong class="font-mono ml-auto">${results.mostUsedPaymentMethod.method} (${results.mostUsedPaymentMethod.count}x)</strong></div>
            <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-purple-400"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg><span class="text-gray-400">Usuario top (Vol.):</span> <strong class="font-mono ml-auto">${results.mostValuableUser.user} (${results.mostValuableUser.volume.toFixed(2)} USDC)</strong></div>
            <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-orange-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span class="text-gray-400">Hora pico:</span> <strong class="font-mono ml-auto">${formatHour(results.hottestHour.hour)} (${results.hottestHour.count} ops)</strong></div>
            <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-gray-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg><span class="text-gray-400">Tasa promedio:</span> <strong class="font-mono ml-auto">${results.avgRate.toFixed(2)}</strong></div>
            ${results.hourWithMinBrecha ? `<div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span class="text-gray-400">Menor brecha:</span> <strong class="font-mono ml-auto text-green-400">${formatHour(results.hourWithMinBrecha.hour)} (${results.hourWithMinBrecha.brecha.toFixed(2)}%)</strong></div>` : ''}
            ${results.hourWithMaxBrecha ? `<div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-red-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg><span class="text-gray-400">Mayor brecha:</span> <strong class="font-mono ml-auto text-red-400">${formatHour(results.hourWithMaxBrecha.hour)} (${results.hourWithMaxBrecha.brecha.toFixed(2)}%)</strong></div>` : ''}
        </div>`;
}

export function runMonthlyAnalysis() {
    const selector = document.getElementById('monthSelector');
    const summaryContainer = document.getElementById('monthlyAnalysisSummary');
    const selectedMonth = selector.value;
    if (!selectedMonth) return;
    summaryContainer.innerHTML = `<div class="text-center py-4"><div class="loader mx-auto"></div><p class="mt-2 text-sm text-gray-400">Analizando ${selector.options[selector.selectedIndex].text}...</p></div>`;
    setTimeout(() => {
        const monthlyOps = state.operations.filter(op => op.fecha.startsWith(selectedMonth));
        if (monthlyOps.length === 0) {
            summaryContainer.innerHTML = `<p class="text-center text-gray-400 py-4">No hay operaciones para el mes seleccionado.</p>`;
            if (state.monthlyChartInstance) state.monthlyChartInstance.destroy();
            drawEmptyChartMessage('monthlyChart', 'Sin operaciones en el mes');
            return;
        }
        const analysisResults = analyzeMonthlyData(monthlyOps);
        renderMonthlyChart(analysisResults.weeklyData);
        renderMonthlySummary(analysisResults);
    }, 50);
}

export function analyzeMonthlyData(monthlyOps) {
    const weeklyData = {};
    const dailyData = {};
    monthlyOps.forEach(op => {
        const opDate = new Date(op.fecha + 'T00:00:00');
        const weekOfMonth = Math.ceil(opDate.getDate() / 7);
        if (!weeklyData[weekOfMonth]) weeklyData[weekOfMonth] = { ops: [], profitVes: 0, profitUsdc: 0, volume: 0 };
        weeklyData[weekOfMonth].ops.push(op);
        if (!dailyData[op.fecha]) dailyData[op.fecha] = [];
        dailyData[op.fecha].push(op);
    });
    const sortedWeeks = Object.keys(weeklyData).sort((a,b) => a - b);
    let cumulativeWeeklyOps = [];
    let lastWeekCumulativeProfitVes = 0;
    let lastWeekCumulativeProfitUsdc = 0;
    sortedWeeks.forEach(week => {
        const opsOfTheWeek = weeklyData[week].ops;
        cumulativeWeeklyOps.push(...opsOfTheWeek);
        const [cumulativeProfitVes, cumulativeProfitUsdc] = calculateFIFOGainsForOps(cumulativeWeeklyOps);
        weeklyData[week].profitVes = cumulativeProfitVes - lastWeekCumulativeProfitVes;
        weeklyData[week].profitUsdc = cumulativeProfitUsdc - lastWeekCumulativeProfitUsdc;
        lastWeekCumulativeProfitVes = cumulativeProfitVes;
        lastWeekCumulativeProfitUsdc = cumulativeProfitUsdc;
    });
    const sortedDates = Object.keys(dailyData).sort();
    let cumulativeDailyOps = [];
    let lastDayCumulativeProfit = -Infinity;
    let bestDay = { date: null, profitVes: -Infinity };
    let positiveProfitDays = 0;
    sortedDates.forEach(date => {
        cumulativeDailyOps.push(...dailyData[date]);
        const [totalGainsForPeriod] = calculateFIFOGainsForOps(cumulativeDailyOps);
        const dailyProfit = totalGainsForPeriod - (lastDayCumulativeProfit === -Infinity ? 0 : lastDayCumulativeProfit);
        if (dailyProfit > 0) positiveProfitDays++;
        if (dailyProfit > bestDay.profitVes) bestDay = { date, profitVes: dailyProfit };
        lastDayCumulativeProfit = totalGainsForPeriod;
    });
    const bestWeek = Object.entries(weeklyData).sort((a, b) => b[1].profitVes - a[1].profitVes)[0];
    const totalProfitVes = Object.values(weeklyData).reduce((sum, week) => sum + week.profitVes, 0);
    const totalProfitUsdc = Object.values(weeklyData).reduce((sum, week) => sum + week.profitUsdc, 0);
    const totalVolume = monthlyOps.reduce((sum, op) => sum + op.montoUsdc, 0);
    const mostUsedPaymentMethod = Object.entries(monthlyOps.reduce((acc, op) => { acc[op.metodoPago] = (acc[op.metodoPago] || 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1])[0];
    const mostValuableUser = Object.entries(monthlyOps.reduce((acc, op) => { acc[op.usuario] = (acc[op.usuario] || 0) + op.montoUsdc; return acc; }, {})).sort((a,b) => b[1]-a[1])[0];
    return {
        totalProfitVes, totalProfitUsdc, totalVolume, totalOps: monthlyOps.length,
        daysInMonth: Object.keys(dailyData).length, positiveProfitDays,
        bestWeek: bestWeek ? { week: bestWeek[0], data: bestWeek[1] } : { week: 'N/A', data: { profitVes: 0 } },
        bestDay, mostUsedPaymentMethod: mostUsedPaymentMethod || ['N/A', 0],
        mostValuableUser: mostValuableUser || ['N/A', 0], weeklyData
    };
}

export function renderMonthlyChart(weeklyData) {
    Chart.register(ChartDataLabels);
    const canvas = document.getElementById('monthlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sortedWeeks = Object.keys(weeklyData).sort();
    if (sortedWeeks.length === 0) { drawEmptyChartMessage('monthlyChart', 'Sin datos del mes'); return; }
    const labels = sortedWeeks.map(week => `Semana ${week}`);
    const profitDataVes = sortedWeeks.map(week => weeklyData[week].profitVes);
    const profitDataUsdc = sortedWeeks.map(week => weeklyData[week].profitUsdc);
    if (state.monthlyChartInstance) state.monthlyChartInstance.destroy();
    state.monthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Ganancia (VES)',
                data: profitDataVes,
                backgroundColor: profitDataVes.map(v => v >= 0 ? 'rgba(34, 211, 238, 0.75)' : 'rgba(239, 68, 68, 0.65)'),
                borderColor: profitDataVes.map(v => v >= 0 ? 'rgba(34, 211, 238, 1)' : 'rgba(239, 68, 68, 1)'),
                borderWidth: 1,
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 54,
                datalabels: {
                    labels: { usdc: { formatter: (value, context) => `${profitDataUsdc[context.dataIndex].toFixed(3)} USDC`, color: '#FBBF24', anchor: 'end', align: 'end', offset: -5, font: { weight: 'bold', size: 11 } } }
                }
            }]
        },
        options: getProfitChartOptions('Ganancia (VES)', profitDataUsdc)
    });
}

export function renderMonthlySummary(results) {
    const container = document.getElementById('monthlyAnalysisSummary');
    container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${iconCard('GANANCIA NETA', `${results.totalProfitVes.toFixed(2)} VES`, `${results.totalProfitUsdc.toFixed(4)} USDC`,
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-green-400"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>', '#22c55e')}
            ${iconCard('VOLUMEN TOTAL', `${results.totalVolume.toFixed(2)} USDC`, '',
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-blue-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" /></svg>', '#3b82f6')}
            ${iconCard('RENTABILIDAD', `${(results.totalVolume > 0 ? (results.totalProfitUsdc / results.totalVolume * 100) : 0).toFixed(2)}%`, '',
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-cyan-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>', '#06b6d4')}
            ${iconCard('CONSISTENCIA', `${results.positiveProfitDays} / ${results.daysInMonth}`, 'días con ganancia',
                '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-purple-400"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>', '#a855f7')}
        </div>
        <hr class="border-gray-700 !my-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-teal-400"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18" /></svg><span class="text-gray-400">Mejor semana:</span> <strong class="font-mono ml-auto text-teal-400">Semana ${results.bestWeek.week} (${results.bestWeek.data.profitVes.toFixed(2)} VES)</strong></div>
            <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-teal-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636" /></svg><span class="text-gray-400">Mejor día:</span> <strong class="font-mono ml-auto text-teal-400">${new Date(results.bestDay.date+'T00:00:00').toLocaleDateString()} (${results.bestDay.profitVes.toFixed(2)} VES)</strong></div>
            <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-yellow-400"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" /></svg><span class="text-gray-400">Método más usado:</span> <strong class="font-mono ml-auto">${results.mostUsedPaymentMethod[0]} (${results.mostUsedPaymentMethod[1]}x)</strong></div>
            <div class="flex items-center gap-2 p-2.5 bg-gray-800/30 rounded-xl border border-gray-700/30"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 flex-shrink-0 text-purple-400"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg><span class="text-gray-400">Usuario top (Vol.):</span> <strong class="font-mono ml-auto">${results.mostValuableUser[0]} (${results.mostValuableUser[1].toFixed(2)} USDC)</strong></div>
        </div>`;
}
