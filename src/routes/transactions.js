const express = require('express');
const logger = require('../logger');
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
    logger.warn('Transaction registration rejected', {
      requestId: req.requestId,
      reason: 'transactionId is required'
    });
    return res.status(400).json({
      error: 'transactionId is required',
      example: REGISTER_EXAMPLE
    });
  }

  if (amount === undefined) {
    logger.warn('Transaction registration rejected', {
      requestId: req.requestId,
      transactionId,
      reason: 'amount is required'
    });
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
    logger.log('Transaction registered', {
      requestId: req.requestId,
      transactionId: record.transactionId,
      amount: record.amount,
      returnCode: record.returnCode
    });
    return res.status(201).json({
      message: 'Transaction registered for ACH return mock',
      record
    });
  } catch (error) {
    if (error.code === 'DUPLICATE_TRANSACTION') {
      logger.warn('Duplicate transaction registration rejected', {
        requestId: req.requestId,
        transactionId,
        error: error.message
      });
      return res.status(409).json({
        error: error.message,
        record: error.record
      });
    }
    logger.warn('Transaction registration failed validation', {
      requestId: req.requestId,
      transactionId,
      error: error.message
    });
    return res.status(400).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  const transactions = store.list();
  logger.log('Transaction registry listed', {
    requestId: req.requestId,
    count: transactions.length
  });
  res.json({ transactions });
});

router.delete('/all', (req, res) => {
  const count = store.clearAll();
  logger.warn('Transaction registry cleared', {
    requestId: req.requestId,
    count
  });
  return res.json({
    message: 'All transactions cleared',
    count
  });
});

router.delete('/:transactionId', (req, res) => {
  const removed = store.remove(req.params.transactionId);
  if (!removed) {
    logger.warn('Transaction delete requested for unknown ID', {
      requestId: req.requestId,
      transactionId: req.params.transactionId
    });
    return res.status(404).json({ error: 'transactionId not found' });
  }
  logger.log('Transaction deleted', {
    requestId: req.requestId,
    transactionId: req.params.transactionId
  });
  return res.json({ message: 'Transaction removed', transactionId: req.params.transactionId });
});

module.exports = router;
