import { Router } from "express";
import * as messageController from "../controllers/message.controller.js";

const messageRouter = Router();

// FIX: added :conversationId param
messageRouter.get("/messages/:conversationId", messageController.getMessages);

// Thread replies for a given parent message
messageRouter.get(
  "/messages/:messageId/thread",
  messageController.getThreadMessages,
);

export default messageRouter;
