# Chat App — Backend (Node + Express + Socket.IO + MongoDB)

A real-time chat API (WhatsApp-style) with one-to-one chat, group chat, and
file/image upload. No authentication in V1.

Pairs with the React frontend in [`../FE_WEBSOCKET`](../FE_WEBSOCKET).

---

## Tech stack

- **Node.js + Express** — REST API
- **Socket.IO** — real-time events
- **MongoDB + Mongoose** — data storage
- **Multer + Cloudinary** — file uploads (stored on Cloudinary)
- ES Modules (`"type": "module"`)

**Features:** 1-to-1 & group chat, image/file upload, **unread counts**,
**read receipts**, **replies (quote)**, and **threads**.

---

## Setup & run

```bash
npm install
```

Create a `.env` file:

```
MONGO_URI=<your MongoDB connection string>
PORT=5000

# Cloudinary (for file/image uploads)
CLOUDINARY_CLOUD_NAME=<your cloud name>
CLOUDINARY_API_KEY=<your api key>
CLOUDINARY_API_SECRET=<your api secret>
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
| POST   | `/users`                      | `{ name, phoneNumber }`                        | created user (409 if phone already used) |
| POST   | `/users/login`                | `{ userId, phoneNumber }`                      | the user if the phone matches, else 401  |
| GET    | `/users`                      | —                                              | all users (**name + id only**, no phone) |
| POST   | `/conversations`              | `{ name, isGroup, participants[], createdBy }` | created (or existing) conversation       |
| GET    | `/conversations/:userId`      | `:userId` · `?limit=20&before=<ISO>`           | conversations page (newest first)        |
| GET    | `/messages/:conversationId`   | `:conversationId` · `?limit=50&before=<ISO>`   | messages page (oldest→newest within page) |
| GET    | `/messages/:messageId/thread` | `:messageId`                                   | replies in that message's thread         |
| POST   | `/upload`                     | form-data field `file`                         | `{ url: "<cloudinary url>" }`            |

Uploads go to **Cloudinary**; `/upload` returns a full `secure_url`. The main
message list excludes thread replies (`threadId: null`).

**Cursor pagination** (both list endpoints): `limit` sets the page size (messages 50,
conversations 20 by default); `before` is an ISO date cursor (`createdAt` for messages,
`lastMessageAt` for conversations) that returns the page *older* than it. Omit `before`
for the newest page. This powers WhatsApp-style infinite scroll on the frontend.

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
| `sendMessage`        | `{ conversationId, senderId, type, text?, fileUrl?, fileName?, replyTo? }` | Save + broadcast a message     |
| `markAsRead`         | `{ conversationId, userId }`                                         | Reset unread + mark messages read    |
| `joinThread` / `leaveThread` | `{ messageId }`                                             | Enter / leave a thread room          |
| `sendThreadMessage`  | `{ threadId, conversationId, senderId, type, text?, fileUrl?, fileName? }` | Save + broadcast a thread reply |

`type` is `"text" | "image" | "file"`. `replyTo` is the quoted message's `_id`.

### Server → Client

| Event                 | Payload                        | Sent to                  | Notes                          |
| --------------------- | ------------------------------ | ------------------------ | ------------------------------ |
| `conversationCreated` | conversation                   | each participant's room  | participants **populated** (same shape as REST) |
| `conversationUpdated` | conversation                   | each participant's room  | participants **populated**; carries `unreadCounts` |
| `newMessage`          | message                        | the conversation room    | `senderId` + `replyTo` populated |
| `messagesRead`        | `{ conversationId, userId, readAt }` | the conversation room | advances reader's cursor; others flip ✓→✓✓ |
| `newThreadMessage`    | message                        | the thread room          | `senderId` populated           |
| `threadUpdated`       | `{ messageId }`                | the conversation room    | parent now has a thread (sets indicator) |
| `error`               | `{ message }`                  | the offending socket     | on failures                    |

### How the two rooms work

- **Personal room** `user:<userId>` — joined via `registerUser`. Drives the live
  **conversation list** (left side): you get `conversationCreated` /
  `conversationUpdated` for any of your chats.
- **Conversation room** `<conversationId>` — joined via `joinConversation`. Drives
  the live **open chat** (right side): you get `newMessage` only for that chat.

---

## Data models

**User** — `{ name, phoneNumber (unique) }` — the phone number doubles as a login secret
(verified by `POST /users/login`) and is never returned by `GET /users`.

**Conversation** — `{ name (null for 1-to-1), isGroup, participants[ref User],
lastMessage, lastMessageAt, createdBy, unreadCounts (Map userId→count),
lastReadAt (Map userId→date) }`

**Message** — `{ conversationId, senderId, type (text|image|file), text, fileUrl,
fileName, replyTo (ref Message), threadId (ref Message), hasThread }`

- `unreadCounts` — per-user unread tally; bumped on send, reset by `markAsRead`.
- `lastReadAt` (on Conversation) — per-user **read cursor**; `markAsRead` sets it to "now"
  in one write. A message is read by user X when `message.createdAt <= lastReadAt[X]`
  (drives ✓✓ read receipts). Replaces the old per-message `readBy` array.
- `replyTo` — inline quote; the message stays in the main list.
- `threadId` — set on thread replies; main list returns only `threadId: null`.
- `hasThread` — set `true` on a parent message once it gets its first thread reply;
  the frontend uses it to show a "thread exists" indicator (no count). A `threadUpdated`
  event is emitted to the conversation room so the indicator appears live.

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
```

---

## Notes

- **Lightweight auth in V1** — login verifies the user's phone number (the secret) via
  `POST /users/login`; after that, clients identify themselves by sending their `userId`.
  No tokens/sessions yet, so the `userId` on socket/REST calls is still trusted as-is.
- **CORS** — the Socket.IO server allows a specific list of origins (localhost
  dev ports + the deployed frontend URL) in `src/socket/socket.js`. Add your own
  frontend origin there if needed.
- **Uploads** go to **Cloudinary** (files are streamed from memory, not saved to
  disk), so `/upload` returns a full hosted URL.
- Sending a message updates the conversation's `lastMessage` / `lastMessageAt`
  and per-user `unreadCounts`, which powers the live, auto-sorting conversation
  list and unread badges on the frontend.
```

