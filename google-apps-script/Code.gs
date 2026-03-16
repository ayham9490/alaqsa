/**
 * Code.gs - Google Apps Script Backend
 * نظام المحاسبة الاحترافي
 * 
 * الإعداد:
 * 1. افتح Google Sheets وأنشئ جدولاً جديداً
 * 2. افتح Extensions > Apps Script
 * 3. الصق هذا الكود
 * 4. انشر: Deploy > New deployment > Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. انسخ الرابط وضعه في إعدادات التطبيق
 */

// ===== CONFIGURATION =====
const SHEET_NAMES = {
  TRANSACTIONS: 'Transactions',
  ACCOUNTS: 'Accounts',
  SETTINGS: 'Settings'
};

const TX_HEADERS = [
  'id', 'type', 'paymentMethod', 'accountId', 'accountName',
  'date', 'fuelType', 'weight', 'density', 'barrels', 'barrelPrice',
  'amount1', 'currency1', 'amount2', 'currency2', 'totalUSD',
  'notes', 'createdAt', 'updatedAt'
];

const ACC_HEADERS = [
  'id', 'name', 'type', 'phone', 'notes', 'createdAt'
];

// ===== MAIN ROUTER =====
function doGet(e) {
  const action = e.parameter.action;
  const sheetId = e.parameter.sheetId;
  
  try {
    let result;
    switch (action) {
      case 'test':
        result = { ok: true, message: 'الاتصال ناجح', timestamp: new Date().toISOString() };
        break;
      case 'getTransactions':
        result = getTransactions(e.parameter, sheetId);
        break;
      case 'getAccounts':
        result = getAccounts(sheetId);
        break;
      case 'getStatement':
        result = getStatement(e.parameter, sheetId);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' });
  }
  
  const { action, sheetId } = body;
  
  try {
    let result;
    switch (action) {
      case 'addTransaction':
        result = addTransaction(body.transaction, sheetId);
        break;
      case 'updateTransaction':
        result = updateTransaction(body.id, body.transaction, sheetId);
        break;
      case 'deleteTransaction':
        result = deleteTransaction(body.id, sheetId);
        break;
      case 'addAccount':
        result = addAccount(body.account, sheetId);
        break;
      case 'updateAccount':
        result = updateAccount(body.id, body.account, sheetId);
        break;
      case 'deleteAccount':
        result = deleteAccount(body.id, sheetId);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

// ===== HELPERS =====
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet(sheetId) {
  if (sheetId) return SpreadsheetApp.openById(sheetId);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    formatHeaderRow(sheet);
  }
  return sheet;
}

function formatHeaderRow(sheet) {
  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  range.setBackground('#1a3c5e');
  range.setFontColor('#ffffff');
  range.setFontFamily('Arial');
  range.setFontWeight('bold');
  range.setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  sheet.setRightToLeft(true);
}

function generateId() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 16);
}

function sheetToObjects(sheet, headers) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
    return obj;
  });
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1; // 1-indexed
  }
  return -1;
}

// ===== TRANSACTIONS =====
function addTransaction(tx, sheetId) {
  const ss = getSpreadsheet(sheetId);
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.TRANSACTIONS, TX_HEADERS);
  
  const id = generateId();
  const now = new Date().toISOString();
  const row = TX_HEADERS.map(h => {
    if (h === 'id') return id;
    if (h === 'createdAt') return now;
    if (h === 'updatedAt') return now;
    return tx[h] !== undefined ? tx[h] : '';
  });
  
  sheet.appendRow(row);
  applyRowFormatting(sheet, sheet.getLastRow(), tx.type);
  
  return { ok: true, id };
}

function getTransactions(params, sheetId) {
  const ss = getSpreadsheet(sheetId);
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.TRANSACTIONS, TX_HEADERS);
  const txs = sheetToObjects(sheet, TX_HEADERS);
  
  let filtered = txs;
  if (params.type) filtered = filtered.filter(t => t.type === params.type);
  if (params.accountId) filtered = filtered.filter(t => t.accountId === params.accountId);
  if (params.dateFrom) filtered = filtered.filter(t => t.date >= params.dateFrom);
  if (params.dateTo) filtered = filtered.filter(t => t.date <= params.dateTo);
  
  return { ok: true, data: filtered.reverse() };
}

function updateTransaction(id, tx, sheetId) {
  const ss = getSpreadsheet(sheetId);
  const sheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS);
  if (!sheet) return { error: 'Sheet not found' };
  
  const rowIdx = findRowById(sheet, id);
  if (rowIdx === -1) return { error: 'Transaction not found' };
  
  const now = new Date().toISOString();
  const row = TX_HEADERS.map(h => {
    if (h === 'id') return id;
    if (h === 'updatedAt') return now;
    return tx[h] !== undefined ? tx[h] : '';
  });
  
  sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  applyRowFormatting(sheet, rowIdx, tx.type);
  
  return { ok: true };
}

