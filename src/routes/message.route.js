import { Router } from "express";
import * as messageController from "../controllers/message.controller.js";

const messageRouter = Router();

// FIX: added :conversationId param
messageRouter.get("/messages/:conversationId", messageController.getMessages);

export default messageRouter;
