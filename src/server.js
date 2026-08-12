const express = require('express');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const getTransactionRoutes = require('./routes/getTransaction');
const transactionsRoutes = require('./routes/transactions');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'snappay-ach-mock',
    port: config.port
  });
});

app.use('/api/interop', getTransactionRoutes);
app.use('/api/transactions', transactionsRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

const server = app.listen(config.port, () => {
  logger.log(`SnapPay ACH mock listening on http://localhost:${config.port}`);
  logger.log(`UI:             http://localhost:${config.port}/`);
  logger.log(`Register txn:   POST http://localhost:${config.port}/api/transactions`);
  logger.log(`GetTransaction: POST http://localhost:${config.port}/api/interop/GetTransaction`);
  logger.log(`Set jBilling Snap Pay Base Url to: http://localhost:${config.port}/`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${config.port} is already in use. Stop the other process or run:`);
    logger.error(`  lsof -i :${config.port} -t | xargs kill`);
    logger.error(`Or use another port: PORT=8090 npm start`);
    process.exit(1);
  }
  throw err;
});
