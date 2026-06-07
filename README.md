# Agenda Eletrônica — API REST com Express.js

**Disciplina:** EC48B-C71 — Programação Web Back-End  
**UTFPR — Campus Cornélio Procópio**  
**Projeto 2** — API REST sobre a biblioteca do Projeto 1

---

## Estrutura de Diretórios

```
projeto2/
├── src/
│   ├── db/
│   │   └── connection.js          # Singleton de conexão MongoDB (Projeto 1, corrigido)
│   ├── models/
│   │   ├── UserModel.js           # Coleção users (Projeto 1, corrigido)
│   │   ├── EventModel.js          # Coleção events (Projeto 1, corrigido)
│   │   └── AttendeeModel.js       # Coleção attendees (Projeto 1, corrigido)
│   ├── utils/
│   │   ├── logger.js              # Log em arquivo com fs nativo
│   │   └── validators.js          # Utilitários de validação compartilhados
│   ├── middlewares/
│   │   └── auth.js                # Middleware de autenticação via sessão
│   └── routes/
│       ├── auth.routes.js         # /api/auth — registro, login, logout
│       ├── users.routes.js        # /api/users — CRUD de usuários
│       ├── events.routes.js       # /api/events — CRUD de eventos
│       └── attendees.routes.js    # /api/events/:id/attendees — participantes
├── logs/                          # Arquivos de log gerados automaticamente
│   └── YYYY-MM-DD.log
├── .env                           # Configurações (não versionar)
├── app.js                         # Fábrica do Express (rotas + middlewares)
├── server.js                      # Ponto de entrada — conecta e inicia
├── package.json
└── README.md
```

---

## Correções do Projeto 1 Aplicadas

| Problema reportado | Solução implementada |
|---|---|
| Métodos sem try/catch e log | **Todos** os métodos têm try/catch + logger.error() em arquivo |
| Conexão não logava em arquivo | connection.js: todos os caminhos de erro chamam logger.error() |
| AttendeeModel incompleto | Adicionados findAll() e findById(); todos os métodos revisados |
| Validação de e-mail fraca | Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` em validators.js (centralizado) |
| Datas inválidas | parseDate() lança Error identificando o campo e o valor problemático |
| IDs inválidos | parseObjectId() usa ObjectId.isValid() antes de construir o objeto |

---

## Critérios do Projeto 2 Atendidos

| Critério | Como foi implementado |
|---|---|
| Rotas GET/POST | GET, POST, PATCH, DELETE em todos os recursos |
| Recebimento de parâmetros | req.body (JSON), req.params (URL), req.query (filtros) |
| Sessões (express-session) | Sessão criada no login, destruída no logout, verificada nas rotas |
| Rotina de login | POST /api/auth/login com autenticação por e-mail + senha |
| Campos obrigatórios + mensagens | Verificação prévia nas rotas + validação nos models, erros em JSON |
| Casos de uso da temática | CRUD completo de usuários, eventos e participantes |

---

## Pré-requisitos

- **Node.js** v18 ou superior  
- **MongoDB** rodando localmente (porta padrão: 27017)

### Instalar MongoDB (se necessário)

```bash
# Ubuntu/Debian
sudo apt-get install -y mongodb

# macOS (via Homebrew)
brew install mongodb-community

# Windows: baixar o instalador em https://www.mongodb.com/try/download/community
```

---

## Instalação e Execução

```bash
# 1. Entrar na pasta do projeto
cd projeto2

# 2. Instalar dependências
npm install

# 3. (Opcional) Ajustar variáveis de ambiente
# O arquivo .env já está configurado para localhost:27017
# Edite-o se o seu MongoDB usar host/porta diferente.

# 4. Iniciar o servidor
node server.js
```

Você verá no terminal:
```
╔═══════════════════════════════════════════════════════╗
║   Agenda Eletrônica API — Projeto 2 EC48B             ║
║   🚀  http://localhost:3000                           ║
╚═══════════════════════════════════════════════════════╝
```

---

## Testando a API com curl

> **Dica:** Use o arquivo `cookies.txt` para que o curl mantenha a sessão entre as requisições.  
> Em Windows CMD, substitua `\` por `^` para quebra de linha, ou use o PowerShell.

---

### 1. Verificar que o servidor está online

```bash
curl http://localhost:3000/
```

---

### 2. Cadastrar usuários

```bash
# Usuário Ana (criadora de eventos)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Ana Souza","email":"ana@email.com","password":"senha123"}'

# Usuário Carlos (participante)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Carlos Lima","email":"carlos@email.com","password":"senha456"}'

# Usuário Beatriz (participante)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Beatriz Ramos","email":"beatriz@email.com","password":"senha789"}'
```

---

### 3. Login (inicia sessão)

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"ana@email.com","password":"senha123"}'
```

---

### 4. Ver usuário logado

```bash
curl http://localhost:3000/api/auth/me -b cookies.txt
```

---

### 5. Listar todos os usuários

