/**
 * reports.js - وحدة التقارير والرسوم البيانية
 */

const Reports = (() => {
  let _charts = {};

  /**
   * تهيئة الوحدة
   */
  function init() {
    document.getElementById('btn-generate-report').addEventListener('click', generate);
    document.getElementById('btn-print-report').addEventListener('click', () => window.print());
    document.getElementById('report-period').addEventListener('change', onPeriodChange);
    loadChartJS();
  }

  /**
   * تحميل مكتبة Chart.js من CDN
   */
  function loadChartJS() {
    if (window.Chart) { generate(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    script.onload = () => generate();
    document.head.appendChild(script);
  }

  /**
   * عند تغيير الفترة الزمنية
   */
  function onPeriodChange() {
    const period = document.getElementById('report-period').value;
    const isCustom = period === 'custom';
    const d1 = document.getElementById('report-custom-dates');
    const d2 = document.getElementById('report-custom-dates2');
    if (d1) d1.style.display = isCustom ? 'flex' : 'none';
    if (d2) d2.style.display = isCustom ? 'flex' : 'none';
  }

  /**
   * الحصول على الفترة الزمنية
   */
  function getPeriodDates() {
    const period = document.getElementById('report-period').value;
    const now = new Date();

    if (period === 'custom') {
      return {
        from: document.getElementById('report-date-from').value,
        to: document.getElementById('report-date-to').value
      };
    }

    let from = new Date();
    if (period === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1);
    } else if (period === 'year') {
      from = new Date(now.getFullYear(), 0, 1);
    }

    return {
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0]
    };
  }

  /**
   * توليد التقارير
   */
  function generate() {
    if (!window.Chart) { loadChartJS(); return; }

    const { from, to } = getPeriodDates();
    const txs = DB.filterTransactions({
      dateFrom: from || undefined,
      dateTo: to || undefined
    });

    generateSalesPurchasesChart(txs);
    generatePaymentMethodsChart(txs);
    generateFuelTypesChart(txs);
    generateExpensesChart(txs);
    generateSummary(txs);
  }

  /**
   * مخطط المبيعات مقابل المشتريات
   */
  function generateSalesPurchasesChart(txs) {
    const data = { بيع: 0, شراء: 0, دفعة: 0, مصاريف: 0 };
    txs.forEach(tx => {
      const amt = parseFloat(tx.amount1) || 0;
      if (tx.type in data) data[tx.type] += amt;
    });

    drawChart('chart-sales-purchases', 'bar', {
      labels: ['مبيعات', 'مشتريات', 'دفعات', 'مصاريف'],
      datasets: [{
        label: 'المبلغ (USD)',
        data: [data['بيع'], data['شراء'], data['دفعة'], data['مصاريف']],
        backgroundColor: [
          'rgba(39,174,96,0.7)',
          'rgba(41,128,185,0.7)',
          'rgba(231,76,60,0.7)',
          'rgba(230,126,34,0.7)'
        ],
        borderColor: ['#27ae60', '#2980b9', '#e74c3c', '#e67e22'],
        borderWidth: 2,
        borderRadius: 6
      }]
    });
  }

  /**
   * مخطط طرق الدفع
   */
  function generatePaymentMethodsChart(txs) {
    const methods = {};
    txs.forEach(tx => {
      const m = tx.paymentMethod || 'غير محدد';
      methods[m] = (methods[m] || 0) + (parseFloat(tx.amount1) || 0);
    });

    if (!Object.keys(methods).length) return;

    drawChart('chart-payment-methods', 'doughnut', {
      labels: Object.keys(methods),
      datasets: [{
        data: Object.values(methods),
        backgroundColor: [
          'rgba(26,60,94,0.8)',
          'rgba(201,162,39,0.8)',
          'rgba(39,174,96,0.8)',
          'rgba(41,128,185,0.8)'
        ],
        borderWidth: 2
      }]
    });
  }

  /**
   * مخطط أنواع الوقود
   */
  function generateFuelTypesChart(txs) {
    const fuels = {};
    txs.filter(tx => tx.fuelType && tx.barrels > 0).forEach(tx => {
      const f = tx.fuelType;
      fuels[f] = (fuels[f] || 0) + (parseFloat(tx.barrels) || 0);
    });

    if (!Object.keys(fuels).length) {
      const ctx = document.getElementById('chart-fuel-types');
      if (ctx) {
        const p = ctx.parentElement.querySelector('p.no-data');
        if (!p) {
          const el = document.createElement('p');
          el.className = 'no-data text-muted text-center';
          el.textContent = 'لا توجد بيانات وقود في هذه الفترة';
          ctx.parentElement.appendChild(el);
        }
      }
      return;
    }

    drawChart('chart-fuel-types', 'pie', {
      labels: Object.keys(fuels),
      datasets: [{
        data: Object.values(fuels),
        backgroundColor: [
          'rgba(26,60,94,0.8)', 'rgba(201,162,39,0.8)',
          'rgba(39,174,96,0.8)', 'rgba(41,128,185,0.8)', 'rgba(231,76,60,0.8)'
        ],
        borderWidth: 2
      }]
    });
  }

  /**
   * مخطط المصاريف الشهرية
   */
  function generateExpensesChart(txs) {
    const monthly = {};
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

    txs.filter(tx => tx.type === 'مصاريف').forEach(tx => {
      if (!tx.date) return;
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
      if (!monthly[key]) monthly[key] = { label, amount: 0 };
      monthly[key].amount += parseFloat(tx.amount1) || 0;
    });

    const sorted = Object.values(monthly).sort((a, b) => a.label.localeCompare(b.label));

    drawChart('chart-expenses', 'line', {
      labels: sorted.map(m => m.label),
      datasets: [{
        label: 'المصاريف (USD)',
        data: sorted.map(m => m.amount),
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231,76,60,0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#e74c3c'
      }]
    });
  }

  /**
   * رسم مخطط
   */
  function drawChart(canvasId, type, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // تدمير المخطط القديم إن وجد
    if (_charts[canvasId]) {
      _charts[canvasId].destroy();
    }

    _charts[canvasId] = new Chart(canvas, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'Amiri', size: 13 },
              padding: 16
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${formatNum(ctx.raw)}`
            }
          }
        },
        scales: type === 'bar' || type === 'line' ? {
          y: {
            beginAtZero: true,
            ticks: { font: { family: 'Amiri' } }
          },
          x: {
            ticks: { font: { family: 'Amiri' } }
          }
        } : {}
      }
    });
  }

  /**
   * توليد ملخص التقرير
   */
  function generateSummary(txs) {
    const summary = {
      totalSales: 0, totalPurchases: 0,
      totalPayments: 0, totalExpenses: 0,
      totalBarrels: 0, txCount: txs.length
    };

    txs.forEach(tx => {
      const amt = parseFloat(tx.amount1) || 0;
      if (tx.type === 'بيع') summary.totalSales += amt;
      else if (tx.type === 'شراء') summary.totalPurchases += amt;
      else if (tx.type === 'دفعة') summary.totalPayments += amt;
      else if (tx.type === 'مصاريف') summary.totalExpenses += amt;
      summary.totalBarrels += parseFloat(tx.barrels) || 0;
    });

    const profit = summary.totalSales - summary.totalPurchases - summary.totalExpenses;

    const container = document.getElementById('report-summary');
    container.innerHTML = [
      { label: 'إجمالي المبيعات', value: formatNum(summary.totalSales) + ' USD', color: 'success' },
      { label: 'إجمالي المشتريات', value: formatNum(summary.totalPurchases) + ' USD', color: 'info' },
      { label: 'إجمالي الدفعات', value: formatNum(summary.totalPayments) + ' USD', color: 'warning' },
      { label: 'إجمالي المصاريف', value: formatNum(summary.totalExpenses) + ' USD', color: 'danger' },
      { label: 'الربح الإجمالي', value: formatNum(profit) + ' USD', color: profit >= 0 ? 'success' : 'danger' },
      { label: 'إجمالي البراميل', value: formatNum(summary.totalBarrels, 2), color: 'primary' },
      { label: 'عدد العمليات', value: summary.txCount, color: 'primary' }
    ].map(item => `
      <div class="summary-item">
        <div class="s-label">${item.label}</div>
        <div class="s-value text-${item.color}">${item.value}</div>
      </div>
    `).join('');
  }

  return { init, generate };
})();
