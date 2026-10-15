const express = require('express');
const logger = require('../logger');
const store = require('../store');
const { buildAchReturnResponse } = require('../templates/achReturnResponse');
const { buildAchSuccessResponse } = require('../templates/achSuccessResponse');

const router = express.Router();

router.post('/GetTransaction', (req, res) => {
  const { transactionid, transactionId } = req.body || {};
  const id = transactionid || transactionId;

  if (!id) {
    logger.warn('GetTransaction rejected', {
      requestId: req.requestId,
      reason: 'transactionid is required'
    });
    return res.status(400).json({
      accountid: null,
      message: 'transactionid is required',
      transactions: []
    });
  }

  const normalizedId = String(id).trim();
  const record = store.get(normalizedId);
  if (!record) {
    logger.log('GetTransaction returned success for unregistered transaction', {
      requestId: req.requestId,
      transactionId: normalizedId
    });
    return res.status(200).json(buildAchSuccessResponse(normalizedId));
  }

  const response = buildAchReturnResponse(record);
  logger.log('GetTransaction returned ACH return response', {
    requestId: req.requestId,
    transactionId: normalizedId,
    amount: record.amount,
    returnCode: record.returnCode,
    transactionDate: record.transactionDate
  });
  return res.status(200).json(response);
});

module.exports = router;
