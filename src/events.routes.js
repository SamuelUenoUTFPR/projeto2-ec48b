/**
 * @module routes/events
 * @description Rotas de gerenciamento de eventos (todas protegidas).
 *
 * GET    /api/events         — lista eventos (filtros: ?from=&to= | ?creator=)
 * GET    /api/events/my      — lista eventos do usuário logado
 * POST   /api/events         — cria novo evento
 * GET    /api/events/:id     — busca evento por ID
 * DELETE /api/events/:id     — exclui evento (apenas o criador)
 *
 * ATENÇÃO: a rota /my deve ser declarada ANTES de /:id para não ser
 * capturada como um ObjectId.
 */
'use strict';

const express             = require('express');
const { isAuthenticated } = require('../middlewares/auth');
const logger              = require('../utils/logger');

const ORIGIN = 'events.routes';

/**
 * @param {import('../models/EventModel')} eventModel
 * @returns {express.Router}
 */
module.exports = function createEventsRouter(eventModel) {
  const router = express.Router();

  router.use(isAuthenticated);

  // ── GET /api/events ───────────────────────────────────────────────────────
  // Suporta filtros via query string:
  //   ?from=2025-02-01&to=2025-02-28  → por intervalo de datas
  //   ?creator=email@dominio.com      → por criador
  //   (sem query)                     → eventos do usuário logado
  router.get('/', async (req, res) => {
    try {
      const { from, to, creator } = req.query;
      let events;

      if (from && to) {
        events = await eventModel.findByDateRange(from, to);
      } else if (creator) {
        events = await eventModel.findByCreator(creator);
      } else {
        events = await eventModel.findByCreator(req.session.user.email);
      }

      return res.json({ events, total: events.length });

    } catch (err) {
      logger.error(ORIGIN, `Falha em GET /events: ${err.message}`, err);
      const status = /inválid|Validação/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ── GET /api/events/my ────────────────────────────────────────────────────
  // Deve vir ANTES de /:id.
  router.get('/my', async (req, res) => {
    try {
      const events = await eventModel.findByCreator(req.session.user.email);
      return res.json({ events, total: events.length });
    } catch (err) {
      logger.error(ORIGIN, `Falha em GET /events/my: ${err.message}`, err);
      return res.status(500).json({ error: 'Erro ao listar seus eventos.' });
    }
  });

  // ── POST /api/events ──────────────────────────────────────────────────────
  router.post('/', async (req, res) => {
    try {
      const { title, description, location, startDate, endDate } = req.body;

      // Verificação prévia dos campos obrigatórios com mensagem clara.
      const missing = [];
      if (!title)     missing.push('"title"');
      if (!startDate) missing.push('"startDate"');
      if (!endDate)   missing.push('"endDate"');
      if (missing.length) {
        return res.status(400).json({
          error: `Campos obrigatórios ausentes: ${missing.join(', ')}.`,
        });
      }

      const result = await eventModel.insert({
        title,
        description,
        location,
        startDate,
        endDate,
        creatorEmail: req.session.user.email, // ← vem da sessão, não do body
      });

      return res.status(201).json({
        message: 'Evento criado com sucesso.',
        eventId: result.insertedId,
      });

    } catch (err) {
      logger.error(ORIGIN, `Falha em POST /events: ${err.message}`, err);
      const status = /inválid|Validação/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ── GET /api/events/:id ───────────────────────────────────────────────────
  router.get('/:id', async (req, res) => {
    try {
      const event = await eventModel.findById(req.params.id);
      if (!event) {
        return res.status(404).json({
          error: `Evento "${req.params.id}" não encontrado.`,
        });
      }
      return res.json({ event });
    } catch (err) {
      logger.error(ORIGIN, `Falha em GET /events/:id: ${err.message}`, err);
      const status = /inválid/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ── DELETE /api/events/:id ────────────────────────────────────────────────
  router.delete('/:id', async (req, res) => {
    try {
      // Busca o evento para verificar quem é o criador.
      const event = await eventModel.findById(req.params.id);
      if (!event) {
        return res.status(404).json({
          error: `Evento "${req.params.id}" não encontrado.`,
        });
      }

      // Regra de negócio: apenas o criador pode excluir.
      if (event.creatorEmail !== req.session.user.email) {
        return res.status(403).json({
          error: 'Apenas o criador do evento pode excluí-lo.',
        });
      }

      await eventModel.deleteById(req.params.id);
      return res.json({ message: 'Evento excluído com sucesso.' });

    } catch (err) {
      logger.error(ORIGIN, `Falha em DELETE /events/:id: ${err.message}`, err);
      const status = /inválid/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  return router;
};
