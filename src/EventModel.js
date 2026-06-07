/**
 * @class EventModel
 * @description Acesso à coleção `events` no MongoDB.
 *
 * CORREÇÕES aplicadas (feedback da professora):
 *   - findByCreator, findByDateRange e deleteById agora têm try/catch + log.
 *   - Validação de datas melhorada: erro aponta o campo e o valor inválido.
 *   - Validação de ObjectId usa ObjectId.isValid() antes de construir o objeto.
 *   - Novo método findById() para busca por ID.
 *
 * Esquema do documento:
 * { _id, title, description?, location?, startDate, endDate, creatorEmail, createdAt }
 */
'use strict';

const { getDb }                         = require('../db/connection');
const logger                            = require('../utils/logger');
const { isValidEmail, parseObjectId, parseDate } = require('../utils/validators');

const COLLECTION = 'events';
const ORIGIN     = 'EventModel';

class EventModel {
  _collection() {
    return getDb().collection(COLLECTION);
  }

  // ── Validação ──────────────────────────────────────────────────────────────

  /**
   * Valida campos obrigatórios de um evento e consistência entre datas.
   * CORREÇÃO: mensagens de erro identificam o campo e o valor problemático.
   */
  _validate(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      throw new Error('Os dados do evento devem ser um objeto válido.');
    }
    if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
      errors.push('Campo "title" é obrigatório e não pode ser vazio.');
    }
    if (!data.startDate) {
      errors.push('Campo "startDate" é obrigatório.');
    } else if (isNaN(new Date(data.startDate).getTime())) {
      errors.push(
        `Campo "startDate" inválido: "${data.startDate}" não é uma data válida. ` +
        'Use o formato ISO 8601 (ex: 2025-02-10T09:00:00).'
      );
    }
    if (!data.endDate) {
      errors.push('Campo "endDate" é obrigatório.');
    } else if (isNaN(new Date(data.endDate).getTime())) {
      errors.push(
        `Campo "endDate" inválido: "${data.endDate}" não é uma data válida. ` +
        'Use o formato ISO 8601 (ex: 2025-02-10T11:00:00).'
      );
    }
    if (!data.creatorEmail || !isValidEmail(data.creatorEmail)) {
      errors.push('Campo "creatorEmail" é obrigatório e deve ser um e-mail válido.');
    }

    // Validação cruzada de datas (só executa se ambas forem válidas).
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end   = new Date(data.endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
        errors.push('"endDate" não pode ser anterior a "startDate".');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validação falhou para EventModel:\n  - ${errors.join('\n  - ')}`);
    }
  }

  // ── Operações SGBD ─────────────────────────────────────────────────────────

  /**
   * Insere um novo evento no banco.
   * @param {{ title, description?, location?, startDate, endDate, creatorEmail }} data
   */
  async insert(data) {
    try {
      this._validate(data);

      const document = {
        title:        data.title.trim(),
        description:  data.description ? String(data.description).trim() : null,
        location:     data.location    ? String(data.location).trim()    : null,
        startDate:    new Date(data.startDate),
        endDate:      new Date(data.endDate),
        creatorEmail: data.creatorEmail.toLowerCase().trim(),
        createdAt:    new Date(),
      };

      const result = await this._collection().insertOne(document);
      logger.info(ORIGIN, `Evento inserido: "${document.title}" | ID: ${result.insertedId}`);
      return result;

    } catch (err) {
      logger.error(ORIGIN, `Falha em insert: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Busca um evento pelo seu ObjectId.
   * CORREÇÃO: novo método + try/catch + log.
   * @param {string} eventId
   * @returns {Promise<Object|null>}
   */
  async findById(eventId) {
    try {
      const oid = parseObjectId(eventId, 'eventId');

      const event = await this._collection().findOne({ _id: oid });
      if (event) {
        logger.info(ORIGIN, `Evento encontrado: ${eventId}`);
      } else {
        logger.warn(ORIGIN, `Evento não encontrado: ${eventId}`);
      }
      return event;

    } catch (err) {
      logger.error(ORIGIN, `Falha em findById: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Lista todos os eventos de um criador, ordenados por startDate.
   * CORREÇÃO: try/catch + log adicionados.
   * @param {string} creatorEmail
   * @returns {Promise<Object[]>}
   */
  async findByCreator(creatorEmail) {
    try {
      if (!creatorEmail || !isValidEmail(creatorEmail)) {
        throw new Error(`E-mail de criador inválido para busca: "${creatorEmail}".`);
      }

      const events = await this._collection()
        .find({ creatorEmail: creatorEmail.toLowerCase().trim() })
        .sort({ startDate: 1 })
        .toArray();

      logger.info(ORIGIN, `findByCreator: ${events.length} evento(s) para ${creatorEmail}.`);
      return events;

    } catch (err) {
      logger.error(ORIGIN, `Falha em findByCreator: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Busca eventos que se sobrepõem a um intervalo de datas.
   * CORREÇÃO: try/catch + log adicionados; datas validadas com parseDate.
   * @param {string|Date} fromDate
   * @param {string|Date} toDate
   * @returns {Promise<Object[]>}
   */
  async findByDateRange(fromDate, toDate) {
    try {
      const from = parseDate(fromDate, 'fromDate');
      const to   = parseDate(toDate,   'toDate');

      if (to < from) {
        throw new Error('"toDate" não pode ser anterior a "fromDate".');
      }

      const events = await this._collection()
        .find({
          startDate: { $lte: to   },
          endDate:   { $gte: from },
        })
        .sort({ startDate: 1 })
        .toArray();

      logger.info(ORIGIN, `findByDateRange: ${events.length} evento(s) no intervalo.`);
      return events;

    } catch (err) {
      logger.error(ORIGIN, `Falha em findByDateRange: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Remove um evento pelo ObjectId.
   * CORREÇÃO: try/catch + log adicionados; ObjectId validado com parseObjectId.
   * @param {string} eventId
   * @returns {Promise<import('mongodb').DeleteResult>}
   */
  async deleteById(eventId) {
    try {
      const oid = parseObjectId(eventId, 'eventId');

      const result = await this._collection().deleteOne({ _id: oid });
      if (result.deletedCount > 0) {
        logger.info(ORIGIN, `Evento removido: ${eventId}`);
      } else {
        logger.warn(ORIGIN, `Evento não encontrado para remoção: ${eventId}`);
      }
      return result;

    } catch (err) {
      logger.error(ORIGIN, `Falha em deleteById: ${err.message}`, err);
      throw err;
    }
  }
}

module.exports = EventModel;
