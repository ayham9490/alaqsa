/**
 * transactions.js - وحدة إدارة العمليات
 */

const Transactions = (() => {
  let _editingId = null;
  let _currentPage = 1;
  const PAGE_SIZE = 20;
  let _filteredTxs = [];

  /**
   * تهيئة الوحدة
   */
  function init() {
    document.getElementById('btn-new-transaction').addEventListener('click', openNewModal);
    document.getElementById('btn-save-transaction').addEventListener('click', save);
    document.getElementById('btn-filter').addEventListener('click', applyFilter);
    document.getElementById('btn-reset-filter').addEventListener('click', resetFilter);
    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-export-excel').addEventListener('click', exportExcel);

    // Fuel calculation
    const weightEl = document.getElementById('tx-weight');
    const densityEl = document.getElementById('tx-density');
    const priceEl = document.getElementById('tx-barrel-price');
    if (weightEl) weightEl.addEventListener('input', recalcFuel);
    if (densityEl) densityEl.addEventListener('input', recalcFuel);
    if (priceEl) priceEl.addEventListener('input', recalcFuel);

    // Show/hide fuel section based on type
    const typeEl = document.getElementById('tx-type');
    if (typeEl) typeEl.addEventListener('change', onTypeChange);

    populateAccountSelects();
    render();
  }

  /**
   * حساب البراميل والإجمالي تلقائياً
   * البراميل = الوزن ÷ الكثافة ÷ 220
   */
  function recalcFuel() {
    const weight = parseFloat(document.getElementById('tx-weight').value) || 0;
    const density = parseFloat(document.getElementById('tx-density').value) || 0;
    const price = parseFloat(document.getElementById('tx-barrel-price').value) || 0;

    let barrels = 0;
    if (density > 0) {
      barrels = weight / density / 220;
    }

    const barrelsEl = document.getElementById('tx-barrels');
    if (barrelsEl) barrelsEl.value = barrels > 0 ? barrels.toFixed(4) : '';

    const total = barrels * price;
    const totalEl = document.getElementById('tx-total');
    if (totalEl) totalEl.value = total > 0 ? total.toFixed(2) : '';

    // تحديث المبلغ الأول تلقائياً
    if (total > 0) {
      document.getElementById('tx-amount1').value = total.toFixed(2);
    }
  }

  /**
   * إظهار/إخفاء قسم الوقود
   */
  function onTypeChange() {
    const type = document.getElementById('tx-type').value;
    const fuelSection = document.getElementById('fuel-section');
    if (fuelSection) {
      fuelSection.style.display = (type === 'بيع' || type === 'شراء') ? 'block' : 'none';
    }
    // مسح حقول الوقود إن أُخفيت
    if (type !== 'بيع' && type !== 'شراء') {
      ['tx-weight', 'tx-density', 'tx-barrels', 'tx-barrel-price', 'tx-total'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    }
  }

  /**
   * ملء قوائم الحسابات
   */
  function populateAccountSelects() {
    const accounts = DB.getAccounts();
    const selects = ['tx-account', 'filter-account'];
    selects.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const current = sel.value;
      const firstOpt = id === 'tx-account' ? '-- اختر الحساب --' : 'الكل';
      sel.innerHTML = `<option value="">${firstOpt}</option>`;
      accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.id;
        opt.textContent = acc.name;
        if (acc.id === current) opt.selected = true;
        sel.appendChild(opt);
      });
    });
  }

  /**
   * فتح نافذة عملية جديدة
   */
  function openNewModal() {
    _editingId = null;
    document.getElementById('modal-transaction-title').textContent = 'معاملة جديدة';
    clearForm();
    document.getElementById('tx-date').value = todayDate();
    document.getElementById('fuel-section').style.display = 'none';
    UI.openModal('modal-transaction');
  }

  /**
   * فتح نافذة التعديل
   */
  function openEdit(id) {
    const tx = DB.getTransactionById(id);
    if (!tx) return;
    _editingId = id;
    document.getElementById('modal-transaction-title').textContent = 'تعديل العملية';

    document.getElementById('tx-type').value = tx.type || '';
    document.getElementById('tx-payment-method').value = tx.paymentMethod || '';
    document.getElementById('tx-account').value = tx.accountId || '';
    document.getElementById('tx-date').value = tx.date || todayDate();
    document.getElementById('tx-fuel-type').value = tx.fuelType || '';
    document.getElementById('tx-weight').value = tx.weight || '';
    document.getElementById('tx-density').value = tx.density || '';
    document.getElementById('tx-barrels').value = tx.barrels || '';
    document.getElementById('tx-barrel-price').value = tx.barrelPrice || '';
    document.getElementById('tx-amount1').value = tx.amount1 || '';
    document.getElementById('tx-currency1').value = tx.currency1 || 'USD';
    document.getElementById('tx-amount2').value = tx.amount2 || '';
    document.getElementById('tx-currency2').value = tx.currency2 || '';
    document.getElementById('tx-total').value = tx.totalUSD || '';
    document.getElementById('tx-notes').value = tx.notes || '';

    // إظهار قسم الوقود
    const fuelSection = document.getElementById('fuel-section');
    fuelSection.style.display = (tx.type === 'بيع' || tx.type === 'شراء') ? 'block' : 'none';

    UI.openModal('modal-transaction');
  }

  /**
   * حفظ العملية
   */
  function save() {
    const type = document.getElementById('tx-type').value;
    const paymentMethod = document.getElementById('tx-payment-method').value;
    const accountId = document.getElementById('tx-account').value;
    const date = document.getElementById('tx-date').value;

    if (!type) { UI.toast('يرجى اختيار نوع العملية', 'warning'); return; }
    if (!paymentMethod) { UI.toast('يرجى اختيار طريقة الدفع', 'warning'); return; }
    if (!accountId) { UI.toast('يرجى اختيار الحساب', 'warning'); return; }
    if (!date) { UI.toast('يرجى إدخال التاريخ', 'warning'); return; }

    const amount1 = parseFloat(document.getElementById('tx-amount1').value) || 0;
    if (amount1 <= 0) { UI.toast('يرجى إدخال مبلغ صحيح', 'warning'); return; }

    const fuelType = document.getElementById('tx-fuel-type').value;
    const weight = parseFloat(document.getElementById('tx-weight').value) || 0;
    const density = parseFloat(document.getElementById('tx-density').value) || 0;
    const barrels = parseFloat(document.getElementById('tx-barrels').value) || 0;
    const barrelPrice = parseFloat(document.getElementById('tx-barrel-price').value) || 0;
    const totalUSD = parseFloat(document.getElementById('tx-total').value) || amount1;

    const data = {
      type,
      paymentMethod,
      accountId,
      accountName: (DB.getAccountById(accountId) || {}).name || '',
      date,
      fuelType: (type === 'بيع' || type === 'شراء') ? fuelType : '',
      weight: (type === 'بيع' || type === 'شراء') ? weight : 0,
      density: (type === 'بيع' || type === 'شراء') ? density : 0,
      barrels: (type === 'بيع' || type === 'شراء') ? barrels : 0,
      barrelPrice: (type === 'بيع' || type === 'شراء') ? barrelPrice : 0,
      amount1,
      currency1: document.getElementById('tx-currency1').value || 'USD',
      amount2: parseFloat(document.getElementById('tx-amount2').value) || 0,
      currency2: document.getElementById('tx-currency2').value || '',
      totalUSD,
      notes: document.getElementById('tx-notes').value.trim()
    };

    if (_editingId) {
      DB.updateTransaction(_editingId, data);
      UI.toast('تم تحديث العملية بنجاح', 'success');
    } else {
      DB.addTransaction(data);
      UI.toast('تم حفظ العملية بنجاح', 'success');
    }

    UI.closeModal('modal-transaction');
    _currentPage = 1;
    applyFilter();
    Dashboard.refresh();
    Cashbox.refresh();

    // محاولة المزامنة مع Google Sheets
    syncToSheets(data);
  }

  /**
   * مزامنة مع Google Sheets (في الخلفية)
   */
  async function syncToSheets(tx) {
    const settings = Storage.get('settings') || {};
    if (!settings.apiUrl) return;
    try {
      await API.addTransaction(tx);
      document.getElementById('sync-status').title = 'تمت المزامنة';
    } catch { /* صامت */ }
  }

  /**
   * تأكيد حذف عملية
   */
  function confirmDelete(id) {
    const tx = DB.getTransactionById(id);
    if (!tx) return;
    UI.confirm(`هل تريد حذف هذه العملية؟`, () => {
      DB.deleteTransaction(id);
      applyFilter();
      Dashboard.refresh();
      Cashbox.refresh();
      UI.toast('تم حذف العملية', 'success');
    });
  }

  /**
   * تطبيق التصفية
   */
  function applyFilter() {
    const type = document.getElementById('filter-type').value;
    const accountId = document.getElementById('filter-account').value;
    const dateFrom = document.getElementById('filter-date-from').value;
    const dateTo = document.getElementById('filter-date-to').value;

    _filteredTxs = DB.filterTransactions({ type, accountId, dateFrom, dateTo });
    _currentPage = 1;
    render(_filteredTxs);
  }

  /**
   * إعادة ضبط الفلاتر
   */
  function resetFilter() {
    ['filter-type', 'filter-account', 'filter-date-from', 'filter-date-to']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    _filteredTxs = DB.getTransactions();
    _currentPage = 1;
    render();
  }

  /**
   * رسم الجدول
   */
  function render(txs) {
    const allTxs = txs || DB.getTransactions();
    _filteredTxs = allTxs;

    const start = (_currentPage - 1) * PAGE_SIZE;
    const pageTxs = allTxs.slice(start, start + PAGE_SIZE);

    const tbody = document.getElementById('transactions-body');

    if (!allTxs.length) {
      tbody.innerHTML = '<tr><td colspan="15" class="empty-row">لا توجد عمليات</td></tr>';
      document.getElementById('transactions-pagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = pageTxs.map((tx, idx) => {
      const rowClass = tx.type === 'دفعة' ? 'row-payment' : tx.type === 'مصاريف' ? 'row-expense' : 'row-normal';
      const globalIdx = start + idx + 1;
      const acc = DB.getAccountById(tx.accountId);
      return `
        <tr class="${rowClass}">
          <td>${globalIdx}</td>
          <td><span class="type-badge type-${tx.type}">${tx.type}</span></td>
          <td>${escHtml(tx.paymentMethod || '-')}</td>
          <td>${escHtml(acc ? acc.name : (tx.accountName || '-'))}</td>
          <td>${escHtml(tx.fuelType || '-')}</td>
          <td>${tx.weight > 0 ? formatNum(tx.weight) : '-'}</td>
          <td>${tx.density > 0 ? tx.density : '-'}</td>
          <td>${tx.barrels > 0 ? formatNum(tx.barrels, 4) : '-'}</td>
          <td>${tx.barrelPrice > 0 ? formatNum(tx.barrelPrice) : '-'}</td>
          <td class="fw-bold">${formatNum(tx.amount1)} ${escHtml(tx.currency1 || 'USD')}</td>
          <td>${tx.amount2 > 0 ? formatNum(tx.amount2) : '-'}</td>
          <td>${escHtml(tx.currency2 || '-')}</td>
          <td>${formatDate(tx.date)}</td>
          <td>${escHtml(tx.notes || '-')}</td>
          <td>
            <button class="btn-icon" onclick="Transactions.openEdit('${tx.id}')" title="تعديل">✏️</button>
            <button class="btn-icon" onclick="Transactions.confirmDelete('${tx.id}')" title="حذف">🗑️</button>
          </td>
        </tr>`;
    }).join('');

    renderPagination(allTxs.length);
  }

  /**
   * رسم الترقيم
   */
  function renderPagination(total) {
    const pages = Math.ceil(total / PAGE_SIZE);
    const container = document.getElementById('transactions-pagination');
    if (pages <= 1) { container.innerHTML = ''; return; }

    let html = '';
    if (_currentPage > 1) html += `<button onclick="Transactions.goPage(${_currentPage - 1})">‹</button>`;

    const start = Math.max(1, _currentPage - 2);
    const end = Math.min(pages, _currentPage + 2);
    for (let i = start; i <= end; i++) {
      html += `<button class="${i === _currentPage ? 'active' : ''}" onclick="Transactions.goPage(${i})">${i}</button>`;
    }

    if (_currentPage < pages) html += `<button onclick="Transactions.goPage(${_currentPage + 1})">›</button>`;
    container.innerHTML = html;
  }

  /**
   * الانتقال لصفحة معينة
   */
  function goPage(page) {
    _currentPage = page;
    render(_filteredTxs);
  }

  /**
   * تصدير CSV
   */
  function exportCSV() {
    const txs = _filteredTxs.length ? _filteredTxs : DB.getTransactions();
    const headers = ['النوع', 'طريقة الدفع', 'الحساب', 'نوع الوقود', 'الوزن', 'الكثافة', 'البراميل', 'سعر البرميل', 'المبلغ', 'العملة', 'المبلغ 2', 'العملة 2', 'التاريخ', 'ملاحظات'];
    const rows = txs.map(tx => {
      const acc = DB.getAccountById(tx.accountId);
      return [
        tx.type, tx.paymentMethod, acc ? acc.name : (tx.accountName || ''),
        tx.fuelType || '', tx.weight || '', tx.density || '', tx.barrels || '', tx.barrelPrice || '',
        tx.amount1, tx.currency1, tx.amount2 || '', tx.currency2 || '', tx.date, tx.notes || ''
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const BOM = '\uFEFF';
    downloadFile(BOM + csv, 'transactions.csv', 'text/csv;charset=utf-8;');
    UI.toast('تم تصدير الملف بنجاح', 'success');
  }

  /**
   * تصدير Excel (HTML table → XLS)
   */
  function exportExcel() {
    const txs = _filteredTxs.length ? _filteredTxs : DB.getTransactions();
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"/></head><body>
<table border="1" dir="rtl" style="font-family:Amiri;">
<thead><tr>
  <th>النوع</th><th>طريقة الدفع</th><th>الحساب</th><th>نوع الوقود</th>
  <th>الوزن</th><th>الكثافة</th><th>البراميل</th><th>سعر البرميل</th>
  <th>المبلغ</th><th>العملة</th><th>التاريخ</th><th>ملاحظات</th>
</tr></thead><tbody>`;
    txs.forEach(tx => {
      const acc = DB.getAccountById(tx.accountId);
      html += `<tr>
        <td>${tx.type}</td><td>${tx.paymentMethod}</td>
        <td>${acc ? acc.name : (tx.accountName || '')}</td>
        <td>${tx.fuelType || ''}</td><td>${tx.weight || ''}</td>
        <td>${tx.density || ''}</td><td>${tx.barrels || ''}</td>
        <td>${tx.barrelPrice || ''}</td><td>${tx.amount1}</td>
        <td>${tx.currency1}</td><td>${tx.date}</td><td>${tx.notes || ''}</td>
      </tr>`;
    });
    html += '</tbody></table></body></html>';
    downloadFile(html, 'transactions.xls', 'application/vnd.ms-excel');
    UI.toast('تم تصدير الملف بنجاح', 'success');
  }

  /**
   * مسح حقول النموذج
   */
  function clearForm() {
    const ids = [
      'tx-type', 'tx-payment-method', 'tx-account', 'tx-fuel-type',
      'tx-weight', 'tx-density', 'tx-barrels', 'tx-barrel-price',
      'tx-amount1', 'tx-amount2', 'tx-total', 'tx-notes'
    ];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const c1 = document.getElementById('tx-currency1');
    if (c1) c1.value = 'USD';
    const c2 = document.getElementById('tx-currency2');
    if (c2) c2.value = '';
  }

  return {
    init, render, openEdit, confirmDelete, applyFilter, resetFilter,
    populateAccountSelects, goPage, exportCSV, exportExcel
  };
})();
