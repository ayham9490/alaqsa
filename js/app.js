/**
 * app.js - الملف الرئيسي للتطبيق
 * يُهيئ جميع الوحدات ويتحكم في التنقل بين الصفحات
 */

// ===== UI HELPERS =====
const UI = (() => {
  // Bootstrap modal instances cache
  const _bsModals = {};

  /**
   * فتح نافذة Bootstrap منبثقة
   */
  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!_bsModals[id]) _bsModals[id] = new bootstrap.Modal(el);
    _bsModals[id].show();
  }

  /**
   * إغلاق نافذة Bootstrap منبثقة
   */
  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const instance = bootstrap.Modal.getInstance(el);
    if (instance) instance.hide();
  }

  /**
   * عرض رسالة SweetAlert2 Toast
   */
  function toast(message, type = 'info') {
    const iconMap = { success: 'success', error: 'error', warning: 'warning', info: 'info' };
    if (window.Swal) {
      Swal.mixin({
        toast: true,
        position: 'bottom-start',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        customClass: { popup: 'colored-toast' }
      }).fire({
        icon: iconMap[type] || 'info',
        title: message
      });
    }
  }

  /**
   * نافذة تأكيد بـ SweetAlert2
   */
  function confirm(message, onConfirm) {
    if (window.Swal) {
      Swal.fire({
        title: 'تأكيد',
        text: message,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#e74c3c',
        cancelButtonColor: '#7f8c8d',
        confirmButtonText: 'حذف',
        cancelButtonText: 'إلغاء',
        reverseButtons: true,
        customClass: { popup: 'swal-rtl' }
      }).then(result => {
        if (result.isConfirmed) onConfirm();
      });
    } else {
      // Fallback to Bootstrap modal
      document.getElementById('confirm-message').textContent = message;
      openModal('modal-confirm');
      const btn = document.getElementById('btn-confirm-delete');
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        closeModal('modal-confirm');
        onConfirm();
      });
    }
  }

  /**
   * إظهار/إخفاء شاشة التحميل
   */
  function loading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('active', show);
  }

  return { openModal, closeModal, toast, confirm, loading };
})();

// ===== UTILITY FUNCTIONS =====

/**
 * تنسيق الأرقام
 */
function formatNum(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return parseFloat(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * تنسيق التاريخ - أرقام إنجليزية
 */
function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    // YYYY-MM-DD بالأرقام الإنجليزية
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch { return dateStr; }
}

/**
 * اليوم بصيغة YYYY-MM-DD
 */
function todayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * تهروب HTML
 */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * تنزيل ملف
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== DASHBOARD =====
const Dashboard = (() => {
  function refresh() {
    const txs = DB.getTransactions();
    let sales = 0, purchases = 0, payments = 0, expenses = 0;

    txs.forEach(tx => {
      const amt = parseFloat(tx.amount1) || 0;
      if (tx.type === 'بيع') sales += amt;
      else if (tx.type === 'شراء') purchases += amt;
      else if (tx.type === 'دفعة') payments += amt;
      else if (tx.type === 'مصاريف') expenses += amt;
    });

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = formatNum(val);
    };

    setEl('dash-sales', sales);
    setEl('dash-purchases', purchases);
    setEl('dash-payments', payments);
    setEl('dash-expenses', expenses);

    // آخر 5 عمليات
    const recent = txs.slice(0, 5);
    const tbody = document.getElementById('dash-recent-body');
    if (tbody) {
      if (!recent.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">لا توجد عمليات بعد</td></tr>';
      } else {
        tbody.innerHTML = recent.map(tx => {
          const acc = DB.getAccountById(tx.accountId);
          return `<tr>
            <td><span class="type-badge type-${tx.type}">${tx.type}</span></td>
            <td>${escHtml(acc ? acc.name : (tx.accountName || '-'))}</td>
            <td>${formatNum(tx.amount1)} ${escHtml(tx.currency1 || 'USD')}</td>
            <td>${formatDate(tx.date)}</td>
          </tr>`;
        }).join('');
      }
    }

    // أرصدة الصندوق
    const balances = DB.getCashboxBalance();
    ['USD', 'TRY', 'SYP'].forEach(c => {
      const el = document.getElementById(`dash-${c.toLowerCase()}`);
      if (el) el.textContent = formatNum(balances[c] || 0);
    });
  }

  return { refresh };
})();

