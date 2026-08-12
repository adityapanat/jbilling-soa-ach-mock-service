const express = require('express');
const store = require('../store');

const router = express.Router();

const REGISTER_EXAMPLE = {
  transactionId: '202784935080',
  amount: 85,
  returnReasonCode: 'R29',
  returnReasonDescription: 'R29 - Corporate Customer Advises Not Authorized',
  date: '7/30/2026 01:26:35 AM'
};

function pickFirst(body, keys) {
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      return body[key];
    }
  }
  return undefined;
}

function pickField(body, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return body[key];
    }
  }
  return undefined;
}

router.post('/', (req, res) => {
  const body = req.body || {};

  const transactionId = pickFirst(body, ['transactionId', 'transaction_id']);
  const amount = pickFirst(body, ['amount', 'transactionAmount', 'transaction_amount']);
  const returnCode = pickFirst(body, [
    'returnReasonCode',
    'returnCode',
    'return_code',
    'returnReasoncode'
  ]);
  const returnDescription = pickField(body, [
    'returnReasonDescription',
    'returnDescription',
    'return_description'
  ]);
  const transactionDate = pickFirst(body, ['date', 'transactionDate', 'transaction_date']);

  if (!transactionId) {
    return res.status(400).json({
      error: 'transactionId is required',
      example: REGISTER_EXAMPLE
    });
  }

  if (amount === undefined) {
    return res.status(400).json({
      error: 'amount is required',
      example: REGISTER_EXAMPLE
    });
  }

  try {
    const record = store.register({
      transactionId,
      amount,
      returnCode,
      returnDescription,
      transactionDate
    });
    return res.status(201).json({
      message: 'Transaction registered for ACH return mock',
      record
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_TRANSACTION') {
      return res.status(409).json({
        error: error.message,
        record: error.record
      });
    }
    return res.status(400).json({ error: error.message });
  }
});

router.get('/', (_req, res) => {
  res.json({ transactions: store.list() });
});

router.delete('/all', (_req, res) => {
  const count = store.clearAll();
  return res.json({
    message: 'All transactions cleared',
    count
  });
});

router.delete('/:transactionId', (req, res) => {
  const removed = store.remove(req.params.transactionId);
  if (!removed) {
    return res.status(404).json({ error: 'transactionId not found' });
  }
  return res.json({ message: 'Transaction removed', transactionId: req.params.transactionId });
});

module.exports = router;
