const pino = require('pino');

function createLogger(level) {
  return pino({
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime
  });
}

module.exports = {
  createLogger
};
