/**
 * @module middlewares/auth
 * @description Middleware de autenticação via sessão.
 * Bloqueia rotas protegidas caso não haja sessão ativa.
 */
'use strict';

const logger = require('../utils/logger');

/**
 * Verifica se existe uma sessão de usuário ativa.
 * Deve ser usado como middleware nas rotas que exigem login.
 */
function isAuthenticated(req, res, next) {
  if (!req.session || !req.session.user) {
    logger.warn(
      'auth.middleware',
      `Acesso não autenticado bloqueado: ${req.method} ${req.originalUrl}`
    );
    return res.status(401).json({
      error: 'Não autenticado. Faça login em POST /api/auth/login.',
    });
  }
  next();
}

module.exports = { isAuthenticated };
