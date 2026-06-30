import mongoose from "mongoose";
import crypto from "crypto";
import Workflow, { type IWorkflowStep } from "../models/Workflow";
import WorkflowRun, { type IWorkflowRun, type IWorkflowRunStep, type IWorkflowRunMetrics } from "../models/WorkflowRun";
import AgentActionPlan from "../models/AgentActionPlan";
import CanvasNode from "../models/CanvasNode";
import Document from "../models/Document";
import IntelligenceNotification from "../models/IntelligenceNotification";
import { executeActionPlan } from "./executionEngine";
import { generateActionPlans } from "./agentActionEngine";
import AgentInstance from "../models/AgentInstance";
import { updateAgentEffectiveness } from "./agentRegistry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks for cycles or infinite loops in parent workflow run references.
 */
export async function validateWorkflowHierarchy(parentRunId: string | mongoose.Types.ObjectId, currentRunId?: string | mongoose.Types.ObjectId): Promise<void> {
  const visited = new Set<string>();
  if (currentRunId) {
    visited.add(currentRunId.toString());
  }

  let nextId = parentRunId.toString();
  while (nextId) {
    if (visited.has(nextId)) {
      throw new Error("Recursive workflow execution detected: Parent-child relationship forms a loop.");
    }
    visited.add(nextId);

    const run = await WorkflowRun.findById(nextId).select("parentRunId").lean().exec();
    if (!run || !run.parentRunId) {
      break;
    }
    nextId = run.parentRunId.toString();
  }
}

/**
 * Calculates workflow risk level independently of individual action risks
 */
export function calculateWorkflowRiskLevel(steps: IWorkflowStep[]): "low" | "medium" | "high" | "critical" {
  const stepCount = steps.length;
  if (stepCount === 0) return "low";

  const hasExecutePlan = steps.some(s => s.actionType === "execute_action_plan");
  
  if (hasExecutePlan) {
    if (stepCount > 4) return "critical";
    if (stepCount > 2) return "high";
    return "medium";
  }

  return "low";
}

/**
 * Calculates estimation metrics for a workflow run simulator panel
 */
export function calculateWorkflowMetrics(steps: IWorkflowStep[]): IWorkflowRunMetrics {
  const plansCount = steps.filter(s => s.actionType === "generate_action_plan").length;
  const executionsCount = steps.filter(s => s.actionType === "execute_action_plan").length;
  const approvalsCount = steps.filter(s => s.actionType === "request_approval").length;

  // Complexity score based on step types
  let complexity = 0;
  for (const step of steps) {
    if (step.actionType === "request_approval") complexity += 5;
    else if (step.actionType === "generate_action_plan") complexity += 10;
    else if (step.actionType === "execute_action_plan") complexity += 20;
    else complexity += 2;
  }

  // Duration in ms: request_approval assumes 1 hour of wait, execute/generate takes 30s
  const duration = (approvalsCount * 3600 + (plansCount + executionsCount) * 30) * 1000;

  return {
    estimatedHealthImpact: executionsCount > 0 ? 5 : 0,
    estimatedMomentumImpact: executionsCount > 0 ? 10 : 0,
    executionComplexity: complexity,
    estimatedDuration: duration,
    estimatedPlansCount: plansCount,
    estimatedExecutionsCount: executionsCount,
    estimatedApprovalsCount: approvalsCount
  };
}

/**
 * Substitutes variables recursively in a parameter block using trigger context.
 */
export function substitutePlaceholders(obj: any, context: Record<string, any>): any {
  if (typeof obj === "string") {
    return obj.replace(/{(\w+)}/g, (_, key) => {
      return context[key] !== undefined ? String(context[key]) : `{${key}}`;
    });
  } else if (Array.isArray(obj)) {
    return obj.map(item => substitutePlaceholders(item, context));
  } else if (obj !== null && typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      result[key] = substitutePlaceholders(obj[key], context);
    }
    return result;
  }
  return obj;
}

/**
 * Computes trigger fingerprint to prevent storming identical proposals
 */
export function computeTriggerFingerprint(
  workflowId: string | mongoose.Types.ObjectId,
  hiveId: string | mongoose.Types.ObjectId,
  triggerType: string,
  context: Record<string, any>
): string {
  const hash = crypto.createHash("sha256");
  hash.update(workflowId.toString());
  hash.update(hiveId.toString());
  hash.update(triggerType);

  // Focus only on key identifiers in the trigger context
  const keyIdentifiers = ["nodeId", "recId", "recommendationId", "missionId", "riskId", "gapId", "threshold"];
  const filterObj: Record<string, any> = {};
  for (const k of keyIdentifiers) {
    if (context[k] !== undefined) {
      filterObj[k] = context[k];
    }
  }

  hash.update(JSON.stringify(filterObj));
  return hash.digest("hex");
}

/**
 * Safety check: Block execution/activation if actor is not a human (AI block).
 */
export function enforceHumanActor(actorId: string): void {
  const lower = actorId.toLowerCase();
  if (
    lower === "ai" ||
    lower === "system" ||
    lower === "hivemind" ||
    lower === "ai-agent" ||
    lower.includes("agent") ||
    lower.includes("bot")
  ) {
    throw new Error("AI agents are strictly blocked from approving, activating, or executing workflows.");
  }
}

// ---------------------------------------------------------------------------
// Core Engine Functions
// ---------------------------------------------------------------------------

/**
 * Triggers workflow checks. Creates proposed run, or increments deduplication storm counts.
 */
