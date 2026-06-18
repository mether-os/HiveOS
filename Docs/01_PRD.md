# HiveOS — Product Requirements Document (PRD)

---

## Overview

HiveOS is an AI-powered collaborative operating system built for software development teams. It replaces the fragmented combination of Discord, Notion, GitHub, and separate AI tools with a single unified workspace where a persistent AI agent continuously understands the project, team, and progress — and acts as an intelligent project co-founder.

It is not a project manager. It is not a chatbot. It is the connective tissue between humans, code, documents, and ideas — with an AI brain that knows everything happening inside the project.

---

## Problem Statement

Developer teams building projects suffer from a specific kind of fragmentation:

- Plans live in Notion
- Communication lives in Discord or WhatsApp
- Code lives in GitHub
- Architecture lives in Figma or random PDFs
- Task tracking lives in Jira or Linear
- AI tools are external, stateless, and context-blind

Nobody has one place that holds everything — and no AI has real context about the project.

The result:

- Wasted standups ("what did you work on yesterday?")
- Missed blockers
- Scope creep nobody notices
- Tasks assigned to the wrong people
- AI tools that don't know your project
- New members taking days to onboard

HiveOS eliminates this. Every piece of the project lives in one place, and the AI understands all of it.

---

## Target Users

### Primary
- Small developer teams (2–8 people) building software projects
- Hackathon teams
- Open-source contributors with collaborators
- Students building portfolio projects as a group

### Secondary
- Solo developers who want an AI project co-pilot
- Bootcamp teams
- Internship project teams

---

## Core Philosophy

> Everything feeds the brain. The brain feeds the team.

Every feature in HiveOS exists to either:
1. Give the AI more context about the project, OR
2. Deliver the AI's intelligence back to the team

---

## Feature Specification

---

### 1. Hive Server (Workspace)

Every project lives in a Hive — a self-contained workspace.

**Creation Flow**
- User creates a Hive
- Names the project
- Invites members via link or email
- Assigns roles: Leader, Member

**Structure of a Hive**
```
Hive
├── Canvas
├── Channels (text, voice concept)
├── Documents
├── Tasks
├── GitHub Connection
├── Knowledge Base
└── AI (HiveMind)
```

**Roles**
- Leader: Full control — can delete workspace, reassign tasks, set sprints, override AI suggestions
- Member: Can contribute, edit, and communicate. Cannot delete workspace or reassign others' work.

**Acceptance Criteria**
- User can create a Hive in under 60 seconds
- Invite link generates and shares instantly
- Role differentiation visible on all collaboration surfaces
- User can be in multiple Hives simultaneously

---

### 2. Hive Canvas

The visual heart of HiveOS. Not a whiteboard. A living knowledge graph.

**What it is**
An infinite 3D/spatial canvas where project building blocks float as draggable nodes. Users can pan, zoom, connect nodes, and build a visual map of the entire project.

**Node Types**
- Audience node
- Tech Stack node
- Feature node
- Architecture node
- Risk node
- Roadmap node
- Task node
- Document node
- GitHub PR node
- AI-generated node

**Interactions**
- Drag nodes onto canvas
- Draw connections between nodes
- Click a node to expand detail
- Select multiple nodes → AI analyzes relationships
- AI can create nodes autonomously based on conversations and uploads

**AI on Canvas**
- User drops Audience + Features onto canvas → AI suggests Tech Stack
- User connects Feature → Architecture → AI flags missing components
- AI creates a complete canvas from a natural language project description

**Acceptance Criteria**
- Canvas supports 100+ nodes without visible lag
- Connections persist across sessions
- AI can generate a canvas from a project brief in under 10 seconds
- Canvas state syncs live across all team members
- Undo/redo supported

---

### 3. HiveMind (AI Agent)

The core intelligence of HiveOS. Not a chatbot. A persistent project AI.

**Context Sources**
HiveMind continuously ingests:
- Canvas state
- All documents uploaded
- GitHub repository events (commits, PRs, issues)
- Task status and assignments
- Team activity and presence
- Chat messages (summaries, not verbatim)
- Member resumes (for capability understanding)

**Capabilities**

**a. Onboarding Intelligence**
- At workspace creation: "Do you have an existing project or are you starting fresh?"
- If fresh: AI runs a structured ideation session — asks about audience, problem, constraints, and generates PRD, architecture, roadmap, and canvas automatically
- If existing: AI asks for description and imports context

**b. Project Health Monitoring**
AI automatically detects and flags:
- No commits for 5+ days on active branch
- Frontend complete, backend missing
- Feature added, no corresponding documentation
- Task assigned to nobody
- Deadline approaching with task incomplete
- Scope creeping beyond original feature set

**c. Task Distribution**
- Based on uploaded resumes, AI creates a skill graph for each member
- AI assigns tasks matching skills to people
- AI rebalances assignments when blockers are detected

