# HiveOS — Technical Requirements Document (TRD)

---

## System Architecture Overview

HiveOS is an event-driven, real-time distributed application. Every user action is an event. Every event updates shared state. The AI continuously processes that state.

```
Client (React)
     │
     ├── REST API (Express)
     ├── WebSocket (Socket.io)
     │
     ▼
API Gateway (Node.js / Express)
     │
     ├── Auth Service
     ├── Workspace Service
     ├── Canvas Service
     ├── Task Service
     ├── Document Service
     ├── GitHub Webhook Handler
     ├── AI Orchestration Service
     │
     ▼
Event Bus (Redis Pub/Sub)
     │
     ├── Event Processor Workers
     ├── AI Context Builder (Background)
     ├── Notification Worker
     │
     ▼
Persistence Layer
     ├── MongoDB (primary datastore)
     ├── Redis (presence, pub/sub, sessions, queues)
     ├── ChromaDB (vector store for AI memory)
```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| React Flow | Canvas node graph |
| Three.js (V2) | 3D canvas animations |
| Socket.io Client | Real-time updates |
| Zustand | Global state management |
| React Query | Server state, caching |
| Framer Motion | Animations |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express.js | HTTP server |
| Socket.io | WebSocket server |
| BullMQ | Job queues |
| Mongoose | MongoDB ORM |
| Passport.js | OAuth (GitHub, Google) |
| JWT | Auth tokens |
| Zod | Input validation |

### Data Layer
| Technology | Purpose |
|---|---|
| MongoDB | Primary datastore |
| Redis | Pub/Sub, presence, queues, sessions |
| ChromaDB | Vector embeddings for AI memory |

### AI Layer
| Technology | Purpose |
|---|---|
| NVIDIA NIM / OpenRouter | LLM inference (via free-claude-code proxy) |
| LangChain.js | AI orchestration |
| ChromaDB | RAG memory store |
| Whisper (V2) | Voice input |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker + Docker Compose | Local development |
| Vercel | Frontend deployment |
| Render | Backend deployment |
| GitHub Webhooks | Repo event ingestion |

---

## Database Schema