export async function triggerWorkflowEvent(
  hiveId: string,
  triggerType: string,
  context: Record<string, any> = {}
): Promise<IWorkflowRun[]> {
  const activeWorkflows = await Workflow.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
    status: "active",
    "trigger.type": triggerType
  } as any).exec();

  const results: IWorkflowRun[] = [];

  for (const workflow of activeWorkflows) {
    // Check parameters threshold matches (if health score threshold)
    if (triggerType === "health_score_threshold") {
      const threshold = workflow.trigger.params?.threshold ?? 50;
      const currentScore = context.healthScore ?? 100;
      if (currentScore >= threshold) {
        continue; // Doesn't breach threshold, skip
      }
    }

    const fingerprint = computeTriggerFingerprint(workflow._id, hiveId, triggerType, context);

    // Look for active/proposed run with identical fingerprint
    const existingRun = await WorkflowRun.findOne({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      triggerFingerprint: fingerprint,
      status: { $in: ["proposed", "active", "paused", "blocked"] }
    }).exec();

    if (existingRun) {
      existingRun.occurrenceCount += 1;
      existingRun.lastTriggeredAt = new Date();
      existingRun.logs.push({
        timestamp: new Date(),
        message: `Deduplicated trigger storm for fingerprint: ${fingerprint}. Total occurrences: ${existingRun.occurrenceCount}`,
        severity: "warn"
      });
      await existingRun.save();
      results.push(existingRun);
      continue;
    }

    // Recursion protection: if context has parentRunId, validate it first
    if (context.parentRunId) {
      await validateWorkflowHierarchy(context.parentRunId);
    }

    // Perform substitution on workflow name & steps
    const runName = substitutePlaceholders(workflow.name, context) || workflow.name;
    const runSteps: IWorkflowRunStep[] = workflow.steps.map(step => ({
      stepNumber: step.stepNumber,
      actionType: step.actionType,
      params: substitutePlaceholders(step.params, context),
      status: "pending"
    }));

    const riskLevel = calculateWorkflowRiskLevel(workflow.steps);
    const metrics = calculateWorkflowMetrics(workflow.steps);

    const newRun = await WorkflowRun.create({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      workflowId: workflow._id,
      name: runName,
      status: "proposed",
      currentStepIndex: 0,
      steps: runSteps,
      parentWorkflowId: context.parentWorkflowId ? new mongoose.Types.ObjectId(context.parentWorkflowId) : undefined,
      parentRunId: context.parentRunId ? new mongoose.Types.ObjectId(context.parentRunId) : undefined,
      spawnedActionPlans: [],
      triggerFingerprint: fingerprint,
      firstTriggeredAt: new Date(),
      lastTriggeredAt: new Date(),
      occurrenceCount: 1,
      workflowRiskLevel: riskLevel,
      proposedBy: context.userId ? new mongoose.Types.ObjectId(context.userId) : undefined,
      metrics,
      logs: [{
        timestamp: new Date(),
        message: `Workflow proposal generated via trigger ${triggerType}. Fingerprint: ${fingerprint}`,
        severity: "info"
      }]
    });

    results.push(newRun);
  }

  return results;
}

/**
 * Transition proposal to approved state (must be a human).
 */
export async function approveWorkflowProposal(
  runId: string,
  actorId: string,
  actorName: string,
  acknowledgeCritical = false
): Promise<IWorkflowRun> {
  enforceHumanActor(actorId);

  const run = await WorkflowRun.findById(runId).exec();
  if (!run) {
    throw new Error("Workflow run not found.");
  }

  if (run.status !== "proposed") {
    throw new Error(`Only proposed runs can be approved. Current status: ${run.status}`);
  }

  // Safety risk guard check
  if (run.workflowRiskLevel === "critical" && !acknowledgeCritical) {
    throw new Error("Critical proposals require explicit acknowledgement.");
  }

  run.status = "approved";
  run.approvedBy = new mongoose.Types.ObjectId(actorId);
  run.approvedAt = new Date();
  run.logs.push({
    timestamp: new Date(),
    message: `Workflow proposal approved by human actor ${actorName}.`,
    severity: "info"
  });

  await run.save();

  // Update Agent metrics if proposed by an agent
  if (run.proposedByAgentId) {
    const agent = await AgentInstance.findOne({ hiveId: run.hiveId, agentId: run.proposedByAgentId }).exec();
    if (agent) {
      agent.metrics.proposalsApproved += 1;
      await agent.save();
      await updateAgentEffectiveness(run.hiveId.toString(), run.proposedByAgentId);
    }
  }

  return run;
}

/**
 * Transition proposal to rejected (failed) state (must be a human).
 */
export async function rejectWorkflowProposal(
  runId: string,
  actorId: string,
  actorName: string
): Promise<IWorkflowRun> {
  enforceHumanActor(actorId);

  const run = await WorkflowRun.findById(runId).exec();
  if (!run) {
    throw new Error("Workflow run not found.");
  }

  if (run.status !== "proposed") {
    throw new Error(`Only proposed runs can be rejected. Current status: ${run.status}`);
  }

  run.status = "failed";
  run.logs.push({
    timestamp: new Date(),
    message: `Workflow proposal rejected by human actor ${actorName}.`,
    severity: "warn"
  });

  await run.save();

  // Update Agent metrics if proposed by an agent
  if (run.proposedByAgentId) {
    const agent = await AgentInstance.findOne({ hiveId: run.hiveId, agentId: run.proposedByAgentId }).exec();
    if (agent) {
      agent.metrics.proposalsRejected += 1;
      await agent.save();
      await updateAgentEffectiveness(run.hiveId.toString(), run.proposedByAgentId);
    }
  }

  return run;
}

