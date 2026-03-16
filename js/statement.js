/**
 * statement.js - وحدة كشف الحساب
 */

const Statement = (() => {
  /**
   * تهيئة الوحدة
   */
  function init() {
    document.getElementById('btn-get-statement').addEventListener('click', load);
    document.getElementById('btn-print-statement').addEventListener('click', print);
    populateAccountSelect();
  }

  /**
   * ملء قائمة الحسابات
   */
  function populateAccountSelect() {
    const accounts = DB.getAccounts();
    const sel = document.getElementById('statement-account');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- اختر حساباً --</option>';
    accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.id;
      opt.textContent = acc.name;
      sel.appendChild(opt);
    });
  }

  /**
   * تحميل وعرض كشف الحساب
   */
  function load(accountId, dateFrom, dateTo) {
    // يمكن الاستدعاء برمجياً أو من الزر
    const accId = accountId || document.getElementById('statement-account').value;
    const from = dateFrom || document.getElementById('statement-date-from').value;
    const to = dateTo || document.getElementById('statement-date-to').value;

    if (!accId) {
      UI.toast('يرجى اختيار الحساب', 'warning');
      return;
    }

    const result = DB.getStatement(accId, from || null, to || null);
    const acc = DB.getAccountById(accId);
    const accName = acc ? acc.name : 'الحساب';

    // تحديث الملخص
    document.getElementById('statement-title').textContent = `كشف حساب: ${accName}`;
    document.getElementById('stmt-total-sales').textContent = formatNum(result.totalSales);
    document.getElementById('stmt-total-payments').textContent = formatNum(result.totalPayments);
    const balance = result.balance;
    const balEl = document.getElementById('stmt-balance');
    balEl.textContent = formatNum(Math.abs(balance));
    balEl.style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';
    balEl.textContent += balance < 0 ? ' (مدين)' : ' (دائن)';

    // رسم الجدول
    renderTable(result.transactions);

    // إظهار البطاقة
    document.getElementById('statement-card').style.display = 'block';
  }

  /**
   * رسم جدول الكشف
   */
  function renderTable(txs) {
    const tbody = document.getElementById('statement-body');
    if (!txs.length) {
      tbody.innerHTML = '<tr><td colspan="11" class="empty-row">لا توجد عمليات لهذا الحساب</td></tr>';
      return;
    }

    let running = 0; // رصيد متحرك
    tbody.innerHTML = txs.map((tx, idx) => {
      const amt = parseFloat(tx.amount1) || 0;
      let sign = 0;
      if (tx.type === 'بيع') { sign = 1; }
      else if (tx.type === 'دفعة' || tx.type === 'مصاريف') { sign = -1; }
      running += sign * amt;

      const rowClass = tx.type === 'دفعة' ? 'row-payment' :
                       tx.type === 'مصاريف' ? 'row-expense' : 'row-normal';

      return `
        <tr class="${rowClass}">
          <td>${idx + 1}</td>
          <td><span class="type-badge type-${tx.type}">${tx.type}</span></td>
          <td>${escHtml(tx.fuelType || '-')}</td>
          <td>${tx.weight > 0 ? formatNum(tx.weight) : '-'}</td>
          <td>${tx.density > 0 ? tx.density : '-'}</td>
          <td>${tx.barrels > 0 ? formatNum(tx.barrels, 4) : '-'}</td>
          <td>${tx.barrelPrice > 0 ? formatNum(tx.barrelPrice) : '-'}</td>
          <td class="fw-bold ${sign >= 0 ? 'text-success' : 'text-danger'}">
            ${sign < 0 ? '-' : '+'} ${formatNum(amt)} ${escHtml(tx.currency1 || 'USD')}
          </td>
          <td>${escHtml(tx.paymentMethod || '-')}</td>
          <td>${formatDate(tx.date)}</td>
          <td>${escHtml(tx.notes || '-')}</td>
        </tr>`;
    }).join('');
  }

  /**
   * طباعة الكشف
   */
  function print() {
    window.print();
  }

  /**
   * الانتقال مباشرة إلى كشف حساب معين (من صفحة الحسابات)
   */
  function goToAccount(accountId) {
    document.getElementById('statement-account').value = accountId;
    load(accountId);
  }

  return { init, load, populateAccountSelect, goToAccount };
})();