// ===== MAIN APP =====
const App = (() => {
  /**
   * تهيئة التطبيق بعد تسجيل الدخول
   */
  function init(user) {
    // تحديث اسم المستخدم
    const userNameEl = document.getElementById('sidebar-user-name');
    if (userNameEl) userNameEl.textContent = user.name || user.username;

    // تحديث اسم الشركة
    const settings = Storage.get('settings') || {};
    const companyName = settings.companyName || 'نظام المحاسبة';
    ['sidebar-company-name', 'login-company-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = companyName;
    });

    // تطبيق الثيم
    Settings.applyTheme(settings);

    // تهيئة الوحدات
    API.init();          // يُهيّئ Supabase أيضاً تلقائياً
    SupaDB.init();       // تأكيد تهيئة Supabase
    Accounts.init();
    Transactions.init();
    Statement.init();
    Cashbox.init();
    Reports.init();
    Settings.init();

    // تحديث الداشبورد
    Dashboard.refresh();

    // تهيئة التنقل
    initNavigation();

    // تهيئة المودالات
    initModals();

    // تحديث التاريخ
    updateDate();
    setInterval(updateDate, 60000);

    // عرض الصفحة الرئيسية
    navigateTo('dashboard');

    // تسجيل Service Worker
    registerSW();

    // PWA Install Banner
    initPWAInstall();

    // مزامنة Supabase في الخلفية
    setTimeout(() => {
      if (DB.checkSync()) {
        DB.processQueue().catch(() => {});    // إرسال ما تأخّر
        DB.pushUnsyncedToSupabase().catch(() => {}); // رفع المحلي الغير مزامن
      }
    }, 2000);
  }

  /**
   * تهيئة التنقل
   */
  function initNavigation() {
    // روابط الـ sidebar (a[data-page])
    document.querySelectorAll('.sidebar a[data-page]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(item.dataset.page);
        if (window.innerWidth <= 768) closeSidebar();
      });
    });

    // أزرار data-page في الصفحات
    document.querySelectorAll('button[data-page]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.page));
    });

    // Sidebar toggle (hamburger)
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);

    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // زر الخروج
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  }

  /**
   * التنقل إلى صفحة
   */
  function navigateTo(pageId) {
    // إخفاء جميع الصفحات (Bootstrap style: display:none)
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
      p.style.display = 'none';
    });
    // إزالة التفعيل من روابط الـ sidebar
    document.querySelectorAll('.sidebar a[data-page]').forEach(n => n.classList.remove('active'));

    // إظهار الصفحة المطلوبة
    const page = document.getElementById(`page-${pageId}`);
    if (page) { page.classList.add('active'); page.style.display = 'block'; }

    // تفعيل رابط الـ sidebar
    const navItem = document.querySelector(`.sidebar a[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');

    // تحديث عنوان الصفحة
    const titles = {
      dashboard: 'الرئيسية',
      transactions: 'إدارة العمليات',
      accounts: 'الحسابات',
      statement: 'كشف الحساب',
      cashbox: 'الصندوق',
      reports: 'التقارير',
      settings: 'الإعدادات'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[pageId] || pageId;

    // تحديث عند التنقل
    if (pageId === 'dashboard') Dashboard.refresh();
    if (pageId === 'cashbox') Cashbox.refresh();
    if (pageId === 'accounts') Accounts.render();
    if (pageId === 'transactions') Transactions.render();
    if (pageId === 'statement') {
      Statement.populateAccountSelect();
      Accounts.refreshAccountSelects();
    }
    if (pageId === 'reports') Reports.generate();
    if (pageId === 'settings') Settings.loadSettings();
  }

  /**
   * الانتقال إلى كشف حساب معين
   */
  function goToStatement(accountId) {
    navigateTo('statement');
    setTimeout(() => Statement.goToAccount(accountId), 100);
  }

  /**
   * تهيئة المودالات - Bootstrap يتولى الإغلاق تلقائياً عبر data-bs-dismiss
   * نضيف هنا فقط تهيئة زر الحذف الاحتياطي
   */
  function initModals() {
    // Bootstrap modals - يُغلق تلقائياً عبر data-bs-dismiss="modal"
    // لا حاجة لـ ESC handler، Bootstrap يتعامل معها
  }

  /**
   * Toggle Sidebar
   */
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }

  /**
   * تحديث التاريخ - أرقام إنجليزية
   */
  function updateDate() {
    const el = document.getElementById('current-date');
    if (el) {
      const now = new Date();
      const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      const months = ['1','2','3','4','5','6','7','8','9','10','11','12'];
      el.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }
  }

  /**
   * تسجيل الخروج
   */
  function logout() {
    Auth.logout();
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  }

  /**
   * تسجيل Service Worker
   */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js')
        .then(() => console.log('SW registered'))
        .catch(e => console.warn('SW error:', e));
    }
  }

  /**
   * PWA Install
   */
  function initPWAInstall() {
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallBanner(deferredPrompt);
    });
  }

  function showInstallBanner(prompt) {
    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
      <span>📲 ثبّت التطبيق على جهازك</span>
      <button id="btn-install">تثبيت</button>
      <button onclick="this.parentElement.remove()" style="background:transparent;border:none;color:#fff;cursor:pointer;font-size:1.2rem;">✕</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('btn-install').addEventListener('click', async () => {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') banner.remove();
    });
    setTimeout(() => { if (banner.parentElement) banner.remove(); }, 10000);
  }

  return { init, navigateTo, goToStatement };
})();

// ===== BOOTSTRAP =====
document.addEventListener('DOMContentLoaded', () => {
  // التحقق من جلسة نشطة
  const session = Auth.getSession();
  if (session) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').style.display = 'block';
    App.init(session);
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-screen').classList.add('active');
    Auth.initLoginScreen();
  }
});
