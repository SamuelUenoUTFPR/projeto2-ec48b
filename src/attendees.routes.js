/**
 * @module routes/attendees
 * @description Rotas de participantes, aninhadas sob /api/events/:eventId/attendees.
 *
 * GET    /api/events/:eventId/attendees                      — lista participantes
 * POST   /api/events/:eventId/attendees                      — convida usuário (só criador)
 * PATCH  /api/events/:eventId/attendees/:userEmail/status    — aceita ou recusa convite (só o próprio)
 * DELETE /api/events/:eventId/attendees/:userEmail           — remove participante (criador ou o próprio)
 *
 * Usa mergeParams: true para acessar :eventId do roteador pai (app.js).
 */
'use strict';

const express             = require('express');
const { isAuthenticated } = require('../middlewares/auth');
const logger              = require('../utils/logger');

const ORIGIN = 'attendees.routes';

/**
 * @param {import('../models/EventModel')}    eventModel
 * @param {import('../models/AttendeeModel')} attendeeModel
 * @returns {express.Router}
 */
module.exports = function createAttendeesRouter(eventModel, attendeeModel) {
  // mergeParams: true permite que req.params.eventId seja acessado aqui.
  const router = express.Router({ mergeParams: true });

  router.use(isAuthenticated);

  // ── GET /api/events/:eventId/attendees ────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const attendees = await attendeeModel.findByEvent(req.params.eventId);
      return res.json({ attendees, total: attendees.length });
    } catch (err) {
      logger.error(ORIGIN, `Falha em GET attendees: ${err.message}`, err);
      const status = /inválid/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ── POST /api/events/:eventId/attendees ───────────────────────────────────
  router.post('/', async (req, res) => {
    try {
      const { eventId } = req.params;
      const { userEmail } = req.body;

      if (!userEmail) {
        return res.status(400).json({ error: 'Campo "userEmail" é obrigatório.' });
      }

      // Regra de negócio: apenas o criador do evento pode convidar.
      const event = await eventModel.findById(eventId);
      if (!event) {
        return res.status(404).json({ error: `Evento "${eventId}" não encontrado.` });
      }
      if (event.creatorEmail !== req.session.user.email) {
        return res.status(403).json({
          error: 'Apenas o criador do evento pode convidar participantes.',
        });
      }

      const result = await attendeeModel.insert({ eventId, userEmail });
      return res.status(201).json({
        message:     `Usuário "${userEmail}" convidado com sucesso.`,
        attendeeId:  result.insertedId,
      });

    } catch (err) {
      logger.error(ORIGIN, `Falha em POST attendees: ${err.message}`, err);
      const status = /Validação|já está convidado|inválid/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ── PATCH /api/events/:eventId/attendees/:userEmail/status ────────────────
  router.patch('/:userEmail/status', async (req, res) => {
    try {
      const { eventId, userEmail } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Campo "status" é obrigatório.' });
      }

      // Regra de negócio: cada usuário só responde pelo próprio convite.
      if (userEmail.toLowerCase() !== req.session.user.email.toLowerCase()) {
        return res.status(403).json({
          error: 'Você só pode atualizar a sua própria resposta ao convite.',
        });
      }

      const result = await attendeeModel.updateStatus(eventId, userEmail, status);
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Convite não encontrado.' });
      }
      return res.json({ message: `Resposta ao convite definida como "${status}".` });

    } catch (err) {
      logger.error(ORIGIN, `Falha em PATCH attendees status: ${err.message}`, err);
      const status = /inválid|Validação/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ── DELETE /api/events/:eventId/attendees/:userEmail ─────────────────────
  router.delete('/:userEmail', async (req, res) => {
    try {
      const { eventId, userEmail } = req.params;
      const sessionEmail           = req.session.user.email;

      // Regra de negócio: criador do evento OU o próprio participante podem remover.
      const event = await eventModel.findById(eventId);
      if (!event) {
        return res.status(404).json({ error: `Evento "${eventId}" não encontrado.` });
      }

      const isCreator = event.creatorEmail === sessionEmail;
      const isSelf    = userEmail.toLowerCase() === sessionEmail.toLowerCase();

      if (!isCreator && !isSelf) {
        return res.status(403).json({
          error: 'Apenas o criador do evento ou o próprio participante podem realizar esta ação.',
        });
      }

      const result = await attendeeModel.delete(eventId, userEmail);
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Participante não encontrado.' });
      }
      return res.json({ message: `Participante "${userEmail}" removido do evento.` });

    } catch (err) {
      logger.error(ORIGIN, `Falha em DELETE attendees: ${err.message}`, err);
      const status = /inválid/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  return router;
};
