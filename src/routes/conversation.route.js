import { Router } from "express";
import * as conversationController from "../controllers/conversation.controller.js";

const conversationRouter = Router();

conversationRouter.post(
  "/conversations",
  conversationController.createConversation,
);
// FIX: added :userId param
conversationRouter.get(
  "/conversations/:userId",
  conversationController.getConversations,
);

export default conversationRouter;
