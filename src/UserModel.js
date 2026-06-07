/**
 * @class UserModel
 * @description Acesso à coleção `users` no MongoDB.
 *
 * CORREÇÕES aplicadas (feedback da professora):
 *   - Validação de e-mail agora usa regex completo (não apenas includes('@')).
 *   - Senha armazenada com hash SHA-256 via módulo nativo `crypto`.
 *   - Todos os métodos possuem try/catch com log em arquivo.
 *   - Projeção { password: 0 } garante que a hash nunca vaze para o cliente.
 *   - Novo método `authenticate()` encapsula a lógica de login.
 *
 * Esquema do documento:
 * { _id, name, email (único), password (hash), createdAt }
 */
'use strict';

const crypto                                     = require('crypto');
const { getDb }                                  = require('../db/connection');
const logger                                     = require('../utils/logger');
const { isValidEmail }                           = require('../utils/validators');

const COLLECTION = 'users';
const ORIGIN     = 'UserModel';

// ─────────────────────────────────────────────────────────────────────────────
// Função interna de hashing de senha
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera um hash SHA-256 da senha com sal fixo.
 * (Em produção, usar bcrypt com sal aleatório por usuário.)
 * @param {string} password
 * @returns {string} Hash hexadecimal de 64 caracteres.
 */
function hashPassword(password) {
  return crypto
    .createHash('sha256')
    .update(`${password}:agenda_salt_2025`)
    .digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────

class UserModel {
  _collection() {
    return getDb().collection(COLLECTION);
  }

  // ── Validação ──────────────────────────────────────────────────────────────

  /**
   * Valida campos obrigatórios e lança Error com lista de problemas.
   * CORREÇÃO: e-mail validado com regex, não apenas includes('@').
   */
  _validate(data) {
    const errors = [];

    if (!data || typeof data !== 'object') {
      throw new Error('Os dados do usuário devem ser um objeto válido.');
    }
    if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('Campo "name" é obrigatório e não pode ser vazio.');
    }
    if (!data.email || !isValidEmail(data.email)) {
      errors.push(
        'Campo "email" é obrigatório e deve ser válido (ex: usuario@dominio.com).'
      );
    }
    if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
      errors.push('Campo "password" é obrigatório e deve ter no mínimo 6 caracteres.');
    }

    if (errors.length > 0) {
      throw new Error(`Validação falhou para UserModel:\n  - ${errors.join('\n  - ')}`);
    }
  }

  // ── Operações SGBD ─────────────────────────────────────────────────────────

  /**
   * Insere novo usuário com senha hasheada.
   * @param {{ name, email, password }} data
   */
  async insert(data) {
    try {
      this._validate(data);

      const document = {
        name:      data.name.trim(),
        email:     data.email.toLowerCase().trim(),
        password:  hashPassword(data.password),
        createdAt: new Date(),
      };

      const result = await this._collection().insertOne(document);
      logger.info(ORIGIN, `Usuário inserido: ${document.email} | ID: ${result.insertedId}`);
      return result;

    } catch (err) {
      if (err.code === 11000) {
        const friendly = new Error(`O e-mail "${data.email}" já está cadastrado.`);
        logger.error(ORIGIN, friendly.message, friendly);
        throw friendly;
      }
      logger.error(ORIGIN, `Falha em insert: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Autentica um usuário comparando senha com o hash armazenado.
   * Retorna o usuário (sem senha) ou null se credenciais inválidas.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object|null>}
   */
  async authenticate(email, password) {
    try {
      if (!email || !isValidEmail(email)) {
        throw new Error(`E-mail inválido para autenticação: "${email}".`);
      }
      if (!password || password.length < 1) {
        throw new Error('Senha é obrigatória para autenticação.');
      }

      // Busca com senha para comparação.
      const user = await this._collection().findOne({
        email: email.toLowerCase().trim(),
      });

      if (!user) {
        logger.warn(ORIGIN, `Autenticação falhou: e-mail não encontrado: ${email}`);
        return null;
      }

      if (user.password !== hashPassword(password)) {
        logger.warn(ORIGIN, `Autenticação falhou: senha incorreta para ${email}`);
        return null;
      }

      // Retorna usuário sem o campo password.
      const { password: _pwd, ...userSemSenha } = user;
      logger.info(ORIGIN, `Autenticação bem-sucedida: ${email}`);
      return userSemSenha;

    } catch (err) {
      logger.error(ORIGIN, `Falha em authenticate: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Busca usuário por e-mail. Nunca retorna a senha.
   * CORREÇÃO: try/catch + log em arquivo adicionados.
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    try {
      if (!email || !isValidEmail(email)) {
        throw new Error(`E-mail inválido para busca: "${email}".`);
      }

      const user = await this._collection().findOne(
        { email: email.toLowerCase().trim() },
        { projection: { password: 0 } }
      );

      if (user) {
        logger.info(ORIGIN, `Usuário encontrado: ${email}`);
      } else {
        logger.warn(ORIGIN, `Usuário não encontrado: ${email}`);
      }

      return user;

    } catch (err) {
      logger.error(ORIGIN, `Falha em findByEmail: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Lista todos os usuários. Nunca retorna senhas.
   * CORREÇÃO: try/catch + log em arquivo adicionados.
   * @returns {Promise<Object[]>}
   */
  async findAll() {
    try {
      const users = await this._collection()
        .find({}, { projection: { password: 0 } })
        .sort({ createdAt: -1 })
        .toArray();

      logger.info(ORIGIN, `findAll: ${users.length} usuário(s) encontrado(s).`);
      return users;

    } catch (err) {
      logger.error(ORIGIN, `Falha em findAll: ${err.message}`, err);
      throw err;
    }
  }

  /**
   * Remove usuário pelo e-mail.
   * CORREÇÃO: try/catch + log em arquivo adicionados.
   * @param {string} email
   * @returns {Promise<import('mongodb').DeleteResult>}
   */
  async deleteByEmail(email) {
    try {
      if (!email || !isValidEmail(email)) {
        throw new Error(`E-mail inválido para deleção: "${email}".`);
      }

      const result = await this._collection().deleteOne({
        email: email.toLowerCase().trim(),
      });

      if (result.deletedCount > 0) {
        logger.info(ORIGIN, `Usuário removido: ${email}`);
      } else {
        logger.warn(ORIGIN, `Nenhum usuário encontrado para remover: ${email}`);
      }

      return result;

    } catch (err) {
      logger.error(ORIGIN, `Falha em deleteByEmail: ${err.message}`, err);
      throw err;
    }
  }
}

module.exports = UserModel;
