/**
 * api.js - وحدة قاعدة البيانات الموحّدة
 * 
 * طبقة ذكية تجمع:
 * 1. LocalStorage  → يعمل دائماً (Offline-first)
 * 2. Supabase      → مزامنة تلقائية عند توفر الإنترنت والإعداد
 * 
 * المبدأ: اكتب محلياً أولاً، ثم زامن مع Supabase في الخلفية.
 */

// ===== GOOGLE APPS SCRIPT API (Legacy) =====
const API = (() => {
  let _baseUrl = '';
  let _sheetId = '';

  function init() {
    const settings = Storage.get('settings') || {};
    _baseUrl = settings.apiUrl || '';
    _sheetId = settings.sheetId || '';
    // تهيئة Supabase أيضاً
    SupaDB.init();
  }

  function setConfig(url, sheetId) {
    _baseUrl = url;
    _sheetId = sheetId;
  }

  async function testConnection() {
    if (!_baseUrl) throw new Error('لم يتم إعداد رابط API');
    const url = new URL(_baseUrl);
    url.searchParams.set('action', 'test');
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  return { init, setConfig, testConnection };
})();

/**
 * Storage - التخزين المحلي
 */
const Storage = (() => {
  const PREFIX = 'accsys_';
  function get(key) {
    try { const r = localStorage.getItem(PREFIX + key); return r ? JSON.parse(r) : null; }
    catch { return null; }
  }
  function set(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
  function remove(key) { localStorage.removeItem(PREFIX + key); }
  function getAll() {
    const data = {};
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX))
      .forEach(k => {
        try { data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)); }
        catch { data[k.slice(PREFIX.length)] = localStorage.getItem(k); }
      });
    return data;
  }
  return { get, set, remove, getAll };
})();

/**
 * DB - قاعدة البيانات الموحّدة (LocalStorage + Supabase sync)
 */
