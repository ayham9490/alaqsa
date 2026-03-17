/**
 * auth.js - وحدة المصادقة وإدارة المستخدمين
 */

const Auth = (() => {
  const DEFAULT_USER = { username: 'admin', password: '1234', name: 'المدير' };
  const SESSION_KEY = 'auth_session';

  /**
   * تسجيل الدخول
   */
  function login(username, password) {
    const settings = Storage.get('settings') || {};
    const storedUser = settings.user || DEFAULT_USER;

    if (username === storedUser.username && password === storedUser.password) {
      const session = {
        username: storedUser.username,
        name: storedUser.name || storedUser.username,
        loginAt: new Date().toISOString()
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return { success: true, user: session };
    }
    return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  }

  /**
   * تسجيل الخروج
   */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /**
   * التحقق من الجلسة الحالية
   */
  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /**
   * هل المستخدم مسجل دخول؟
   */
  function isLoggedIn() {
    return !!getSession();
  }

  /**
   * تحديث بيانات المستخدم
   */
  function updateUser(username, password, name) {
    const settings = Storage.get('settings') || {};
    settings.user = settings.user || {};
    if (username) settings.user.username = username;
    if (password) settings.user.password = password;
    if (name) settings.user.name = name;
    Storage.set('settings', settings);

    // تحديث الجلسة
    const session = getSession();
    if (session) {
      session.username = settings.user.username;
      session.name = settings.user.name || settings.user.username;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    return true;
  }

  /**
   * تهيئة شاشة الدخول
   */
  function initLoginScreen() {
    const form = document.getElementById('login-form');
    if (!form) return;

    // تحديث اسم الشركة في شاشة الدخول
    const settings = Storage.get('settings') || {};
    const companyName = settings.companyName || 'نظام المحاسبة';
    const el = document.getElementById('login-company-name');
    if (el) el.textContent = companyName;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      if (!username || !password) {
        UI.toast('يرجى إدخال اسم المستخدم وكلمة المرور', 'warning');
        return;
      }

      const result = login(username, password);
      if (result.success) {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'block';
        App.init(result.user);
      } else {
        UI.toast(result.message, 'error');
        document.getElementById('login-password').value = '';
      }
    });
  }

  return { login, logout, getSession, isLoggedIn, updateUser, initLoginScreen };
})();
