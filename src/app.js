import express from "express";
import morgan from "morgan";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import "dotenv/config";

import { openApiSpec } from "./config/swagger.js";

// Routes
import userRouter from "./routes/user.route.js";
import conversationRouter from "./routes/conversation.route.js";
import messageRouter from "./routes/message.route.js";
import uploadRouter from "./routes/upload.route.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// API docs (REST + WebSocket reference)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

// API Routes
app.use("/api", userRouter);
app.use("/api", conversationRouter);
app.use("/api", messageRouter);
app.use("/api", uploadRouter);

export default app;