### Users Collection
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string",
  "avatar": "string",
  "githubId": "string",
  "googleId": "string",
  "resume": {
    "raw": "string",
    "skills": ["string"],
    "experience": ["string"],
    "processedAt": "Date"
  },
  "createdAt": "Date"
}
```

### Hives Collection (Workspaces)
```json
{
  "_id": "ObjectId",
  "name": "string",
  "description": "string",
  "ownerId": "ObjectId",
  "members": [
    {
      "userId": "ObjectId",
      "role": "leader | member",
      "joinedAt": "Date",
      "skills": ["string"]
    }
  ],
  "githubRepo": {
    "repoId": "string",
    "repoUrl": "string",
    "webhookId": "string",
    "connectedAt": "Date"
  },
  "settings": {
    "aiEnabled": "boolean",
    "dailyMissionsEnabled": "boolean",
    "standupTime": "string"
  },
  "createdAt": "Date"
}
```

### Canvas Collection
```json
{
  "_id": "ObjectId",
  "hiveId": "ObjectId",
  "nodes": [
    {
      "id": "string",
      "type": "audience | feature | techstack | architecture | risk | task | document | ai-generated",
      "label": "string",
      "content": "object",
      "position": { "x": "number", "y": "number" },
      "createdBy": "ObjectId",
      "createdAt": "Date"
    }
  ],
  "edges": [
    {
      "id": "string",
      "source": "string",
      "target": "string",
      "label": "string"
    }
  ],
  "updatedAt": "Date"
}
```

### Tasks Collection
```json
{
  "_id": "ObjectId",
  "hiveId": "ObjectId",
  "title": "string",
  "description": "string",
  "status": "todo | in_progress | review | done | blocked",
  "priority": "critical | high | normal | low",
  "assignedTo": "ObjectId",
  "createdBy": "ObjectId | ai",
  "linkedCanvasNodeId": "string",
  "linkedGithubPR": "string",
  "blockedBy": ["ObjectId"],
  "dueDate": "Date",
  "subtasks": [
    {
      "id": "string",
      "title": "string",
      "done": "boolean"
    }
  ],
  "aiGenerated": "boolean",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Documents Collection
```json
{
  "_id": "ObjectId",
  "hiveId": "ObjectId",
  "title": "string",
  "type": "markdown | pdf | image",
  "content": "string",
  "filePath": "string",
  "linkedCanvasNodeId": "string",
  "vectorized": "boolean",
  "vectorizedAt": "Date",
  "versions": [
    {
      "content": "string",
      "editedBy": "ObjectId",
      "editedAt": "Date"
    }
  ],
  "createdBy": "ObjectId",
  "createdAt": "Date"
}
```

### Events Collection (Event Store)
```json
{
  "_id": "ObjectId",
  "hiveId": "ObjectId",
  "type": "string",
  "actorId": "ObjectId | 'ai' | 'github'",
  "payload": "object",
  "timestamp": "Date"
}
```

**Event Types:**
```
workspace.created
member.joined
member.left
canvas.node_added
canvas.node_connected
canvas.node_deleted
task.created
task.assigned
task.status_changed
task.blocked
document.uploaded
document.created
github.push
github.pr_opened
github.pr_merged
github.issue_created
ai.context_updated
ai.task_generated
ai.health_flagged
ai.daily_mission_sent
```

### AI Memory Collection
```json
{
  "_id": "ObjectId",
  "hiveId": "ObjectId",
  "type": "summary | entity | relationship | health_flag",
  "content": "string",
  "vectorId": "string",
  "relatedEntityType": "task | member | feature | document",
  "relatedEntityId": "ObjectId",
  "createdAt": "Date",
  "expiresAt": "Date"
}
```

### Presence (Redis — not MongoDB)
```
Key: presence:{hiveId}
Type: Redis Hash
Fields:
  {userId}: {status, activity, lastSeen}
TTL: 30 seconds (refreshed by heartbeat)
```

---

## Service Architecture

### 1. API Service
Standard Express REST API. All routes JWT-protected.

**Endpoints — Workspaces**
```
POST   /api/hives              Create hive
GET    /api/hives/:id          Get hive
POST   /api/hives/:id/invite   Generate invite link
POST   /api/hives/:id/join     Join hive
DELETE /api/hives/:id          Delete hive (leader only)
```

**Endpoints — Canvas**
```
GET    /api/hives/:id/canvas        Get canvas
POST   /api/hives/:id/canvas/nodes  Add node
PUT    /api/hives/:id/canvas/nodes/:nodeId  Update node
DELETE /api/hives/:id/canvas/nodes/:nodeId  Delete node
POST   /api/hives/:id/canvas/edges  Add edge
```

**Endpoints — Tasks**
```
GET    /api/hives/:id/tasks         Get all tasks
POST   /api/hives/:id/tasks         Create task
PUT    /api/hives/:id/tasks/:taskId Update task
DELETE /api/hives/:id/tasks/:taskId Delete task
POST   /api/hives/:id/tasks/ai-generate  Trigger AI task generation
```

**Endpoints — Documents**
```
GET    /api/hives/:id/docs          Get all docs
POST   /api/hives/:id/docs          Create/upload doc
GET    /api/hives/:id/docs/:docId   Get single doc
PUT    /api/hives/:id/docs/:docId   Update doc
```

**Endpoints — AI**
```
POST   /api/hives/:id/ai/chat       Send message to HiveMind
GET    /api/hives/:id/ai/health     Get project health report
GET    /api/hives/:id/ai/missions   Get today's missions
POST   /api/hives/:id/ai/canvas     AI generates canvas nodes
```

**Endpoints — GitHub**
```
POST   /api/hives/:id/github/connect    Connect repo
POST   /webhooks/github/:hiveId         Webhook receiver
```

---

### 2. WebSocket Gateway (Socket.io)

**Connection**
```
socket.io namespace: /hive
Auth: JWT in handshake query
Room: hiveId
```

**Server → Client Events**
```
canvas:node_added        { node }
canvas:node_updated      { nodeId, updates }
canvas:node_deleted      { nodeId }
canvas:edge_added        { edge }
task:created             { task }
task:updated             { taskId, updates }
presence:updated         { userId, status, activity }
ai:thinking              { message }
ai:response              { content, type }
ai:health_flag           { flag }
ai:canvas_update         { nodes, edges }
github:event             { type, payload }
member:joined            { user }
member:left              { userId }
```

**Client → Server Events**
```
canvas:update_node       { nodeId, updates }
task:update              { taskId, updates }
presence:heartbeat       { activity }
ai:chat                  { message }
```

---

### 3. Event Processing Pipeline

Every significant action writes to the Events Collection AND publishes to Redis Pub/Sub.

```
User Action
    ↓
API Handler
    ↓
Write to DB
    ↓
Publish to Redis Channel: events:{hiveId}
    ↓
Event Processor (Worker)
    ↓
├── Socket Gateway (broadcast to room)
├── AI Context Queue (update AI memory)
└── Notification Worker (if needed)
```

**Why this matters (interview answer)**
This is event sourcing. We can replay any project's history by replaying events. We can derive any state from events. The AI memory is a projection of events.

---

### 4. AI Orchestration Service

Runs as a separate process. Consumes AI Context Queue from BullMQ.

**AI Context Building (Background)**
```
Triggered by: new event in hive
Steps:
1. Pull recent events (last 50)
2. Pull canvas state
3. Pull task statuses
4. Pull recent GitHub events
5. Build context string
6. Generate embeddings
7. Store in ChromaDB
8. Update AI memory collection
```

**AI Chat Handler**
```
User message
    ↓
Pull project context from ChromaDB (RAG)
    ↓
Build system prompt:
  - Project summary
  - Team skills
  - Current tasks
  - Recent events
  - Canvas nodes
    ↓
LLM call (NVIDIA NIM / OpenRouter)
    ↓
Parse response
    ↓
If response contains canvas actions → execute
If response contains task creation → create
    ↓
Stream response to client via Socket.io
```

**AI Health Monitor (Scheduled — runs every 6 hours)**
```
Pull all events last 24h
Pull task statuses
Pull GitHub events
Analyze patterns
Flag anomalies
Publish health_flag events
```

**Daily Mission Generator (Scheduled — runs at 7AM)**
```
For each member in hive:
  - Pull assigned tasks
  - Pull blocked tasks
  - Pull pending PR reviews
  - Pull recent GitHub activity
  - Generate mission list (max 5 items)
  - Store in Redis (expires 24h)
  - Send Socket.io notification
```

---

### 5. Redis Usage

| Usage | Pattern | Details |
|---|---|---|
| Presence | Hash + TTL | Heartbeat every 10s, TTL 30s |
| Pub/Sub | Channel per hive | events:{hiveId} |
| Session cache | String | JWT blacklist |
| AI job queue | BullMQ | Document vectorization, health checks |
| Daily missions | String | Expires 24h |
| Rate limiting | Sorted Set | Per-user per-endpoint |

---

## System Design Considerations

### WebSocket Scaling
In V1: Single Socket.io server.
In V2: Redis Adapter for Socket.io enables horizontal scaling across multiple server instances. All instances share pub/sub state through Redis.

This is the interview answer to: "How would you scale this?"

### Event Ordering
Events within a hive are ordered by timestamp. Redis Pub/Sub does not guarantee ordering under high load. For production: use Redis Streams with consumer groups which DO guarantee ordering per stream key.

This is the interview answer to: "What are the tradeoffs in your architecture?"

### AI Context Window Management
The full project history can exceed any LLM context window. Solution:
1. Summarize old events into memory chunks (stored in ChromaDB)
2. Use RAG — retrieve only relevant context for each query
3. Maintain a rolling summary updated every N events

This is the interview answer to: "How do you handle AI memory at scale?"

### Consistency vs. Availability
Canvas and task state: eventual consistency is acceptable. Two members editing simultaneously may briefly see different states. Resolved by:
- Last-write-wins at field level (Mongoose versioning)
- Socket.io broadcasting canonical state after write

For task assignments (leader actions): strong consistency required. Use MongoDB transactions.

### Idempotency
GitHub webhooks can be delivered multiple times. All webhook handlers are idempotent:
- Events stored with unique webhook delivery ID
- Duplicate delivery ID = skip processing

---

## Security

- JWT tokens, 7-day expiry, refresh token pattern
- All hive routes: verify membership before access
- Leader-only routes: verify role
- GitHub webhook signature verification (HMAC-SHA256)
- File uploads: type validation, size limit (10MB), virus scanning (V2)
- Rate limiting: 100 req/min per user via Redis
- Input validation: Zod schemas on all endpoints

---

## Environment Variables

```
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=

# Redis
REDIS_URL=

# Auth
JWT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SESSION_SECRET=

# AI
OPENROUTER_API_KEY=
NVIDIA_NIM_API_KEY=
FREE_CLAUDE_CODE_PROXY=http://localhost:8082

# GitHub
GITHUB_WEBHOOK_SECRET=

# Frontend
VITE_API_URL=
VITE_SOCKET_URL=
```

---

## Directory Structure

```
hiveos/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/        # React Flow canvas
│   │   │   ├── tasks/
│   │   │   ├── ai/
│   │   │   ├── presence/
│   │   │   └── layout/
│   │   ├── pages/
│   │   ├── store/             # Zustand
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── socket.ts
│   │   │   └── api.ts
│   │   └── types/
│
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── models/            # Mongoose schemas
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── context-builder.ts
│   │   │   │   ├── chat-handler.ts
│   │   │   │   ├── health-monitor.ts
│   │   │   │   └── mission-generator.ts
│   │   │   ├── github/
│   │   │   └── presence/
│   │   ├── workers/           # BullMQ workers
│   │   ├── events/            # Event publisher
│   │   ├── sockets/           # Socket.io handlers
│   │   └── middleware/
│
├── docker-compose.yml
└── README.md
```
