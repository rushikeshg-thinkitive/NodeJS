# Chat App — Backend (Node + Express + Socket.IO + MongoDB)

A real-time chat API (WhatsApp-style) with one-to-one chat, group chat, and
file/image upload. No authentication in V1.

Pairs with the React frontend in [`../FE_WEBSOCKET`](../FE_WEBSOCKET).

---

## Tech stack

- **Node.js + Express** — REST API
- **Socket.IO** — real-time events
- **MongoDB + Mongoose** — data storage
- **Multer** — file uploads
- ES Modules (`"type": "module"`)

---

## Setup & run

```bash
npm install
```

Create a `.env` file:

```
MONGO_URI=<your MongoDB connection string>
PORT=5000
```

Start the server (auto-reloads with nodemon):

```bash
npm run dev
```

You should see `Server is running on port 5000`.

> Express and Socket.IO share **one** HTTP server (see `index.js`), which is why
> we use `createServer(app)` instead of `app.listen()`.

---

## REST API

Base URL: `http://localhost:5000/api`

| Method | Endpoint                      | Body / Params                                  | Returns                                  |
| ------ | ----------------------------- | ---------------------------------------------- | ---------------------------------------- |
| POST   | `/users`                      | `{ name, phoneNumber }`                        | created user                             |
| GET    | `/users`                      | —                                              | all users                                |
| POST   | `/conversations`              | `{ name, isGroup, participants[], createdBy }` | created (or existing) conversation       |
| GET    | `/conversations/:userId`      | `:userId`                                      | that user's conversations (newest first) |
| GET    | `/messages/:conversationId`   | `:conversationId`                              | that chat's messages (oldest first)      |
| POST   | `/upload`                     | form-data field `file`                         | `{ url: "/uploads/<name>" }`             |

Uploaded files are served statically at `http://localhost:5000/uploads/<name>`.

> REST is used for **loading history** and **uploading files**. Live actions go
> through Socket.IO (below).

---

## Socket.IO events

Connect to `http://localhost:5000`.

### Client → Server

| Event                | Payload                                                              | Purpose                              |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------ |
| `registerUser`       | `{ userId }`                                                         | Join your personal room for notifications |
| `createConversation` | `{ name, isGroup, participants[], createdBy }`                       | Create a chat, notify participants   |
| `joinConversation`   | `{ conversationId }`                                                 | Enter a chat room to receive its messages |
| `leaveConversation`  | `{ conversationId }`                                                 | Leave a chat room (call before switching) |
| `sendMessage`        | `{ conversationId, senderId, type, text?, fileUrl?, fileName? }`     | Save + broadcast a message           |

`type` is `"text" | "image" | "file"`.

### Server → Client

| Event                 | Payload         | Sent to                  | Notes                               |
| --------------------- | --------------- | ------------------------ | ----------------------------------- |
| `conversationCreated` | conversation    | each participant's room  | participants are **IDs only**       |
| `conversationUpdated` | conversation    | each participant's room  | participants are **IDs only**       |
| `newMessage`          | message         | the conversation room    | `senderId` is **populated**         |
| `error`               | `{ message }`   | the offending socket     | on failures                         |

### How the two rooms work

- **Personal room** `user:<userId>` — joined via `registerUser`. Drives the live
  **conversation list** (left side): you get `conversationCreated` /
  `conversationUpdated` for any of your chats.
- **Conversation room** `<conversationId>` — joined via `joinConversation`. Drives
  the live **open chat** (right side): you get `newMessage` only for that chat.

---

## Data models

**User** — `{ name, phoneNumber (unique) }`

**Conversation** — `{ name (null for 1-to-1), isGroup, participants[ref User],
lastMessage, lastMessageAt, createdBy }`

**Message** — `{ conversationId, senderId, type (text|image|file), text, fileUrl,
fileName }`

Both `Conversation.participants` and `Message.{conversationId,createdAt}` are
indexed for fast lookups.

---

## Project structure

```
index.js                       Entry: connect DB, create HTTP server, start Socket.IO
src/
  app.js                       Express app: middleware + route mounting
  config/
    config.js                  Config values
    database.js                MongoDB connection
  routes/                      user / conversation / message / upload routes
  controllers/                 Request handlers for the REST routes
  models/                      Mongoose schemas (User, Conversation, Message)
  socket/
    socket.js                  All Socket.IO event handlers
uploads/                       Uploaded files (served at /uploads)
```

---

## Notes

- **No auth in V1** — clients identify themselves by sending a `userId`.
- **CORS** is open (`origin: "*"`) for local development.
- Sending a message updates the conversation's `lastMessage` / `lastMessageAt`,
  which is what powers the live, auto-sorting conversation list on the frontend.
```

