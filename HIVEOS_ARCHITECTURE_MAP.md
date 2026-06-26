# HiveOS Complete Visual Architecture Map

This document is a visual design and walkthrough guide of the HiveOS technical stack. It maps out the path of data, control, and state synchronization across all 10 architecture layers of the application.

---

## 1. THE VERTICAL STACK MAP

```
+---------------------------------------------------------------------------------+
|                                 FRONTEND LAYER                                  |
|   - Component: CanvasBoard.tsx          - Controller: RealtimeWorkspaceController |
|   - Hooks: useSocket.ts, useCanvasActions.ts                                    |
+---------------------------------------------------------------------------------+
                                         │
                                         ▼ (HTTP REST / API Actions)
+---------------------------------------------------------------------------------+
|                                    API LAYER                                    |
|   - Route Handlers: app/api/hives/[hiveId]/canvas/route.ts                      |
|   - Server Actions: server/actions/canvas.ts, server/actions/hives.ts           |
+---------------------------------------------------------------------------------+
                                         │
                                         ▼ (WebSockets / Presence / Live Sync)
+---------------------------------------------------------------------------------+
|                                  SOCKET LAYER                                   |
|   - Port: 3002 (Standalone Node.js Server)                                      |
|   - Server: realtime-server/src/server.ts, presence.ts, auth.ts                 |
+---------------------------------------------------------------------------------+
                                         │
                                         ▼ (Background AI & Diagnostics)
+---------------------------------------------------------------------------------+
|                                 SERVICES LAYER                                  |
|   - Core Analyzers: hiveMindService.ts, knowledgeIndexService.ts                |
|   - LLM: hivemind-llm/service.ts (NVIDIA NIM Interface)                         |
+---------------------------------------------------------------------------------+
                                         │
                                         ▼ (Agent Registry & Delegation)
+---------------------------------------------------------------------------------+
|                                  AGENTS LAYER                                   |
|   - Definitions: agentRegistry.ts (Architect, Product, PM, Risk, Doc Agents)     |
|   - Planning: agentActionEngine.ts (Action templates & quality scores)          |
+---------------------------------------------------------------------------------+
                                         │
                                         ▼ (Workspace Adjacency & Context)
+---------------------------------------------------------------------------------+
|                              KNOWLEDGE GRAPH LAYER                              |
|   - Engine: graphEngine.ts (Builds adjacency lists, checks cycles)              |
|   - Aggregator: unifiedContext.ts (Aggregates documents & node metadata)         |
+---------------------------------------------------------------------------------+
                                         │
                                         ▼ (Primary Persistence)
+---------------------------------------------------------------------------------+
|                                  MONGODB LAYER                                  |
|   - Collections: hives, canvasnodes, canvasedges, workflowruns, agentinstances |
|   - Text Index: search queries directed to the knowledgeindices collection       |
+---------------------------------------------------------------------------------+
                                         │
                                         ▼ (Cache & Event Bus)
+---------------------------------------------------------------------------------+
|                                   REDIS LAYER                                   |
|   - Caching: ioredis client (stores compiled graph under key hiveos:graph)      |
|   - Pub/Sub: broadcast events via hiveos:canvas and hiveos:activity channels    |
+---------------------------------------------------------------------------------+
                                         │
                                         ▼ (External Event Ingestion)
+---------------------------------------------------------------------------------+
|                                  GITHUB LAYER                                   |
|   - Integration: GithubIntegration.tsx, GithubEvent schema                     |
|   - Webhook: app/api/webhooks/github/route.ts (HMAC signature verification)     |
+---------------------------------------------------------------------------------+
                                         │
                                         ▼ (Orchestrated Execution)
+---------------------------------------------------------------------------------+
|                                 WORKFLOW LAYER                                  |
|   - Orchestrator: workflowEngine.ts (Deduplication, triggers, run statuses)      |
|   - Execution: executionEngine.ts (Transactional writes, rollback snapshots)    |
+---------------------------------------------------------------------------------+
```

---

## 2. COMPONENT-BY-COMPONENT SPECIFICATION

