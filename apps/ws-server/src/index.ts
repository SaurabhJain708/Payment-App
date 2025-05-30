import http from "http";
import { WebSocket } from "ws";

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  console.log("Client connected");

  // Handle incoming messages
  ws.on("message", (message) => {
    console.log(`Received: ${message}`);

    // Echo back the message
    ws.send(`Server says: ${message}`);
  });

  // Handle disconnection
  ws.on("close", () => {
    console.log("Client disconnected");
  });

  // Optional: Handle errors
  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

// Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server is listening on ws://localhost:${PORT}`);
});
