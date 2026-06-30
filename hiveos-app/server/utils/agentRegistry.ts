import mongoose from "mongoose";
import AgentInstance from "../models/AgentInstance";
import Workflow from "../models/Workflow";
import WorkflowRun, { type IWorkflowRun, type IWorkflowRunStep } from "../models/WorkflowRun";
import { getProjectContext } from "./unifiedContext";
import { detectCycles, findCriticalPath } from "./hiveMindService";
import { calculateWorkflowMetrics } from "./workflowEngine";

export interface IAgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  minimumRiskLevel: "low" | "medium" | "high" | "critical";
}

// 1. Static Agent definitions
export const AGENT_DEFINITIONS: IAgentDefinition[] = [
  {
    id: "architect",
    name: "Architect Agent",
    description: "Analyzes system architecture and graph topologies. Identifies circular dependencies, deadlocks, and bottlenecks, proposing structural resolution workflows.",
    capabilities: ["analyze_graph", "generate_workflow_proposals"],
    minimumRiskLevel: "medium"
  },
  {
    id: "product",
    name: "Product Agent",
    description: "Focuses on feature alignment and requirements definitions. Identifies missing specification sheets and PRD nodes, generating product scaffolding workflows.",
    capabilities: ["analyze_documents", "generate_workflow_proposals"],
    minimumRiskLevel: "low"
  },
  {
    id: "documentation",
    name: "Documentation Agent",
    description: "Monitors documentation health and coverage gaps across the project graph, proposing stubs and spec recovery workflows.",
    capabilities: ["analyze_documents", "generate_workflow_proposals"],
    minimumRiskLevel: "low"
  },
  {
    id: "pm",
    name: "Project Manager Agent",
    description: "Tracks contributor tasks allocation, workload distributions, and unowned feature deliverables, proposing assignment and planning workflows.",
    capabilities: ["analyze_graph", "generate_workflow_proposals"],
    minimumRiskLevel: "low"
  },
  {
    id: "risk",
    name: "Risk Analyst Agent",
    description: "Audits security vulnerabilities, single points of failure, and blocked workflows, proposing proactive mitigation plans.",
    capabilities: ["analyze_graph", "generate_workflow_proposals"],
    minimumRiskLevel: "high"
  }
];

const RISK_LEVELS = ["low", "medium", "high", "critical"];

/**
 * Checks if a requested risk level is below the minimum allowed level
 */
export function isRiskLevelBelow(level: string, minimum: string): boolean {
  return RISK_LEVELS.indexOf(level) < RISK_LEVELS.indexOf(minimum);
}

/**
 * Seeds AgentInstance documents for a hive if they don't already exist.
 */
export async function seedAgentsForHive(hiveId: string): Promise<void> {
  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);
  
  for (const def of AGENT_DEFINITIONS) {
    const exists = await AgentInstance.exists({ hiveId: hiveObjectId, agentId: def.id });
    if (!exists) {
      await AgentInstance.create({
        hiveId: hiveObjectId,
        agentId: def.id,
        status: "active",
        riskLevel: def.minimumRiskLevel,
        metrics: {
          proposalsGenerated: 0,
          proposalsApproved: 0,
          proposalsRejected: 0,
          workflowSuccessCount: 0,
          workflowFailureCount: 0,
          totalConfidence: 0,
          proposalEffectivenessScore: 0
        },
        overrides: {}
      });
    }
  }
}

/**
 * Centralized Shared Context Builder.
 * Pulls workspace context using only unified context APIs.
 */