```bash
curl http://localhost:3000/api/users -b cookies.txt
```

---

### 6. Criar evento

```bash
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Reunião de Planejamento Q1",
    "description": "Definir metas do primeiro trimestre",
    "location": "Sala de Conferências A",
    "startDate": "2025-02-10T09:00:00",
    "endDate": "2025-02-10T11:00:00"
  }'
```

> Copie o `eventId` retornado para os próximos comandos.

```bash
# Crie mais um evento para ter dados variados
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Workshop de Node.js",
    "startDate": "2025-02-15T14:00:00",
    "endDate": "2025-02-15T18:00:00"
  }'
```

---

### 7. Listar meus eventos

```bash
curl http://localhost:3000/api/events/my -b cookies.txt
```

---

### 8. Buscar evento por ID

```bash
curl http://localhost:3000/api/events/SEU_EVENT_ID -b cookies.txt
```

---

### 9. Buscar eventos por intervalo de datas

```bash
curl "http://localhost:3000/api/events?from=2025-02-01&to=2025-02-28" -b cookies.txt
```

---

### 10. Convidar participante para o evento

```bash
curl -X POST http://localhost:3000/api/events/SEU_EVENT_ID/attendees \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"userEmail":"carlos@email.com"}'

curl -X POST http://localhost:3000/api/events/SEU_EVENT_ID/attendees \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"userEmail":"beatriz@email.com"}'
```

---

### 11. Listar participantes do evento

```bash
curl http://localhost:3000/api/events/SEU_EVENT_ID/attendees -b cookies.txt
```

---

### 12. Carlos responde ao convite (login como Carlos)

```bash
# Login como Carlos
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies_carlos.txt \
  -d '{"email":"carlos@email.com","password":"senha456"}'

# Carlos aceita o convite
curl -X PATCH \
  http://localhost:3000/api/events/SEU_EVENT_ID/attendees/carlos@email.com/status \
  -H "Content-Type: application/json" \
  -b cookies_carlos.txt \
  -d '{"status":"accepted"}'
```

---

### 13. Remover participante

```bash
# Volta para a sessão de Ana
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"ana@email.com","password":"senha123"}'

# Ana remove Beatriz do evento
curl -X DELETE \
  http://localhost:3000/api/events/SEU_EVENT_ID/attendees/beatriz@email.com \
  -b cookies.txt
```

---

### 14. Excluir evento

```bash
curl -X DELETE http://localhost:3000/api/events/SEU_EVENT_ID -b cookies.txt
```

---

### 15. Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt
```

---

### 16. Testar erros (demonstração de mensagens de erro)

```bash
# Erro: campo obrigatório ausente
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste"}'

# Erro: e-mail inválido
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste","email":"nao-e-email","password":"123456"}'

# Erro: data inválida no evento
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"Evento","startDate":"nao-e-data","endDate":"2025-02-10T11:00:00"}'

# Erro: endDate antes de startDate
curl -X POST http://localhost:3000/api/events \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"title":"Evento","startDate":"2025-02-10T18:00:00","endDate":"2025-02-10T08:00:00"}'

# Erro: acesso sem login (401)
curl http://localhost:3000/api/events/my
```

---

## Arquivos de Log

Todos os erros e ações são persistidos em `logs/YYYY-MM-DD.log`:

```
[2025-02-10T14:30:01.123Z] [INFO ] [auth.routes] Login bem-sucedido: ana@email.com
[2025-02-10T14:30:05.456Z] [ERROR] [EventModel] Validação falhou para EventModel:
  - "endDate" não pode ser anterior a "startDate".
  Stack: Error: Validação falhou ...
```

---

## Resumo das Rotas

| Método | Rota | Autenticação | Descrição |
|--------|------|:---:|-----------|
| GET | / | ✗ | Health check |
| POST | /api/auth/register | ✗ | Cadastrar usuário |
| POST | /api/auth/login | ✗ | Login (cria sessão) |
| POST | /api/auth/logout | ✔ | Logout (destrói sessão) |
| GET | /api/auth/me | ✔ | Dados do usuário logado |
| GET | /api/users | ✔ | Listar usuários |
| GET | /api/users/:email | ✔ | Buscar usuário por e-mail |
| DELETE | /api/users/:email | ✔ | Excluir conta própria |
| GET | /api/events | ✔ | Listar eventos (com filtros) |
| GET | /api/events/my | ✔ | Meus eventos |
| POST | /api/events | ✔ | Criar evento |
| GET | /api/events/:id | ✔ | Buscar evento por ID |
| DELETE | /api/events/:id | ✔ | Excluir evento (criador) |
| GET | /api/events/:id/attendees | ✔ | Listar participantes |
| POST | /api/events/:id/attendees | ✔ | Convidar participante (criador) |
| PATCH | /api/events/:id/attendees/:email/status | ✔ | Aceitar/recusar convite (próprio) |
| DELETE | /api/events/:id/attendees/:email | ✔ | Remover participante |
