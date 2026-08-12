module.exports = {
  port: Number(process.env.PORT) || 8089,
  accountId: process.env.SNAPPAY_ACCOUNT_ID || '1002424079',
  returnCode: 'R29',
  dataFile: process.env.DATA_FILE || 'data/transactions.json',
  logFile: process.env.LOG_FILE || 'data/server.log',
  paymentMethod: {
    type: 'CHECKING',
    firstname: 'Test',
    lastname: 'User',
    routingnumber: '122105278',
    last4: '1234',
    paymentmethodid: 89173560,
    tokenid: '000000000000',
    addressline1: '1017 E Garfield St',
    city: 'Phoenix',
    state: 'AZ',
    zip: '85012',
    country: 'US',
    email: 'test@example.com'
  },
  transactionDefaults: {
    merchantid: '202308518523',
    paymenttransactionid: 409315142,
    authorizationcode: '',
    pgtransactiontype: 'Charge',
    currency: 'USD',
    feeamount: 0,
    feevalue: 0
  }
};
