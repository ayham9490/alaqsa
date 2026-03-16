/**
 * accounts.js - وحدة إدارة الحسابات
 */

const Accounts = (() => {
  let _editingId = null;

  /**
   * تهيئة الوحدة
   */
  function init() {
    document.getElementById('btn-new-account')
      .addEventListener('click', openNewModal);

    document.getElementById('btn-save-account')
      .addEventListener('click', save);

    render();
  }

  /**
   * رسم جدول الحسابات
   */
  function render() {
    const accounts = DB.getAccounts();
    const tbody = document.getElementById('accounts-body');
    if (!accounts.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">لا توجد حسابات</td></tr>';
      return;
    }

    tbody.innerHTML = accounts.map((acc, idx) => {
      const balance = calcBalance(acc.id);
      const balanceClass = balance >= 0 ? 'text-success' : 'text-danger';
      return `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${escHtml(acc.name)}</strong></td>
          <td><span class="badge badge-blue">${escHtml(acc.type || '')}</span></td>
          <td>${escHtml(acc.phone || '-')}</td>
          <td class="${balanceClass} fw-bold">${formatNum(balance)} USD</td>
          <td>${escHtml(acc.notes || '-')}</td>
          <td>
            <button class="btn-icon" onclick="Accounts.openEdit('${acc.id}')" title="تعديل">✏️</button>
            <button class="btn-icon" onclick="Accounts.confirmDelete('${acc.id}')" title="حذف">🗑️</button>
            <button class="btn-icon" onclick="App.goToStatement('${acc.id}')" title="كشف الحساب">📋</button>
          </td>
        </tr>`;
    }).join('');
  }

  /**
   * حساب رصيد حساب معين
   */
  function calcBalance(accountId) {
    const txs = DB.filterTransactions({ accountId });
    let balance = 0;
    txs.forEach(tx => {
      const amt = parseFloat(tx.totalUSD) || parseFloat(tx.amount1) || 0;
      if (tx.type === 'بيع') balance += amt;
      else if (tx.type === 'دفعة') balance -= amt;
      else if (tx.type === 'شراء') balance -= amt;
    });
    return balance;
  }

  /**
   * فتح نافذة حساب جديد
   */
  function openNewModal() {
    _editingId = null;
    document.getElementById('modal-account-title').textContent = 'حساب جديد';
    clearForm();
    UI.openModal('modal-account');
  }

  /**
   * فتح نافذة التعديل
   */
  function openEdit(id) {
    const acc = DB.getAccountById(id);
    if (!acc) return;
    _editingId = id;
    document.getElementById('modal-account-title').textContent = 'تعديل الحساب';
    document.getElementById('acc-name').value = acc.name || '';
    document.getElementById('acc-type').value = acc.type || 'عميل';
    document.getElementById('acc-phone').value = acc.phone || '';
    document.getElementById('acc-notes').value = acc.notes || '';
    UI.openModal('modal-account');
  }

  /**
   * حفظ الحساب
   */
  function save() {
    const name = document.getElementById('acc-name').value.trim();
    if (!name) { UI.toast('اسم الحساب مطلوب', 'warning'); return; }

    const data = {
      name,
      type: document.getElementById('acc-type').value,
      phone: document.getElementById('acc-phone').value.trim(),
      notes: document.getElementById('acc-notes').value.trim()
    };

    if (_editingId) {
      DB.updateAccount(_editingId, data);
      UI.toast('تم تحديث الحساب بنجاح', 'success');
    } else {
      DB.addAccount(data);
      UI.toast('تم إضافة الحساب بنجاح', 'success');
    }

    UI.closeModal('modal-account');
    render();
    Transactions.populateAccountSelects();
    refreshAccountSelects();
    Dashboard.refresh();
  }

  /**
   * تأكيد الحذف
   */
  function confirmDelete(id) {
    const acc = DB.getAccountById(id);
    if (!acc) return;
    UI.confirm(`هل تريد حذف حساب "${acc.name}"؟`, () => {
      DB.deleteAccount(id);
      render();
      Transactions.populateAccountSelects();
      refreshAccountSelects();
      UI.toast('تم حذف الحساب', 'success');
      Dashboard.refresh();
    });
  }

  /**
   * تحديث قوائم الحسابات في الصفحات الأخرى
   */
  function refreshAccountSelects() {
    const accounts = DB.getAccounts();
    const selects = ['statement-account', 'filter-account'];
    selects.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = `<option value="">-- الكل --</option>`;
      if (id === 'statement-account') sel.innerHTML = `<option value="">-- اختر حساباً --</option>`;
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
   * مسح الحقول
   */
  function clearForm() {
    ['acc-name', 'acc-phone', 'acc-notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const typeEl = document.getElementById('acc-type');
    if (typeEl) typeEl.value = 'عميل';
  }

  /**
   * الحصول على قائمة الحسابات (للاستخدام من وحدات أخرى)
   */
  function getList() {
    return DB.getAccounts();
  }

  return { init, render, openEdit, confirmDelete, getList, calcBalance, refreshAccountSelects };
})();
