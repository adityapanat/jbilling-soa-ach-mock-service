const fs = require('fs');
const path = require('path');
const config = require('./config');
const { parseTransactionDate } = require('./dateUtil');

const dataPath = path.resolve(__dirname, '..', config.dataFile);

function ensureDataFile() {
  const dir = path.dirname(dataPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
  }
}

function readAll() {
  ensureDataFile();
  const raw = fs.readFileSync(dataPath, 'utf8');
  return JSON.parse(raw || '{}');
}

function writeAll(data) {
  ensureDataFile();
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function resolveReturnDescription(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function register({
  transactionId,
  amount,
  returnCode,
  returnDescription,
  transactionDate
}) {
  const id = String(transactionId).trim();
  if (!id) {
    throw new Error('transactionId is required');
  }

  const parsedAmount = Number(amount);
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('amount must be a positive number');
  }

  const record = {
    transactionId: id,
    amount: parsedAmount,
    returnCode: returnCode || config.returnCode,
    returnDescription: resolveReturnDescription(returnDescription),
    transactionDate: parseTransactionDate(transactionDate),
    registeredAt: new Date().toISOString()
  };

  const data = readAll();
  if (data[id]) {
    const error = new Error(`Transaction ID ${id} is already registered`);
    error.code = 'DUPLICATE_TRANSACTION';
    error.record = data[id];
    throw error;
  }

  data[id] = record;
  writeAll(data);
  return record;
}

function get(transactionId) {
  const data = readAll();
  return data[String(transactionId).trim()] || null;
}

function list() {
  return Object.values(readAll());
}

function remove(transactionId) {
  const id = String(transactionId).trim();
  const data = readAll();
  const existed = Boolean(data[id]);
  delete data[id];
  writeAll(data);
  return existed;
}

function clearAll() {
  const data = readAll();
  const count = Object.keys(data).length;
  writeAll({});
  return count;
}

module.exports = {
  register,
  get,
  list,
  remove,
  clearAll
};