**d. Daily Mission Generation**
Every morning, AI generates a personalized "Today's Mission" for each member:
```
Mayank — Today's Mission
1. Complete /auth endpoints (blocked since 2 days)
2. Review PR #14 (waiting on you)
3. Update API docs for /users
```

**e. Canvas Intelligence**
- User says "create app flow" → AI generates app flow nodes on canvas
- User says "what are our risks?" → AI creates risk nodes
- AI monitors canvas and flags disconnected nodes

**f. Standup Generation**
- AI generates a daily standup summary per member
- Leader can view team standup in one place without a meeting

**g. AI Chat**
- Persistent sidebar chat with full project context
- AI can reference specific files, PRs, tasks, and canvas nodes in responses
- AI remembers everything said and done in the project

**Acceptance Criteria**
- AI responds to queries in under 3 seconds
- AI correctly identifies project blockers 80%+ of the time in test scenarios
- Daily missions generated by 8AM
- Canvas generation from description completes in under 15 seconds

---

### 4. Presence System

Real-time visibility into what every team member is doing.

**Features**
- Online/offline status
- Current activity: "Working on auth backend", "Reading documentation", "Reviewing PR"
- Focus mode (do not disturb)
- Activity timeline per member (last 24 hours)
- "Who's in the zone" panel (sorted by recent activity)

**Acceptance Criteria**
- Presence updates propagate within 500ms
- Activity display does not require manual input — inferred from behavior
- Works across multiple browser sessions

---

### 5. Task Engine

Not Jira. Not Linear. A task system that the AI drives.

**Features**
- Tasks created manually or by AI
- Assigned to members (AI suggests, Leader confirms)
- Status: Todo → In Progress → Review → Done → Blocked
- Priority: Critical, High, Normal, Low
- Tasks linked to canvas nodes
- Tasks linked to GitHub PRs/issues
- Subtasks supported
- Blocking relationships (Task A blocks Task B)

**Acceptance Criteria**
- Tasks created by AI based on project description within first 5 minutes of workspace setup
- Task status updates reflect in AI context within 30 seconds
- Blocking relationships visible in canvas

---

### 6. Document Layer

Not Notion. A document layer that the AI reads and understands.

**Features**
- Rich text documents (Markdown-based)
- Upload PDFs, images, architecture diagrams
- AI reads all uploaded documents
- Documents linked to canvas nodes
- Version history
- AI can generate documents (PRD, TRD, Architecture docs) on command

**Acceptance Criteria**
- PDF upload processing completes in under 30 seconds
- AI can answer questions about uploaded documents immediately after processing
- Documents linked to canvas nodes visible in both views

---

### 7. GitHub Integration

**Features**
- Connect GitHub repository to Hive
- AI receives events: push, PR opened, PR merged, issue created, issue closed
- Commits show up in activity feed
- PRs linked to tasks automatically
- AI detects: "PR opened but no review assigned"
- AI detects: "Commit on main without PR"
- GitHub stats visible in presence panel: who committed today

**Acceptance Criteria**
- Webhook setup in under 2 minutes
- Events processed and visible in under 5 seconds
- AI references latest commits when answering questions

---

### 8. Knowledge Graph (Internal)

Not visible to users directly. Powers HiveMind.

**What it stores**
```
Members → Skills → Tasks
Tasks → Features → Components
Components → Architecture
Documents → Features
GitHub Commits → Tasks
Canvas Nodes → Relationships
Events → Timeline
```

**What it enables**
- AI can answer: "Who is best suited for the payment integration?"
- AI can answer: "What features are behind schedule?"
- AI can answer: "What does the auth flow look like?"

---

### 9. Onboarding Flow

**New Project**
1. Create Hive → name project
2. AI asks: "Tell me about your project idea in 2-3 sentences"
3. AI generates: PRD draft, architecture suggestion, initial task list, canvas skeleton
4. Members invited → each uploads resume
5. AI creates skill map → assigns tasks
6. Project kicks off

**Existing Project**
1. Create Hive
2. Upload: existing docs, PRD, any files
3. Connect GitHub repo
4. AI ingests and builds context
5. Members join and upload resumes
6. AI generates initial health assessment

---

## Non-Goals (V1)

- Mobile app
- Real-time code editor (not VS Code)
- Kubernetes/cloud deployment
- Voice/video calls
- Public project galleries
- Marketplace
- Billing

---

## Success Metrics

| Metric | Target |
|---|---|
| Workspace creation to first AI response | < 2 minutes |
| AI context accuracy | 80%+ on factual project questions |
| Real-time update latency | < 500ms |
| Canvas node render (100 nodes) | < 1 second |
| Daily active usage per workspace | 5+ AI interactions per day |
| Onboarding completion rate | 80%+ in first session |

---

## Future (V2+)

- Screen understanding: AI sees VS Code, understands context
- Local desktop agent: AI can take actions
- Voice commands: "Create a task for authentication"
- Project replay: watch the entire project history as a timeline
- AI code review: PR reviewed by HiveMind before humans
- Multi-workspace AI: AI compares current project to past ones
