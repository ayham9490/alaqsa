const Settings = (() => {
  function init() {
    loadSettings();
  }

  function loadSettings() {
    const s = Storage.get('settings') || {};
    if (s.supabaseUrl && s.supabaseAnonKey) {
      SupaDB.setConfig(s.supabaseUrl, s.supabaseAnonKey);
    }
  }

  return { init, loadSettings };
})();
