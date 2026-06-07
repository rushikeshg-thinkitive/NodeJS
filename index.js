import { createServer } from "http";
import app from "./src/app.js";
import connectDB from "./src/config/database.js";
import { initSocket } from "./src/socket/socket.js";
import "dotenv/config";

const PORT = process.env.PORT || 5000;

// 1. Connect to MongoDB
await connectDB();

// 2. Wrap Express in a raw HTTP server
//    Socket.IO needs this — it can't attach to app.listen() directly
const httpServer = createServer(app);

// 3. Initialize Socket.IO on the same HTTP server
initSocket(httpServer);

// 4. Start the server
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