export async function buildAgentContext(hiveId: string) {
  const projContext = await getProjectContext(hiveId);
  const { nodes, edges, activeDocuments, recentActivities } = projContext;
  
  // Calculate structural cycles and paths
  const cycles = detectCycles(nodes, edges);
  const criticalPath = findCriticalPath(nodes, edges);
  
  const cycleNodeIds = cycles.flat();
  const criticalPathNodeIds = criticalPath.map((n: any) => n.id);
  
  let contextText = `=== HIVE SYSTEM CONTEXT ===\n`;
  contextText += `Total Nodes: ${nodes.length}\n`;
  contextText += `Total Edges: ${edges.length}\n`;
  contextText += `Cycles Found: ${cycles.length}\n`;
  if (cycles.length > 0) {
    contextText += `Circular Loops:\n`;
    cycles.forEach((c: any, i: number) => {
      contextText += `  Loop ${i+1}: ${c.join(" -> ")}\n`;
    });
  }
  contextText += `Critical Path Nodes count: ${criticalPath.length}\n`;
  
  contextText += `\n=== TOP BOTTLENECKS / CENTRALITY ===\n`;
  projContext.importantNodes.forEach((n: any) => {
    contextText += `- [${n.category}] "${n.title}" (ID: ${n.id}, Degree: ${n.degree}, Status: ${n.status})\n`;
  });
  
  contextText += `\n=== RECENT DOCUMENTS ===\n`;
  activeDocuments.forEach((d: any) => {
    contextText += `- "${d.title}" (ID: ${d._id.toString()}, Status: ${d.status}, Tags: ${(d.tags || []).join(", ")})\n`;
  });
  
  contextText += `\n=== RECENT ACTIVITIES ===\n`;
  recentActivities.forEach((a: any) => {
    contextText += `- [${a.type}] "${a.title}" by ${a.actorName} (${new Date(a.timestamp).toLocaleDateString()})\n`;
  });
  
  return {
    contextText,
    nodes,
    edges,
    documents: activeDocuments,
    activities: recentActivities,
    cycles,
    criticalPath,
    cycleNodeIds,
    criticalPathNodeIds
  };
}

/**
 * Calculates programmatic confidence scores based on explainability evidence
 */
export function calculateAgentConfidence(params: {
  sourceEntities: string[];
  sourceDocuments: string[];
  sourceActivities: string[];
  sourceWorkflows: string[];
  sourceRecommendations: string[];
  sourceRisks: string[];
  sourceMissions: string[];
  edges: any[];
  ruleAgreement: boolean;
  effectivenessScore: number;
}) {
  const sourceCount =
    params.sourceEntities.length +
    params.sourceDocuments.length +
    params.sourceActivities.length +
    params.sourceWorkflows.length +
    params.sourceRecommendations.length +
    params.sourceRisks.length +
    params.sourceMissions.length;
    
  let confidence = 0.5;
  
  // Source Count Boost (+0.05 per source up to +0.20)
  const sourceBoost = Math.min(0.20, sourceCount * 0.05);
  confidence += sourceBoost;
  
  // Graph Evidence (+0.15 if at least two source entities are connected by an edge)
  let graphEvidence = false;
  if (params.sourceEntities.length >= 2) {
    graphEvidence = params.edges.some(edge => 
      params.sourceEntities.includes(edge.source) && 
      params.sourceEntities.includes(edge.target)
    );
  }
  if (graphEvidence) {
    confidence += 0.15;
  }
  
  // Rule Agreement (+0.20)
  if (params.ruleAgreement) {
    confidence += 0.20;
  }
  
  // Historical Effectiveness (+0.20 max)
  const effectivenessBoost = Math.min(0.20, params.effectivenessScore / 500);
  confidence += effectivenessBoost;
  
  // Clamp and round
  const finalConfidence = Math.max(0.1, Math.min(1.0, Math.round(confidence * 100) / 100));
  
  return {
    confidence: finalConfidence,
    breakdown: {
      sourceCount,
      graphEvidence,
      ruleAgreement: params.ruleAgreement,
      historicalEffectiveness: params.effectivenessScore
    }
  };
}

/**
 * Proposes a workflow run for a specific agent by analyzing context.
 * Strictly orchestration-only: generates proposals, never executes directly.
 */
