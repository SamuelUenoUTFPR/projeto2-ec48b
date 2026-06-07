/**
 * @module connection
 * @description Gerenciador de conexão MongoDB (Singleton).
 *
 * CORREÇÃO aplicada (feedback da professora):
 *   - Todos os caminhos de erro (connect, getDb, disconnect) agora
 *     registram no arquivo de log antes de relançar a exceção.
 */
'use strict';

require('dotenv').config();

const { MongoClient } = require('mongodb');
const logger          = require('../utils/logger');

const MONGODB_URI     = process.env.MONGODB_URI     || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'agenda_eletronica';

let _client = null;
let _db     = null;

/**
 * Estabelece a conexão com o MongoDB (Singleton).
 * @async
 * @returns {Promise<import('mongodb').Db>}
 * @throws {Error} Logado em arquivo antes de relançar.
 */
async function connect() {
  if (_client && _db) {
    logger.info('connection', 'Reutilizando conexão existente com o MongoDB.');
    return _db;
  }

  try {
    logger.info('connection', `Conectando ao MongoDB: ${MONGODB_URI}`);

    _client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    await _client.connect();
    _db = _client.db(MONGODB_DB_NAME);

    logger.info('connection', `Conectado ao banco: "${MONGODB_DB_NAME}".`);
    return _db;

  } catch (err) {
    // ← CORREÇÃO: log em arquivo antes de relançar.
    logger.error('connection', `Falha ao conectar ao MongoDB: ${err.message}`, err);
    _client = null;
    _db     = null;
    throw err;
  }
}

/**
 * Retorna a instância do banco já conectado.
 * @returns {import('mongodb').Db}
 * @throws {Error} Logado em arquivo se connect() não foi chamado.
 */
function getDb() {
  if (!_db) {
    const err = new Error(
      'Banco de dados não inicializado. Chame connect() antes de getDb().'
    );
    // ← CORREÇÃO: log em arquivo antes de relançar.
    logger.error('connection', err.message, err);
    throw err;
  }
  return _db;
}

/**
 * Encerra a conexão com o MongoDB.
 * @async
 */
async function disconnect() {
  if (_client) {
    try {
      await _client.close();
      logger.info('connection', 'Conexão com o MongoDB encerrada.');
    } catch (err) {
      // ← CORREÇÃO: log em arquivo no catch do disconnect.
      logger.error('connection', `Erro ao encerrar conexão: ${err.message}`, err);
    } finally {
      _client = null;
      _db     = null;
    }
  }
}

module.exports = { connect, getDb, disconnect };