### 1. Frontend Layer
* **Actual Files**:
  * [CanvasBoard.tsx](file:///c:/Users/mayan/HiveOS/hiveos-app/features/canvas/components/CanvasBoard.tsx): Parent component managing the React Flow canvas workspace.
  * [RealtimeWorkspaceController.tsx](file:///c:/Users/mayan/HiveOS/hiveos-app/features/realtime/components/RealtimeWorkspaceController.tsx): Handles room subscription and triggers canvas re-syncs on reconnection.
  * [useSocket.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/features/realtime/hooks/useSocket.ts): Instantiates and exposes the global Socket.io instance.
* **Core Functions**:
  * `handleResync(e: CustomEvent)`: Remaps raw nodes and edges into custom React Flow specifications when network reconnects.
  * `resyncCanvasState()`: Fetches the latest database canvas structure from Next.js REST routes.

### 2. API Layer
* **Actual Files**:
  * `app/api/hives/[hiveId]/canvas/route.ts`: Manages board operations (adding nodes, updates, and deletes).
  * [canvas.ts (Actions)](file:///c:/Users/mayan/HiveOS/hiveos-app/server/actions/canvas.ts): Queries canvas elements directly from database.
* **Core Functions**:
  * `GET()`: Resolves session and fetches canvas.
  * `POST()`: Parses actions (`create_node`, `update_node`, `create_edge`, `delete_edge`), writes to DB, updates search index, and invalidates Redis graph cache.

### 3. Socket Layer
* **Actual Files**:
  * `realtime-server/src/server.ts`: Entry point for the Node.js standalone WebSockets server.
  * `realtime-server/src/presence.ts`: Manages user mouse coordinates, active rooms, and typing indicators in memory.
  * `realtime-server/src/auth.ts`: Auth middleware validating Better Auth session cookies.
* **Core Functions**:
  * `socketAuthMiddleware(socket, next)`: extracts cookies from socket headers, queries MongoDB's `sessions` collection, and rejects unauthorized connections.
  * `broadcastPresence(workspaceId)`: Emits typing and coordinate data to users in a workspace room.

### 4. Services Layer
* **Actual Files**:
  * [hiveMindService.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/hiveMindService.ts): Runs cycle audits and triggers NVIDIA NIM LLM analysis.
  * `server/services/hivemind-llm/service.ts`: Handles requests to LLM endpoints.
  * [knowledgeIndexService.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/knowledgeIndexService.ts): Indexes canvas items into a queryable MongoDB full-text index.
* **Core Functions**:
  * `runHiveMindAnalysis(hiveId)`: Assembles context, runs local topological checks, prompts NIM endpoint, and writes recommendations.
  * `indexNode(node)`: normalizes canvas node metadata into `knowledgeindices` collection.

### 5. Agents Layer
* **Actual Files**:
  * [agentRegistry.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/agentRegistry.ts): Registers default agents (Architect, Product, PM, Risk, Doc) and seeds databases.
  * [agentActionEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/agentActionEngine.ts): Heuristics engine mapping findings to action plan templates.
* **Core Functions**:
  * `buildAgentContext(hiveId)`: Builds workspace statistics (nodes, edges, cycles, critical paths) for agents.
  * `generateActionPlans(hiveId, recommendations)`: Auto-creates plans and computes quality/reversibility scores.

### 6. Knowledge Graph Layer
* **Actual Files**:
  * [graphEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/graphEngine.ts): Computes graph adjacency maps and cache keys.
  * [unifiedContext.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/unifiedContext.ts): Aggregates workspace data (documents, nodes, commit histories) for LLM context windows.
* **Core Functions**:
  * `buildGraph(hiveId)`: Compiles node and edge states into an adjacency matrix.
  * `getProjectContext(hiveId)`: Serializes workspace states for AI consumption.

### 7. MongoDB Layer
* **Actual Files**:
  * `server/models/CanvasNode.ts`: Visual card schema (type, coordinates, status).
  * `server/models/CanvasEdge.ts`: Directed dependency link schema (source, target, relationType).
  * `server/models/Hive.ts`: Core workspace configuration schema.
  * `server/models/WorkflowRun.ts`: Holds run steps, logs, and approval signatures.
* **Actual Classes (Schemas)**:
  * `CanvasNode`: Vertex schema with indices on `hiveId` and `id`.
  * `CanvasEdge`: Link schema with compound unique indices.

### 8. Redis Layer
* **Actual Files**:
  * [redis.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/lib/redis.ts): Handles connection pool and fallbacks.
* **Core Mechanisms**:
  * Redis Adapter (`@socket.io/redis-adapter`): Syncs Socket.io rooms across multi-node servers.
  * Pub/Sub Channels: `hiveos:canvas` and `hiveos:activity` channels broadcast updates cross-process.

### 9. GitHub Layer
* **Actual Files**:
  * `app/api/webhooks/github/route.ts`: Webhook receiver endpoint.
  * `server/models/GithubEvent.ts`: Schema for repository sync information.
* **Core Functions**:
  * `POST(req)`: Validates signatures, stores events, and triggers workspace re-analyses.
  * `validateSignature(...)`: Computes HMAC-SHA256 signatures to verify request origins.

### 10. Workflows Layer
* **Actual Files**:
  * [workflowEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/workflowEngine.ts): Matches triggers and manages workflow runs.
  * [executionEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/executionEngine.ts): Executes step templates within database transactions.
* **Core Functions**:
  * `triggerWorkflowEvent(hiveId, triggerType, context)`: Evaluates workflow parameters and spawns runs.
  * `executeActionPlan(...)`: Executes approved actions (create node, modify document) inside database transactions, with rollbacks on failure.

---

## 3. CORE SYSTEM INTERACTION TRACES

### Event 1: Collaborative Node Update
```
[User A moves node] 
       │
       ▼ (REST API Write)
  PATCH /api/hives/[hiveId]/canvas ──> updates coordinates in MongoDB (canvasnodes)
       │
       ▼ (Cache & Event Bus)
  Invalidates Redis graph cache ──> publishes coordinates to Redis channel 'hiveos:canvas'
       │
       ▼ (WS Broadcast)
  Realtime WS Server intercepts Pub/Sub ──> broadcasts 'canvas:node-update' to room
       │
       ▼ (State Update)
  [User B's client] receives event ──> updates React Flow state, visual movement renders
```

### Event 2: AI Audit and Self-Healing Proposal
```
Graph changes committed 
       │
       ▼ (Background Worker)
  runAnalysisBackground(hiveId) starts ──> compiles context using unifiedContext.ts
       │
       ▼ (Algorithms)
  DFS detects circular loops ──> findCriticalPath finds longest path
       │
       ▼ (Inference)
  Context sent to NVIDIA NIM ──> LLaMA returns structured risks and gaps JSON
       │
       ▼ (Action Proposal)
  agentActionEngine maps gaps to stubs ──> inserts proposed WorkflowRun in DB
       │
       ▼ (Real-time Notify)
  Socket server emits 'workflow:run-updated' ──> visual alert shows in client UI
```

---
*End of Architecture Map.*
