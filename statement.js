const Statement = (() => {
  async function goToAccount(accountId) {
    const txs = await apiGetTransactions();
    // فلترة العمليات حسب الحساب
  }

  return { goToAccount };
})();
