// OpenAPI 3.0 spec for the Chat App API.
//
// REST endpoints are described under `paths`. Socket.IO is event-driven and
// can't be modelled by OpenAPI, so the full WebSocket reference lives in the
// markdown `info.description` below — Swagger UI renders it on the same page.

const websocketDescription = `
A real-time chat backend. REST endpoints are documented below; the real-time
layer runs on **Socket.IO** and is documented in this section.

## WebSocket (Socket.IO)

Connect from the client:

\`\`\`js
import { io } from "socket.io-client";
const socket = io("http://localhost:5000"); // or the deployed URL
\`\`\`

**Rooms used by the server**
- \`user:<userId>\` — a user's personal room (per-user notifications)
- \`<conversationId>\` — everyone currently viewing a conversation
- \`thread:<messageId>\` — everyone viewing a thread (parent message id)

### Client → Server events

| Event | Payload | Purpose |
|-------|---------|---------|
| \`registerUser\` | \`{ userId }\` | Join personal room \`user:<userId>\` |
| \`createConversation\` | \`{ name, isGroup, participants: [userId], createdBy }\` | Create a chat (dedupes 1-to-1); emits \`conversationCreated\` to each participant |
| \`joinConversation\` | \`{ conversationId }\` | Enter a conversation room |
| \`leaveConversation\` | \`{ conversationId }\` | Leave a conversation room |
| \`sendMessage\` | \`{ conversationId, senderId, type, text?, fileUrl?, fileName?, replyTo? }\` | Send a message. \`type\` ∈ \`text\|image\|file\`. \`replyTo\` = id of quoted message (optional) |
| \`markAsRead\` | \`{ conversationId, userId }\` | Reset unread count + mark messages read for this user |
| \`joinThread\` | \`{ messageId }\` | Enter a thread room (parent message id) |
| \`leaveThread\` | \`{ messageId }\` | Leave a thread room |
| \`sendThreadMessage\` | \`{ threadId, conversationId, senderId, type, text?, fileUrl?, fileName? }\` | Send a reply inside a thread (\`threadId\` = parent message id) |

### Server → Client events

| Event | Payload | When |
|-------|---------|------|
| \`conversationCreated\` | \`Conversation\` | A conversation involving you was created |
| \`conversationUpdated\` | \`Conversation\` | Last message / unread count changed |
| \`newMessage\` | \`Message\` (sender + \`replyTo\` populated) | New message in a conversation room |
| \`messagesRead\` | \`{ conversationId, userId }\` | A user read the conversation (update read-receipt ticks) |
| \`newThreadMessage\` | \`Message\` (sender populated) | New reply in a thread room |
| \`error\` | \`{ message }\` | An emitted action failed |
`;

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Chat App API",
    version: "1.0.0",
    description: websocketDescription,
  },
  servers: [
    { url: "http://localhost:5000", description: "Local" },
    {
      url: "https://nodejs-production-d170.up.railway.app",
      description: "Production (Railway)",
    },
  ],
  tags: [
    { name: "Users", description: "User accounts" },
    { name: "Conversations", description: "Chats and groups" },
    { name: "Messages", description: "Messages and threads" },
    { name: "Upload", description: "File uploads (Cloudinary)" },
  ],
  paths: {
    "/api/users": {
      post: {
        tags: ["Users"],
        summary: "Create a user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UserInput" },
            },
          },
        },
        responses: {
          201: {
            description: "Created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          400: { $ref: "#/components/responses/Error" },
        },
      },
      get: {
        tags: ["Users"],
        summary: "List all users (name + id only — phone is never sent)",
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/User" },
                },
              },
            },
          },
          500: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/users/login": {
      post: {
        tags: ["Users"],
        summary: "Log in by verifying a user's phone number (the secret)",
        description:
          "The phone number acts as a password. Pass the chosen user's id and " +
          "the phone they typed; returns the user only if it matches.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId", "phoneNumber"],
                properties: {
                  userId: { type: "string" },
                  phoneNumber: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
          401: { $ref: "#/components/responses/Error" },
          500: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/conversations": {
      post: {
        tags: ["Conversations"],
        summary: "Create a conversation (dedupes 1-to-1)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ConversationInput" },
            },
          },
        },
        responses: {
          201: {
            description: "Created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Conversation" },
              },
            },
          },
          200: {
            description: "Existing 1-to-1 conversation returned",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Conversation" },
              },
            },
          },
          500: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/conversations/{userId}": {
      get: {
        tags: ["Conversations"],
        summary: "List a user's conversations (newest first)",
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "User id",
          },
        ],
        responses: {
          200: {
            description: "OK (participants populated)",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Conversation" },
                },
              },
            },
          },
          500: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/messages/{conversationId}": {
      get: {
        tags: ["Messages"],
        summary: "Get top-level messages in a conversation",
        description:
          "Excludes thread replies. Sender and `replyTo` are populated.",
        parameters: [
          {
            name: "conversationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Message" },
                },
              },
            },
          },
          500: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/messages/{messageId}/thread": {
      get: {
        tags: ["Messages"],
        summary: "Get replies belonging to a thread",
        parameters: [
          {
            name: "messageId",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "Parent message id",
          },
        ],
        responses: {
          200: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Message" },
                },
              },
            },
          },
          500: { $ref: "#/components/responses/Error" },
        },
      },
    },
    "/api/upload": {
      post: {
        tags: ["Upload"],
        summary: "Upload a file to Cloudinary",
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary" },
                },
                required: ["file"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Uploaded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { url: { type: "string", format: "uri" } },
                },
              },
            },
          },
          400: { $ref: "#/components/responses/Error" },
          500: { $ref: "#/components/responses/Error" },
        },
      },
    },
  },
  components: {
    responses: {
      Error: {
        description: "Error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Error" },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          message: { type: "string" },
          error: { type: "string" },
        },
      },
      UserInput: {
        type: "object",
        required: ["name", "phoneNumber"],
        properties: {
          name: { type: "string", example: "Alice" },
          phoneNumber: { type: "string", example: "+15550100" },
        },
      },
      User: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string" },
          phoneNumber: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ConversationInput: {
        type: "object",
        required: ["participants"],
        properties: {
          name: {
            type: "string",
            nullable: true,
            description: "Group name; null for 1-to-1",
          },
          isGroup: { type: "boolean", default: false },
          participants: {
            type: "array",
            items: { type: "string" },
            description: "User ids",
          },
          createdBy: { type: "string" },
        },
      },
      Conversation: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string", nullable: true },
          isGroup: { type: "boolean" },
          participants: {
            type: "array",
            description: "User ids, or populated User objects",
            items: {},
          },
          lastMessage: { type: "string" },
          lastMessageAt: { type: "string", format: "date-time" },
          unreadCounts: {
            type: "object",
            description: "Map of userId -> unread message count",
            additionalProperties: { type: "integer" },
            example: { "652f...": 3 },
          },
          lastReadAt: {
            type: "object",
            description:
              "Map of userId -> last-read timestamp (read cursor; drives read receipts)",
            additionalProperties: { type: "string", format: "date-time" },
            example: { "652f...": "2026-06-22T10:00:00.000Z" },
          },
          createdBy: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Message: {
        type: "object",
        properties: {
          _id: { type: "string" },
          conversationId: { type: "string" },
          senderId: {
            description: "User id, or populated User object",
            oneOf: [
              { type: "string" },
              { $ref: "#/components/schemas/User" },
            ],
          },
          type: { type: "string", enum: ["text", "image", "file"] },
          text: { type: "string" },
          fileUrl: { type: "string", nullable: true },
          fileName: { type: "string", nullable: true },
          replyTo: {
            nullable: true,
            description: "Quoted message id, or populated Message",
            oneOf: [
              { type: "string" },
              { $ref: "#/components/schemas/Message" },
            ],
          },
          threadId: {
            type: "string",
            nullable: true,
            description: "Parent message id when this is a thread reply",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
};

export default openApiSpec;
