/**
 * @file server.js
 * @description Ponto de entrada da aplicação.
 *
 * Responsabilidades:
 *   1. Conectar ao MongoDB e criar índices de unicidade.
 *   2. Instanciar os models do Projeto 1.
 *   3. Criar e iniciar o servidor Express.
 *   4. Graceful shutdown ao receber SIGTERM/SIGINT.
 *
 * Execute com: node server.js
 */
'use strict';

require('dotenv').config();

const { connect, getDb, disconnect } = require('./src/db/connection');
const { createApp }                  = require('./app');
const UserModel                      = require('./src/models/UserModel');
const EventModel                     = require('./src/models/EventModel');
const AttendeeModel                  = require('./src/models/AttendeeModel');
const logger                         = require('./src/utils/logger');

const PORT = parseInt(process.env.PORT || '3000', 10);

// ─────────────────────────────────────────────────────────────────────────────
// Criação de índices MongoDB
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Garante a existência dos índices de unicidade necessários para o domínio.
 * Idempotente: MongoDB ignora a criação se o índice já existir.
 */
async function ensureIndexes() {
  const db = getDb();

  // E-mail de usuário deve ser único no sistema.
  await db.collection('users').createIndex(
    { email: 1 },
    { unique: true, name: 'unique_user_email' }
  );

  // Um usuário não pode ser convidado duas vezes para o mesmo evento.
  await db.collection('attendees').createIndex(
    { eventId: 1, userEmail: 1 },
    { unique: true, name: 'unique_attendee_per_event' }
  );

  // Índice de performance: busca de eventos por criador.
  await db.collection('events').createIndex(
    { creatorEmail: 1 },
    { name: 'idx_event_creator' }
  );

  logger.info('server', 'Índices do MongoDB verificados/criados com sucesso.');
}

// ─────────────────────────────────────────────────────────────────────────────
// Inicialização do servidor
// ─────────────────────────────────────────────────────────────────────────────

async function startServer() {
  try {
    // 1. Conecta ao MongoDB.
    await connect();

    // 2. Cria índices de unicidade e performance.
    await ensureIndexes();

    // 3. Instancia os models (reutilizam a conexão singleton).
    const userModel     = new UserModel();
    const eventModel    = new EventModel();
    const attendeeModel = new AttendeeModel();

    // 4. Cria a aplicação Express com os models injetados.
    const app = createApp({ userModel, eventModel, attendeeModel });

    // 5. Inicia o servidor HTTP.
    const server = app.listen(PORT, () => {
      logger.info('server', `Servidor iniciado em http://localhost:${PORT}`);
      console.log('\n╔═══════════════════════════════════════════════════════╗');
      console.log('║   Agenda Eletrônica API — Projeto 2 EC48B             ║');
      console.log(`║   🚀  http://localhost:${PORT}                           ║`);
      console.log('╚═══════════════════════════════════════════════════════╝\n');
    });

    // 6. Graceful shutdown: encerra conexões adequadamente.
    async function shutdown(signal) {
      logger.info('server', `Sinal ${signal} recebido. Encerrando servidor...`);
      server.close(async () => {
        await disconnect();
        logger.info('server', 'Servidor encerrado com sucesso.');
        process.exit(0);
      });
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('server', `Falha crítica ao iniciar: ${err.message}`, err);
    await disconnect();
    process.exit(1);
  }
}

startServer();