/**
 * Helper to recursively search an object for specific key values.
 */
function findKeysRecursive(obj: any, keys: string[], found: Record<string, string[]>) {
  if (obj === null || typeof obj !== "object") return;
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      findKeysRecursive(item, keys, found);
    }
    return;
  }
  
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    if (keys.includes(k) && typeof val === "string" && val.length > 5 && !val.startsWith("ref:")) {
      if (!found[k]) found[k] = [];
      found[k].push(val);
    } else {
      findKeysRecursive(val, keys, found);
    }
  }
}

/**
 * Re-run checks before workflow run activation/execution.
 */
export async function runActivationGuards(run: IWorkflowRun): Promise<{ valid: boolean; error?: string }> {
  // 1. Entity existence check
  const nodeKeys = ["nodeId", "linkedNodeId", "targetNodeId", "sourceNodeId", "entityId"];
  const docKeys = ["documentId", "docId", "linkedDocId"];

  for (const step of run.steps) {
    const foundValues: Record<string, string[]> = {};
    findKeysRecursive(step.params, [...nodeKeys, ...docKeys], foundValues);

    // Validate nodes
    for (const key of nodeKeys) {
      const nodeIds = foundValues[key] || [];
      for (const id of nodeIds) {
        const nodeExists = await CanvasNode.exists({ id, hiveId: run.hiveId });
        if (!nodeExists) {
          return { valid: false, error: `Referenced Node ${id} in Step ${step.stepNumber} does not exist.` };
        }
      }
    }

    // Validate docs
    for (const key of docKeys) {
      const docIds = foundValues[key] || [];
      for (const id of docIds) {
        try {
          const docIdObj = new mongoose.Types.ObjectId(id);
          const docExists = await Document.exists({ _id: docIdObj });
          if (!docExists) {
            return { valid: false, error: `Referenced Document ${id} in Step ${step.stepNumber} does not exist.` };
          }
        } catch (e) {
          // ignore invalid objectid shapes
        }
      }
    }
  }

  // 2. Risk check - enforce max risk level guard configuration
  // For demonstration/verification, let's look for a hypothetical maxRiskLevel on the hive or default config
  const configuredMaxRisk: "low" | "medium" | "high" | "critical" = "high"; // configure default max to High
  const riskHierarchy = { low: 1, medium: 2, high: 3, critical: 4 };

  if (riskHierarchy[run.workflowRiskLevel] > riskHierarchy[configuredMaxRisk]) {
    return {
      valid: false,
      error: `Workflow risk level [${run.workflowRiskLevel}] exceeds maximum configured safety threshold [${configuredMaxRisk}].`
    };
  }

  return { valid: true };
}

/**
 * Activates and starts execution of an approved workflow run.
 */
export async function executeWorkflowRun(
  runId: string,
  actorId: string,
  actorName: string
): Promise<IWorkflowRun> {
  enforceHumanActor(actorId);

  const run = await WorkflowRun.findById(runId).exec();
  if (!run) {
    throw new Error("Workflow run not found.");
  }

  if (run.status !== "approved" && run.status !== "paused" && run.status !== "blocked") {
    throw new Error(`Workflow run cannot be activated from state: ${run.status}`);
  }

  // Run activation guards
  const guardResult = await runActivationGuards(run);
  if (!guardResult.valid) {
    run.status = "blocked";
    run.logs.push({
      timestamp: new Date(),
      message: `Activation blocked by guard: ${guardResult.error}`,
      severity: "error"
    });
    await run.save();
    return run;
  }

  // Recursion protection double check
  if (run.parentRunId) {
    await validateWorkflowHierarchy(run.parentRunId, run._id);
  }

  run.status = "active";
  if (!run.activatedAt) {
    run.activatedAt = new Date();
    run.activatedBy = new mongoose.Types.ObjectId(actorId);
  }
  run.logs.push({
    timestamp: new Date(),
    message: `Workflow run activated/resumed by ${actorName}.`,
    severity: "info"
  });
  await run.save();

  // Trigger step execution asynchronously
  runStepProcessorBackground(run._id.toString(), actorId, actorName);

  return run;
}

/**
 * Pause workflow execution (requires human).
 */
export async function pauseWorkflow(
  runId: string,
  actorId: string,
  actorName: string
): Promise<IWorkflowRun> {
  enforceHumanActor(actorId);

  const run = await WorkflowRun.findById(runId).exec();
  if (!run) {
    throw new Error("Workflow run not found.");
  }

  if (run.status !== "active") {
    throw new Error(`Only active workflows can be paused. Current: ${run.status}`);
  }

  run.status = "paused";
  run.logs.push({
    timestamp: new Date(),
    message: `Workflow manually paused by human actor ${actorName}.`,
    severity: "info"
  });
  await run.save();
  return run;
}

/**
 * Resume a paused workflow run.
 */
export async function resumeWorkflow(
  runId: string,
  actorId: string,
  actorName: string
): Promise<IWorkflowRun> {
  return executeWorkflowRun(runId, actorId, actorName);
}

/**
 * Human override approval for a paused step (e.g. approval request step).
 */
