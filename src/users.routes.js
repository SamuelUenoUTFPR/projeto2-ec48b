/**
 * @module routes/users
 * @description Rotas de gerenciamento de usuários (todas protegidas).
 *
 * GET    /api/users        — lista todos os usuários
 * GET    /api/users/:email — busca por e-mail
 * DELETE /api/users/:email — remove a própria conta
 */
'use strict';

const express             = require('express');
const { isAuthenticated } = require('../middlewares/auth');
const logger              = require('../utils/logger');

const ORIGIN = 'users.routes';

/**
 * @param {import('../models/UserModel')} userModel
 * @returns {express.Router}
 */
module.exports = function createUsersRouter(userModel) {
  const router = express.Router();

  // Todas as rotas de usuário exigem autenticação.
  router.use(isAuthenticated);

  // ── GET /api/users ────────────────────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const users = await userModel.findAll();
      return res.json({ users, total: users.length });
    } catch (err) {
      logger.error(ORIGIN, `Falha em GET /users: ${err.message}`, err);
      return res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
  });

  // ── GET /api/users/:email ─────────────────────────────────────────────────
  router.get('/:email', async (req, res) => {
    try {
      const user = await userModel.findByEmail(req.params.email);
      if (!user) {
        return res.status(404).json({
          error: `Usuário com e-mail "${req.params.email}" não encontrado.`,
        });
      }
      return res.json({ user });
    } catch (err) {
      logger.error(ORIGIN, `Falha em GET /users/:email: ${err.message}`, err);
      const status = /inválido/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ── DELETE /api/users/:email ──────────────────────────────────────────────
  router.delete('/:email', async (req, res) => {
    try {
      // Regra de negócio: usuário só pode excluir a própria conta.
      if (req.params.email.toLowerCase() !== req.session.user.email.toLowerCase()) {
        return res.status(403).json({
          error: 'Você só pode excluir a sua própria conta.',
        });
      }

      const result = await userModel.deleteByEmail(req.params.email);
      if (result.deletedCount === 0) {
        return res.status(404).json({
          error: `Usuário "${req.params.email}" não encontrado.`,
        });
      }

      // Encerra a sessão após excluir a conta.
      req.session.destroy(() => {});
      return res.json({ message: `Conta "${req.params.email}" excluída com sucesso.` });

    } catch (err) {
      logger.error(ORIGIN, `Falha em DELETE /users/:email: ${err.message}`, err);
      const status = /inválido/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  return router;
};
