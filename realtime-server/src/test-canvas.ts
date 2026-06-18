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

async function testCanvasMutations() {
  const mongo = new MongoClient(uri!);
  try {
    console.log("[Canvas Test] Connecting to MongoDB Atlas...");
    await mongo.connect();
    const db = mongo.db();

    // Query for an active session
    const session = await db.collection("session").findOne({
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      console.error("[Canvas Test] ERROR: No active session found. Log in on browser first.");
      await mongo.close();
      process.exit(1);
    }

    console.log(`[Canvas Test] Active Session Token Found: ${session.token.substring(0, 10)}... (User: ${session.userId})`);
    await mongo.close();

    const socket = io(`http://localhost:${port}`, {
      auth: { token: session.token },
      reconnection: false
    });

    const workspaceId = "6a2ad1ef178401c4b2f0e9fa";
    const testNodeId = `test-node-${Date.now().toString(36)}`;
    const testEdgeId = `test-edge-${Date.now().toString(36)}`;

    socket.on("connect", () => {
      console.log(`[Canvas Test] Connected! Socket ID: ${socket.id}`);
      console.log(`[Canvas Test] Joining workspace: ${workspaceId}`);
      socket.emit("workspace:join", { workspaceId });

      // Step 1: Create a Node (after 1s)
      setTimeout(() => {
        console.log(`\n--- Step 1: Creating Canvas Node: ${testNodeId} ---`);
        socket.emit("canvas:node-create", {
          workspaceId,
          node: {
            id: testNodeId,
            hiveId: workspaceId,
            type: "customNode",
            category: "Goal",
            title: "Launch Phase 3 Canvas",
            description: "Build collaborative React Flow graph UI",
            tags: ["canvas", "realtime", "xyflow"],
            position: { x: 250, y: 180 },
            data: { priority: "High", status: "In Progress", progress: 45 }
          }
        });
      }, 1000);

      // Step 2: Lock Node & Sim Drag (after 2s)
      setTimeout(() => {
        console.log(`\n--- Step 2: Simulating Node Lock & Drag ---`);
        socket.emit("canvas:node-lock", { workspaceId, id: testNodeId });
        
        // Drag updates
        socket.emit("canvas:node-drag", {
          workspaceId,
          id: testNodeId,
          position: { x: 260, y: 190 }
        });
      }, 2000);

      // Step 3: Drag Stop (after 3s)
      setTimeout(() => {
        console.log(`\n--- Step 3: Drag Stop & Unlock ---`);
        socket.emit("canvas:node-unlock", { workspaceId, id: testNodeId });
        socket.emit("canvas:node-drag-stop", {
          workspaceId,
          id: testNodeId,
          position: { x: 300, y: 200 }
        });
      }, 3000);

      // Step 4: Update Node properties (after 4s)
      setTimeout(() => {
        console.log(`\n--- Step 4: Updating Node Metadata ---`);
        socket.emit("canvas:node-update", {
          workspaceId,
          id: testNodeId,
          updates: {
            title: "Launch Phase 3 Canvas (Completed)",
            description: "Collaborative canvas built and fully tested",
            category: "Goal",
            tags: ["canvas", "realtime", "mongodb", "upstash"],
            data: { priority: "High", status: "Done", progress: 100 }
          }
        });
      }, 4000);

      // Step 5: Connect Edge (after 5s)
      setTimeout(() => {
        console.log(`\n--- Step 5: Creating Canvas Connection Edge ---`);
        socket.emit("canvas:edge-create", {
          workspaceId,
          edge: {
            id: testEdgeId,
            hiveId: workspaceId,
            source: "node-parent-123",
            target: testNodeId,
            type: "smoothstep"
          }
        });
      }, 5000);

      // Step 6: Delete Connection Edge (after 6s)
      setTimeout(() => {
        console.log(`\n--- Step 6: Deleting Canvas Edge ---`);
        socket.emit("canvas:edge-delete", {
          workspaceId,
          id: testEdgeId
        });
      }, 6000);

      // Step 7: Delete Node & Clean Up (after 7s)
      setTimeout(() => {
        console.log(`\n--- Step 7: Deleting Canvas Node (Clean Up) ---`);
        socket.emit("canvas:node-delete", {
          workspaceId,
          id: testNodeId
        });
      }, 7000);

      // Step 8: Complete (after 8s)
      setTimeout(() => {
        console.log(`\n[Canvas Test] All mutations simulated successfully!`);
        socket.disconnect();
        process.exit(0);
      }, 8000);
    });

    socket.on("connect_error", (err) => {
      console.error("[Canvas Test] Connection error:", err.message);
      process.exit(1);
    });

    // Event loggers
    socket.on("canvas:node-create", (data) => console.log("[EVENT] canvas:node-create:", data.node.title));
    socket.on("canvas:node-lock", (data) => console.log("[EVENT] canvas:node-lock:", data.id, "by", data.lockedBy.name));
    socket.on("canvas:node-unlock", (data) => console.log("[EVENT] canvas:node-unlock:", data.id));
    socket.on("canvas:node-drag", (data) => console.log("[EVENT] canvas:node-drag:", data.id, "to", data.position));
    socket.on("canvas:node-drag-stop", (data) => console.log("[EVENT] canvas:node-drag-stop:", data.id, "to", data.position));
    socket.on("canvas:node-update", (data) => console.log("[EVENT] canvas:node-update:", data.id, "updates:", data.updates.title));
    socket.on("canvas:node-delete", (data) => console.log("[EVENT] canvas:node-delete:", data.id));
    socket.on("canvas:edge-create", (data) => console.log("[EVENT] canvas:edge-create:", data.edge.id));
    socket.on("canvas:edge-delete", (data) => console.log("[EVENT] canvas:edge-delete:", data.id));

  } catch (err) {
    console.error("[Canvas Test] Setup error:", err);
    process.exit(1);
  }
}

testCanvasMutations();
