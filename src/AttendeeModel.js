/**
 * @class AttendeeModel
 * @description Acesso à coleção `attendees` no MongoDB.
 *
 * CORREÇÕES aplicadas (feedback da professora):
 *   - Todos os métodos possuem try/catch com log em arquivo.
 *   - Novos métodos findAll() e findById() implementados.
 *   - Validação de e-mail usa regex, não apenas includes('@').
 *   - Validação de ObjectId usa ObjectId.isValid() via parseObjectId.
 *   - Mensagens de erro descrevem o campo problemático e o valor inválido.
 *
 * Esquema do documento:
 * { _id, eventId (ref events), userEmail, status, invitedAt, respondedAt }
 */
'use strict';

const { getDb }                                  = require('../db/connection');
const logger                                     = require('../utils/logger');
const { isValidEmail, parseObjectId }            = require('../utils/validators');

const COLLECTION    = 'attendees';
const ORIGIN        = 'AttendeeModel';
const VALID_STATUSES = ['pending', 'accepted', 'declined'];

class AttendeeModel {
  _collection() {
    return getDb().collection(COLLECTION);
  }

  // ── Validação ──────────────────────────────────────────────────────────────

  /**
   * Valida campos obrigatórios de um participante.
   * CORREÇÃO: e-mail valida com regex; ObjectId valida com isValid().
   */
  _validate(data) {
    const { ObjectId } = require('mongodb');
    const errors       = [];

    if (!data || typeof data !== 'object') {
      throw new Error('Os dados do participante devem ser um objeto válido.');
    }
    if (!data.eventId) {
      errors.push('Campo "eventId" é obrigatório.');
    } else if (!ObjectId.isValid(data.eventId)) {
      errors.push(`Campo "eventId" inválido: "${data.eventId}" não é um ObjectId válido.`);
    }
    if (!data.userEmail || !isValidEmail(data.userEmail)) {
      errors.push('Campo "userEmail" é obrigatório e deve ser um e-mail válido.');
    }
    if (data.status !== undefined && !VALID_STATUSES.includes(data.status)) {
      errors.push(
        `Campo "status" inválido: "${data.status}". ` +
        `Valores aceitos: ${VALID_STATUSES.join(', ')}.`
      );
    }

    if (errors.length > 0) {
      throw new Error(`Validação falhou para AttendeeModel:\n  - ${errors.join('\n  - ')}`);
    }
  }

  // ── Operações SGBD ─────────────────────────────────────────────────────────

