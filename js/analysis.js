import { operations, weeklyChartInstance, monthlyChartInstance, setWeeklyChartInstance, setMonthlyChartInstance } from './state.js';
import { calculateFIFOGainsForOps } from './operations.js';

export function closeWeeklyAnalysisModal() {
    document.getElementById('weeklyAnalysisModal').classList.remove('show');
    if (weeklyChartInstance) {
        weeklyChartInstance.destroy();
    }
}

export function openWeeklyAnalysisModal() {
    const modal = document.getElementById('weeklyAnalysisModal');
    const summaryContainer = document.getElementById('weeklyAnalysisSummary');
    modal.classList.add('show');

    summaryContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="loader mx-auto"></div>
            <p class="mt-2 text-sm text-gray-400">Analizando datos de la semana...</p>
        </div>`;

    setTimeout(() => {
        const weeklyOps = getWeeklyOperations();
        if (weeklyOps.length === 0) {
            summaryContainer.innerHTML = `<p class="text-center text-gray-400 py-4">No hay operaciones en los últimos 7 días para analizar.</p>`;
            if (weeklyChartInstance) weeklyChartInstance.destroy();
            return;
        }
        const analysisResults = analyzeWeeklyData(weeklyOps);
        renderWeeklyChart(analysisResults.dailyData);
        renderWeeklySummary(analysisResults);
    }, 50);
}

function getWeeklyOperations() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(today.getDate() - diff);

    const formatDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const startStr = formatDate(monday);
    const endStr = formatDate(today);

    return operations.filter(op => op.fecha >= startStr && op.fecha <= endStr);
}

function analyzeWeeklyData(ops) {
    const dailyData = {};
    const paymentMethodCount = {};
    const userVolume = {};
    const hourlyOps = Array(24).fill(0).map(() => ({ count: 0, buyRates: [], sellRates: [] }));

    const groupedByDay = ops.reduce((acc, op) => {
        const date = op.fecha;
        if (!acc[date]) acc[date] = [];
        acc[date].push(op);
        return acc;
    }, {});

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

        dailyData[date] = {
            volume: dailyVolume,
            profitVes: dailyProfitVes,
            profitUsdc: dailyProfitUsdc,
            opCount: opsOfTheDay.length
        };

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
        const brecha = avgBuy > 0 ? ((avgSell - avgBuy) / avgBuy * 100) : 0;
        return { hour, brecha };
    }).filter(h => h.brecha !== -1);

    return {
        totalOps: ops.length,
        totalVolume,
        totalProfitVes,
        totalProfitUsdc,
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

function renderWeeklyChart(dailyData) {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    const sortedDates = Object.keys(dailyData).sort();

    const labels = sortedDates.map(date => new Date(date+'T00:00:00').toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric'}));
    const profitDataVes = sortedDates.map(date => dailyData[date].profitVes);
    const profitDataUsdc = sortedDates.map(date => dailyData[date].profitUsdc);

    if (weeklyChartInstance) {
        weeklyChartInstance.destroy();
    }

    setWeeklyChartInstance(new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ganancia (VES)',
                    data: profitDataVes,
                    backgroundColor: 'rgba(52, 211, 153, 0.7)',
                    borderColor: 'rgba(52, 211, 153, 1)',
                    borderWidth: 1,
                    datalabels: {
                        labels: {
                            usdc: {
                                formatter: (value, context) => {
                                    const usdcValue = profitDataUsdc[context.dataIndex];
                                    return `${usdcValue.toFixed(3)} USDC`;
                                },
                                color: '#FBBF24',
                                anchor: 'end',
                                align: 'end',
                                offset: -5,
                                font: {
                                    weight: 'bold',
                                    size: 11,
                                }
                            }
                        }
                    }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Ganancia (VES)' }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    }));
}

function renderWeeklySummary(results) {
    const container = document.getElementById('weeklyAnalysisSummary');
    const formatHour = h => `${h}:00 - ${h}:59`;

    container.innerHTML = `
        <h3 class="text-base font-semibold text-center mb-2">Resumen General de la Semana</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-sm">
            <div class="info-card !p-2">
                <div class="info-card-title !text-xs">GANANCIA NETA</div>
                <div class="info-card-value !text-base text-green-400">${results.totalProfitVes.toFixed(2)} VES</div>
                <div class="info-card-details text-orange-400">${results.totalProfitUsdc.toFixed(4)} USDC</div>
            </div>
            <div class="info-card !p-2"><div class="info-card-title !text-xs">VOLUMEN TOTAL</div><div class="info-card-value !text-lg">${results.totalVolume.toFixed(2)} USDC</div></div>
            <div class="info-card !p-2"><div class="info-card-title !text-xs">RENTABILIDAD</div><div class="info-card-value !text-lg text-blue-400">${(results.totalVolume > 0 ? (results.totalProfitUsdc / results.totalVolume * 100) : 0).toFixed(2)}%</div></div>
            <div class="info-card !p-2"><div class="info-card-title !text-xs">OPERACIONES</div><div class="info-card-value !text-lg">${results.totalOps}</div></div>
        </div>
        <hr class="border-gray-700 !my-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><strong>Día de mayor volumen:</strong> <span class="float-right font-mono">${new Date(results.dayWithMostVolume.date+'T00:00:00').toLocaleDateString()} (${results.dayWithMostVolume.value.toFixed(2)} USDC)</span></div>
            <div><strong>Día de mayor ganancia:</strong> <span class="float-right font-mono text-green-400">${new Date(results.dayWithMostProfit.date+'T00:00:00').toLocaleDateString()} (${results.dayWithMostProfit.valueVes.toFixed(2)} VES)</span></div>
            <div><strong>Método de pago más usado:</strong> <span class="float-right font-mono">${results.mostUsedPaymentMethod.method} (${results.mostUsedPaymentMethod.count} veces)</span></div>
            <div><strong>Usuario más valioso (Vol.):</strong> <span class="float-right font-mono">${results.mostValuableUser.user} (${results.mostValuableUser.volume.toFixed(2)} USDC)</span></div>
            <div><strong>Hora de mayor actividad:</strong> <span class="float-right font-mono">${formatHour(results.hottestHour.hour)} (${results.hottestHour.count} ops)</span></div>
            <div><strong>Tasa promedio de la semana:</strong> <span class="float-right font-mono">${results.avgRate.toFixed(2)}</span></div>
            ${results.hourWithMinBrecha ? `<div><strong>Hora con menor brecha:</strong> <span class="float-right font-mono text-green-400">${formatHour(results.hourWithMinBrecha.hour)} (${results.hourWithMinBrecha.brecha.toFixed(2)}%)</span></div>` : ''}
            ${results.hourWithMaxBrecha ? `<div><strong>Hora con mayor brecha:</strong> <span class="float-right font-mono text-red-400">${formatHour(results.hourWithMaxBrecha.hour)} (${results.hourWithMaxBrecha.brecha.toFixed(2)}%)</span></div>` : ''}
        </div>
    `;
}

function populateMonthSelector() {
    const selector = document.getElementById('monthSelector');
    if (!operations || operations.length === 0) return;

    selector.innerHTML = '';

    const oldestOp = operations.reduce((oldest, op) => op.timestamp < oldest.timestamp ? op : oldest, operations[0]);
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

export { populateMonthSelector };

export function closeMonthlyAnalysisModal() {
    document.getElementById('monthlyAnalysisModal').classList.remove('show');
    if (monthlyChartInstance) {
        monthlyChartInstance.destroy();
    }
}

export function openMonthlyAnalysisModal() {
    document.getElementById('monthlyAnalysisModal').classList.add('show');
    populateMonthSelector();
    if (document.getElementById('monthSelector').options.length > 0) {
        runMonthlyAnalysis();
    }
}

export function runMonthlyAnalysis() {
    const selector = document.getElementById('monthSelector');
    const summaryContainer = document.getElementById('monthlyAnalysisSummary');
    const selectedMonth = selector.value;

    if (!selectedMonth) return;

    summaryContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="loader mx-auto"></div>
            <p class="mt-2 text-sm text-gray-400">Analizando ${selector.options[selector.selectedIndex].text}...</p>
        </div>`;

    setTimeout(() => {
        const monthlyOps = operations.filter(op => op.fecha.startsWith(selectedMonth));
        if (monthlyOps.length === 0) {
            summaryContainer.innerHTML = `<p class="text-center text-gray-400 py-4">No hay operaciones para el mes seleccionado.</p>`;
            if (monthlyChartInstance) monthlyChartInstance.destroy();
            return;
        }
        const analysisResults = analyzeMonthlyData(monthlyOps);
        renderMonthlyChart(analysisResults.weeklyData);
        renderMonthlySummary(analysisResults);
    }, 50);
}

