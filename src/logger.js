const fs = require('fs');
const path = require('path');
const config = require('./config');

const logPath = path.resolve(__dirname, '..', config.logFile);

function ensureLogFile() {
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function append(level, message) {
  ensureLogFile();
  const line = `${new Date().toISOString()} [${level}] ${message}\n`;
  fs.appendFileSync(logPath, line, 'utf8');
}

function log(message) {
  console.log(message);
  append('INFO', message);
}

function error(message) {
  console.error(message);
  append('ERROR', message);
}

module.exports = {
  log,
  error,
  logPath
};
