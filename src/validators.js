/**
 * @module validators
 * @description Utilitários de validação compartilhados entre os Models.
 *
 * Centraliza regex de e-mail, parse de ObjectId e parse de datas para
 * evitar duplicação de código e garantir comportamento consistente em
 * todos os módulos.
 */
'use strict';

const { ObjectId } = require('mongodb');

/** Regex de validação de e-mail (RFC 5322 simplificado). */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Verifica se uma string é um endereço de e-mail válido.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

/**
 * Verifica se um valor é um ObjectId MongoDB válido.
 * @param {*} id
 * @returns {boolean}
 */
function isValidObjectId(id) {
  return Boolean(id) && ObjectId.isValid(id);
}

/**
 * Converte uma string em ObjectId, lançando Error descritivo se inválido.
 * @param {string} id        - Valor a converter.
 * @param {string} fieldName - Nome do campo (usado na mensagem de erro).
 * @returns {ObjectId}
 * @throws {Error} Se ausente ou inválido.
 */
function parseObjectId(id, fieldName = 'id') {
  if (!id) {
    throw new Error(`Campo "${fieldName}" é obrigatório.`);
  }
  if (!ObjectId.isValid(id)) {
    throw new Error(
      `Campo "${fieldName}" inválido: "${id}" não é um ObjectId válido.`
    );
  }
  return new ObjectId(id);
}

/**
 * Converte um valor em Date, lançando Error descritivo se inválido.
 * @param {string|Date} value     - Valor a converter.
 * @param {string}      fieldName - Nome do campo (usado na mensagem de erro).
 * @returns {Date}
 * @throws {Error} Se ausente ou não conversível.
 */
function parseDate(value, fieldName) {
  if (!value) {
    throw new Error(`Campo "${fieldName}" é obrigatório.`);
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(
      `Campo "${fieldName}" inválido: "${value}" não é uma data válida. ` +
      'Use o formato ISO 8601 (ex: 2025-02-10T09:00:00).'
    );
  }
  return date;
}

module.exports = { EMAIL_REGEX, isValidEmail, isValidObjectId, parseObjectId, parseDate };