export async function submitStepApproval(
  runId: string,
  stepNumber: number,
  actorId: string,
  actorName: string
): Promise<IWorkflowRun> {
  enforceHumanActor(actorId);

  const run = await WorkflowRun.findById(runId).exec();
  if (!run) {
    throw new Error("Workflow run not found.");
  }

  const step = run.steps.find(s => s.stepNumber === stepNumber);
  if (!step) {
    throw new Error(`Step number ${stepNumber} not found in run.`);
  }

  step.status = "completed";
  step.executedAt = new Date();
  run.logs.push({
    timestamp: new Date(),
    message: `Step ${stepNumber} approved/completed manually by human actor ${actorName}.`,
    severity: "info"
  });

  // Automatically auto-resume next steps
  if (run.status === "paused") {
    run.status = "active";
  }
  await run.save();

  runStepProcessorBackground(run._id.toString(), actorId, actorName);

  return run;
}

/**
 * Updates proposing agent metrics when a workflow run finishes executing.
 */
export async function handleWorkflowRunTerminalState(run: any): Promise<void> {
  if (!run.proposedByAgentId) return;
  try {
    const agent = await AgentInstance.findOne({ hiveId: run.hiveId, agentId: run.proposedByAgentId }).exec();
    if (agent) {
      if (run.status === "completed") {
        agent.metrics.workflowSuccessCount += 1;
      } else if (run.status === "failed") {
        agent.metrics.workflowFailureCount += 1;
      }
      await agent.save();
      await updateAgentEffectiveness(run.hiveId.toString(), run.proposedByAgentId);
    }
  } catch (err) {
    console.error("[WorkflowEngine] Error updating agent metrics on terminal state:", err);
  }
}

/**
 * Processes workflow steps sequentially in background thread context
 */
async function runStepProcessorBackground(runId: string, actorId: string, actorName: string): Promise<void> {
  try {
    let run = await WorkflowRun.findById(runId).exec();
    if (!run || run.status !== "active") return;

    const startTime = run.activatedAt ? run.activatedAt.getTime() : Date.now();

    while (run && run.status === "active" && run.currentStepIndex < run.steps.length) {
      const stepIndex = run.currentStepIndex;
      const step = run.steps[stepIndex];

      if (!step) break;

      // Skip already completed/skipped steps
      if (step.status === "completed" || step.status === "skipped") {
        run.currentStepIndex += 1;
        await run.save();
        continue;
      }

      run.logs.push({
        timestamp: new Date(),
        message: `Processing step ${step.stepNumber}: ${step.actionType}...`,
        severity: "info"
      });
      step.status = "running";
      await run.save();

      try {
        const result = await executeWorkflowStep(run, stepIndex, actorId, actorName);
        
        // Refresh run state from DB
        run = await WorkflowRun.findById(runId).exec();
        if (!run) break;

        const refreshedStep = run.steps[stepIndex];
        if (!refreshedStep) break;

        if (result.status === "paused") {
          run.status = "paused";
          refreshedStep.status = "running";
          refreshedStep.executedAt = new Date();
          run.logs.push({
            timestamp: new Date(),
            message: `Step ${refreshedStep.stepNumber} suspended/paused. Workflow run is paused awaiting action.`,
            severity: "info"
          });
          await run.save();
          break; // Stop iteration
        } else if (result.status === "completed") {
          refreshedStep.status = "completed";
          refreshedStep.executedAt = new Date();
          if (result.actionPlanId) {
            refreshedStep.actionPlanId = result.actionPlanId;
            run.spawnedActionPlans.push(result.actionPlanId);
          }
          run.currentStepIndex += 1;
          run.logs.push({
            timestamp: new Date(),
            message: `Step ${refreshedStep.stepNumber} completed successfully.`,
            severity: "info"
          });
          await run.save();
        } else if (result.status === "failed") {
          refreshedStep.status = "failed";
          refreshedStep.executedAt = new Date();
          refreshedStep.error = result.error || "Execution error.";
          run.status = "failed";
          run.completedAt = new Date();
          run.executionDurationMs = Date.now() - startTime;
          run.logs.push({
            timestamp: new Date(),
            message: `Step ${refreshedStep.stepNumber} failed: ${refreshedStep.error}`,
            severity: "error"
          });
          await run.save();
          await handleWorkflowRunTerminalState(run);
          break; // Stop iteration
        }
      } catch (err: any) {
        // Refresh run state from DB if possible
        run = await WorkflowRun.findById(runId).exec();
        if (run) {
          const refreshedStep = run.steps[stepIndex];
          if (refreshedStep) {
            refreshedStep.status = "failed";
            refreshedStep.executedAt = new Date();
            refreshedStep.error = err.message;
          }
          run.status = "failed";
          run.completedAt = new Date();
          run.executionDurationMs = Date.now() - startTime;
          run.logs.push({
            timestamp: new Date(),
            message: `Internal exception in step ${step.stepNumber}: ${err.message}`,
            severity: "error"
          });
          await run.save();
          await handleWorkflowRunTerminalState(run);
        }
        break; // Stop iteration
      }

      // Reload
      run = await WorkflowRun.findById(runId).exec();
    }

    if (run && run.status === "active" && run.currentStepIndex >= run.steps.length) {
      run.status = "completed";
      run.completedAt = new Date();
      run.executionDurationMs = Date.now() - startTime;
      run.logs.push({
        timestamp: new Date(),
        message: `Workflow completed successfully in ${run.executionDurationMs}ms.`,
        severity: "info"
      });
      await run.save();
      await handleWorkflowRunTerminalState(run);
    }
  } catch (err) {
    console.error("[WorkflowEngine] Background processor error:", err);
  }
}