function analyzeMonthlyData(monthlyOps) {
    const weeklyData = {};
    const dailyData = {};
    monthlyOps.forEach(op => {
        const opDate = new Date(op.fecha + 'T00:00:00');
        const weekOfMonth = Math.ceil(opDate.getDate() / 7);
        if (!weeklyData[weekOfMonth]) {
            weeklyData[weekOfMonth] = { ops: [], profitVes: 0, profitUsdc: 0, volume: 0 };
        }
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
        if (dailyProfit > bestDay.profitVes) {
            bestDay = { date, profitVes: dailyProfit };
        }
        lastDayCumulativeProfit = totalGainsForPeriod;
    });

    const bestWeek = Object.entries(weeklyData).sort((a, b) => b[1].profitVes - a[1].profitVes)[0];
    const totalProfitVes = Object.values(weeklyData).reduce((sum, week) => sum + week.profitVes, 0);
    const totalProfitUsdc = Object.values(weeklyData).reduce((sum, week) => sum + week.profitUsdc, 0);
    const totalVolume = monthlyOps.reduce((sum, op) => sum + op.montoUsdc, 0);
    const mostUsedPaymentMethod = Object.entries(monthlyOps.reduce((acc, op) => { acc[op.metodoPago] = (acc[op.metodoPago] || 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1])[0];
    const mostValuableUser = Object.entries(monthlyOps.reduce((acc, op) => { acc[op.usuario] = (acc[op.usuario] || 0) + op.montoUsdc; return acc; }, {})).sort((a,b) => b[1]-a[1])[0];

    return {
        totalProfitVes,
        totalProfitUsdc,
        totalVolume,
        totalOps: monthlyOps.length,
        daysInMonth: Object.keys(dailyData).length,
        positiveProfitDays,
        bestWeek: bestWeek ? { week: bestWeek[0], data: bestWeek[1] } : { week: 'N/A', data: { profitVes: 0 } },
        bestDay,
        mostUsedPaymentMethod: mostUsedPaymentMethod || ['N/A', 0],
        mostValuableUser: mostValuableUser || ['N/A', 0],
        weeklyData
    };
}

function renderMonthlyChart(weeklyData) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    const sortedWeeks = Object.keys(weeklyData).sort();

    const labels = sortedWeeks.map(week => `Semana ${week}`);
    const profitDataVes = sortedWeeks.map(week => weeklyData[week].profitVes);
    const profitDataUsdc = sortedWeeks.map(week => weeklyData[week].profitUsdc);

    if (monthlyChartInstance) {
        monthlyChartInstance.destroy();
    }

    setMonthlyChartInstance(new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ganancia (VES)',
                data: profitDataVes,
                backgroundColor: 'rgba(34, 211, 238, 0.7)',
                borderColor: 'rgba(34, 211, 238, 1)',
                borderWidth: 1,
                datalabels: {
                    labels: {
                        usdc: {
                            formatter: (value, context) => `${profitDataUsdc[context.dataIndex].toFixed(3)} USDC`,
                            color: '#FBBF24',
                            anchor: 'end',
                            align: 'end',
                            offset: -5,
                            font: { weight: 'bold', size: 11 }
                        }
                    }
                }
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Ganancia (VES)' } } },
            plugins: { legend: { display: false } }
        }
    }));
}

