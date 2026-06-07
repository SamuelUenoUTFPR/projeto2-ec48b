/**
 * @module routes/auth
 * @description Rotas de autenticação (registro, login, logout, perfil).
 *
 * POST /api/auth/register  — cria conta
 * POST /api/auth/login     — inicia sessão
 * POST /api/auth/logout    — encerra sessão (protegido)
 * GET  /api/auth/me        — dados do usuário logado (protegido)
 */
'use strict';

const express              = require('express');
const { isAuthenticated }  = require('../middlewares/auth');
const logger               = require('../utils/logger');

const ORIGIN = 'auth.routes';

/**
 * @param {import('../models/UserModel')} userModel
 * @returns {express.Router}
 */
module.exports = function createAuthRouter(userModel) {
  const router = express.Router();

  // ── POST /api/auth/register ───────────────────────────────────────────────
  router.post('/register', async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // Verificação de campos obrigatórios antes de chamar o model.
      const missing = [];
      if (!name)     missing.push('"name"');
      if (!email)    missing.push('"email"');
      if (!password) missing.push('"password"');
      if (missing.length) {
        return res.status(400).json({
          error: `Campos obrigatórios ausentes: ${missing.join(', ')}.`,
        });
      }

      const result = await userModel.insert({ name, email, password });

      return res.status(201).json({
        message: 'Usuário cadastrado com sucesso.',
        userId:  result.insertedId,
      });

    } catch (err) {
      logger.error(ORIGIN, `Falha em /register: ${err.message}`, err);
      const status = /Validação|já está cadastrado/i.test(err.message) ? 400 : 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ── POST /api/auth/login ──────────────────────────────────────────────────
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Campos "email" e "password" são obrigatórios.',
        });
      }

      const user = await userModel.authenticate(email, password);

      if (!user) {
        return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      }

      // Armazena dados do usuário na sessão.
      req.session.user = {
        id:    user._id.toString(),
        name:  user.name,
        email: user.email,
      };

      logger.info(ORIGIN, `Login bem-sucedido: ${email}`);
      return res.json({
        message: 'Login realizado com sucesso.',
        user:    req.session.user,
      });

    } catch (err) {
      logger.error(ORIGIN, `Falha em /login: ${err.message}`, err);
      return res.status(500).json({ error: 'Erro interno ao realizar login.' });
    }
  });

  // ── POST /api/auth/logout ─────────────────────────────────────────────────
  router.post('/logout', isAuthenticated, (req, res) => {
    const email = req.session.user?.email;

    req.session.destroy((err) => {
      if (err) {
        logger.error(ORIGIN, `Erro ao destruir sessão: ${err.message}`, err);
        return res.status(500).json({ error: 'Erro ao encerrar sessão.' });
      }
      res.clearCookie('connect.sid');
      logger.info(ORIGIN, `Logout: ${email}`);
      return res.json({ message: 'Logout realizado com sucesso.' });
    });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────────────────
  router.get('/me', isAuthenticated, (req, res) => {
    return res.json({ user: req.session.user });
  });

  return router;
};