function deleteTransaction(id, sheetId) {
  const ss = getSpreadsheet(sheetId);
  const sheet = ss.getSheetByName(SHEET_NAMES.TRANSACTIONS);
  if (!sheet) return { error: 'Sheet not found' };
  
  const rowIdx = findRowById(sheet, id);
  if (rowIdx === -1) return { error: 'Not found' };
  sheet.deleteRow(rowIdx);
  return { ok: true };
}

// ===== ACCOUNTS =====
function addAccount(acc, sheetId) {
  const ss = getSpreadsheet(sheetId);
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.ACCOUNTS, ACC_HEADERS);
  
  const id = generateId();
  const now = new Date().toISOString();
  const row = ACC_HEADERS.map(h => {
    if (h === 'id') return id;
    if (h === 'createdAt') return now;
    return acc[h] !== undefined ? acc[h] : '';
  });
  
  sheet.appendRow(row);
  return { ok: true, id };
}

function getAccounts(sheetId) {
  const ss = getSpreadsheet(sheetId);
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.ACCOUNTS, ACC_HEADERS);
  const accounts = sheetToObjects(sheet, ACC_HEADERS);
  return { ok: true, data: accounts };
}

function updateAccount(id, acc, sheetId) {
  const ss = getSpreadsheet(sheetId);
  const sheet = ss.getSheetByName(SHEET_NAMES.ACCOUNTS);
  if (!sheet) return { error: 'Sheet not found' };
  
  const rowIdx = findRowById(sheet, id);
  if (rowIdx === -1) return { error: 'Account not found' };
  
  const row = ACC_HEADERS.map(h => {
    if (h === 'id') return id;
    return acc[h] !== undefined ? acc[h] : '';
  });
  
  sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  return { ok: true };
}

function deleteAccount(id, sheetId) {
  const ss = getSpreadsheet(sheetId);
  const sheet = ss.getSheetByName(SHEET_NAMES.ACCOUNTS);
  if (!sheet) return { error: 'Sheet not found' };
  
  const rowIdx = findRowById(sheet, id);
  if (rowIdx === -1) return { error: 'Not found' };
  sheet.deleteRow(rowIdx);
  return { ok: true };
}

// ===== STATEMENT =====
function getStatement(params, sheetId) {
  const txsResult = getTransactions(params, sheetId);
  const txs = txsResult.data || [];
  
  let totalSales = 0, totalPayments = 0;
  txs.forEach(tx => {
    const amt = parseFloat(tx.amount1) || 0;
    if (tx.type === 'بيع') totalSales += amt;
    if (tx.type === 'دفعة') totalPayments += amt;
  });
  
  return {
    ok: true,
    data: { transactions: txs, totalSales, totalPayments, balance: totalSales - totalPayments }
  };
}

// ===== ROW FORMATTING =====
function applyRowFormatting(sheet, rowIdx, type) {
  const lastCol = TX_HEADERS.length;
  const range = sheet.getRange(rowIdx, 1, 1, lastCol);
  
  const colors = {
    'بيع': '#e8f5e9',
    'شراء': '#e3f2fd',
    'دفعة': '#fce4ec',
    'مصاريف': '#fff3e0'
  };
  
  const bgColor = colors[type] || '#ffffff';
  range.setBackground(bgColor);
  range.setHorizontalAlignment('center');
  range.setFontFamily('Arial');
}

// ===== SETUP FUNCTION =====
/**
 * تشغيل هذه الدالة مرة واحدة لإعداد الجداول
 */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // إنشاء ورقة العمليات
  const txSheet = getOrCreateSheet(ss, SHEET_NAMES.TRANSACTIONS, TX_HEADERS);
  txSheet.setColumnWidths(1, TX_HEADERS.length, 130);
  txSheet.setName(SHEET_NAMES.TRANSACTIONS);
  
  // إنشاء ورقة الحسابات
  const accSheet = getOrCreateSheet(ss, SHEET_NAMES.ACCOUNTS, ACC_HEADERS);
  accSheet.setColumnWidths(1, ACC_HEADERS.length, 150);
  accSheet.setName(SHEET_NAMES.ACCOUNTS);
  
  // حذف ورقة Sheet1 الافتراضية إن وجدت
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  
  SpreadsheetApp.getUi().alert('✅ تم إعداد الجداول بنجاح!');
}

// ===== MENU =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ نظام المحاسبة')
    .addItem('إعداد الجداول', 'setupSpreadsheet')
    .addToUi();
}