export async function runAgentAnalysis(hiveId: string, agentId: string): Promise<IWorkflowRun> {
  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);
  
  // 1. Fetch Agent Instance
  let instance = await AgentInstance.findOne({ hiveId: hiveObjectId, agentId }).exec();
  if (!instance) {
    await seedAgentsForHive(hiveId);
    instance = await AgentInstance.findOne({ hiveId: hiveObjectId, agentId }).exec();
  }
  if (!instance) throw new Error("Agent instance not found");
  const def = AGENT_DEFINITIONS.find(d => d.id === agentId);
  if (!def) throw new Error("Agent definition not found");
  if (instance.status === "inactive") {
    throw new Error(`Agent ${agentId} is currently deactivated.`);
  }

  // 2. Build Context
  const context = await buildAgentContext(hiveId);
  const { nodes, edges, cycles } = context;

  // 3. Propose workflow based on heuristic analysis matching role capabilities
  let templateName = "Project Bootstrap template";
  let reasoning = "Proposing project baseline bootstrap workspace setup.";
  let sourceEntities: string[] = [];
  let sourceRisks: string[] = [];
  let workflowParams: Record<string, any> = {};
  let ruleAgreement = false;

  if (agentId === "architect") {
    if (cycles.length > 0) {
      templateName = "Architecture Cleanup sequence";
      const targetNodeId = cycles[0]?.[0] || "";
      const nodeObj = nodes.find((n: any) => n.id === targetNodeId);
      workflowParams = {
        actionPlanId: new mongoose.Types.ObjectId().toString(),
        nodeId: targetNodeId,
        nodeTitle: nodeObj?.title || "Cycle Node"
      };
      reasoning = `Circular dependency detected involving node "${nodeObj?.title || targetNodeId}". Proposing Architecture Cleanup sequence to break cycle.`;
      sourceEntities = cycles[0] || [];
      sourceRisks = ["circular_dependency"];
      ruleAgreement = true;
    } else {
      templateName = "Architecture Cleanup sequence";
      workflowParams = {
        actionPlanId: new mongoose.Types.ObjectId().toString(),
        nodeId: nodes[0]?.id || "node-1",
        nodeTitle: nodes[0]?.title || "Base Node"
      };
      reasoning = "System architecture is clean. Proposing ADR cleanup sequence as a standard audit workflow.";
      sourceEntities = nodes[0] ? [nodes[0].id] : [];
    }
  } else if (agentId === "product") {
    const unspecFeature = nodes.find((n: any) => n.category === "Feature");
    if (unspecFeature) {
      templateName = "Feature Delivery scaffold";
      workflowParams = {
        nodeId: unspecFeature.id,
        nodeTitle: unspecFeature.title
      };
      reasoning = `Feature node "${unspecFeature.title}" is flagged. Proposing Feature Delivery scaffolding workflow to build PRD spec.`;
      sourceEntities = [unspecFeature.id];
      ruleAgreement = true;
    }
  } else if (agentId === "documentation") {
    const docGapNode = nodes.find((n: any) => n.category === "Architecture" || n.category === "Feature");
    if (docGapNode) {
      templateName = "Documentation Recovery workflow";
      workflowParams = {
        nodeId: docGapNode.id,
        nodeTitle: docGapNode.title
      };
      reasoning = `Missing spec coverage identified on node "${docGapNode.title}". Proposing Documentation Recovery workflow to build spec draft.`;
      sourceEntities = [docGapNode.id];
      ruleAgreement = true;
    }
  } else if (agentId === "pm") {
    const unownedNode = nodes.find((n: any) => n.category === "Feature" && !n.data?.owner);
    if (unownedNode) {
      templateName = "Ownership Assignment workflow";
      workflowParams = {
        nodeId: unownedNode.id,
        nodeTitle: unownedNode.title,
        userId: new mongoose.Types.ObjectId().toString() // Propose a mock ID placeholder
      };
      reasoning = `Feature node "${unownedNode.title}" lacks a designated project owner. Proposing Owner Assignment workflow.`;
      sourceEntities = [unownedNode.id];
      ruleAgreement = true;
    }
  } else if (agentId === "risk") {
    const riskNode = nodes.find((n: any) => n.category === "Risk" && n.data?.status !== "Resolved");
    if (riskNode) {
      templateName = "Bug Resolution flow";
      workflowParams = {
        nodeId: riskNode.id,
        nodeTitle: riskNode.title
      };
      reasoning = `Active threat/risk detected on node "${riskNode.title}". Proposing Bug Resolution mitigation flow.`;
      sourceEntities = [riskNode.id];
      sourceRisks = [riskNode.id];
      ruleAgreement = true;
    } else {
      const todoTask = nodes.find((n: any) => n.category === "Task");
      templateName = "Bug Resolution flow";
      workflowParams = {
        nodeId: todoTask?.id || "node-1",
        nodeTitle: todoTask?.title || "Setup"
      };
      reasoning = "No critical risks active. Proposing mitigation workflow for task node validation.";
      sourceEntities = todoTask ? [todoTask.id] : [];
    }
  }

  // 4. Fetch the target Workflow definition template
  const template = await Workflow.findOne({ hiveId: hiveObjectId, name: templateName, isTemplate: true }).exec();
  if (!template) {
    throw new Error(`Target workflow template "${templateName}" not seeded.`);
  }

  // 5. Calculate Confidence Breakdown
  const effectivenessScore = instance.metrics.proposalEffectivenessScore || 0;
  const confidenceData = calculateAgentConfidence({
    sourceEntities,
    sourceDocuments: [],
    sourceActivities: [],
    sourceWorkflows: [],
    sourceRecommendations: [],
    sourceRisks,
    sourceMissions: [],
    edges,
    ruleAgreement,
    effectivenessScore
  });

  // 6. Substitute Placeholders in Steps
  const substitute = (obj: any, context: Record<string, any>): any => {
    if (typeof obj === "string") {
      return obj.replace(/{(\w+)}/g, (_, key) => {
        return context[key] !== undefined ? String(context[key]) : `{${key}}`;
      });
    } else if (Array.isArray(obj)) {
      return obj.map(item => substitute(item, context));
    } else if (obj !== null && typeof obj === "object") {
      const result: Record<string, any> = {};
      for (const key of Object.keys(obj)) {
        result[key] = substitute(obj[key], context);
      }
      return result;
    }
    return obj;
  };

  const runSteps: IWorkflowRunStep[] = template.steps.map(step => ({
    stepNumber: step.stepNumber,
    actionType: step.actionType,
    params: substitute(step.params, workflowParams),
    status: "pending" as const
  }));

  const metrics = calculateWorkflowMetrics(template.steps);

  // 7. Create WorkflowRun proposed proposal document
  const proposal = await WorkflowRun.create({
    hiveId: hiveObjectId,
    workflowId: template._id,
    name: `${def.name}: ${template.name}`,
    status: "proposed",
    currentStepIndex: 0,
    steps: runSteps,
    parentWorkflowId: undefined,
    parentRunId: undefined,
    spawnedActionPlans: [],
    triggerFingerprint: `agent-${agentId}-${new mongoose.Types.ObjectId().toString()}`,
    firstTriggeredAt: new Date(),
    lastTriggeredAt: new Date(),
    occurrenceCount: 1,
    workflowRiskLevel: instance.riskLevel, // Inherits agent's configured risk level override
    proposedByAgentId: agentId,
    agentExplainability: {
      reasoning,
      sourceEntities,
      sourceDocuments: [],
      sourceActivities: [],
      sourceWorkflows: [],
      sourceRecommendations: [],
      sourceRisks,
      sourceMissions: [],
      confidence: confidenceData.confidence,
      confidenceBreakdown: confidenceData.breakdown
    },
    metrics,
    logs: [{
      timestamp: new Date(),
      message: `Workflow proposal generated by agent ${def.name}. Confidence: ${confidenceData.confidence}`,
      severity: "info"
    }]
  });

  // 8. Increment metrics.proposalsGenerated
  instance.metrics.proposalsGenerated += 1;
  instance.metrics.totalConfidence += confidenceData.confidence;
  await instance.save();

  return proposal;
}

/**
 * Updates agent effectiveness score based on outcomes.
 */
export async function updateAgentEffectiveness(hiveId: string, agentId: string): Promise<void> {
  const instance = await AgentInstance.findOne({ hiveId: new mongoose.Types.ObjectId(hiveId), agentId }).exec();
  if (!instance) return;

  const { proposalsApproved, proposalsRejected, workflowSuccessCount, workflowFailureCount } = instance.metrics;

  // Effectiveness formula
  let score = (proposalsApproved * 5) + (workflowSuccessCount * 20) - (proposalsRejected * 10) - (workflowFailureCount * 20);
  if (score < 0) score = 0; // Clamp >= 0

  instance.metrics.proposalEffectivenessScore = score;
  await instance.save();
}