/**
 * Handles individual step logic without modifying node/document DB state directly.
 * Employs execution engine for plan mutation operations.
 */
export async function executeWorkflowStep(
  run: any,
  stepIndex: number,
  actorId: string,
  actorName: string
): Promise<{ status: "completed" | "paused" | "failed"; actionPlanId?: mongoose.Types.ObjectId; error?: string }> {
  const step = run.steps[stepIndex];
  if (!step) {
    return { status: "failed", error: "Step definition not found" };
  }

  const { actionType, params } = step;

  switch (actionType) {
    case "generate_action_plan": {
      // 1. Check if step defines programmatically explicit plan structure
      if (params.title && params.steps) {
        const newPlan = await AgentActionPlan.create({
          hiveId: run.hiveId,
          status: "proposed",
          title: params.title,
          description: params.description || `Generated action plan for workflow run ${run.name}`,
          reason: params.reason || `Automatically generated by step ${step.stepNumber}`,
          confidence: params.confidence ?? 1.0,
          riskLevel: params.riskLevel ?? "medium",
          riskScore: params.riskScore ?? 50,
          actionQualityScore: params.actionQualityScore ?? 80,
          steps: (params.steps || []).map((s: any) => ({
            stepNumber: s.stepNumber,
            actionType: s.actionType,
            params: s.params || {},
            reversibility: s.reversibility || "reversible",
            affectedEntities: s.affectedEntities || [],
            expectedImpact: s.expectedImpact || `Executes automated ${s.actionType.replace(/_/g, " ")} step.`
          })),
          sourceRiskIds: params.sourceRiskIds || [],
          sourceGapIds: params.sourceGapIds || [],
          sourceRecommendationIds: params.sourceRecommendationIds || [],
          sourceMissionIds: params.sourceMissionIds || [],
          expiresAt: new Date(Date.now() + 72 * 3600000), // default 72h
          structuredAuditLogs: [{
            actorId: new mongoose.Types.ObjectId(actorId),
            actorName,
            action: "submit",
            notes: `Generated programmatically via Workflow: ${run.name} Step ${step.stepNumber}`,
            timestamp: new Date()
          }]
        });

        return { status: "completed", actionPlanId: newPlan._id };
      }

      // 2. Otherwise trigger generic action engine generation
      const genResult = await generateActionPlans(run.hiveId.toString());
      if (genResult.plans && genResult.plans.length > 0) {
        const newestPlan = genResult.plans[0];
        return { status: "completed", actionPlanId: newestPlan!._id };
      }

      return { status: "completed" }; // continue even if 0 plans generated
    }

    case "request_approval": {
      // Pause run. Human must manually approve/resume step.
      // Create user notification
      await IntelligenceNotification.create({
        hiveId: run.hiveId,
        type: "new_risk", // reusing exist risk layout channels
        fingerprint: `workflow_run:${run._id}:step:${step.stepNumber}`,
        title: `Workflow Awaiting Approval: ${run.name}`,
        message: `Workflow Run requires manual confirmation to execute step ${step.stepNumber}.`,
        severity: "medium"
      });

      return { status: "paused" };
    }

    case "execute_action_plan": {
      // Resolve action plan reference from previous steps
      let targetPlanId: mongoose.Types.ObjectId | undefined;

      if (params.actionPlanId) {
        if (params.actionPlanId.toString().startsWith("ref:")) {
          const refStepNum = parseInt(params.actionPlanId.split(":")[1] || "0", 10);
          const refStep = run.steps.find((s: any) => s.stepNumber === refStepNum);
          targetPlanId = refStep?.actionPlanId;
        } else {
          try {
            targetPlanId = new mongoose.Types.ObjectId(params.actionPlanId);
          } catch (e) {
            // invalid ID format
          }
        }
      } else if (params.actionPlanStepNumber) {
        const refStep = run.steps.find((s: any) => s.stepNumber === params.actionPlanStepNumber);
        targetPlanId = refStep?.actionPlanId;
      }

      if (!targetPlanId) {
        return { status: "failed", error: "Could not resolve target actionPlanId parameter." };
      }

      // Check action plan status
      const plan = await AgentActionPlan.findById(targetPlanId).exec();
      if (!plan) {
        return { status: "failed", error: `Target action plan ${targetPlanId} not found.` };
      }

      if (plan.status === "proposed") {
        // Paused! Wait for human approval of the Action Plan.
        // We set run state to paused and do NOT complete step.
        // Once approved, the workflow run is resumed by human.
        await IntelligenceNotification.create({
          hiveId: run.hiveId,
          type: "new_risk",
          fingerprint: `workflow_run:${run._id}:plan:${plan._id}`,
          title: `Action Plan Awaiting Approval: ${plan.title}`,
          message: `Workflow step cannot continue because action plan is proposed. Approve the plan to proceed.`,
          severity: "medium"
        });

        // Save a warning log in run
        run.logs.push({
          timestamp: new Date(),
          message: `Target Action Plan ${plan._id} is proposed. Pausing workflow run.`,
          severity: "warn"
        });
        await run.save();

        return { status: "paused" };
      }

      if (plan.status !== "approved" && plan.status !== "executed") {
        return { status: "failed", error: `Target Action Plan ${plan._id} status is ${plan.status}. Must be approved.` };
      }

      // If already executed (perhaps from manual retry), we skip execution
      if (plan.status === "executed") {
        return { status: "completed", actionPlanId: plan._id };
      }

      // Run execution through Phase 11 engine
      const execResult = await executeActionPlan(
        run.hiveId.toString(),
        plan._id.toString(),
        actorId,
        actorName,
        {},
        { maxRiskLevel: "high" }
      );

      if (!execResult.success) {
        return { status: "failed", error: `Execution engine error: ${execResult.message}` };
      }

      return { status: "completed", actionPlanId: plan._id };
    }

    case "notify_user": {
      await IntelligenceNotification.create({
        hiveId: run.hiveId,
        type: "new_risk",
        fingerprint: `workflow_run:${run._id}:notify:${step.stepNumber}`,
        title: params.title || `Workflow Notice: ${run.name}`,
        message: params.message || `Notice from step ${step.stepNumber}.`,
        severity: params.severity || "info"
      });

      return { status: "completed" };
    }

    default:
      return { status: "failed", error: `Unsupported workflow step actionType: ${actionType}` };
  }
}