function renderMonthlySummary(results) {
    const container = document.getElementById('monthlyAnalysisSummary');
    container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-sm">
            <div class="info-card !p-2">
                <div class="info-card-title !text-xs">GANANCIA NETA</div>
                <div class="info-card-value !text-base text-green-400">${results.totalProfitVes.toFixed(2)} VES</div>
                <div class="info-card-details text-orange-400">${results.totalProfitUsdc.toFixed(4)} USDC</div>
            </div>
            <div class="info-card !p-2"><div class="info-card-title !text-xs">VOLUMEN TOTAL</div><div class="info-card-value !text-lg">${results.totalVolume.toFixed(2)} USDC</div></div>
            <div class="info-card !p-2"><div class="info-card-title !text-xs">RENTABILIDAD</div><div class="info-card-value !text-lg text-blue-400">${(results.totalVolume > 0 ? (results.totalProfitUsdc / results.totalVolume * 100) : 0).toFixed(2)}%</div></div>
            <div class="info-card !p-2">
                <div class="info-card-title !text-xs">CONSISTENCIA</div>
                <div class="info-card-value !text-lg text-purple-400">${results.positiveProfitDays} / ${results.daysInMonth}</div>
                <div class="info-card-details">días con ganancia</div>
            </div>
        </div>
        <hr class="border-gray-700 !my-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><strong>Mejor semana del mes:</strong> <span class="float-right font-mono text-teal-400">Semana ${results.bestWeek.week} (${results.bestWeek.data.profitVes.toFixed(2)} VES)</span></div>
            <div><strong>Mejor día del mes:</strong> <span class="float-right font-mono text-teal-400">${new Date(results.bestDay.date+'T00:00:00').toLocaleDateString()} (${results.bestDay.profitVes.toFixed(2)} VES)</span></div>
            <div><strong>Método de pago más usado:</strong> <span class="float-right font-mono">${results.mostUsedPaymentMethod[0]} (${results.mostUsedPaymentMethod[1]} veces)</span></div>
            <div><strong>Usuario más valioso (Vol.):</strong> <span class="float-right font-mono">${results.mostValuableUser[0]} (${results.mostValuableUser[1].toFixed(2)} USDC)</span></div>
        </div>
    `;
}
