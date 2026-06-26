# HiveOS Developer Learning Roadmap & Interview Prep Guide

This roadmap outlines the core modules, functions, and structures of HiveOS, structured into 7-day, 14-day, and 30-day study plans to help you prepare for technical interviews and project walkthroughs.

---

## SECTION 1 — TOP 20 FILES (RANKED)

| Rank | File Path | Core Responsibility | Why It Matters for Interviews |
|:---:|---|---|---|
| 1 | [hiveMindService.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/hiveMindService.ts) | Core AI pipeline, graph metrics & topology analysis. | Cycle detection (DFS) & critical path computation (DAG) algorithms. |
| 2 | [workflowEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/workflowEngine.ts) | Workflow state machine orchestration. | Deduplication, race condition prevention, trigger fingerprinting. |
| 3 | [executionEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/executionEngine.ts) | Safe, transactional write interface to graph database. | Transaction isolation, rollbacks, validation gates. |
| 4 | [agentActionEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/agentActionEngine.ts) | Maps AI diagnostics to proposed plans. | Multi-factor quality and risk scoring heuristics. |
| 5 | [unifiedContext.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/unifiedContext.ts) | Context aggregator for LLM token ingestion. | Token optimization, full-text text index search queries. |
| 6 | [CanvasBoard.tsx](file:///c:/Users/mayan/HiveOS/hiveos-app/features/canvas/components/CanvasBoard.tsx) | Canvas view managing nodes/edges states. | React Flow custom node integration, state-to-view mapping. |
| 7 | [server.ts (realtime)](file:///c:/Users/mayan/HiveOS/realtime-server/src/server.ts) | Standalone Node.js Socket.io server. | Horizontal scaling, Redis adapter configuration, connection lifecycles. |
| 8 | [presence.ts (realtime)](file:///c:/Users/mayan/HiveOS/realtime-server/src/presence.ts) | Keeps track of active user selections/states. | Highly optimized real-time caching, locks. |
| 9 | [agentRegistry.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/agentRegistry.ts) | Declares default agents & builds context summaries. | Modular agent architecture, capability-based delegation. |
| 10 | [RealtimeWorkspaceController.tsx](file:///c:/Users/mayan/HiveOS/hiveos-app/features/realtime/components/RealtimeWorkspaceController.tsx) | Dispatches workspace WS actions & canvas events. | Handling WS connection drops, Custom Dom Event dispatching. |
| 11 | [route.ts (webhooks/github)](file:///c:/Users/mayan/HiveOS/hiveos-app/app/api/webhooks/github/route.ts) | Integrates GitHub push and PR webhook events. | Security validations, HMAC-SHA256 digests, webhook idempotency. |
| 12 | [route.ts (canvas)](file:///c:/Users/mayan/HiveOS/hiveos-app/app/api/hives/%5BhiveId%5D/canvas/route.ts) | Canvas REST actions API route. | Search sync hooks, transactional write structures. |
| 13 | [auth.ts (lib)](file:///c:/Users/mayan/HiveOS/hiveos-app/lib/auth.ts) | Session security configuration. | Better Auth session persistence, OAuth flows. |
| 14 | [db.ts (lib)](file:///c:/Users/mayan/HiveOS/hiveos-app/lib/db.ts) | Reusable global MongoDB client connection pool. | Serverless connection limits, connection pooling. |
| 15 | [redis.ts (lib)](file:///c:/Users/mayan/HiveOS/hiveos-app/lib/redis.ts) | Redis setup with failover memory fallback. | Cache reliability, fail-safe architectures. |
| 16 | [graphEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/graphEngine.ts) | Compiles workspace vertices into maps. | Adjacency lists representation, Cache-Aside pattern. |
| 17 | [next.config.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/next.config.ts) | Builds configuration (security headers, compilers). | Content Security Policy, Standalone output limits. |
| 18 | [middleware.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/middleware.ts) | Request path authentication filter. | Edge middleware routing, session validation. |
| 19 | [executionAuth.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/executionAuth.ts) | Checks permissions before running workflows. | Resource isolation, workspace boundary security. |
| 20 | [knowledgeIndexService.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/knowledgeIndexService.ts) | Handles index synchronizations. | Denormalized text-indexing architecture. |

---

## SECTION 2 — TOP 20 FUNCTIONS (RANKED)

1. **`runHiveMindAnalysis(hiveId)`** ([hiveMindService.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/hiveMindService.ts)): Pulls context, detects cycles/critical paths, queries NIM models, saves snapshot and recommendations.
2. **`executeActionPlan(...)`** ([executionEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/executionEngine.ts)): Processes approved action plan steps within a transaction database session.
3. **`triggerWorkflowEvent(hiveId, triggerType, context)`** ([workflowEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/workflowEngine.ts)): Orchestrates trigger matching and deduplication checks.
4. **`detectCycles(nodes, edges)`** ([hiveMindService.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/hiveMindService.ts)): DFS implementation detecting loops in graph configurations.
5. **`findCriticalPath(nodes, edges)`** ([hiveMindService.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/hiveMindService.ts)): Computes the longest task path chain.
6. **`computeTrustAndExplainability(...)`** ([hiveMindService.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/hiveMindService.ts)): Evaluates finding confidence.
7. **`generateActionPlans(...)`** ([agentActionEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/agentActionEngine.ts)): Translates AI recommendations to step checklists.
8. **`searchKnowledge(hiveId, query)`** ([unifiedContext.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/unifiedContext.ts)): Executes weighted text searches with regex fallback.
9. **`buildAgentContext(hiveId)`** ([agentRegistry.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/agentRegistry.ts)): Compiles node metrics and cycle counts for LLM prompting.
10. **`computeTriggerFingerprint(...)`** ([workflowEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/workflowEngine.ts)): Generates SHA-256 trigger hashes.
11. **`approveWorkflowProposal(...)`** ([workflowEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/workflowEngine.ts)): Human approval validator tracking agent metrics.
12. **`enforceHumanActor(actorId)`** ([workflowEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/workflowEngine.ts)): Throws error if non-human actor attempts high-risk operations.
13. **`getProjectContext(hiveId)`** ([unifiedContext.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/unifiedContext.ts)): Fetches all components for workspace context summaries.
14. **`calculateSmartNodePosition(...)`** ([executionEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/executionEngine.ts)): Identifies empty board spots.
15. **`computeActionQualityScore(...)`** ([agentActionEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/agentActionEngine.ts)): Calculates quality score based on reversibility, affected elements, and confidence.
16. **`validateWorkflowHierarchy(...)`** ([workflowEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/workflowEngine.ts)): DFS cycles validation on workflow tree parent references.
17. **`calculateWorkflowMetrics(steps)`** ([workflowEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/workflowEngine.ts)): Estimates duration, complexity, and performance metrics.
18. **`substitutePlaceholders(obj, context)`** ([workflowEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/workflowEngine.ts)): Recursive placeholder resolver.
19. **`invalidateGraphCache(hiveId)`** ([graphEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/graphEngine.ts)): Removes graph cache items on write actions.
20. **`authorizeExecution(...)`** ([executionAuth.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/executionAuth.ts)): Enforces workspace scope isolation.

---

## SECTION 3 — TOP 20 CLASSES (SCHEMA MODELS & SERVICES)

HiveOS is built with TypeScript and Mongoose, organizing entities into **Mongoose Schema Models**, **React Components**, and **Service Singletons**:

1. **`Hive`** (Mongoose Schema): Models workspaces, metadata, owners, and GitHub configurations.
2. **`CanvasNode`** (Mongoose Schema): Models layout coordinates, tags, and category types.
3. **`CanvasEdge`** (Mongoose Schema): Models directed connections and relation types.
4. **`Document`** (Mongoose Schema): Models workspace document content and linked node IDs.
5. **`AgentInstance`** (Mongoose Schema): Tracks agent configurations, statuses, and performance metrics.
6. **`AgentActionPlan`** (Mongoose Schema): Proposes action steps, risk evaluations, and execution states.
7. **`WorkflowRun`** (Mongoose Schema): Tracks progress and logs of workflow runs.
8. **`Workflow`** (Mongoose Schema): Blueprint schemas for triggers and steps.
9. **`KnowledgeIndex`** (Mongoose Schema): Standardized text-search indexes.
10. **`HiveMindSnapshot`** (Mongoose Schema): Historically logs graph metrics for trend analysis.
11. **`HiveMindRecommendation`** (Mongoose Schema): AI findings (gaps, opportunities, risks).
12. **`HiveMindMission`** (Mongoose Schema): Daily sprint targets.
13. **`Activity`** (Mongoose Schema): Activity timeline event feeds.
14. **`ChatMessage`** (Mongoose Schema): Chat message histories.
15. **`User`** (Mongoose Schema): User account and OAuth credential data.
16. **`ExecutionAuthorizationService`** (Service Singleton): Checks resource edit permissions.
17. **`HiveMindLLMService`** (Service Singleton): Interfaces with NVIDIA NIM.
18. **`SocketServer`** (Socket.io Service): Manages WebSocket connections and rooms.
19. **`PresenceManager`** (Redis Wrapper): Manages active user locations and typing states.
20. **`CanvasBoard`** (React Component): Interactive collaboration board.

---

## SECTION 4 — MASTERING PLANS

### 📅 The 7-Day Interview Sprint (High-Yield Core)

* **Goal**: Understand high-level data flows, key algorithms, and tech stack choices for system design interviews.
* **Daily Schedule**:
  * **Day 1: System Architecture Overview**
    * Study the high-level architecture diagram.
    * Focus on the separation between Next.js (REST) and the Realtime Server (Socket.io).
  * **Day 2: Graph Algorithms in practice**
    * Study `detectCycles()` and `findCriticalPath()` in [hiveMindService.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/hiveMindService.ts).
    * Practice explaining cycle detection (DFS) and DAG critical path calculation.
  * **Day 3: The Write Pipeline & Transactions**
    * Trace a write request in [executionEngine.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/server/utils/executionEngine.ts#L85-L250).
    * Learn how database transactions protect graph updates and how rollbacks are handled.
  * **Day 4: Real-time Sync & Sockets**
    * Study [server.ts](file:///c:/Users/mayan/HiveOS/realtime-server/src/server.ts) and presence mechanics in [presence.ts](file:///c:/Users/mayan/HiveOS/realtime-server/src/presence.ts).
    * Explain why Socket.io is running on a standalone port (scaling WebSocket routes outside Serverless runtimes).
  * **Day 5: AI Pipelines & Prompts**
    * Read the background worker runner `runHiveMindAnalysis()`.
    * Understand how graph metrics are compiled into prompts for structured LLM inference.
  * **Day 6: Webhooks & Event Ingestion**
    * Study [api/webhooks/github/route.ts](file:///c:/Users/mayan/HiveOS/hiveos-app/app/api/webhooks/github/route.ts).
    * Review security mechanisms: HMAC verification and delivery-ID-based deduplication.
  * **Day 7: Whiteboard Pitch Practice**
    * Memorize the 15/30/60-second elevator pitches.
    * Practice drawing the high-level block diagram.

---

### 📅 The 14-Day Deep Dive (Implementation Focus)

* **Goal**: Learn how core systems (Workflows, Agents, Sockets) are implemented.
* **Weekly Breakdown**:
  * **Week 1: Core System Logic**
    * *Day 8*: Study Mongoose relationship mapping (`canvasnodes` & `canvasedges`).
    * *Day 9*: Trace `triggerWorkflowEvent()` in `workflowEngine.ts` to see how event context triggers action plans.
    * *Day 10*: Study the caching logic in `graphEngine.ts` (Redis keys, TTL, and cache-aside invalidation).
    * *Day 11*: Learn about Better Auth middleware integration and socket connection authorization.
    * *Day 12*: Study the full-text search indexing logic in `knowledgeIndexService.ts` and the weighted scoring algorithm in `searchKnowledge()`.
    * *Day 13-14*: Trace a canvas node drag-and-drop event from UI mouse release to Socket.io broadcast.
  * **Week 2: Advanced Mechanics & Edge Cases**
    * Re-run local test scripts (`realtime-server/src/test-canvas.ts`) to understand Socket.io broadcast coverage.

---

### 📅 The 30-Day Mastery Plan (Engineering Lead Track)

* **Goal**: Master the codebase, analyze scaling bottlenecks, and design architectural extensions.
* **Weekly Focus**:
  * **Days 1-7: Graph Traversal & Heuristics** (Cycle detection, DAGs, critical path analysis, explainability metrics).
  * **Days 8-14: Realtime Infrastructure** (Socket rooms, scaling via Redis adapters, session authorization, presence systems).
  * **Days 15-21: AI Orchestration** (Prompt optimization, agent registries, capability matrices, action templates).
  * **Days 22-30: Scaling & Architecture Decisions**
    * Focus on architectural trade-offs: Why MongoDB vs. SQL? How does the application scale horizontally?
    * Review CSP and security headers in `next.config.ts`.
    * Analyze OOM build issues and understand the CPU limiting config choices.

---

## SECTION 5 — WHAT TO IGNORE FOR INTERVIEWS

Focus your preparation on core business logic and system design. You can ignore:
1. **Third-Party Test Suites** (`realtime-server/src/test-*.ts`): These are utility scripts used for local load testing.
2. **Standard Boilerplates** (`eslint.config.mjs`, `postcss.config.mjs`, `tsconfig.json`): Standard Next.js templates.
3. **UI Styling Details** (`components/ui/*`): Standard shadcn components (buttons, badges, inputs). Focus instead on layout controllers like `CanvasBoard.tsx` or `RealtimeWorkspaceController.tsx`.

---

## SECTION 6 — ACTUAL EXECUTION PATHS

### 1. Unified Search Execution Path
```
[Client UI Input]
       │
       ▼ (GET Request)
  /api/hives/[hiveId]/search?q=query
       │
       ▼ (Handler Validation)
  Validates Better Auth session token
       │
       ▼ (Query Execution)
  Calls searchKnowledge() -> runs MongoDB $text search on "knowledgeindices"
       │
       ▼ (Analytics Logging)
  Inserts performance log into "searchmetrics" (query, latencyMs, count)
       │
       ▼ (JSON Response)
  Returns deduplicated search result matches
```

### 2. Canvas Board Mutation Path
```
[User drags node on CanvasBoard.tsx]
       │
       ▼ (API request)
  PATCH /api/hives/[hiveId]/canvas (action: "update_node_position")
       │
       ▼ (Database update)
  Updates node coordinates in "canvasnodes" collection
       │
       ▼ (Cache Invalidation)
  Calls invalidateGraphCache(hiveId) to clear the Redis cache
       │
       ▼ (Pub/Sub Event)
  Publishes coordinate changes to Redis channel "hiveos:canvas"
       │
       ▼ (Realtime Broadcast)
  Realtime WS Server receives event and broadcasts to room "workspace:[hiveId]"
       │
       ▼ (UI Update)
  Other users' browser clients receive change and update React Flow state
```

---
*End of Learning Roadmap.*
