/**
 * settings.js - وحدة الإعدادات
 */

const Settings = (() => {
  /**
   * تهيئة الوحدة
   */
  function init() {
    document.getElementById('btn-save-company').addEventListener('click', saveCompany);
    document.getElementById('btn-save-appearance').addEventListener('click', saveAppearance);
    document.getElementById('btn-save-supabase').addEventListener('click', saveSupabase);
    document.getElementById('btn-test-supabase').addEventListener('click', testSupabase);
    document.getElementById('btn-sync-from-supabase').addEventListener('click', syncFromSupabase);
    document.getElementById('btn-push-to-supabase').addEventListener('click', pushToSupabase);
    document.getElementById('btn-save-user').addEventListener('click', saveUser);
    document.getElementById('btn-add-currency').addEventListener('click', addCurrency);
    document.getElementById('btn-backup').addEventListener('click', backup);
    document.getElementById('btn-restore').addEventListener('click', () => {
      document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', restore);

    loadSettings();
  }

  /**
   * تحميل الإعدادات الحالية في الحقول
   */
  function loadSettings() {
    const s = Storage.get('settings') || {};

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

    setVal('setting-company-name',  s.companyName  || '');
    setVal('setting-address',       s.address      || '');
    setVal('setting-phone',         s.phone        || '');
    setVal('setting-primary-color', s.primaryColor || '#2c3e50');
    setVal('setting-secondary-color', s.secondaryColor || '#3498db');
    setVal('setting-font',          s.font         || 'Amiri');
    setVal('setting-theme',         s.theme        || 'light');
    setVal('setting-supabase-url',  s.supabaseUrl  || '');
    setVal('setting-supabase-key',  s.supabaseAnonKey || '');
    setVal('setting-username',      (s.user || {}).username || 'admin');

    renderCurrencies(s.currencies || ['USD', 'TRY', 'SYP']);

    // عرض آخر مزامنة
    const lastSync = Storage.get('lastSync');
    const resultEl = document.getElementById('supabase-test-result');
    if (lastSync && resultEl) {
      resultEl.className = 'api-test-result success';
      resultEl.textContent = `✅ آخر مزامنة: ${lastSync.replace('T', ' ').slice(0, 19)}`;
    }
  }

  /**
   * حفظ إعدادات الشركة
   */
  function saveCompany() {
    const s = Storage.get('settings') || {};
    s.companyName = document.getElementById('setting-company-name').value.trim() || 'نظام المحاسبة';
    s.address = document.getElementById('setting-address').value.trim();
    s.phone = document.getElementById('setting-phone').value.trim();
    Storage.set('settings', s);

    // تحديث أسماء الشركة في الواجهة
    ['sidebar-company-name', 'login-company-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = s.companyName;
    });

    UI.toast('تم حفظ إعدادات الشركة', 'success');
  }

  /**
   * حفظ إعدادات المظهر
   */
  function saveAppearance() {
    const s = Storage.get('settings') || {};
    s.primaryColor = document.getElementById('setting-primary-color').value;
    s.secondaryColor = document.getElementById('setting-secondary-color').value;
    s.font = document.getElementById('setting-font').value;
    s.theme = document.getElementById('setting-theme').value;
    Storage.set('settings', s);
    applyTheme(s);
    UI.toast('تم تطبيق المظهر', 'success');
  }

  /**
   * تطبيق الثيم
   */
  function applyTheme(s) {
    const root = document.documentElement;
    if (s.primaryColor) root.style.setProperty('--primary', s.primaryColor);
    if (s.secondaryColor) root.style.setProperty('--secondary', s.secondaryColor);
    if (s.font) {
      root.style.setProperty('--font-main', `'${s.font}', serif`);
      document.body.style.fontFamily = `'${s.font}', serif`;
    }
    if (s.theme) document.documentElement.setAttribute('data-theme', s.theme);
  }

  /**
   * حفظ إعدادات Supabase
   */
  function saveSupabase() {
    const url = document.getElementById('setting-supabase-url').value.trim();
    const key = document.getElementById('setting-supabase-key').value.trim();
    if (!url || !key) { UI.toast('أدخل URL و Anon Key', 'warning'); return; }

    const s = Storage.get('settings') || {};
    s.supabaseUrl     = url;
    s.supabaseAnonKey = key;
    Storage.set('settings', s);
    SupaDB.setConfig(url, key);
    UI.toast('تم حفظ إعدادات Supabase', 'success');
  }

  /**
   * اختبار الاتصال بـ Supabase
   */
  async function testSupabase() {
    saveSupabase();
    const resultEl = document.getElementById('supabase-test-result');
    resultEl.className = 'api-test-result';
    resultEl.textContent = '🔄 جارٍ الاختبار...';
    resultEl.style.display = 'block';

    try {
      const r = await SupaDB.testConnection();
      resultEl.className = 'api-test-result success';
      resultEl.textContent = r.message;
    } catch (err) {
      resultEl.className = 'api-test-result error';
      resultEl.textContent = `❌ ${err.message}`;
    }
  }

  /**
   * سحب البيانات من Supabase → محلي
   */
  async function syncFromSupabase() {
    saveSupabase();
    UI.loading(true);
    try {
      const r = await DB.syncFromSupabase();
      UI.loading(false);
      UI.toast(`✅ تم سحب ${r.txCount} عملية و ${r.accCount} حساب من Supabase`, 'success');
      // تحديث الواجهة
      Dashboard.refresh();
      Accounts.render();
      Transactions.render();
    } catch (err) {
      UI.loading(false);
      UI.toast(`❌ فشل السحب: ${err.message}`, 'error');
    }
  }

  /**
   * رفع البيانات المحلية → Supabase
   */
  async function pushToSupabase() {
    saveSupabase();
    UI.loading(true);
    try {
      await DB.pushUnsyncedToSupabase();
      UI.loading(false);
      UI.toast('✅ تم رفع البيانات إلى Supabase', 'success');
    } catch (err) {
      UI.loading(false);
      UI.toast(`❌ فشل الرفع: ${err.message}`, 'error');
    }
  }

  /**
   * حفظ إعدادات المستخدم
   */
  function saveUser() {
    const username = document.getElementById('setting-username').value.trim();
    const newPass = document.getElementById('setting-new-password').value;
    const confirmPass = document.getElementById('setting-confirm-password').value;

    if (!username) { UI.toast('اسم المستخدم مطلوب', 'warning'); return; }
    if (newPass && newPass !== confirmPass) {
      UI.toast('كلمتا المرور غير متطابقتين', 'error');
      return;
    }

    Auth.updateUser(username, newPass || null, username);
    document.getElementById('setting-new-password').value = '';
    document.getElementById('setting-confirm-password').value = '';
    document.getElementById('sidebar-user-name').textContent = username;
    UI.toast('تم تحديث بيانات المستخدم', 'success');
  }

  /**
   * رسم قائمة العملات
   */
  function renderCurrencies(currencies) {
    const container = document.getElementById('currencies-list');
    if (!container) return;
    container.innerHTML = `<div class="currencies-list">` + currencies.map(c => `
      <div class="currency-item">
        <span class="fw-bold">${escHtml(c)}</span>
        <button class="btn btn-sm btn-danger" onclick="Settings.removeCurrency('${escHtml(c)}')" title="حذف">✕</button>
      </div>
    `).join('') + '</div>';
  }

  /**
   * إضافة عملة جديدة
   */
  function addCurrency() {
    const code = document.getElementById('new-currency-code').value.trim().toUpperCase();
    if (!code || code.length < 2) {
      UI.toast('يرجى إدخال رمز عملة صحيح (2-5 أحرف)', 'warning');
      return;
    }

    const s = Storage.get('settings') || {};
    s.currencies = s.currencies || ['USD', 'TRY', 'SYP'];

    if (s.currencies.includes(code)) {
      UI.toast('هذه العملة موجودة بالفعل', 'warning');
      return;
    }

    s.currencies.push(code);
    Storage.set('settings', s);

    // إضافة للقوائم المنسدلة
    ['tx-currency1', 'tx-currency2', 'cashbox-currency-filter'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = code;
      sel.appendChild(opt);
    });

    renderCurrencies(s.currencies);
    document.getElementById('new-currency-code').value = '';
    document.getElementById('new-currency-name').value = '';
    UI.toast(`تمت إضافة العملة ${code}`, 'success');
  }

  /**
   * حذف عملة
   */
  function removeCurrency(code) {
    if (['USD', 'TRY', 'SYP'].includes(code)) {
      UI.toast('لا يمكن حذف العملات الأساسية', 'warning');
      return;
    }
    const s = Storage.get('settings') || {};
    s.currencies = (s.currencies || []).filter(c => c !== code);
    Storage.set('settings', s);
    renderCurrencies(s.currencies);
    UI.toast(`تم حذف العملة ${code}`, 'success');
  }

  /**
   * تصدير نسخة احتياطية
   */
  function backup() {
    const data = DB.exportAll();
    const json = JSON.stringify(data, null, 2);
    const date = new Date().toISOString().split('T')[0];
    downloadFile(json, `accounting-backup-${date}.json`, 'application/json');
    UI.toast('تم تصدير النسخة الاحتياطية', 'success');
  }

  /**
   * استيراد نسخة احتياطية
   */
  function restore(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.version) throw new Error('ملف غير صحيح');
        UI.confirm('سيتم استبدال جميع البيانات الحالية. هل أنت متأكد؟', () => {
          DB.importAll(data);
          UI.toast('تم استيراد البيانات بنجاح - سيتم إعادة تحميل الصفحة', 'success');
          setTimeout(() => location.reload(), 2000);
        });
      } catch { UI.toast('الملف غير صحيح أو تالف', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return { init, loadSettings, applyTheme, addCurrency, removeCurrency };
})();
