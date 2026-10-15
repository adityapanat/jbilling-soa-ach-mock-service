const express = require('express');
const path = require('path');
const packageInfo = require('../package.json');
const config = require('./config');
const logger = require('./logger');
const getTransactionRoutes = require('./routes/getTransaction');
const transactionsRoutes = require('./routes/transactions');

const app = express();

app.use(logger.requestMiddleware());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'snappay-ach-mock',
    port: config.port
  });
});

app.get('/api/version', (_req, res) => {
  res.json({
    name: packageInfo.name,
    version: packageInfo.version,
    description: packageInfo.description
  });
});

app.get('/version', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'version.html'));
});

app.use('/api/interop', getTransactionRoutes);
app.use('/api/transactions', transactionsRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, req, res, next) => {
  const requestedStatus = Number(err.statusCode || err.status);
  const statusCode = requestedStatus >= 400 && requestedStatus < 600 ? requestedStatus : 500;
  logger.error('Unhandled request error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    statusCode,
    error: err
  });

  if (res.headersSent) {
    return next(err);
  }

  return res.status(statusCode).json({
    message: statusCode >= 500 ? 'Internal server error' : err.message,
    requestId: req.requestId
  });
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
