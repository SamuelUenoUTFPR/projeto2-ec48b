/**
 * @module app
 * @description Fábrica da aplicação Express.
 *
 * Recebe as instâncias dos models já inicializados e monta toda a
 * configuração do Express (middlewares, sessão, rotas, erros 404/500).
 * Não inicia o servidor — isso é responsabilidade do server.js.
 */
'use strict';

require('dotenv').config();

const express  = require('express');
const session  = require('express-session');

const createAuthRouter      = require('./src/routes/auth.routes');
const createUsersRouter     = require('./src/routes/users.routes');
const createEventsRouter    = require('./src/routes/events.routes');
const createAttendeesRouter = require('./src/routes/attendees.routes');
const logger                = require('./src/utils/logger');

/**
 * Cria e configura a aplicação Express.
 *
 * @param {Object} models
 * @param {import('./src/models/UserModel')}     models.userModel
 * @param {import('./src/models/EventModel')}    models.eventModel
 * @param {import('./src/models/AttendeeModel')} models.attendeeModel
 * @returns {express.Application}
 */
function createApp({ userModel, eventModel, attendeeModel }) {
  const app = express();

  // ── Middlewares globais ────────────────────────────────────────────────────

  // Faz o parse do corpo JSON das requisições.
  app.use(express.json());

  // Faz o parse de formulários URL-encoded (ex: Content-Type: application/x-www-form-urlencoded).
  app.use(express.urlencoded({ extended: true }));

  // Configuração de sessão com express-session.
  app.use(session({
    secret:            process.env.SESSION_SECRET || 'agenda-eletronica-secret-2025',
    resave:            false,  // Não re-salva sessão se não houve mudança.
    saveUninitialized: false,  // Não salva sessões vazias (boa prática de privacidade).
    cookie: {
      httpOnly: true,                   // Cookie inacessível via JavaScript no browser.
      secure:   false,                  // true apenas com HTTPS em produção.
      maxAge:   24 * 60 * 60 * 1000,   // Expira em 24 horas.
    },
  }));

  // Log de todas as requisições HTTP recebidas.
  app.use((req, _res, next) => {
    const user = req.session?.user?.email || 'anônimo';
    logger.info('http', `${req.method} ${req.originalUrl} | Usuário: ${user}`);
    next();
  });

  // ── Rota raiz (health check) ───────────────────────────────────────────────
  app.get('/', (_req, res) => {
    res.json({
      api:     'Agenda Eletrônica — EC48B Programação Web Back-End',
      versao:  '2.0.0',
      status:  'online',
      rotas: {
        auth:          'POST /api/auth/register | POST /api/auth/login | POST /api/auth/logout | GET /api/auth/me',
        usuarios:      'GET /api/users | GET /api/users/:email | DELETE /api/users/:email',
        eventos:       'GET /api/events | GET /api/events/my | POST /api/events | GET /api/events/:id | DELETE /api/events/:id',
        participantes: 'GET|POST /api/events/:eventId/attendees | PATCH /api/events/:eventId/attendees/:email/status | DELETE /api/events/:eventId/attendees/:email',
      },
    });
  });

  // ── Rotas da API ───────────────────────────────────────────────────────────
  app.use('/api/auth',   createAuthRouter(userModel));
  app.use('/api/users',  createUsersRouter(userModel));
  app.use('/api/events', createEventsRouter(eventModel));

  // Rota de participantes aninhada sob eventos.
  // mergeParams: true no roteador filho garante acesso a :eventId.
  app.use(
    '/api/events/:eventId/attendees',
    createAttendeesRouter(eventModel, attendeeModel)
  );

  // ── Rota 404 (deve ser a última before o error handler) ───────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });

  // ── Handler global de erros (assinatura com 4 parâmetros é obrigatória) ───
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error('app', `Erro não tratado: ${err.message}`, err);
    res.status(500).json({ error: 'Erro interno no servidor. Verifique os logs.' });
  });

  return app;
}

module.exports = { createApp };
