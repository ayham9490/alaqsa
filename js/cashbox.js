/**
 * cashbox.js - وحدة الصندوق
 */

const Cashbox = (() => {
  /**
   * تهيئة الوحدة
   */
  function init() {
    document.getElementById('btn-cashbox-filter')
      .addEventListener('click', loadDetails);
    refresh();
  }

  /**
   * تحديث عرض الصندوق
   */
  function refresh() {
    const balances = DB.getCashboxBalance();
    renderCards(balances);
    // تحديث الداشبورد أيضاً
    updateDashboard(balances);
  }

  /**
   * رسم بطاقات الأرصدة
   */
  function renderCards(balances) {
    const container = document.getElementById('cashbox-grid');
    if (!container) return;

    const entries = Object.entries(balances);
    if (!entries.length) {
      container.innerHTML = '<p class="text-muted text-center">لا توجد بيانات</p>';
      return;
    }

    container.innerHTML = entries.map(([currency, balance]) => {
      const isNeg = balance < 0;
      return `
        <div class="cashbox-card">
          <div class="cashbox-currency">${escHtml(currency)}</div>
          <div class="cashbox-amount ${isNeg ? 'negative' : ''}">
            ${isNeg ? '-' : ''}${formatNum(Math.abs(balance))}
          </div>
          <div class="cashbox-label">الرصيد الحالي</div>
        </div>`;
    }).join('');
  }

  /**
   * تحميل تفاصيل العمليات حسب العملة
   */
  function loadDetails() {
    const currency = document.getElementById('cashbox-currency-filter').value;
    const txs = DB.getTransactions().filter(tx => {
      return (tx.currency1 === currency && tx.paymentMethod !== 'آجل') ||
             (tx.currency2 === currency && tx.paymentMethod !== 'آجل');
    });

    const tbody = document.getElementById('cashbox-details-body');
    if (!txs.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-row">لا توجد عمليات بالعملة ${escHtml(currency)}</td></tr>`;
      return;
    }

    tbody.innerHTML = txs.map(tx => {
      const acc = DB.getAccountById(tx.accountId);
      let amt = 0;
      let isMain = tx.currency1 === currency;
      amt = isMain ? (parseFloat(tx.amount1) || 0) : (parseFloat(tx.amount2) || 0);

      const isInflow = tx.type === 'بيع';
      const amtClass = isInflow ? 'text-success' : 'text-danger';
      const sign = isInflow ? '+' : '-';

      return `
        <tr>
          <td><span class="type-badge type-${tx.type}">${tx.type}</span></td>
          <td>${escHtml(acc ? acc.name : (tx.accountName || '-'))}</td>
          <td class="${amtClass} fw-bold">${sign} ${formatNum(amt)} ${escHtml(currency)}</td>
          <td>${formatDate(tx.date)}</td>
          <td>${escHtml(tx.notes || '-')}</td>
        </tr>`;
    }).join('');
  }

  /**
   * تحديث أرصدة الداشبورد
   */
  function updateDashboard(balances) {
    const usdEl = document.getElementById('dash-usd');
    const tryEl = document.getElementById('dash-try');
    const sypEl = document.getElementById('dash-syp');

    if (usdEl) usdEl.textContent = formatNum(balances['USD'] || 0);
    if (tryEl) tryEl.textContent = formatNum(balances['TRY'] || 0);
    if (sypEl) sypEl.textContent = formatNum(balances['SYP'] || 0);
  }

  return { init, refresh, loadDetails };
})();