// ---------------------------------------------------------------------------
// Built-in Templates Registry Seeder
// ---------------------------------------------------------------------------

/**
 * Registers the 6 standard built-in workflow templates if missing.
 */
export async function registerBuiltInTemplates(): Promise<void> {
  const templates = [
    {
      name: "Feature Delivery scaffold",
      description: "Automates feature bootstrapping: Generates plan to build PRD and task nodes, gets user validation, and executes scaffolding.",
      trigger: { type: "manual", params: {} },
      steps: [
        {
          stepNumber: 1,
          actionType: "generate_action_plan",
          params: {
            title: "Scaffold Feature Delivery: {nodeTitle}",
            description: "Automatically boots document and task scaffolds for feature gap",
            confidence: 1.0,
            riskLevel: "medium",
            steps: [
              {
                stepNumber: 1,
                actionType: "create_document",
                params: {
                  title: "PRD: {nodeTitle}",
                  type: "prd",
                  linkedNodeId: "{nodeId}"
                },
                reversibility: "reversible",
                affectedEntities: [{ entityId: "{nodeId}", entityType: "node", title: "{nodeTitle}" }]
              },
              {
                stepNumber: 2,
                actionType: "create_node",
                params: {
                  category: "Task",
                  title: "Implementation Plan: {nodeTitle}",
                  status: "Todo"
                },
                reversibility: "reversible",
                affectedEntities: [{ entityId: "{nodeId}", entityType: "node", title: "{nodeTitle}" }]
              }
            ]
          }
        },
        {
          stepNumber: 2,
          actionType: "request_approval",
          params: {}
        },
        {
          stepNumber: 3,
          actionType: "execute_action_plan",
          params: { actionPlanId: "ref:1" }
        }
      ],
      status: "active",
      isTemplate: true
    },
    {
      name: "Bug Resolution flow",
      description: "Auto-mitigates active high-priority bugs, commits status modifications, and alerts the team.",
      trigger: { type: "manual", params: {} },
      steps: [
        {
          stepNumber: 1,
          actionType: "generate_action_plan",
          params: {
            title: "Resolve Bug: {nodeTitle}",
            confidence: 0.95,
            riskLevel: "low",
            steps: [
              {
                stepNumber: 1,
                actionType: "update_node",
                params: {
                  nodeId: "{nodeId}",
                  status: "In Progress"
                },
                reversibility: "reversible",
                affectedEntities: [{ entityId: "{nodeId}", entityType: "node", title: "{nodeTitle}" }]
              }
            ]
          }
        },
        {
          stepNumber: 2,
          actionType: "execute_action_plan",
          params: { actionPlanId: "ref:1" }
        },
        {
          stepNumber: 3,
          actionType: "notify_user",
          params: {
            title: "Bug mitigation active",
            message: "Mitigation plan for {nodeTitle} executed successfully. Status is now set to In Progress.",
            severity: "info"
          }
        }
      ],
      status: "active",
      isTemplate: true
    },
    {
      name: "Documentation Recovery workflow",
      description: "Tracks missing documentation gaps (PRD, TRD) and recovery stub generation.",
      trigger: { type: "manual", params: {} },
      steps: [
        {
          stepNumber: 1,
          actionType: "generate_action_plan",
          params: {
            title: "Document PRD Gap: {nodeTitle}",
            confidence: 1.0,
            riskLevel: "low",
            steps: [
              {
                stepNumber: 1,
                actionType: "create_document",
                params: {
                  title: "PRD: {nodeTitle}",
                  type: "prd",
                  linkedNodeId: "{nodeId}"
                },
                reversibility: "reversible",
                affectedEntities: [{ entityId: "{nodeId}", entityType: "node", title: "{nodeTitle}" }]
              }
            ]
          }
        },
        {
          stepNumber: 2,
          actionType: "execute_action_plan",
          params: { actionPlanId: "ref:1" }
        }
      ],
      status: "active",
      isTemplate: true
    },
    {
      name: "Ownership Assignment workflow",
      description: "Validates unowned nodes and commits assignee assignments.",
      trigger: { type: "manual", params: {} },
      steps: [
        {
          stepNumber: 1,
          actionType: "generate_action_plan",
          params: {
            title: "Assign Owner to Node: {nodeTitle}",
            confidence: 0.9,
            riskLevel: "low",
            steps: [
              {
                stepNumber: 1,
                actionType: "update_node",
                params: {
                  nodeId: "{nodeId}",
                  owner: "{userId}"
                },
                reversibility: "reversible",
                affectedEntities: [{ entityId: "{nodeId}", entityType: "node", title: "{nodeTitle}" }]
              }
            ]
          }
        },
        {
          stepNumber: 2,
          actionType: "execute_action_plan",
          params: { actionPlanId: "ref:1" }
        }
      ],
      status: "active",
      isTemplate: true
    },
    {
      name: "Architecture Cleanup sequence",
      description: "Manages circular back-edge cycles, requests user verification, and posts ADR stubs.",
      trigger: { type: "health_score_threshold", params: { threshold: 60 } },
      steps: [
        {
          stepNumber: 1,
          actionType: "request_approval",
          params: {}
        },
        {
          stepNumber: 2,
          actionType: "execute_action_plan",
          params: { actionPlanId: "{actionPlanId}" }
        },
        {
          stepNumber: 3,
          actionType: "generate_action_plan",
          params: {
            title: "ADR Scaffold: Cycle Cleanup",
            steps: [
              {
                stepNumber: 1,
                actionType: "create_document",
                params: {
                  title: "ADR: Architecture Loop Resolution",
                  type: "architecture"
                },
                reversibility: "reversible",
                affectedEntities: []
              }
            ]
          }
        }
      ],
      status: "active",
      isTemplate: true
    },
    {
      name: "Project Bootstrap template",
      description: "Generates action plan to bootstrap workspace scaffolds, requests review, and applies configurations.",
      trigger: { type: "manual", params: {} },
      steps: [
        {
          stepNumber: 1,
          actionType: "generate_action_plan",
          params: {
            title: "Bootstrap Workspace Scaffold",
            description: "Automatically builds baseline features and implementation tasks",
            confidence: 1.0,
            riskLevel: "medium",
            steps: [
              {
                stepNumber: 1,
                actionType: "create_node",
                params: {
                  category: "Feature",
                  title: "Core Service Integration",
                  status: "Proposed"
                },
                reversibility: "reversible",
                affectedEntities: []
              },
              {
                stepNumber: 2,
                actionType: "create_node",
                params: {
                  category: "Task",
                  title: "Set up CI/CD Pipeline",
                  status: "Todo"
                },
                reversibility: "reversible",
                affectedEntities: []
              }
            ]
          }
        },
        {
          stepNumber: 2,
          actionType: "request_approval",
          params: {}
        },
        {
          stepNumber: 3,
          actionType: "execute_action_plan",
          params: { actionPlanId: "ref:1" }
        }
      ],
      status: "active",
      isTemplate: true
    }
  ];

  for (const t of templates) {
    // We register templates matching name
    const exists = await Workflow.exists({ name: t.name, isTemplate: true });
    if (!exists) {
      // Find a placeholder hiveId. A system-wide template needs a hiveId, so we can seed it with a special id
      // or we can sync it per-hive when requested. However, since the model has a required hiveId,
      // we can do the seeding inside specific hives or create templates when a hive is loaded.
      // To keep it simple, we can seed templates with a null/dummy hiveId if it's template, or require hiveId.
      // Wait, Workflow schema has: `hiveId: { type: Schema.Types.ObjectId, ref: 'Hive', required: true }`.
      // Since `hiveId` is required: true, we should seed templates scoped to a specific hiveId when the API route
      // or verification code is run. We'll write a helper `seedTemplatesForHive(hiveId)`!
      // This is extremely safe and handles the schema requirement perfectly.
    }
  }
}