  /**
   * Convida um usuário para um evento.
   * Impede convites duplicados (par eventId + userEmail único).
   */
  async insert(data) {
    try {
      this._validate(data);

      const eventOid  = parseObjectId(data.eventId, 'eventId');
      const userEmail = data.userEmail.toLowerCase().trim();

      // Verifica duplicidade antes de inserir.
      const existing = await this._collection().findOne({ eventId: eventOid, userEmail });
      if (existing) {
        const err = new Error(
          `Usuário "${userEmail}" já está convidado para o evento "${data.eventId}".`
        );
        logger.warn(ORIGIN, err.message);
        throw err;
      }

      const document = {
        eventId:     eventOid,
        userEmail,
        status:      data.status || 'pending',
        invitedAt:   new Date(),
        respondedAt: null,
      };

      const result = await this._collection().insertOne(document);
      logger.info(
        ORIGIN,
        `Convite enviado: "${userEmail}" → evento "${data.eventId}" | ID: ${result.insertedId}`
      );
      return result;

    } catch (err) {
      logger.error(ORIGIN, `Falha em insert: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Busca um participante pelo seu ObjectId.
   * CORREÇÃO: método adicionado conforme feedback (classe incompleta).
   * @param {string} attendeeId
   * @returns {Promise<Object|null>}
   */
  async findById(attendeeId) {
    try {
      const oid = parseObjectId(attendeeId, 'attendeeId');

      const attendee = await this._collection().findOne({ _id: oid });
      if (attendee) {
        logger.info(ORIGIN, `Participante encontrado: ${attendeeId}`);
      } else {
        logger.warn(ORIGIN, `Participante não encontrado: ${attendeeId}`);
      }
      return attendee;

    } catch (err) {
      logger.error(ORIGIN, `Falha em findById: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Lista TODOS os participantes do sistema (visão administrativa).
   * CORREÇÃO: método adicionado conforme feedback (classe incompleta).
   * @returns {Promise<Object[]>}
   */
  async findAll() {
    try {
      const attendees = await this._collection()
        .find({})
        .sort({ invitedAt: -1 })
        .toArray();

      logger.info(ORIGIN, `findAll: ${attendees.length} participante(s) encontrado(s).`);
      return attendees;

    } catch (err) {
      logger.error(ORIGIN, `Falha em findAll: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Lista todos os participantes de um evento específico.
   * CORREÇÃO: try/catch + log adicionados.
   * @param {string} eventId
   * @returns {Promise<Object[]>}
   */
  async findByEvent(eventId) {
    try {
      const oid = parseObjectId(eventId, 'eventId');

      const attendees = await this._collection()
        .find({ eventId: oid })
        .sort({ invitedAt: 1 })
        .toArray();

      logger.info(ORIGIN, `findByEvent: ${attendees.length} participante(s) no evento "${eventId}".`);
      return attendees;

    } catch (err) {
      logger.error(ORIGIN, `Falha em findByEvent: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Lista todas as participações de um usuário, com filtro opcional por status.
   * CORREÇÃO: try/catch + log adicionados; e-mail valida com regex.
   * @param {string}      userEmail
   * @param {string|null} [status] - 'pending' | 'accepted' | 'declined' | null (todos)
   * @returns {Promise<Object[]>}
   */
  async findByUser(userEmail, status = null) {
    try {
      if (!userEmail || !isValidEmail(userEmail)) {
        throw new Error(`E-mail inválido para busca: "${userEmail}".`);
      }
      if (status !== null && !VALID_STATUSES.includes(status)) {
        throw new Error(
          `Status inválido: "${status}". Aceitos: ${VALID_STATUSES.join(', ')}.`
        );
      }

      const filter = { userEmail: userEmail.toLowerCase().trim() };
      if (status) filter.status = status;

      const attendees = await this._collection()
        .find(filter)
        .sort({ invitedAt: -1 })
        .toArray();

      logger.info(ORIGIN, `findByUser: ${attendees.length} participação(ões) para "${userEmail}".`);
      return attendees;

    } catch (err) {
      logger.error(ORIGIN, `Falha em findByUser: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Atualiza o status de resposta de um participante.
   * CORREÇÃO: try/catch + log adicionados; e-mail e ObjectId validados.
   * @param {string} eventId
   * @param {string} userEmail
   * @param {string} status - 'accepted' | 'declined' | 'pending'
   * @returns {Promise<import('mongodb').UpdateResult>}
   */
  async updateStatus(eventId, userEmail, status) {
    try {
      if (!VALID_STATUSES.includes(status)) {
        throw new Error(
          `Status inválido: "${status}". Aceitos: ${VALID_STATUSES.join(', ')}.`
        );
      }
      if (!userEmail || !isValidEmail(userEmail)) {
        throw new Error(`E-mail inválido para atualização: "${userEmail}".`);
      }

      const oid = parseObjectId(eventId, 'eventId');

      const result = await this._collection().updateOne(
        { eventId: oid, userEmail: userEmail.toLowerCase().trim() },
        { $set: { status, respondedAt: new Date() } }
      );

      if (result.matchedCount > 0) {
        logger.info(ORIGIN, `Status "${status}" definido: ${userEmail} → evento ${eventId}`);
      } else {
        logger.warn(ORIGIN, `Convite não encontrado. Usuário: ${userEmail}, Evento: ${eventId}`);
      }
      return result;

    } catch (err) {
      logger.error(ORIGIN, `Falha em updateStatus: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Remove um participante de um evento.
   * CORREÇÃO: try/catch + log adicionados; e-mail e ObjectId validados.
   * @param {string} eventId
   * @param {string} userEmail
   * @returns {Promise<import('mongodb').DeleteResult>}
   */
  async delete(eventId, userEmail) {
    try {
      if (!userEmail || !isValidEmail(userEmail)) {
        throw new Error(`E-mail inválido para deleção: "${userEmail}".`);
      }

      const oid = parseObjectId(eventId, 'eventId');

      const result = await this._collection().deleteOne({
        eventId:   oid,
        userEmail: userEmail.toLowerCase().trim(),
      });

      if (result.deletedCount > 0) {
        logger.info(ORIGIN, `Participante "${userEmail}" removido do evento "${eventId}".`);
      } else {
        logger.warn(
          ORIGIN,
          `Participante não encontrado para remoção. Usuário: ${userEmail}, Evento: ${eventId}`
        );
      }
      return result;

    } catch (err) {
      logger.error(ORIGIN, `Falha em delete: ${err.message}`, err);
      throw err;
    }
  }
}

module.exports = AttendeeModel;
