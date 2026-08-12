const express = require('express');
const store = require('../store');
const { buildAchReturnResponse } = require('../templates/achReturnResponse');
const { buildAchSuccessResponse } = require('../templates/achSuccessResponse');

const router = express.Router();

router.post('/GetTransaction', (req, res) => {
  const { transactionid, transactionId } = req.body || {};
  const id = transactionid || transactionId;

  if (!id) {
    return res.status(400).json({
      accountid: null,
      message: 'transactionid is required',
      transactions: []
    });
  }

  const normalizedId = String(id).trim();
  const record = store.get(normalizedId);
  if (!record) {
    console.log(
      `[GetTransaction] transactionId=${normalizedId} not registered — returning Success (no ACH return)`
    );
    return res.status(200).json(buildAchSuccessResponse(normalizedId));
  }

  const response = buildAchReturnResponse(record);
  console.log(
    `[GetTransaction] transactionId=${normalizedId} amount=${record.amount} returnCode=${record.returnCode} date=${record.transactionDate}`
  );
  return res.status(200).json(response);
});

module.exports = router;
