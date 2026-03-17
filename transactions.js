const Transactions = (() => {
  async function render() {
    const txs = await apiGetTransactions();
    // العرض يتم كما هو في الواجهة الحالية
  }

  async function save(tx) {
    await apiSaveTransaction(tx);
    render();
  }

  async function remove(id) {
    await apiDeleteTransaction(id);
    render();
  }

  return { render, save, remove };
})();