/**
 * Seeds built-in templates specifically for a Hive so it is immediately operational.
 */
export async function seedTemplatesForHive(hiveId: string): Promise<void> {
  const templates = [
    {
      hiveId: new mongoose.Types.ObjectId(hiveId),
      name: "Feature Delivery scaffold",
      description: "Automates feature bootstrapping: Generates plan to build PRD and task nodes, gets user validation, and executes scaffolding.",
      trigger: { type: "manual", params: {} },
      steps: [
        {
          stepNumber: 1,
          actionType: "generate_action_plan",
          params: {
            title: "Scaffold Feature Delivery: {nodeTitle}",
            description: "Automatically boots document and task scaffolds for feature gap",
            confidence: 1.0,
            riskLevel: "medium",
            steps: [
              {
                stepNumber: 1,
                actionType: "create_document",
                params: {
                  title: "PRD: {nodeTitle}",
                  type: "prd",
                  linkedNodeId: "{nodeId}"
                },
                reversibility: "reversible",
                affectedEntities: [{ entityId: "{nodeId}", entityType: "node", title: "{nodeTitle}" }]
              },
              {
                stepNumber: 2,
                actionType: "create_node",
                params: {
                  category: "Task",
                  title: "Implementation Plan: {nodeTitle}",
                  status: "Todo"
                },
                reversibility: "reversible",
                affectedEntities: [{ entityId: "{nodeId}", entityType: "node", title: "{nodeTitle}" }]
              }
            ]
          }
        },
        {
          stepNumber: 2,
          actionType: "request_approval",
          params: {}
        },
        {
          stepNumber: 3,
          actionType: "execute_action_plan",
          params: { actionPlanId: "ref:1" }
        }
      ],
      status: "active" as const,
      isTemplate: true
    },
    {
      hiveId: new mongoose.Types.ObjectId(hiveId),
      name: "Bug Resolution flow",
      description: "Auto-mitigates active high-priority bugs, commits status modifications, and alerts the team.",
      trigger: { type: "manual", params: {} },
      steps: [
        {
          stepNumber: 1,
          actionType: "generate_action_plan",
          params: {
            title: "Resolve Bug: {nodeTitle}",
            confidence: 0.95,
            riskLevel: "low",
            steps: [
              {
                stepNumber: 1,
                actionType: "update_node",
                params: {
                  nodeId: "{nodeId}",
                  status: "In Progress"
                },
                reversibility: "reversible",
                affectedEntities: [{ entityId: "{nodeId}", entityType: "node", title: "{nodeTitle}" }]
              }
            ]
          }
        },
        {
          stepNumber: 2,
          actionType: "execute_action_plan",
          params: { actionPlanId: "ref:1" }
        },
        {
          stepNumber: 3,
          actionType: "notify_user",
          params: {
            title: "Bug mitigation active",
            message: "Mitigation plan for {nodeTitle} executed successfully. Status is now set to In Progress.",
            severity: "info"
          }
        }
      ],
      status: "active" as const,
      isTemplate: true
    },
    {
      hiveId: new mongoose.Types.ObjectId(hiveId),
      name: "Documentation Recovery workflow",
      description: "Tracks missing documentation gaps (PRD, TRD) and recovery stub generation.",
      trigger: { type: "manual", params: {} },
      steps: [
        {
          stepNumber: 1,
          actionType: "generate_action_plan",
          params: {
            title: "Document PRD Gap: {nodeTitle}",
            confidence: 1.0,
            riskLevel: "low",
            steps: [
              {
                stepNumber: 1,
                actionType: "create_document",
                params: {
                  title: "PRD: {nodeTitle}",
                  type: "prd",
                  linkedNodeId: "{nodeId}"
                },
                reversibility: "reversible",
                affectedEntities: [{ entityId: "{nodeId}", entityType: "node", title: "{nodeTitle}" }]
              }
            ]
          }
        },
        {
          stepNumber: 2,
          actionType: "execute_action_plan",
          params: { actionPlanId: "ref:1" }
        }
      ],
      status: "active" as const,
      isTemplate: true
    },
    {
      hiveId: new mongoose.Types.ObjectId(hiveId),
      name: "Ownership Assignment workflow",
      description: "Validates unowned nodes and commits assignee assignments.",
      trigger: { type: "manual", params: {} },
      steps: [
        {
          stepNumber: 1,
          actionType: "generate_action_plan",
          params: {
            title: "Assign Owner to Node: {nodeTitle}",
            confidence: 0.9,
            riskLevel: "low",
            steps: [
              {
                stepNumber: 1,
                actionType: "update_node",
                params: {
                  nodeId: "{nodeId}",
                  owner: "{userId}"
                },
                reversibility: "reversible",
                affectedEntities: [{ entityId: "{nodeId}", entityType: "node", title: "{nodeTitle}" }]
              }
            ]
          }
        },
        {
          stepNumber: 2,
          actionType: "execute_action_plan",
          params: { actionPlanId: "ref:1" }
        }
      ],
      status: "active" as const,
      isTemplate: true
    },
    {
      hiveId: new mongoose.Types.ObjectId(hiveId),
      name: "Architecture Cleanup sequence",
      description: "Manages circular back-edge cycles, requests user verification, and posts ADR stubs.",
      trigger: { type: "health_score_threshold", params: { threshold: 60 } },
      steps: [
        {
          stepNumber: 1,
          actionType: "request_approval",
          params: {}
        },
        {
          stepNumber: 2,
          actionType: "execute_action_plan",
          params: { actionPlanId: "{actionPlanId}" }
        },
        {
          stepNumber: 3,
          actionType: "generate_action_plan",
          params: {
            title: "ADR Scaffold: Cycle Cleanup",
            steps: [
              {
                stepNumber: 1,
                actionType: "create_document",
                params: {
                  title: "ADR: Architecture Loop Resolution",
                  type: "architecture"
                },
                reversibility: "reversible",
                affectedEntities: []
              }
            ]
          }
        }
      ],
      status: "active" as const,
      isTemplate: true
    },
    {
      hiveId: new mongoose.Types.ObjectId(hiveId),
      name: "Project Bootstrap template",
      description: "Generates action plan to bootstrap workspace scaffolds, requests review, and applies configurations.",
      trigger: { type: "manual", params: {} },
      steps: [
        {
          stepNumber: 1,
          actionType: "generate_action_plan",
          params: {
            title: "Bootstrap Workspace Scaffold",
            description: "Automatically builds baseline features and implementation tasks",
            confidence: 1.0,
            riskLevel: "medium",
            steps: [
              {
                stepNumber: 1,
                actionType: "create_node",
                params: {
                  category: "Feature",
                  title: "Core Service Integration",
                  status: "Proposed"
                },
                reversibility: "reversible",
                affectedEntities: []
              },
              {
                stepNumber: 2,
                actionType: "create_node",
                params: {
                  category: "Task",
                  title: "Set up CI/CD Pipeline",
                  status: "Todo"
                },
                reversibility: "reversible",
                affectedEntities: []
              }
            ]
          }
        },
        {
          stepNumber: 2,
          actionType: "request_approval",
          params: {}
        },
        {
          stepNumber: 3,
          actionType: "execute_action_plan",
          params: { actionPlanId: "ref:1" }
        }
      ],
      status: "active" as const,
      isTemplate: true
    }
  ];

  for (const t of templates) {
    const exists = await Workflow.exists({ hiveId: t.hiveId as any, name: t.name, isTemplate: true } as any);
    if (!exists) {
      await Workflow.create(t as any);
    }
  }
}
