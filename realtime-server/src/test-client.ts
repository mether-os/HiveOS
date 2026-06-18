import { io } from "socket.io-client";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
const port = process.env.PORT || 3002;

if (!uri) {
  console.error("MONGODB_URI is not defined in environment");
  process.exit(1);
}

async function testClient() {
  const mongo = new MongoClient(uri!);
  try {
    console.log("[Test] Connecting to MongoDB to fetch an active session...");
    await mongo.connect();
    const db = mongo.db();

    // Query session table for an active session
    const session = await db.collection("session").findOne({
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      console.error("[Test] ERROR: No active session found in MongoDB. Please log in on the browser first.");
      await mongo.close();
      process.exit(1);
    }

    console.log(`[Test] Found active session token: ${session.token.substring(0, 10)}... (User: ${session.userId})`);
    await mongo.close();

    // Connect to Socket.io Server using the active session token
    console.log(`[Test] Connecting socket to http://localhost:${port}...`);
    const socket = io(`http://localhost:${port}`, {
      auth: {
        token: session.token
      },
      reconnection: false
    });

    socket.on("connect", () => {
      console.log(`[Test] Socket connected successfully! ID: ${socket.id}`);
      
      // Emit join workspace
      const testWorkspaceId = "test-workspace-123";
      console.log(`[Test] Joining workspace: ${testWorkspaceId}`);
      socket.emit("workspace:join", { workspaceId: testWorkspaceId });

      // Start typing simulation after 1 second
      setTimeout(() => {
        console.log("[Test] Simulating typing:start...");
        socket.emit("typing:start", { workspaceId: testWorkspaceId });
      }, 1000);

      // Stop typing simulation after 2.5 seconds
      setTimeout(() => {
        console.log("[Test] Simulating typing:stop...");
        socket.emit("typing:stop", { workspaceId: testWorkspaceId });
      }, 2500);

      // Send chat message after 3 seconds
      setTimeout(() => {
        console.log("[Test] Sending chat message...");
        socket.emit("chat:message", { text: "Hello from realtime validation script! 🚀" });
      }, 3000);

      // Disconnect after 5 seconds
      setTimeout(() => {
        console.log("[Test] Disconnecting test client...");
        socket.disconnect();
        process.exit(0);
      }, 5000);
    });

    socket.on("connect_error", (err) => {
      console.error("[Test] Connection error:", err.message);
      process.exit(1);
    });

    socket.on("workspace:presence", (data) => {
      console.log("[Test EVENT] Received workspace:presence update:", JSON.stringify(data));
    });

    socket.on("typing:update", (data) => {
      console.log("[Test EVENT] Received typing:update:", JSON.stringify(data));
    });

    socket.on("chat:message", (data) => {
      console.log("[Test EVENT] Received chat:message:", JSON.stringify(data));
    });

    socket.on("user:status", (data) => {
      console.log("[Test EVENT] Received user:status:", JSON.stringify(data));
    });

  } catch (err) {
    console.error("[Test] Setup error:", err);
    process.exit(1);
  }
}

testClient();
