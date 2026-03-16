/**
 * supabase.js - وحدة قاعدة بيانات Supabase
 * نظام المحاسبة الاحترافي
 * 
 * يستخدم Supabase REST API مباشرة عبر fetch (بدون npm)
 * CDN: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
 * 
 * ===== إعداد Supabase =====
 * 1. سجّل دخولك على https://supabase.com
 * 2. أنشئ مشروعاً جديداً
 * 3. من Dashboard > Settings > API، انسخ:
 *    - Project URL  (مثال: https://xxxx.supabase.co)
 *    - anon/public key
 * 4. ضعهما في إعدادات التطبيق (الإعدادات > Supabase)
 * 5. نفّذ SQL التهيئة من قسم SQL Editor
 */

const SupaDB = (() => {
  let _url    = '';   // https://dbzcuqtobuxtvirrcerz.supabase.co
  let _anonKey = '';  // sb_publishable_4YS1GjIl1k9dlzwbgAnMGQ_gm_mdtbU

  // ===== CONFIG =====
  function init() {
    const s = Storage.get('settings') || {};
    _url     = (s.supabaseUrl     || '').replace(/\/$/, '');
    _anonKey =  s.supabaseAnonKey || '';
  }

  function setConfig(url, anonKey) {
    _url     = url.replace(/\/$/, '');
    _anonKey = anonKey;
  }

  function isConfigured() {
    return !!(_url && _anonKey);
  }

  // ===== HEADERS =====
  function headers(extra = {}) {
    return {
      'Content-Type':  'application/json',
      'apikey':         _anonKey,
      'Authorization': `Bearer ${_anonKey}`,
      'Prefer':        'return=representation',
      ...extra
    };
  }

  // ===== GENERIC REST =====
  async function rest(method, table, params = {}, body = null) {
    if (!isConfigured()) throw new Error('Supabase غير مهيأ. أضف URL و Anon Key من الإعدادات.');

    let endpoint = `${_url}/rest/v1/${table}`;
    const qs = new URLSearchParams();

    // Build query string from params
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
      try { const e = await res.json(); errMsg = e.message || e.error || errMsg; } catch {}
      throw new Error(errMsg);
    }

    if (res.status === 204) return null;
    return await res.json();
  }

  // ===== TEST =====
  async function testConnection() {
    // بسيط: نسأل عن عدد الصفوف في جدول accounts
    const res = await rest('GET', 'accounts', {
      select: 'id',
      limit:  '1'
    });
    return { ok: true, message: 'الاتصال بـ Supabase ناجح ✅' };
  }

  // ====================================================
  // TRANSACTIONS
  // ====================================================
  async function addTransaction(tx) {
    const row = _txToRow(tx);
    const data = await rest('POST', 'transactions', {}, row);
    return data && data[0] ? data[0] : { id: row.id };
  }

  async function getTransactions({ type, accountId, dateFrom, dateTo } = {}) {
    const params = {
      select: '*',
      order:  'date.desc,created_at.desc',
      limit:  '2000'
    };
    if (type)      params['type'] = `eq.${type}`;
    if (accountId) params['account_id'] = `eq.${accountId}`;
    if (dateFrom)  params['date'] = (params['date'] ? params['date'] + ',' : '') + `gte.${dateFrom}`;
    if (dateTo)    params['date'] = (params['date'] ? params['date'] + ',' : '') + `lte.${dateTo}`;

    const data = await rest('GET', 'transactions', params);
    return (data || []).map(_rowToTx);
  }

  async function getTransactionById(id) {
    const data = await rest('GET', 'transactions', { select: '*', id: `eq.${id}`, limit: '1' });
    return data && data[0] ? _rowToTx(data[0]) : null;
  }

  async function updateTransaction(id, tx) {
    const row = _txToRow(tx);
    delete row.id;
    delete row.created_at;
    row.updated_at = new Date().toISOString();
    await rest('PATCH', 'transactions', { id: `eq.${id}` }, row);
    return { ok: true };
  }

  async function deleteTransaction(id) {
    await rest('DELETE', 'transactions', { id: `eq.${id}` });
    return { ok: true };
  }

  // ====================================================
  // ACCOUNTS
  // ====================================================
  async function addAccount(acc) {
    const row = _accToRow(acc);
    const data = await rest('POST', 'accounts', {}, row);
    return data && data[0] ? data[0] : { id: row.id };
  }

  async function getAccounts() {
    const data = await rest('GET', 'accounts', { select: '*', order: 'name.asc' });
    return (data || []).map(_rowToAcc);
  }

  async function getAccountById(id) {
    const data = await rest('GET', 'accounts', { select: '*', id: `eq.${id}`, limit: '1' });
    return data && data[0] ? _rowToAcc(data[0]) : null;
  }

  async function updateAccount(id, acc) {
    const row = _accToRow(acc);
    delete row.id;
    delete row.created_at;
    await rest('PATCH', 'accounts', { id: `eq.${id}` }, row);
    return { ok: true };
  }

  async function deleteAccount(id) {
    await rest('DELETE', 'accounts', { id: `eq.${id}` });
    return { ok: true };
  }

  // ====================================================
  // STATEMENT
  // ====================================================
  async function getStatement(accountId, dateFrom, dateTo) {
    const txs = await getTransactions({ accountId, dateFrom, dateTo });
    let totalSales = 0, totalPayments = 0;
    txs.forEach(tx => {
      const amt = parseFloat(tx.amount1) || 0;
      if (tx.type === 'بيع')  totalSales    += amt;
      if (tx.type === 'دفعة') totalPayments += amt;
    });
    return { transactions: txs, totalSales, totalPayments, balance: totalSales - totalPayments };
  }

  // ====================================================
  // FIELD MAPPERS (camelCase JS ↔ snake_case DB)
  // ====================================================
  function _txToRow(tx) {
    return {
      id:             tx.id || _genId(),
      type:           tx.type           || '',
      payment_method: tx.paymentMethod  || '',
      account_id:     tx.accountId      || '',
      account_name:   tx.accountName    || '',
      date:           tx.date           || '',
      fuel_type:      tx.fuelType       || '',
      weight:         parseFloat(tx.weight)      || 0,
      density:        parseFloat(tx.density)     || 0,
      barrels:        parseFloat(tx.barrels)     || 0,
      barrel_price:   parseFloat(tx.barrelPrice) || 0,
      amount1:        parseFloat(tx.amount1)     || 0,
      currency1:      tx.currency1      || 'USD',
      amount2:        parseFloat(tx.amount2)     || 0,
      currency2:      tx.currency2      || '',
      total_usd:      parseFloat(tx.totalUSD)    || parseFloat(tx.amount1) || 0,
      notes:          tx.notes          || '',
      created_at:     tx.createdAt      || new Date().toISOString(),
      updated_at:     new Date().toISOString()
    };
  }

  function _rowToTx(row) {
    return {
      id:            row.id,
      type:          row.type,
      paymentMethod: row.payment_method,
      accountId:     row.account_id,
      accountName:   row.account_name,
      date:          row.date,
      fuelType:      row.fuel_type,
      weight:        row.weight,
      density:       row.density,
      barrels:       row.barrels,
      barrelPrice:   row.barrel_price,
      amount1:       row.amount1,
      currency1:     row.currency1,
      amount2:       row.amount2,
      currency2:     row.currency2,
      totalUSD:      row.total_usd,
      notes:         row.notes,
      createdAt:     row.created_at,
      updatedAt:     row.updated_at
    };
  }

  function _accToRow(acc) {
    return {
      id:         acc.id || _genId(),
      name:       acc.name    || '',
      type:       acc.type    || 'عميل',
      phone:      acc.phone   || '',
      notes:      acc.notes   || '',
      created_at: acc.createdAt || new Date().toISOString()
    };
  }

  function _rowToAcc(row) {
    return {
      id:        row.id,
      name:      row.name,
      type:      row.type,
      phone:     row.phone,
      notes:     row.notes,
      createdAt: row.created_at
    };
  }

  function _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    init, setConfig, isConfigured, testConnection,
    addTransaction, getTransactions, getTransactionById,
    updateTransaction, deleteTransaction,
    addAccount, getAccounts, getAccountById,
    updateAccount, deleteAccount,
    getStatement
  };
})();

