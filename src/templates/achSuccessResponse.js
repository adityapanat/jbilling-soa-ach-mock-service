const config = require('../config');
const { formatSnapPayDate } = require('../dateUtil');

function buildAchSuccessResponse(transactionId) {
  const transactionDate = formatSnapPayDate(new Date());

  return {
    accountid: config.accountId,
    message: 'Success',
    status: 'Y',
    transactions: [
      {
        transaction: {
          merchantid: config.transactionDefaults.merchantid,
          returncode: null,
          returndescription: null,
          pgtransactionid: transactionId,
          paymenttransactionid: config.transactionDefaults.paymenttransactionid,
          authorizationcode: config.transactionDefaults.authorizationcode,
          transactiondate: transactionDate,
          transactionstatus: 'Success',
          pgtransactiontype: config.transactionDefaults.pgtransactiontype,
          procrespcode: null,
          transactionamount: 0,
          currency: config.transactionDefaults.currency,
          totaltransactionamount: 0,
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
  buildAchSuccessResponse
};
