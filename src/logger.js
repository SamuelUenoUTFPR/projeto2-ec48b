/**
 * @module logger
 * @description Módulo de log persistente em arquivo usando `fs` nativo.
 *
 * Rotaciona por data (um arquivo por dia: YYYY-MM-DD.log em /logs/).
 * Expõe: logger.info | logger.warn | logger.error
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(__dirname, '../../logs');

// Garante a existência do diretório de logs antes de qualquer escrita.
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function _getLogFilePath() {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(LOG_DIR, `${today}.log`);
}

/**
 * Formata e persiste uma entrada no arquivo de log do dia.
 * @param {string} level   - 'INFO' | 'WARN' | 'ERROR'
 * @param {string} origin  - Identificador do módulo que gerou o log.
 * @param {string} message - Mensagem descritiva.
 * @param {Error|null} err - Objeto Error com stack trace (opcional).
 */
function _write(level, origin, message, err = null) {
  const timestamp = new Date().toISOString();
  let logLine = `[${timestamp}] [${level.padEnd(5)}] [${origin}] ${message}`;

  if (err instanceof Error) {
    logLine += `\n  Stack: ${err.stack}`;
  }
  logLine += '\n';

  // Exibe no console também (útil durante desenvolvimento).
  const consoleFn = level === 'ERROR' ? console.error : console.log;
  consoleFn(logLine.trimEnd());

  // Persiste no arquivo. Se falhar, reporta apenas no console.
  try {
    fs.appendFileSync(_getLogFilePath(), logLine, { encoding: 'utf8' });
  } catch (fsErr) {
    console.error(`[LOGGER CRÍTICO] Falha ao gravar no arquivo de log: ${fsErr.message}`);
  }
}

const logger = {
  info:  (origin, message)       => _write('INFO',  origin, message),
  warn:  (origin, message)       => _write('WARN',  origin, message),
  error: (origin, message, err)  => _write('ERROR', origin, message, err),
};

module.exports = logger;