// ====================================================
// SQL SCHEMA - انسخ وشغّل في Supabase SQL Editor
// ====================================================
/*

-- ===== TRANSACTIONS TABLE =====
CREATE TABLE IF NOT EXISTS public.transactions (
  id             TEXT PRIMARY KEY,
  type           TEXT NOT NULL,
  payment_method TEXT,
  account_id     TEXT,
  account_name   TEXT,
  date           DATE,
  fuel_type      TEXT,
  weight         NUMERIC(18,4) DEFAULT 0,
  density        NUMERIC(18,6) DEFAULT 0,
  barrels        NUMERIC(18,4) DEFAULT 0,
  barrel_price   NUMERIC(18,2) DEFAULT 0,
  amount1        NUMERIC(18,2) DEFAULT 0,
  currency1      TEXT DEFAULT 'USD',
  amount2        NUMERIC(18,2) DEFAULT 0,
  currency2      TEXT DEFAULT '',
  total_usd      NUMERIC(18,2) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ACCOUNTS TABLE =====
CREATE TABLE IF NOT EXISTS public.accounts (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT DEFAULT 'عميل',
  phone      TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ROW LEVEL SECURITY (اختياري - للحماية) =====
-- تفعيل RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts     ENABLE ROW LEVEL SECURITY;

-- سياسة: السماح بكل العمليات للـ anon key (للبساطة)
-- يمكن تقييده لاحقاً بالمستخدمين المسجلين
CREATE POLICY "allow_all_transactions" ON public.transactions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_accounts" ON public.accounts
  FOR ALL USING (true) WITH CHECK (true);

-- ===== INDEXES للأداء =====
CREATE INDEX IF NOT EXISTS idx_transactions_date       ON public.transactions (date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type       ON public.transactions (type);
CREATE INDEX IF NOT EXISTS idx_accounts_name           ON public.accounts (name);

*/
