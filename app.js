/**
 * app.js - النسخة المحدثة لتتوافق مع Supabase + LocalStorage + SW الجديد
 * لا تغيير في منطق العمليات — فقط تحسينات تكامل
 */

// ===== UI HELPERS =====
const UI = (() => {
  const _bsModals = {};

  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!_bsModals[id]) _bsModals[id] = new bootstrap.Modal(el);
    _bsModals[id].show();
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const instance = bootstrap.Modal.getInstance(el);
    if (instance) instance.hide();
  }

  function toast(message, type = 'info') {
    if (window.Swal) {
      Swal.mixin({
        toast: true,
        position: 'bottom-start',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true,
        customClass: { popup: 'colored-toast' }
      }).fire({
        icon: type,
        title: message
      });
    }
  }

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
        reverseButtons: true
      }).then(result => {
        if (result.isConfirmed) onConfirm();
      });
    }
  }

  function loading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('active', show);
  }

  return { openModal, closeModal, toast, confirm, loading };
})();

// ===== UTILITIES =====
function formatNum(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  return parseFloat(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  } catch { return dateStr; }
}

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ===== DASHBOARD =====
const Dashboard = (() => {
  function refresh() {
    const txs = DB.getTransactions();
    let sales=0,purchases=0,payments=0,expenses=0;

    txs.forEach(tx => {
      const amt = parseFloat(tx.amount1) || 0;
      if (tx.type === 'بيع') sales += amt;
      else if (tx.type === 'شراء') purchases += amt;
      else if (tx.type === 'دفعة') payments += amt;
      else if (tx.type === 'مصاريف') expenses += amt;
    });

    const setEl = (id,val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = formatNum(val);
    };

    setEl('dash-sales', sales);
    setEl('dash-purchases', purchases);
    setEl('dash-payments', payments);
    setEl('dash-expenses', expenses);

    // آخر 5 عمليات
    const recent = txs.slice(0,5);
    const tbody = document.getElementById('dash-recent-body');
    if (tbody) {
      if (!recent.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-row">لا توجد عمليات بعد</td></tr>';
      } else {
        tbody.innerHTML = recent.map(tx => {
          const acc = DB.getAccountById(tx.accountId);
          return `
            <tr>
              <td><span class="type-badge type-${tx.type}">${tx.type}</span></td>
              <td>${escHtml(acc ? acc.name : tx.accountName || '-')}</td>
              <td>${formatNum(tx.amount1)} ${escHtml(tx.currency1 || 'USD')}</td>
              <td>${formatDate(tx.date)}</td>
            </tr>`;
        }).join('');
      }
    }

    // أرصدة الصندوق
    const balances = DB.getCashboxBalance();
    ['USD','TRY','SYP'].forEach(c => {
      const el = document.getElementById(`dash-${c.toLowerCase()}`);
      if (el) el.textContent = formatNum(balances[c] || 0);
    });
  }

  return { refresh };
})();

// ===== MAIN APP =====
const App = (() => {

  function init(user) {
    // اسم المستخدم
    const userNameEl = document.getElementById('sidebar-user-name');
    if (userNameEl) userNameEl.textContent = user.name || user.username;

    // اسم الشركة
    const settings = Storage.get('settings') || {};
    const companyName = settings.companyName || 'نظام المحاسبة';
    ['sidebar-company-name','login-company-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = companyName;
    });

    // الثيم
    Settings.applyTheme(settings);

    // تهيئة الوحدات
    API.init();          // API الجديد (Supabase + LocalStorage)
    SupaDB.init?.();     // إن وجد
    Accounts.init();
    Transactions.init();
    Statement.init();
    Cashbox.init();
    Reports.init();
    Settings.init();

    // تحديث الداشبورد
    Dashboard.refresh();

    // التنقل
    initNavigation();

    // التاريخ
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
      if (DB.checkSync?.()) {
        DB.processQueue?.();
        DB.pushUnsyncedToSupabase?.();
      }
    }, 2000);
  }

  function initNavigation() {
    document.querySelectorAll('.sidebar a[data-page]').forEach(item => {
      item.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(item.dataset.page);
        if (window.innerWidth <= 768) closeSidebar();
      });
    });

    document.querySelectorAll('button[data-page]').forEach(el => {
      el.addEventListener('click', () => navigateTo(el.dataset.page));
    });

    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);

    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.addEventListener('click', closeSidebar);

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
  }

  function navigateTo(pageId) {
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
      p.style.display = 'none';
    });

    document.querySelectorAll('.sidebar a[data-page]').forEach(n => n.classList.remove('active'));

    const page = document.getElementById(`page-${pageId}`);
    if (page) { page.classList.add('active'); page.style.display = 'block'; }

    const navItem = document.querySelector(`.sidebar a[data-page="${pageId}"]`);
    if (navItem) navItem.classList.add('active');

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

  function goToStatement(accountId) {
    navigateTo('statement');
    setTimeout(() => Statement.goToAccount(accountId), 100);
  }

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('active');
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }

  function updateDate() {
    const el = document.getElementById('current-date');
    if (el) {
      const now = new Date();
      const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
      const months = ['1','2','3','4','5','6','7','8','9','10','11','12'];
      el.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }
  }

  function logout() {
    Auth.logout();
    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js')
        .then(() => console.log('SW registered'))
        .catch(e => console.warn('SW error:', e));
    }
  }

  function initPWAInstall() {
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', e => {
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
  const session = Auth.getSession();
  if (session) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    App.init(session);
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    Auth.initLoginScreen();
  }
});