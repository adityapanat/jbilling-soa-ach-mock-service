const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const logPath = path.resolve(__dirname, '..', config.logFile);
const logLevels = { debug: 10, info: 20, warn: 30, error: 40 };
const configuredLogLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const minimumLogLevel = logLevels[configuredLogLevel] || logLevels.info;
const phoenixTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Phoenix',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hourCycle: 'h23',
  timeZoneName: 'short'
});

function formatTimestamp(date = new Date()) {
  const parts = Object.fromEntries(
    phoenixTimeFormatter.formatToParts(date).map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond} ${parts.timeZoneName}`;
}

function ensureLogFile() {
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function serializeMetadata(metadata) {
  if (metadata === undefined) {
    return '';
  }

  const normalized = Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => {
      if (value instanceof Error) {
        return [key, { name: value.name, message: value.message, stack: value.stack }];
      }
      return [key, value];
    })
  );

  try {
    return ` ${JSON.stringify(normalized)}`;
  } catch (_error) {
    return ' {"metadata":"unserializable"}';
  }
}

function write(level, message, metadata) {
  if (logLevels[level] < minimumLogLevel) {
    return;
  }

  const line = `${formatTimestamp()} [${level.toUpperCase()}] ${String(message).replace(/[\r\n]+/g, ' ')}${serializeMetadata(metadata)}`;
  const output = level === 'error' || level === 'warn' ? console.error : console.log;
  output(line);

  ensureLogFile();
  try {
    fs.appendFileSync(logPath, `${line}\n`, 'utf8');
  } catch (writeError) {
    console.error(`${formatTimestamp()} [ERROR] Failed to append application log`, writeError);
  }
}

function log(message, metadata) {
  write('info', message, metadata);
}

function debug(message, metadata) {
  write('debug', message, metadata);
}

function warn(message, metadata) {
  write('warn', message, metadata);
}

function error(message, metadata) {
  write('error', message, metadata);
}

function requestMiddleware() {
  return (req, res, next) => {
    const requestId = crypto.randomUUID();
    const startedAt = process.hrtime.bigint();
    const requestPath = req.originalUrl.split('?')[0];
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const requestMetadata = {
      requestId,
      method: req.method,
      path: requestPath,
      remoteAddress: req.ip
    };
    log('HTTP request started', requestMetadata);

    let completed = false;
    res.on('finish', () => {
      completed = true;
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const metadata = {
        ...requestMetadata,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2))
      };
      const message = 'HTTP request completed';
      if (res.statusCode >= 500) {
        error(message, metadata);
      } else if (res.statusCode >= 400) {
        warn(message, metadata);
      } else {
        log(message, metadata);
      }
    });

    res.on('close', () => {
      if (!completed) {
        warn('HTTP request connection closed before response completed', requestMetadata);
      }
    });

    next();
  };
}

module.exports = {
  log,
  debug,
  warn,
  error,
  requestMiddleware,
  formatTimestamp,
  logPath
};
