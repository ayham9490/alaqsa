const Cashbox = (() => {
  async function refresh() {
    const txs = await apiGetTransactions();
    // حساب الأرصدة من العمليات
  }

  return { refresh };
})();
