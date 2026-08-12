const config = require('../config');

function buildAchReturnResponse(record) {
  const numericAmount = Number(record.amount);

  return {
    accountid: config.accountId,
    message: 'Failed',
    transactions: [
      {
        transaction: {
          merchantid: config.transactionDefaults.merchantid,
          returncode: record.returnCode,
          returndescription: record.returnDescription,
          pgtransactionid: record.transactionId,
          paymenttransactionid: config.transactionDefaults.paymenttransactionid,
          authorizationcode: config.transactionDefaults.authorizationcode,
          transactiondate: record.transactionDate,
          transactionstatus: 'Failed',
          pgtransactiontype: config.transactionDefaults.pgtransactiontype,
          procrespcode: null,
          transactionamount: numericAmount,
          currency: config.transactionDefaults.currency,
          totaltransactionamount: numericAmount,
          feeamount: config.transactionDefaults.feeamount,
          feevalue: config.transactionDefaults.feevalue
        },
        paymentmethod: {
          ...config.paymentMethod
        }
      }
    ]
  };
}

module.exports = {
  buildAchReturnResponse
};
