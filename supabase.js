/**
 * supabase.js - النسخة المحدثة بالكامل
 * متوافقة مع App.js + api.js + Service Worker الجديد
 * تعمل كطبقة REST منخفضة المستوى بدون أي تخزين محلي
 */

const SupaDB = (() => {

  // ================================
  // CONFIG
  // ================================
  let _url = '';
  let _anonKey = '';

  function init() {
    const s = Storage.get('settings') || {};
    _url = (s.supabaseUrl || '').replace(/\/$/, '');
    _anonKey = s.supabaseAnonKey || '';
  }

  function setConfig(url, anonKey) {
    _url = url.replace(/\/$/, '');
    _anonKey = anonKey;
  }

  function isConfigured() {
    return !!(_url && _anonKey);
  }

  function isOnline() {
    return navigator.onLine;
  }

  // ================================
  // HEADERS
  // ================================
  function headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      'apikey': _anonKey,
      'Authorization': `Bearer ${_anonKey}`,
      'Prefer': 'return=representation,resolution=merge-duplicates',
      ...extra
    };
  }

  // ================================
  // SAFE CALL WRAPPER
  // ================================
  async function safeCall(fn) {
    if (!isConfigured()) return { ok: false, error: 'Supabase غير مهيأ' };
    if (!isOnline()) return { ok: false, error: 'لا يوجد اتصال بالإنترنت' };

    try {
      const data = await fn();
      return { ok: true, data };
    } catch (e) {
      console.warn('Supabase Error:', e.message);
      return { ok: false, error: e.message };
    }
  }

  // ================================
  // GENERIC REST
  // ================================
  async function rest(method, table, params = {}, body = null) {
    if (!isConfigured()) throw new Error('Supabase غير مهيأ');

    let endpoint = `${_url}/rest/v1/${table}`;
    const qs = new URLSearchParams();

    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') qs.append(k, v);
    });

    const qStr = qs.toString();
    if (qStr) endpoint += '?' + qStr;

    const opts = { method, headers: headers() };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(endpoint, opts);

    if (!res.ok) {
      let errMsg = `HTTP ${res.status}`;
      try {
        const e = await res.json();
        errMsg = e.message || e.error || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    if (res.status === 204) return null;
    return await res.json();
  }

  // ================================
  // TEST CONNECTION
  // ================================
  async function testConnection() {
    return safeCall(async () => {
      await rest('GET', 'accounts', { select: 'id', limit: '1' });
      return 'الاتصال ناجح';
    });
  }

  // ================================
  // TRANSACTIONS
  // ================================
  async function addTransaction(tx) {
    return safeCall(async () => {
      const row = _txToRow(tx);
      const data = await rest('POST', 'transactions', {}, row);
      return data?.[0] || row;
    });
  }

  async function updateTransaction(id, tx) {
    return safeCall(async () => {
      const row = _txToRow(tx);
      delete row.id;
      delete row.created_at;
      row.updated_at = new Date().toISOString();
      await rest('PATCH', 'transactions', { id: `eq.${id}` }, row);
      return true;
    });
  }

  async function deleteTransaction(id) {
    return safeCall(async () => {
      await rest('DELETE', 'transactions', { id: `eq.${id}` });
      return true;
    });
  }

  async function getTransactions(filters = {}) {
    return safeCall(async () => {
      const params = {
        select: '*',
        order: 'date.desc,created_at.desc',
        limit: '2000'
      };

      if (filters.type) params['type'] = `eq.${filters.type}`;
      if (filters.accountId) params['account_id'] = `eq.${filters.accountId}`;
      if (filters.dateFrom) params['date'] = `gte.${filters.dateFrom}`;
      if (filters.dateTo) params['date'] = (params['date'] ? params['date'] + ',' : '') + `lte.${filters.dateTo}`;

      const data = await rest('GET', 'transactions', params);
      return (data || []).map(_rowToTx);
    });
  }

  // ================================
  // ACCOUNTS
  // ================================
  async function addAccount(acc) {
    return safeCall(async () => {
      const row = _accToRow(acc);
      const data = await rest('POST', 'accounts', {}, row);
      return data?.[0] || row;
    });
  }

  async function updateAccount(id, acc) {
    return safeCall(async () => {
      const row = _accToRow(acc);
      delete row.id;
      delete row.created_at;
      await rest('PATCH', 'accounts', { id: `eq.${id}` }, row);
      return true;
    });
  }

  async function deleteAccount(id) {
    return safeCall(async () => {
      await rest('DELETE', 'accounts', { id: `eq.${id}` });
      return true;
    });
  }

  async function getAccounts() {
    return safeCall(async () => {
      const data = await rest('GET', 'accounts', { select: '*', order: 'name.asc' });
      return (data || []).map(_rowToAcc);
    });
  }

  // ================================
  // MAPPERS
  // ================================
  function _txToRow(tx) {
    return {
      id: tx.id || _genId(),
      type: tx.type || '',
      payment_method: tx.paymentMethod || '',
      account_id: tx.accountId || '',
      account_name: tx.accountName || '',
      date: tx.date || '',
      fuel_type: tx.fuelType || '',
      weight: parseFloat(tx.weight) || 0,
      density: parseFloat(tx.density) || 0,
      barrels: parseFloat(tx.barrels) || 0,
      barrel_price: parseFloat(tx.barrelPrice) || 0,
      amount1: parseFloat(tx.amount1) || 0,
      currency1: tx.currency1 || 'USD',
      amount2: parseFloat(tx.amount2) || 0,
      currency2: tx.currency2 || '',
      total_usd: parseFloat(tx.totalUSD) || parseFloat(tx.amount1) || 0,
      notes: tx.notes || '',
      created_at: tx.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  function _rowToTx(row) {
    return {
      id: row.id,
      type: row.type,
      paymentMethod: row.payment_method,
      accountId: row.account_id,
      accountName: row.account_name,
      date: row.date,
      fuelType: row.fuel_type,
      weight: row.weight,
      density: row.density,
      barrels: row.barrels,
      barrelPrice: row.barrel_price,
      amount1: row.amount1,
      currency1: row.currency1,
      amount2: row.amount2,
      currency2: row.currency2,
      totalUSD: row.total_usd,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function _accToRow(acc) {
    return {
      id: acc.id || _genId(),
      name: acc.name || '',
      type: acc.type || 'عميل',
      phone: acc.phone || '',
      notes: acc.notes || '',
      created_at: acc.createdAt || new Date().toISOString()
    };
  }

  function _rowToAcc(row) {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      phone: row.phone,
      notes: row.notes,
      createdAt: row.created_at
    };
  }

  function _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ================================
  // EXPORT
  // ================================
  return {
    init,
    setConfig,
    isConfigured,
    isOnline,
    testConnection,

    addTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactions,

    addAccount,
    updateAccount,
    deleteAccount,
    getAccounts
  };
})();