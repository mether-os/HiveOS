import mongoose from "mongoose";
import Hive from "../models/Hive";
import CanvasNode from "../models/CanvasNode";
import CanvasEdge from "../models/CanvasEdge";
import Document from "../models/Document";
import Activity from "../models/Activity";
import HiveMindRecommendation from "../models/HiveMindRecommendation";
import HiveMindSnapshot from "../models/HiveMindSnapshot";
import HiveMindMission from "../models/HiveMindMission";
import Workflow from "../models/Workflow";
import WorkflowRun from "../models/WorkflowRun";
import ChatMetric from "../models/ChatMetric";
import { seedTemplatesForHive } from "./workflowEngine";

/**
 * Seeds a comprehensive demo workspace for the given ownerId.
 * Flushes any pre-existing demo workspace hives owned by this user to keep data clean.
 */
export async function seedDemoWorkspace(ownerId: string): Promise<string> {
  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

  // 1. Clean up existing demo hives for this user
  const existingHives = await Hive.find({
    ownerId: ownerObjectId,
    name: "HiveOS Demo Workspace"
  }).exec();

  for (const hive of existingHives) {
    const hiveId = hive._id;
    await CanvasNode.deleteMany({ hiveId }).exec();
    await CanvasEdge.deleteMany({ hiveId }).exec();
    await Document.deleteMany({ hiveId }).exec();
    await Activity.deleteMany({ hiveId }).exec();
    await HiveMindRecommendation.deleteMany({ hiveId }).exec();
    await HiveMindSnapshot.deleteMany({ hiveId }).exec();
    await HiveMindMission.deleteMany({ hiveId }).exec();
    await Workflow.deleteMany({ hiveId }).exec();
    await WorkflowRun.deleteMany({ hiveId }).exec();
    await ChatMetric.deleteMany({ hiveId }).exec();
    await Hive.deleteOne({ _id: hiveId }).exec();
  }

  // 2. Create new Showcase Hive
  const hiveId = new mongoose.Types.ObjectId();
  await Hive.create({
    _id: hiveId,
    name: "HiveOS Demo Workspace",
    description: "Recruiter-ready showcase workspace demonstrating HiveOS canvas graphs, document specifications, automated recommendation rules, workflows, agent proposals, and conversational intelligence.",
    ownerId: ownerObjectId,
    githubRepo: {
      owner: "demo-portfolio",
      repo: "hiveos-core",
      status: "connected",
      connectedAt: new Date()
    }
  });

  // 3. Seed 16 Nodes (spanning different categories)
  const nodeSeeds = [
    {
      id: "node-auth-core",
      category: "Feature" as const,
      title: "Auth Gateway Core",
      description: "Primary authentication endpoint validating JWT tokens and social OAuth providers.",
      tags: ["auth", "security", "core"],
      position: { x: 300, y: 100 },
      data: { status: "Done", owner: "mayanksharma" }
    },
    {
      id: "node-session-store",
      category: "Tech Stack" as const,
      title: "Session Redis Cache",
      description: "Distributed cache storing active session states and rate limit metadata.",
      tags: ["redis", "cache", "performance"],
      position: { x: 300, y: -100 },
      data: { status: "Done", owner: "mayanksharma" }
    },
    {
      id: "node-postgres-db",
      category: "Tech Stack" as const,
      title: "Postgres Cluster Store",
      description: "Persistent SQL datastore hosting transactional user data.",
      tags: ["postgres", "database", "storage"],
      position: { x: 50, y: -100 },
      data: { status: "Done", owner: "mayanksharma" }
    },
    {
      id: "node-nim-gateway",
      category: "Tech Stack" as const,
      title: "Nvidia NIM LLM Gateway",
      description: "NVIDIA NIM interface wrapping local llama-3 models for stateless chat prompt execution.",
      tags: ["llm", "ai", "nvidia"],
      position: { x: 550, y: 100 },
      data: { status: "Done", owner: "mayanksharma" }
    },
    {
      id: "node-chat-panel",
      category: "Feature" as const,
      title: "Conversational Panel UI",
      description: "Interactive chat sidebar exposing HiveMind analysis to workspace users.",
      tags: ["chat", "ui", "conversational"],
      position: { x: 550, y: 300 },
      data: { status: "In Progress", owner: "recruiter" }
    },
    {
      id: "node-agent-pm",
      category: "Architecture" as const,
      title: "PM Agent Controller",
      description: "Autonomous controller managing task assignments and workflow Proposals.",
      tags: ["agent", "pm", "orchestrator"],
      position: { x: -200, y: 100 },
      data: { status: "Done", owner: "system" }
    },
    {
      id: "node-agent-arch",
      category: "Architecture" as const,
      title: "Architect Agent Controller",
      description: "Autonomous agent running cycle detectors and generating dependency optimizations.",
      tags: ["agent", "architect", "graph"],
      position: { x: -200, y: -100 },
      data: { status: "Done", owner: "system" }
    },
    {
      id: "node-agent-risk",
      category: "Architecture" as const,
      title: "Risk Agent Controller",
      description: "Autonomous monitor evaluating security flaws, unowned nodes, and SPOFs.",
      tags: ["agent", "risk", "security"],
      position: { x: -200, y: 300 },
      data: { status: "Done", owner: "system" }
    },
    {
      id: "node-goal-uptime",
      category: "Goal" as const,
      title: "99.99% Core Service Uptime",
      description: "Maintain strict high availability on authorization endpoints.",
      tags: ["goal", "reliability"],
      position: { x: 50, y: -300 },
      data: { status: "Done" }
    },
    {
      id: "node-goal-latency",
      category: "Goal" as const,
      title: "< 100ms Response Latency",
      description: "Performance threshold for gateway validations.",
      tags: ["goal", "performance"],
      position: { x: 550, y: -100 },
      data: { status: "Done" }
    },
    {
      id: "node-risk-spof",
      category: "Risk" as const,
      title: "Single Point of Failure: Auth Gateway",
      description: "Critical risk since all features rely on a single Auth Gateway instance.",
      tags: ["risk", "spof", "critical"],
      position: { x: 300, y: 300 },
      data: { status: "Todo" }
    },
    {
      id: "node-risk-loop",
      category: "Risk" as const,
      title: "Circular Dependency: Auth vs Session",
      description: "Auth Gateway depends on Session Store, which recursively queries Auth Gateway.",
      tags: ["risk", "cycle", "architect"],
      position: { x: 50, y: 100 },
      data: { status: "Todo" }
    },
    {
      id: "node-doc-prd",
      category: "Document" as const,
      title: "PRD: Auth Gateway Spec",
      description: "Core requirements documentation detailing OAuth token claims.",
      tags: ["document", "prd"],
      position: { x: 300, y: 500 },
      data: { status: "Done" }
    },
    {
      id: "node-doc-arch",
      category: "Document" as const,
      title: "Arch Doc: LLM Gateway Flow",
      description: "Technical details on how prompts are routed to NVIDIA NIM models.",
      tags: ["document", "architecture"],
      position: { x: 800, y: 100 },
      data: { status: "Done" }
    },
    {
      id: "node-task-verify",
      category: "Task" as const,
      title: "Verify security compliance",
      description: "Audit route validation headers for vulnerability checks.",
      tags: ["task", "security"],
      position: { x: -200, y: 500 },
      data: { status: "Todo", owner: "recruiter" }
    },
    {
      id: "node-task-audit",
      category: "Task" as const,
      title: "Run automated cycle detector",
      description: "Analyze dependency graphs for cycle loops.",
      tags: ["task", "graph"],
      position: { x: -200, y: -300 },
      data: { status: "Todo", owner: "mayanksharma" }
    }
  ];

  await CanvasNode.insertMany(
    nodeSeeds.map((n) => ({
      ...n,
      hiveId,
      createdBy: ownerObjectId,
      type: "customNode"
    }))
  );

  // 4. Seed 22 CanvasEdges (establishing structures + circular dependencies)
  const edgeSeeds = [
    { id: "edge-1", source: "node-auth-core", target: "node-session-store", relationType: "uses" as const },
    { id: "edge-2", source: "node-session-store", target: "node-auth-core", relationType: "depends_on" as const }, // Circular dependency!
    { id: "edge-3", source: "node-auth-core", target: "node-postgres-db", relationType: "uses" as const },
    { id: "edge-4", source: "node-postgres-db", target: "node-goal-uptime", relationType: "implements" as const },
    { id: "edge-5", source: "node-postgres-db", target: "node-goal-latency", relationType: "implements" as const },
    { id: "edge-6", source: "node-nim-gateway", target: "node-chat-panel", relationType: "generates" as const },
    { id: "edge-7", source: "node-chat-panel", target: "node-auth-core", relationType: "depends_on" as const },
    { id: "edge-8", source: "node-agent-pm", target: "node-task-verify", relationType: "owns" as const },
    { id: "edge-9", source: "node-agent-arch", target: "node-task-audit", relationType: "owns" as const },
    { id: "edge-10", source: "node-agent-risk", target: "node-risk-spof", relationType: "owns" as const },
    { id: "edge-11", source: "node-risk-spof", target: "node-auth-core", relationType: "blocks" as const },
    { id: "edge-12", source: "node-risk-loop", target: "node-session-store", relationType: "blocks" as const },
    { id: "edge-13", source: "node-doc-prd", target: "node-auth-core", relationType: "documents" as const },
    { id: "edge-14", source: "node-doc-arch", target: "node-nim-gateway", relationType: "documents" as const },
    { id: "edge-15", source: "node-task-verify", target: "node-postgres-db", relationType: "depends_on" as const },
    { id: "edge-16", source: "node-task-audit", target: "node-postgres-db", relationType: "depends_on" as const },
    { id: "edge-17", source: "node-postgres-db", target: "node-session-store", relationType: "relates_to" as const },
    { id: "edge-18", source: "node-nim-gateway", target: "node-session-store", relationType: "uses" as const },
    { id: "edge-19", source: "node-chat-panel", target: "node-nim-gateway", relationType: "uses" as const },
    { id: "edge-20", source: "node-auth-core", target: "node-goal-latency", relationType: "implements" as const },
    { id: "edge-21", source: "node-postgres-db", target: "node-postgres-db", relationType: "relates_to" as const }, // Loop
    { id: "edge-22", source: "node-postgres-db", target: "node-postgres-db", relationType: "relates_to" as const } // Parallel loop
  ];

  await CanvasEdge.insertMany(
    edgeSeeds.map((e) => ({
      ...e,
      hiveId,
      type: "smoothstep"
    }))
  );

  // 5. Seed 4 linked Documents
  const documentSeeds = [
    {
      title: "Auth Gateway Specification",
      type: "prd" as const,
      nodeId: "node-auth-core",
      content: `## Auth Gateway Core Requirements
This PRD outlines token validation procedures.
- OAuth 2.0 protocol checks using Google and GitHub social logins.
- Refresh Token rotating storage schema inside Redis cache.
- JWT verification using RS256 hashing.

### Functional Scope
1. Enforces rate limits using Redis leaky-bucket configurations.
2. Formats all responses inside standard \`{ data, error }\` payload wrappers.`,
      tags: ["auth", "spec", "prd"]
    },
    {
      title: "HiveMind NIM LLM Orchestrator",
      type: "architecture" as const,
      nodeId: "node-nim-gateway",
      content: `## NVIDIA NIM LLM Gateway Architecture
Documents prompt routing topology within HiveOS.
- Model instance: \`nvidia_nim/nvidia/nemotron-3-nano-30b-a3b\`.
- Context compaction boundaries programmatically summarize conversation history older than 20 messages.
- Programmatic citation matching scans output markdown strings for node IDs, documents, or workflows.

### Citation Integrity Rules
If the LLM generates a response with zero cited entities, the system falls back to the safety message:
*"I do not have enough evidence to answer."*`,
      tags: ["llm", "nvidia", "architecture"]
    },
    {
      title: "Sprint Planning & Core Bottlenecks",
      type: "meeting" as const,
      nodeId: "node-postgres-db",
      content: `## Sprint Planning Meeting Notes
- **Attendees**: Mayank, Recruiter, AI Agent PM
- **Focus**: Performance optimization and cycle resolution.
- Postgres cluster latency currently p95 at 230ms due to index scanning.
- Action items: Add text indexes to Mongoose documents collection, verify OAuth bypass headers are removed.`,
      tags: ["sprint", "meeting", "database"]
    },
    {
      title: "SPOF & Cyber Risk Analysis",
      type: "prd" as const, // prd maps as Risk Assessment in practice
      nodeId: "node-risk-spof",
      content: `## Vulnerability and SPOF Audit
Evaluates single point of failure occurrences.
- High risk: Single instance Auth Gateway Core.
- Recommendation: Introduce active-active gateway replication.
- Workflow mitigation: Trigger Automated Gateway Failover Workflow if health drops below 50.`,
      tags: ["security", "risk", "audit"]
    }
  ];

  await Document.insertMany(
    documentSeeds.map((d) => ({
      ...d,
      hiveId,
      status: "approved" as const,
      createdBy: ownerObjectId,
      updatedBy: ownerObjectId
    }))
  );

  // 6. Seed 5 GitHub Activity logs
  const activitySeeds = [
    {
      type: "github_commit",
      title: "feat: add OAuth endpoint and token refresh",
      description: "Mayank committed 2 changes to main: added RS256 token verification helpers.",
      actorName: "mayanksharma",
      graphLinks: [{ nodeId: "node-auth-core", source: "regex_hashtag" as const, confidence: 0.95 }]
    },
    {
      type: "github_commit",
      title: "refactor: optimize session cache redis lookup",
      description: "Mayank committed 1 change: enabled sliding window updates on Redis caching.",
      actorName: "mayanksharma",
      graphLinks: [{ nodeId: "node-session-store", source: "regex_hashtag" as const, confidence: 0.9 }]
    },
    {
      type: "github_pr_merge",
      title: "Merged PR #12: Support Nvidia NIM LLM client gateway",
      description: "Merged branch 'feature/nemotron-gateway' into main. Verified stateless responses.",
      actorName: "mayanksharma",
      graphLinks: [{ nodeId: "node-nim-gateway", source: "keyword_heuristic" as const, confidence: 0.8 }]
    },
    {
      type: "github_issue_open",
      title: "Opened Issue #45: Circular dependency loop auth-vs-session",
      description: "Critical cycle detected on canvas: Auth Gateway depends on Session Store which calls Auth.",
      actorName: "system",
      graphLinks: [{ nodeId: "node-risk-loop", source: "keyword_heuristic" as const, confidence: 0.85 }]
    },
    {
      type: "github_issue_comment",
      title: "Comment on Issue #45: Resolve cycle by separating cache invalidate events",
      description: "Recruiter commented: Separation of concerns will resolve this loop.",
      actorName: "recruiter",
      graphLinks: [{ nodeId: "node-risk-loop", source: "manual" as const, confidence: 1.0 }]
    }
  ];

  await Activity.insertMany(
    activitySeeds.map((a) => ({
      ...a,
      hiveId,
      timestamp: new Date(Date.now() - 3600000) // 1 hour ago
    }))
  );

  // 7. Seed HiveMind Snapshot trends
  const snapshotSeeds = [
    {
      healthScore: 68,
      risksCount: 4,
      gapsCount: 5,
      recommendationsCount: 6,
      momentumScore: 50,
      timestamp: new Date(Date.now() - 3 * 86400000) // 3 days ago
    },
    {
      healthScore: 75,
      risksCount: 3,
      gapsCount: 4,
      recommendationsCount: 5,
      momentumScore: 70,
      timestamp: new Date(Date.now() - 2 * 86400000) // 2 days ago
    },
    {
      healthScore: 82,
      risksCount: 2,
      gapsCount: 3,
      recommendationsCount: 4,
      momentumScore: 85,
      timestamp: new Date(Date.now() - 86400000) // 1 day ago
    }
  ];

  await HiveMindSnapshot.create(
    snapshotSeeds.map((s) => ({
      ...s,
      hiveId,
      risks: [],
      recommendations: [],
      gaps: [],
      missions: []
    }))
  );

  // 8. Seed Recommendations, Risks, Missions
  await HiveMindRecommendation.create([
    {
      hiveId,
      type: "architecture",
      title: "Resolve Single Point of Failure (SPOF)",
      reason: "All core requests route through 'Auth Gateway Core'. Introduce redundant gateways to avoid downtime.",
      confidence: 0.95,
      relatedEntities: [{ entityId: "node-auth-core", entityType: "node" as const, title: "Auth Gateway Core" }],
      status: "active",
      suggestedActions: ["run_agent", "create_workflow_proposal"],
      sourceNodes: ["node-auth-core"],
      sourceType: "graph",
      sourceCount: 1
    },
    {
      hiveId,
      type: "relationship",
      title: "Break Circular Dependency Loop",
      reason: "Circular dependency detected: Auth Gateway Core <-> Session Redis Cache.",
      confidence: 0.9,
      relatedEntities: [
        { entityId: "node-auth-core", entityType: "node" as const, title: "Auth Gateway Core" },
        { entityId: "node-session-store", entityType: "node" as const, title: "Session Redis Cache" }
      ],
      status: "accepted",
      suggestedActions: ["create_action_plan"],
      sourceNodes: ["node-auth-core", "node-session-store"],
      sourceType: "graph",
      sourceCount: 2
    },
    {
      hiveId,
      type: "document",
      title: "Resolve Specification Gap",
      reason: "Feature 'Conversational Panel UI' has status 'In Progress' but lacks a linked PRD document.",
      confidence: 0.85,
      relatedEntities: [{ entityId: "node-chat-panel", entityType: "node" as const, title: "Conversational Panel UI" }],
      status: "active",
      suggestedActions: ["run_agent"],
      sourceNodes: ["node-chat-panel"],
      sourceType: "document",
      sourceCount: 1
    }
  ]);

  await HiveMindMission.create([
    {
      hiveId,
      title: "Link PRD to Conversational Panel",
      description: "Draft specification document and attach to 'Conversational Panel UI' node.",
      type: "link_prd",
      relatedEntities: [{ entityId: "node-chat-panel", entityType: "node" as const, title: "Conversational Panel UI" }],
      status: "pending",
      generatedBy: "system"
    },
    {
      hiveId,
      title: "Document Redundant Gateway Strategy",
      description: "Create a technical spec detailing redundancy setup.",
      type: "link_prd",
      relatedEntities: [{ entityId: "node-auth-core", entityType: "node" as const, title: "Auth Gateway Core" }],
      status: "completed",
      completedAt: new Date(),
      generatedBy: "system"
    },
    {
      hiveId,
      title: "Break circular dependencies",
      description: "Remove the cyclic edges between Auth and Session cache.",
      type: "resolve_cycle",
      relatedEntities: [
        { entityId: "node-auth-core", entityType: "node" as const, title: "Auth Gateway Core" },
        { entityId: "node-session-store", entityType: "node" as const, title: "Session Redis Cache" }
      ],
      status: "pending",
      generatedBy: "system"
    }
  ]);

  // 9. Seed Workflows & Runs (Seeding templates + runs)
  await seedTemplatesForHive(hiveId.toString());
  const seededWorkflows = await Workflow.find({ hiveId }).exec();
  const docWorkflow = seededWorkflows.find((w) => w.name.includes("Documentation")) || seededWorkflows[0];
  const PMWorkflow = seededWorkflows.find((w) => w.name.includes("Ownership")) || seededWorkflows[0];
  const archWorkflow = seededWorkflows.find((w) => w.name.includes("Architecture")) || seededWorkflows[0];

  if (!docWorkflow || !PMWorkflow || !archWorkflow) {
    throw new Error("Required workflows templates are not seeded");
  }

  // Completed run
  await WorkflowRun.create({
    hiveId,
    workflowId: docWorkflow._id,
    name: "Automated Documentation Recovery Run",
    status: "completed",
    currentStepIndex: 2,
    steps: [
      { stepNumber: 1, actionType: "create_document", params: { title: "Draft Spec" }, status: "completed" },
      { stepNumber: 2, actionType: "create_edge", params: { relationType: "documents" }, status: "completed" }
    ],
    workflowRiskLevel: "low",
    firstTriggeredAt: new Date(Date.now() - 7200000),
    lastTriggeredAt: new Date(Date.now() - 7200000),
    completedAt: new Date(Date.now() - 7100000),
    logs: [
      { timestamp: new Date(), message: "Workflow initialized.", severity: "info" },
      { timestamp: new Date(), message: "Successfully created document.", severity: "info" },
      { timestamp: new Date(), message: "Successfully executed steps. Run completed.", severity: "info" }
    ],
    metrics: { estimatedHealthImpact: 5, estimatedMomentumImpact: 5, executionComplexity: 2, estimatedDuration: 200, estimatedPlansCount: 1, estimatedExecutionsCount: 1, estimatedApprovalsCount: 0 }
  });

  // Failed run
  await WorkflowRun.create({
    hiveId,
    workflowId: PMWorkflow._id,
    name: "Automated Ownership Assignment Run",
    status: "failed",
    currentStepIndex: 1,
    steps: [
      { stepNumber: 1, actionType: "assign_owner", params: { nodeId: "node-auth-core", owner: "invalid-user" }, status: "failed", error: "User profile invalid-user does not exist." }
    ],
    workflowRiskLevel: "medium",
    firstTriggeredAt: new Date(Date.now() - 3600000),
    lastTriggeredAt: new Date(Date.now() - 3600000),
    logs: [
      { timestamp: new Date(), message: "Workflow started.", severity: "info" },
      { timestamp: new Date(), message: "Action failed: User profile invalid-user does not exist.", severity: "error" }
    ],
    metrics: { estimatedHealthImpact: 10, estimatedMomentumImpact: 5, executionComplexity: 3, estimatedDuration: 300, estimatedPlansCount: 1, estimatedExecutionsCount: 1, estimatedApprovalsCount: 0 }
  });

  // Proposed Run (awaiting approval)
  await WorkflowRun.create({
    hiveId,
    workflowId: archWorkflow._id,
    name: "Automated Security Compliance Audit Run",
    status: "proposed",
    currentStepIndex: 0,
    steps: [
      { stepNumber: 1, actionType: "create_node", params: { title: "Compliance Node" }, status: "pending" }
    ],
    workflowRiskLevel: "medium",
    firstTriggeredAt: new Date(),
    lastTriggeredAt: new Date(),
    logs: [
      { timestamp: new Date(), message: "Workflow proposed by Architect Agent.", severity: "info" }
    ],
    metrics: { estimatedHealthImpact: 12, estimatedMomentumImpact: 8, executionComplexity: 4, estimatedDuration: 400, estimatedPlansCount: 1, estimatedExecutionsCount: 1, estimatedApprovalsCount: 1 }
  });

  // 10. Seed Agent Proposals (with explainability metrics)
  // PM proposal
  await WorkflowRun.create({
    hiveId,
    workflowId: PMWorkflow._id,
    name: "PM Agent: Core Ownership Allocation Plan",
    status: "proposed",
    currentStepIndex: 0,
    steps: [
      { stepNumber: 1, actionType: "assign_owner", params: { nodeId: "node-chat-panel", owner: "recruiter" }, status: "pending" }
    ],
    workflowRiskLevel: "low",
    proposedByAgentId: "pm",
    agentExplainability: {
      reasoning: "The 'Conversational Panel UI' feature node has been in progress for 2 days but remains unowned. Allocation of a human owner prevents feature drift.",
      sourceEntities: ["node-chat-panel"],
      sourceDocuments: [],
      sourceActivities: [],
      sourceWorkflows: [],
      sourceRecommendations: ["Resolve Specification Gap"],
      sourceRisks: [],
      sourceMissions: ["Link PRD to Conversational Panel"],
      confidence: 0.85,
      confidenceBreakdown: { sourceCount: 2, graphEvidence: true, ruleAgreement: true, historicalEffectiveness: 80 }
    },
    logs: [{ timestamp: new Date(), message: "Proposed by Product Manager Agent.", severity: "info" }],
    metrics: { estimatedHealthImpact: 8, estimatedMomentumImpact: 10, executionComplexity: 2, estimatedDuration: 150, estimatedPlansCount: 1, estimatedExecutionsCount: 1, estimatedApprovalsCount: 1 }
  });

  // Architect proposal
  await WorkflowRun.create({
    hiveId,
    workflowId: archWorkflow._id,
    name: "Architect Agent: Cyclic Dependency Break Proposal",
    status: "proposed",
    currentStepIndex: 0,
    steps: [
      { stepNumber: 1, actionType: "delete_edge", params: { edgeId: "edge-2" }, status: "pending" }
    ],
    workflowRiskLevel: "medium",
    proposedByAgentId: "architect",
    agentExplainability: {
      reasoning: "Circular dependency loop detected on Canvas nodes: 'Auth Gateway Core' <-> 'Session Redis Cache'. This loop locks requests and leads to deadlocks. Removing the backwards edge resolves the cycle.",
      sourceEntities: ["node-auth-core", "node-session-store", "edge-2"],
      sourceDocuments: ["Auth Gateway Specification"],
      sourceActivities: ["github_issue_open"],
      sourceWorkflows: [],
      sourceRecommendations: ["Break Circular Dependency Loop"],
      sourceRisks: ["Circular Dependency Warning"],
      sourceMissions: ["Break circular dependencies"],
      confidence: 0.9,
      confidenceBreakdown: { sourceCount: 4, graphEvidence: true, ruleAgreement: true, historicalEffectiveness: 85 }
    },
    logs: [{ timestamp: new Date(), message: "Proposed by Architect Agent.", severity: "info" }],
    metrics: { estimatedHealthImpact: 25, estimatedMomentumImpact: 15, executionComplexity: 4, estimatedDuration: 500, estimatedPlansCount: 1, estimatedExecutionsCount: 1, estimatedApprovalsCount: 1 }
  });

  // Risk Analyst proposal
  await WorkflowRun.create({
    hiveId,
    workflowId: archWorkflow._id, // reuse template
    name: "Risk Agent: Redundant Gateway Provisioning Proposal",
    status: "proposed",
    currentStepIndex: 0,
    steps: [
      { stepNumber: 1, actionType: "create_node", params: { title: "Auth Gateway Replica" }, status: "pending" },
      { stepNumber: 2, actionType: "create_edge", params: { relationType: "implements" as const }, status: "pending" }
    ],
    workflowRiskLevel: "high",
    proposedByAgentId: "risk",
    agentExplainability: {
      reasoning: "Auth Gateway Core operates as a Single Point of Failure (SPOF). Creating a redundant replica node guarantees backup routing paths and shields core operations.",
      sourceEntities: ["node-auth-core"],
      sourceDocuments: ["SPOF & Cyber Risk Analysis"],
      sourceActivities: [],
      sourceWorkflows: [],
      sourceRecommendations: ["Resolve Single Point of Failure (SPOF)"],
      sourceRisks: ["SPOF warning"],
      sourceMissions: [],
      confidence: 0.8,
      confidenceBreakdown: { sourceCount: 3, graphEvidence: false, ruleAgreement: true, historicalEffectiveness: 75 }
    },
    logs: [{ timestamp: new Date(), message: "Proposed by Risk Analyst Agent.", severity: "info" }],
    metrics: { estimatedHealthImpact: 30, estimatedMomentumImpact: 10, executionComplexity: 5, estimatedDuration: 600, estimatedPlansCount: 2, estimatedExecutionsCount: 2, estimatedApprovalsCount: 1 }
  });

  // 11. Seed 3 ChatMetric log history
  await ChatMetric.create([
    {
      hiveId,
      query: "Show dependencies for Auth Gateway",
      answer: "Auth Gateway Core depends on Postgres Cluster Store and uses Session Redis Cache. A circular dependency is also present with Session Redis Cache.",
      mode: "architect",
      questionCategory: "architecture",
      citedSourcesCount: 2,
      suggestionsCount: 1,
      acceptedSuggestionsCount: 1,
      latencyMs: 1200,
      validationSuccess: true,
      timestamp: new Date(Date.now() - 3600000 * 2)
    },
    {
      hiveId,
      query: "Are there circular dependencies?",
      answer: "Yes. The Session Redis Cache (node-session-store) and Auth Gateway Core (node-auth-core) form a circular dependency loop.",
      mode: "risk",
      questionCategory: "risk",
      citedSourcesCount: 3,
      suggestionsCount: 1,
      acceptedSuggestionsCount: 0,
      latencyMs: 1800,
      validationSuccess: true,
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      hiveId,
      query: "Is NIM gateway documented?",
      answer: "Yes, the Nvidia NIM LLM Gateway is documented in 'HiveMind NIM LLM Orchestrator' which lists the model nano-30b configuration.",
      mode: "product",
      questionCategory: "product",
      citedSourcesCount: 1,
      suggestionsCount: 1,
      acceptedSuggestionsCount: 0,
      latencyMs: 1400,
      validationSuccess: true,
      timestamp: new Date()
    }
  ]);

  return hiveId.toString();
}