const DB = (() => {

  // ===== SYNC STATUS =====
  let _syncEnabled = false;

  function checkSync() {
    _syncEnabled = SupaDB.isConfigured();
    return _syncEnabled;
  }

  // ===== HELPERS =====
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ====================================================
  // LOCAL STORAGE LAYER
  // ====================================================
  function _getLocalTxs() { return Storage.get('transactions') || []; }
  function _saveTxs(txs)  { Storage.set('transactions', txs); }
  function _getLocalAccs(){ return Storage.get('accounts')     || []; }
  function _saveAccs(accs){ Storage.set('accounts', accs); }

  // ====================================================
  // TRANSACTIONS
  // ====================================================

  /**
   * إضافة عملية - محلياً فوراً، Supabase في الخلفية
   */
  function addTransaction(tx) {
    const txs = _getLocalTxs();
    const newTx = {
      ...tx,
      id:        generateId(),
      createdAt: new Date().toISOString(),
      synced:    false
    };
    txs.unshift(newTx);
    _saveTxs(txs);

    // مزامنة Supabase في الخلفية
    if (checkSync()) {
      SupaDB.addTransaction(newTx)
        .then(() => {
          newTx.synced = true;
          _markSynced('transactions', newTx.id);
          _updateSyncStatus(true);
        })
        .catch(err => {
          console.warn('[Supabase] addTransaction failed:', err.message);
          _addToQueue('add', 'transactions', newTx);
        });
    }
    return newTx;
  }

  /**
   * تحديث عملية
   */
  function updateTransaction(id, updates) {
    const txs = _getLocalTxs();
    const idx = txs.findIndex(t => t.id === id);
    if (idx === -1) return null;
    txs[idx] = { ...txs[idx], ...updates, updatedAt: new Date().toISOString(), synced: false };
    _saveTxs(txs);

    if (checkSync()) {
      SupaDB.updateTransaction(id, txs[idx])
        .then(() => _markSynced('transactions', id))
        .catch(err => _addToQueue('update', 'transactions', { id, data: updates }));
    }
    return txs[idx];
  }

  /**
   * حذف عملية
   */
  function deleteTransaction(id) {
    const txs = _getLocalTxs().filter(t => t.id !== id);
    _saveTxs(txs);

    if (checkSync()) {
      SupaDB.deleteTransaction(id)
        .catch(err => _addToQueue('delete', 'transactions', { id }));
    }
  }

  function getTransactionById(id) {
    return _getLocalTxs().find(t => t.id === id) || null;
  }

  function getTransactions() {
    return _getLocalTxs();
  }

  function filterTransactions({ type, accountId, dateFrom, dateTo } = {}) {
    let txs = _getLocalTxs();
    if (type)      txs = txs.filter(t => t.type      === type);
    if (accountId) txs = txs.filter(t => t.accountId === accountId);
    if (dateFrom)  txs = txs.filter(t => t.date      >= dateFrom);
    if (dateTo)    txs = txs.filter(t => t.date      <= dateTo);
    return txs;
  }

  // ====================================================
  // ACCOUNTS
  // ====================================================

  function addAccount(acc) {
    const accs = _getLocalAccs();
    const newAcc = { ...acc, id: generateId(), createdAt: new Date().toISOString() };
    accs.push(newAcc);
    _saveAccs(accs);

    if (checkSync()) {
      SupaDB.addAccount(newAcc)
        .then(() => _updateSyncStatus(true))
        .catch(err => _addToQueue('add', 'accounts', newAcc));
    }
    return newAcc;
  }

  function updateAccount(id, updates) {
    const accs = _getLocalAccs();
    const idx  = accs.findIndex(a => a.id === id);
    if (idx === -1) return null;
    accs[idx] = { ...accs[idx], ...updates };
    _saveAccs(accs);

    if (checkSync()) {
      SupaDB.updateAccount(id, accs[idx])
        .catch(err => _addToQueue('update', 'accounts', { id, data: updates }));
    }
    return accs[idx];
  }

  function deleteAccount(id) {
    _saveAccs(_getLocalAccs().filter(a => a.id !== id));
    if (checkSync()) {
      SupaDB.deleteAccount(id)
        .catch(err => _addToQueue('delete', 'accounts', { id }));
    }
  }

  function getAccountById(id) {
    return _getLocalAccs().find(a => a.id === id) || null;
  }

  function getAccounts() { return _getLocalAccs(); }

  // ====================================================
  // STATEMENT & CASHBOX
  // ====================================================

  function getStatement(accountId, dateFrom, dateTo) {
    const txs = filterTransactions({ accountId, dateFrom: dateFrom || null, dateTo: dateTo || null });
    let totalSales = 0, totalPayments = 0;
    txs.forEach(tx => {
      const amt = parseFloat(tx.amount1) || 0;
      if (tx.type === 'بيع')  totalSales    += amt;
      if (tx.type === 'دفعة') totalPayments += amt;
    });
    return { transactions: txs, totalSales, totalPayments, balance: totalSales - totalPayments };
  }

  function getCashboxBalance() {
    const txs = _getLocalTxs();
    const settings = Storage.get('settings') || {};
    const currencies = settings.currencies || ['USD', 'TRY', 'SYP'];
    const balances = {};
    currencies.forEach(c => { balances[c] = 0; });

    txs.forEach(tx => {
      if (tx.paymentMethod === 'آجل') return; // الآجل لا يؤثر على الصندوق

      const process = (amt, curr, isInflow) => {
        if (!amt || !curr) return;
        if (!(curr in balances)) balances[curr] = 0;
        const sign = isInflow ? 1 : -1;
        balances[curr] += sign * (parseFloat(amt) || 0);
      };

      const inflow = tx.type === 'بيع';
      const outflow = tx.type === 'دفعة' || tx.type === 'مصاريف' || tx.type === 'شراء';

      if (inflow)  { process(tx.amount1, tx.currency1, true);  process(tx.amount2, tx.currency2, true); }
      if (outflow) { process(tx.amount1, tx.currency1, false); process(tx.amount2, tx.currency2, false); }
    });

    return balances;
  }

  // ====================================================
  // SUPABASE FULL SYNC (سحب من السحابة → محلي)
  // ====================================================

  /**
   * مزامنة كاملة: سحب كل البيانات من Supabase وحفظها محلياً
   */
  async function syncFromSupabase() {
    if (!checkSync()) return { ok: false, reason: 'Supabase غير مهيأ' };

    try {
      _updateSyncStatus('syncing');

      const [txs, accs] = await Promise.all([
        SupaDB.getTransactions(),
        SupaDB.getAccounts()
      ]);

      _saveTxs(txs.map(tx => ({ ...tx, synced: true })));
      _saveAccs(accs.map(acc => ({ ...acc, synced: true })));

      _updateSyncStatus(true);
      Storage.set('lastSync', new Date().toISOString());

      return { ok: true, txCount: txs.length, accCount: accs.length };
    } catch (err) {
      _updateSyncStatus(false);
      throw err;
    }
  }

  /**
   * رفع البيانات المحلية غير المزامنة إلى Supabase
   */
  async function pushUnsyncedToSupabase() {
    if (!checkSync()) return;

    const txs = _getLocalTxs().filter(t => !t.synced);
    const accs = _getLocalAccs().filter(a => !a.synced);

    const promises = [
      ...txs.map(tx => SupaDB.addTransaction(tx)
        .then(() => _markSynced('transactions', tx.id))
        .catch(() => {})),
      ...accs.map(acc => SupaDB.addAccount(acc)
        .then(() => _markSynced('accounts', acc.id))
        .catch(() => {}))
    ];

    await Promise.allSettled(promises);
  }

  // ====================================================
  // OFFLINE QUEUE
  // ====================================================

  function _addToQueue(op, table, data) {
    const queue = Storage.get('syncQueue') || [];
    queue.push({ op, table, data, at: Date.now() });
    Storage.set('syncQueue', queue);
  }

  async function processQueue() {
    if (!checkSync()) return;
    const queue = Storage.get('syncQueue') || [];
    if (!queue.length) return;

    const remaining = [];
    for (const item of queue) {
      try {
        if (item.op === 'add' && item.table === 'transactions') await SupaDB.addTransaction(item.data);
        else if (item.op === 'add' && item.table === 'accounts')  await SupaDB.addAccount(item.data);
        else if (item.op === 'update' && item.table === 'transactions') await SupaDB.updateTransaction(item.data.id, item.data.data);
        else if (item.op === 'update' && item.table === 'accounts')     await SupaDB.updateAccount(item.data.id, item.data.data);
        else if (item.op === 'delete' && item.table === 'transactions') await SupaDB.deleteTransaction(item.data.id);
        else if (item.op === 'delete' && item.table === 'accounts')     await SupaDB.deleteAccount(item.data.id);
      } catch {
        remaining.push(item);
      }
    }
    Storage.set('syncQueue', remaining);
  }

  // ====================================================
  // HELPERS
  // ====================================================

  function _markSynced(table, id) {
    const items = table === 'transactions' ? _getLocalTxs() : _getLocalAccs();
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) {
      items[idx].synced = true;
      table === 'transactions' ? _saveTxs(items) : _saveAccs(items);
    }
  }

  function _updateSyncStatus(state) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    if (state === 'syncing') { el.textContent = '🔄'; el.title = 'جارٍ المزامنة...'; el.style.animation = 'spin 1s linear infinite'; }
    else if (state === true) { el.textContent = '✅'; el.title = 'تمت المزامنة مع Supabase'; el.style.animation = ''; }
    else                     { el.textContent = '⚠️'; el.title = 'تعذّرت المزامنة - يعمل offline'; el.style.animation = ''; }
  }

  // ====================================================
  // BACKUP / RESTORE
  // ====================================================

  function exportAll() {
    return {
      transactions: _getLocalTxs(),
      accounts:     _getLocalAccs(),
      settings:     Storage.get('settings') || {},
      exportedAt:   new Date().toISOString(),
      version:      '2.0'
    };
  }

  function importAll(data) {
    if (data.transactions) _saveTxs(data.transactions);
    if (data.accounts)     _saveAccs(data.accounts);
    if (data.settings)     Storage.set('settings', data.settings);
  }

  return {
    // Transactions
    getTransactions, addTransaction, updateTransaction,
    deleteTransaction, getTransactionById, filterTransactions,
    // Accounts
    getAccounts, addAccount, updateAccount, deleteAccount, getAccountById,
    // Reports
    getStatement, getCashboxBalance,
    // Sync
    syncFromSupabase, pushUnsyncedToSupabase, processQueue, checkSync,
    // Utils
    exportAll, importAll, generateId
  };
})();
