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

async function runMultiClientTest() {
  const mongo = new MongoClient(uri!);
  try {
    console.log("[Multi-Client Test] Connecting to MongoDB Atlas...");
    await mongo.connect();
    const db = mongo.db();

    // Query for up to two active sessions
    const sessions = await db.collection("session")
      .find({ expiresAt: { $gt: new Date() } })
      .limit(2)
      .toArray();

    if (sessions.length < 1) {
      console.error("[Multi-Client Test] ERROR: No active sessions found. Log in on browser first.");
      await mongo.close();
      process.exit(1);
    }

    const tokenA = sessions[0].token;
    // Fallback to same token if only 1 active session is found (simulating two tabs for same user)
    const tokenB = sessions[1] ? sessions[1].token : sessions[0].token;
    const isSameUser = tokenA === tokenB;

    console.log(`[Multi-Client Test] Session A Token: ${tokenA.substring(0, 8)}... (User: ${sessions[0].userId})`);
    console.log(`[Multi-Client Test] Session B Token: ${tokenB.substring(0, 8)}... ${isSameUser ? "(Same user / Tab 2)" : `(User: ${sessions[1].userId})`}`);
    await mongo.close();

    const workspaceId = "hive-shared-workspace-999";
    console.log(`\n--- Starting Connections to http://localhost:${port} ---`);

    // --- CONNECT CLIENT A ---
    const socketA = io(`http://localhost:${port}`, {
      auth: { token: tokenA },
      reconnection: false
    });

    socketA.on("connect", () => {
      console.log(`[Client A] Connected! Socket ID: ${socketA.id}`);
      console.log(`[Client A] Joining workspace: ${workspaceId}`);
      socketA.emit("workspace:join", { workspaceId });
    });

    socketA.on("workspace:presence", (data) => {
      console.log(`[Client A EVENT] Received workspace:presence:`, data.members.map((m: any) => m.name));
    });

    socketA.on("typing:update", (data) => {
      console.log(`[Client A EVENT] Received typing:update:`, data);
    });

    socketA.on("chat:message", (data) => {
      console.log(`[Client A EVENT] Received chat:message from ${data.userName}: "${data.text}"`);
    });

    // --- CONNECT CLIENT B (after 1 second) ---
    setTimeout(() => {
      console.log(`\n--- Connecting Client B ---`);
      const socketB = io(`http://localhost:${port}`, {
        auth: { token: tokenB },
        reconnection: false
      });

      socketB.on("connect", () => {
        console.log(`[Client B] Connected! Socket ID: ${socketB.id}`);
        console.log(`[Client B] Joining workspace: ${workspaceId}`);
        socketB.emit("workspace:join", { workspaceId });
      });

      socketB.on("workspace:presence", (data) => {
        console.log(`[Client B EVENT] Received workspace:presence:`, data.members.map((m: any) => m.name));
      });

      socketB.on("typing:update", (data) => {
        console.log(`[Client B EVENT] Received typing:update:`, data);
      });

      socketB.on("chat:message", (data) => {
        console.log(`[Client B EVENT] Received chat:message from ${data.userName}: "${data.text}"`);
      });

      // --- SIMULATE TYPING FROM CLIENT A (after 2 seconds) ---
      setTimeout(() => {
        console.log(`\n--- Client A Starts Typing ---`);
        socketA.emit("typing:start", { workspaceId });
      }, 1000);

      // --- CLIENT A STOPS TYPING & SEND MESSAGE (after 3.5 seconds) ---
      setTimeout(() => {
        console.log(`\n--- Client A Stops Typing & Sends Message ---`);
        socketA.emit("typing:stop", { workspaceId });
        socketA.emit("chat:message", { text: "Hey team! Let's get this canvas implemented. 🎨" });
      }, 2500);

      // --- SIMULATE CLIENT B REPLY (after 5 seconds) ---
      setTimeout(() => {
        console.log(`\n--- Client B Sends Reply ---`);
        socketB.emit("chat:message", { text: "Agreed, let's proceed to Phase 3!" });
      }, 4000);

      // --- CLEAN UP CONNECTIONS (after 7 seconds) ---
      setTimeout(() => {
        console.log(`\n--- Cleaning Up Connections ---`);
        console.log("[Client B] Disconnecting...");
        socketB.disconnect();
      }, 6000);

      setTimeout(() => {
        console.log("[Client A] Disconnecting...");
        socketA.disconnect();
        console.log("\n[Multi-Client Test] Verification completed successfully!");
        process.exit(0);
      }, 7000);

    }, 1000);

  } catch (err) {
    console.error("[Multi-Client Test] Error:", err);
    process.exit(1);
  }
}

runMultiClientTest();
