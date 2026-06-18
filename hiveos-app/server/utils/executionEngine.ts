import mongoose from "mongoose";
import AgentActionPlan, { type IAgentActionPlan, type IActionStep } from "../models/AgentActionPlan";
import CanvasNode from "../models/CanvasNode";
import CanvasEdge from "../models/CanvasEdge";
import Document from "../models/Document";
import HiveMindMission from "../models/HiveMindMission";
import GraphMutationEvent from "../models/GraphMutationEvent";
import DocumentKnowledgeEvent from "../models/DocumentKnowledgeEvent";
import { ExecutionAuthorizationService } from "./executionAuth";
import { invalidateGraphCache } from "./graphEngine";
import { indexNode, indexDocument } from "./knowledgeIndexService";

export interface ExecutionOptions {
  maxRiskLevel?: "low" | "medium" | "high" | "critical"; // default: "critical" (allow all)
}

const ALLOWED_OPERATIONS = new Set([
  "create_node",
  "update_node",
  "create_edge",
  "delete_edge",
  "assign_owner",
  "create_document",
  "create_mission",
]);

const RISK_HIERARCHY = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// Map document type to canvas edge relationType (matching standard logic in app/api/hives/[hiveId]/documents/route.ts)
function getSemanticRelation(docType: string): "depends_on" | "implements" | "relates_to" | "blocks" | "documents" | "owns" | "uses" | "generates" {
  switch (docType) {
    case "prd":
      return "implements";
    case "trd":
      return "uses";
    case "research":
      return "relates_to";
    case "meeting":
      return "generates";
    case "architecture":
      return "documents";
    default:
      return "relates_to";
  }
}

/**
 * Calculates smart placement coordinates for a node inside the workspace, avoiding overlap.
 */
async function calculateSmartNodePosition(hiveId: string, session?: mongoose.ClientSession): Promise<{ x: number; y: number }> {
  try {
    const minDistance = 120;
    const allNodes = await CanvasNode.find({ hiveId: new mongoose.Types.ObjectId(hiveId) }, null, { session }).exec();
    
    // Grid search starting at Documents Cluster region
    for (let gridX = -600; gridX <= 0; gridX += 160) {
      for (let gridY = -600; gridY <= 0; gridY += 120) {
        const hasCollision = allNodes.some((node) => {
          const dx = node.position.x - gridX;
          const dy = node.position.y - gridY;
          return Math.sqrt(dx * dx + dy * dy) < minDistance;
        });

        if (!hasCollision) {
          return { x: gridX, y: gridY };
        }
      }
    }
  } catch (err) {
    console.error("[ExecutionEngine] Position calculation error:", err);
  }
  return { x: -300, y: -300 }; // Default fallback
}

/**
 * Controlled Execution Engine for approved Action Plans.
 * Operates purely deterministically, running permission validation, risk checks, 
 * atomic transactions (where supported), and rollback state tracking.
 */
export async function executeActionPlan(
  hiveId: string,
  planId: string,
  actorId: string,
  actorName: string,
  stepOverrides: Record<number, any> = {},
  options: ExecutionOptions = {}
): Promise<{ success: boolean; message: string; plan: IAgentActionPlan | null }> {
  const startTime = performance.now();
  console.log(`[ExecutionEngine] Initiating execution of plan ${planId} for hive ${hiveId} by ${actorName} (${actorId})`);

  // 1. Fetch Plan
  const plan = await AgentActionPlan.findOne({
    _id: new mongoose.Types.ObjectId(planId),
    hiveId: new mongoose.Types.ObjectId(hiveId),
  }).exec();

  if (!plan) {
    return { success: false, message: "Action plan not found.", plan: null };
  }

  // 2. Safety Check: Plan Status Must Be Approved
  if (plan.status !== "approved") {
    return {
      success: false,
      message: `Only approved plans can be executed. Current status: ${plan.status}`,
      plan,
    };
  }

  // 3. Safety Check: Permission Validation
  const authRes = await ExecutionAuthorizationService.authorizeExecution(
    hiveId,
    actorId,
    plan.steps.flatMap((s) => s.affectedEntities)
  );

  if (!authRes.authorized) {
    const msg = `Authorization Rejected: ${authRes.reason}`;
    console.warn(`[ExecutionEngine] ${msg}`);
    
    // Update plan status to failed
    plan.status = "failed";
    plan.executionResult = "failed";
    plan.executionDetails = {
      entitiesCreated: [],
      entitiesUpdated: [],
      entitiesFailed: [{ stepNumber: 0, error: msg }],
      executionOperations: [],
    };
    plan.structuredAuditLogs.push({
      actorId: new mongoose.Types.ObjectId(actorId),
      actorName,
      action: "reject",
      notes: msg,
      timestamp: new Date(),
    });
    await plan.save();

    return { success: false, message: msg, plan };
  }

  // 4. Safety Check: Risk Policy Enforcement
  const maxRisk = options.maxRiskLevel ?? "critical";
  const planRiskVal = RISK_HIERARCHY[plan.riskLevel] ?? 2;
  const maxRiskVal = RISK_HIERARCHY[maxRisk] ?? 4;

  if (planRiskVal > maxRiskVal) {
    const msg = `Risk Guard Blocked Execution: Plan risk level (${plan.riskLevel.toUpperCase()}) exceeds configured maximum risk threshold (${maxRisk.toUpperCase()}).`;
    console.warn(`[ExecutionEngine] ${msg}`);
    
    plan.status = "failed";
    plan.executionResult = "failed";
    plan.executionDetails = {
      entitiesCreated: [],
      entitiesUpdated: [],
      entitiesFailed: [{ stepNumber: 0, error: msg }],
      executionOperations: [],
    };
    plan.structuredAuditLogs.push({
      actorId: new mongoose.Types.ObjectId(actorId),
      actorName,
      action: "reject",
      notes: msg,
      timestamp: new Date(),
    });
    await plan.save();

    return { success: false, message: msg, plan };
  }

  // 5. Safety Check: Allowed Operations Pass
  for (const step of plan.steps) {
    if (!ALLOWED_OPERATIONS.has(step.actionType)) {
      const msg = `Disallowed Operation: Action type "${step.actionType}" is forbidden in execution engine V1. Aborting.`;
      console.warn(`[ExecutionEngine] ${msg}`);
      
      plan.status = "failed";
      plan.executionResult = "failed";
      plan.executionDetails = {
        entitiesCreated: [],
        entitiesUpdated: [],
        entitiesFailed: [{ stepNumber: step.stepNumber, error: msg }],
        executionOperations: [],
      };
      plan.structuredAuditLogs.push({
        actorId: new mongoose.Types.ObjectId(actorId),
        actorName,
        action: "reject",
        notes: msg,
        timestamp: new Date(),
      });
      await plan.save();
      return { success: false, message: msg, plan };
    }
  }

  // 6. Safety Check: Verification of target entities existence (for modifications/deletions)
  for (const step of plan.steps) {
    const overrides = stepOverrides[step.stepNumber] || {};
    const mergedParams = { ...step.params, ...overrides };

    if (step.actionType === "update_node" || step.actionType === "assign_owner") {
      const targetId = mergedParams.nodeId;
      const nodeExists = await CanvasNode.findOne({ id: targetId, hiveId: new mongoose.Types.ObjectId(hiveId) }).exec();
      if (!nodeExists) {
        const msg = `Validation Abort: Target node "${targetId}" for step ${step.stepNumber} does not exist in the database.`;
        console.warn(`[ExecutionEngine] ${msg}`);
        
        plan.status = "failed";
        plan.executionResult = "failed";
        plan.executionDetails = {
          entitiesCreated: [],
          entitiesUpdated: [],
          entitiesFailed: [{ stepNumber: step.stepNumber, error: msg }],
          executionOperations: [],
        };
        await plan.save();
        return { success: false, message: msg, plan };
      }
    } else if (step.actionType === "delete_edge") {
      const sourceId = mergedParams.sourceId;
      const targetId = mergedParams.targetId;
      const edgeExists = await CanvasEdge.findOne({ source: sourceId, target: targetId, hiveId: new mongoose.Types.ObjectId(hiveId) }).exec();
      if (!edgeExists) {
        const msg = `Validation Abort: Target edge "${sourceId} -> ${targetId}" for step ${step.stepNumber} does not exist in the database.`;
        console.warn(`[ExecutionEngine] ${msg}`);
        
        plan.status = "failed";
        plan.executionResult = "failed";
        plan.executionDetails = {
          entitiesCreated: [],
          entitiesUpdated: [],
          entitiesFailed: [{ stepNumber: step.stepNumber, error: msg }],
          executionOperations: [],
        };
        await plan.save();
        return { success: false, message: msg, plan };
      }
    }
  }

  // 7. Capture beforeState snapshots
  const beforeState: Record<string, any> = { nodes: {}, edges: {}, documents: {} };
  for (const step of plan.steps) {
    const overrides = stepOverrides[step.stepNumber] || {};
    const mergedParams = { ...step.params, ...overrides };

    if (step.actionType === "update_node" || step.actionType === "assign_owner") {
      const node = await CanvasNode.findOne({ id: mergedParams.nodeId, hiveId: new mongoose.Types.ObjectId(hiveId) }).lean().exec();
      if (node) {
        beforeState.nodes[node.id] = node;
      }
    } else if (step.actionType === "delete_edge") {
      const edge = await CanvasEdge.findOne({ source: mergedParams.sourceId, target: mergedParams.targetId, hiveId: new mongoose.Types.ObjectId(hiveId) }).lean().exec();
      if (edge) {
        beforeState.edges[edge.id] = edge;
      }
    }
  }

  // 8. Transaction boundary setup
  let session: mongoose.ClientSession | undefined;
  let useTransactions = false;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransactions = true;
    console.log("[ExecutionEngine] Mongoose database transaction started.");
  } catch (err: any) {
    console.warn("[ExecutionEngine] MongoDB transactions unsupported (running in standalone mode). Execution fallback to step-wise writes.", err.message);
  }

  const entitiesCreated: Array<{ entityId: string; entityType: string; title: string }> = [];
  const entitiesUpdated: Array<{ entityId: string; entityType: string; title: string }> = [];
  const entitiesFailed: Array<{ stepNumber: number; error: string }> = [];
  const executionOperations: Array<{ operation: string; entityId: string; timestamp: Date; details?: any }> = [];

  // Placeholder map to link items created in prior steps
  const variableMap = new Map<string, string>();

  // Helper to replace variable strings
  const resolveValue = (val: any): any => {
    if (typeof val === "string" && variableMap.has(val)) {
      return variableMap.get(val)!;
    }
    return val;
  };

  const resolveParams = (params: Record<string, any>): Record<string, any> => {
    const resolved: Record<string, any> = {};
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "object" && v !== null) {
        resolved[k] = resolveParams(v);
      } else {
        resolved[k] = resolveValue(v);
      }
    }
    return resolved;
  };

  let executionSuccess = true;
  let executionMessage = "Execution completed successfully.";

  try {
    // 9. Execute Steps Loop
    for (const step of plan.steps) {
      const overrides = stepOverrides[step.stepNumber] || {};
      const mergedParams = resolveParams({ ...step.params, ...overrides });

      console.log(`[ExecutionEngine] Executing step ${step.stepNumber}: ${step.actionType}`);

      switch (step.actionType) {
        case "create_node": {
          const category = mergedParams.category || "Task";
          const title = mergedParams.title || "New Node";
          const description = mergedParams.description || "";
          const status = mergedParams.status || "Todo";
          const owner = mergedParams.owner ?? null;
          const assigneeName = mergedParams.assigneeName ?? null;
          const priority = mergedParams.priority || "Medium";

          const nodePos = await calculateSmartNodePosition(hiveId, session);
          const customNodeId = `node-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;

          const nodeDocs = await CanvasNode.create(
            [
              {
                id: customNodeId,
                hiveId: new mongoose.Types.ObjectId(hiveId),
                type: "customNode",
                category,
                title,
                description,
                position: nodePos,
                tags: [],
                createdBy: new mongoose.Types.ObjectId(actorId),
                data: { status, priority, owner, assigneeName },
              },
            ],
            { session }
          );

          const nodeDoc = nodeDocs[0]!;
          variableMap.set("__NEW_TECH_STACK_NODE__", nodeDoc.id);
          variableMap.set("__RECOMMENDED_TARGET__", nodeDoc.id);
          variableMap.set("__NEW_NODE__", nodeDoc.id);
          variableMap.set(`__NEW_NODE_STEP_${step.stepNumber}__`, nodeDoc.id);

          entitiesCreated.push({ entityId: nodeDoc.id, entityType: "node", title });
          executionOperations.push({
            operation: "create_node",
            entityId: nodeDoc.id,
            timestamp: new Date(),
            details: { category, title },
          });

          // Write mutation audit trail
          await GraphMutationEvent.create(
            [
              {
                hiveId: new mongoose.Types.ObjectId(hiveId),
                eventType: "node_created",
                entityId: nodeDoc.id,
                entityType: "node",
                actorId: new mongoose.Types.ObjectId(actorId),
                actorName,
                previousState: null,
                nextState: nodeDoc.toJSON(),
                timestamp: new Date(),
              },
            ],
            { session }
          );

          // Index search node
          await indexNode(nodeDoc._id);
          break;
        }

        case "update_node":
        case "assign_owner": {
          const targetNodeId = mergedParams.nodeId;
          const updates = mergedParams.updates || {};

          // If assign_owner, map owner variables directly
          if (step.actionType === "assign_owner") {
            const ownerId = mergedParams.owner;
            const assigneeName = mergedParams.assigneeName;
            updates["data.owner"] = ownerId;
            updates["data.assignee"] = assigneeName;
          }

          const existingNode = await CanvasNode.findOne({ id: targetNodeId, hiveId: new mongoose.Types.ObjectId(hiveId) }, null, { session }).exec();
          if (!existingNode) {
            throw new Error(`Node ${targetNodeId} not found during update run.`);
          }

          const prevNodeState = existingNode.toJSON();

          // Apply updates to existing node
          if (updates["data.owner"] !== undefined) {
            existingNode.data = { ...existingNode.data, owner: updates["data.owner"], assignee: updates["data.assignee"] };
          }
          if (updates.status) {
            existingNode.data = { ...existingNode.data, status: updates.status };
          }
          if (updates.title) existingNode.title = updates.title;
          if (updates.description) existingNode.description = updates.description;

          await existingNode.save({ session });

          entitiesUpdated.push({ entityId: existingNode.id, entityType: "node", title: existingNode.title });
          executionOperations.push({
            operation: step.actionType,
            entityId: existingNode.id,
            timestamp: new Date(),
            details: updates,
          });

          await GraphMutationEvent.create(
            [
              {
                hiveId: new mongoose.Types.ObjectId(hiveId),
                eventType: "node_updated",
                entityId: existingNode.id,
                entityType: "node",
                actorId: new mongoose.Types.ObjectId(actorId),
                actorName,
                previousState: prevNodeState,
                nextState: existingNode.toJSON(),
                timestamp: new Date(),
              },
            ],
            { session }
          );

          await indexNode(existingNode._id);
          break;
        }

        case "create_edge": {
          const source = mergedParams.sourceId;
          const target = mergedParams.targetId;
          const relationType = mergedParams.relationType || "relates_to";
          const customEdgeId = `edge-${source}-${target}-${Date.now().toString(36)}`;

          const edgeDocs = await CanvasEdge.create(
            [
              {
                id: customEdgeId,
                hiveId: new mongoose.Types.ObjectId(hiveId),
                source,
                target,
                type: "smoothstep",
                relationType,
                data: {},
              },
            ],
            { session }
          );

          const edgeDoc = edgeDocs[0]!;
          entitiesCreated.push({ entityId: edgeDoc.id, entityType: "edge", title: `${source} -> ${target}` });
          executionOperations.push({
            operation: "create_edge",
            entityId: edgeDoc.id,
            timestamp: new Date(),
            details: { source, target, relationType },
          });

          await GraphMutationEvent.create(
            [
              {
                hiveId: new mongoose.Types.ObjectId(hiveId),
                eventType: "edge_created",
                entityId: edgeDoc.id,
                entityType: "edge",
                actorId: new mongoose.Types.ObjectId(actorId),
                actorName,
                previousState: null,
                nextState: edgeDoc.toJSON(),
                timestamp: new Date(),
              },
            ],
            { session }
          );
          break;
        }

        case "delete_edge": {
          const source = mergedParams.sourceId;
          const target = mergedParams.targetId;

          const edgeDoc = await CanvasEdge.findOne({ source, target, hiveId: new mongoose.Types.ObjectId(hiveId) }, null, { session }).exec();
          if (!edgeDoc) {
            throw new Error(`Edge ${source} -> ${target} not found during deletion step.`);
          }

          const prevEdgeState = edgeDoc.toJSON();
          await CanvasEdge.deleteOne({ _id: edgeDoc._id }, { session });

          entitiesUpdated.push({ entityId: edgeDoc.id, entityType: "edge", title: `${source} -> ${target}` });
          executionOperations.push({
            operation: "delete_edge",
            entityId: edgeDoc.id,
            timestamp: new Date(),
            details: { source, target },
          });

          await GraphMutationEvent.create(
            [
              {
                hiveId: new mongoose.Types.ObjectId(hiveId),
                eventType: "edge_deleted",
                entityId: edgeDoc.id,
                entityType: "edge",
                actorId: new mongoose.Types.ObjectId(actorId),
                actorName,
                previousState: prevEdgeState,
                nextState: null,
                timestamp: new Date(),
              },
            ],
            { session }
          );
          break;
        }

        case "create_document": {
          const title = mergedParams.title || "New Document Specification";
          const docType = mergedParams.type || "prd";
          const linkedNodeId = mergedParams.linkedNodeId || null;

          const docNodePos = await calculateSmartNodePosition(hiveId, session);
          const canvasNodeId = `node-doc-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;

          // Create document canvas node representation
          const canvasNodeDocs = await CanvasNode.create(
            [
              {
                id: canvasNodeId,
                hiveId: new mongoose.Types.ObjectId(hiveId),
                type: "customNode",
                category: "Document",
                title: title.trim(),
                description: `Format: ${docType.toUpperCase()}`,
                position: docNodePos,
                tags: [],
                createdBy: new mongoose.Types.ObjectId(actorId),
                data: { status: "Todo", priority: "Low" },
              },
            ],
            { session }
          );

          const canvasNodeDoc = canvasNodeDocs[0]!;
          entitiesCreated.push({ entityId: canvasNodeDoc.id, entityType: "node", title: canvasNodeDoc.title });

          // Create Document Document
          const documentDocs = await Document.create(
            [
              {
                hiveId: new mongoose.Types.ObjectId(hiveId),
                nodeId: canvasNodeId,
                title: title.trim(),
                type: docType,
                content: "",
                tags: [],
                status: "draft",
                createdBy: new mongoose.Types.ObjectId(actorId),
                updatedBy: new mongoose.Types.ObjectId(actorId),
              },
            ],
            { session }
          );

          const documentDoc = documentDocs[0]!;
          entitiesCreated.push({ entityId: documentDoc._id.toString(), entityType: "document", title: documentDoc.title });
          executionOperations.push({
            operation: "create_document",
            entityId: documentDoc._id.toString(),
            timestamp: new Date(),
            details: { title, type: docType, nodeId: canvasNodeId },
          });

          // Link edge if target node is present
          if (linkedNodeId) {
            const edgeId = `edge-doc-${canvasNodeId}-${linkedNodeId}-${Date.now().toString(36)}`;
            const relationType = getSemanticRelation(docType);

            await CanvasEdge.create(
              [
                {
                  id: edgeId,
                  hiveId: new mongoose.Types.ObjectId(hiveId),
                  source: canvasNodeId,
                  target: linkedNodeId,
                  type: "smoothstep",
                  relationType,
                  data: {},
                },
              ],
              { session }
            );

            // Log document link
            await DocumentKnowledgeEvent.create(
              [
                {
                  hiveId: new mongoose.Types.ObjectId(hiveId),
                  documentId: documentDoc._id,
                  eventType: "DocumentLinked",
                  actorId: new mongoose.Types.ObjectId(actorId),
                  actorName,
                  metadata: { nodeId: linkedNodeId, relationType, edgeId },
                },
              ],
              { session }
            );
          }

          // Document created event
          await DocumentKnowledgeEvent.create(
            [
              {
                hiveId: new mongoose.Types.ObjectId(hiveId),
                documentId: documentDoc._id,
                eventType: "DocumentCreated",
                actorId: new mongoose.Types.ObjectId(actorId),
                actorName,
                metadata: { nodeId: canvasNodeId, type: docType },
              },
            ],
            { session }
          );

          // Index both
          await indexNode(canvasNodeDoc._id);
          await indexDocument(documentDoc._id);
          break;
        }

        case "create_mission": {
          const title = mergedParams.title || "Daily Mission Checklist";
          const desc = mergedParams.description || "";
          const mType = mergedParams.type || "assign_owner";
          const relatedEntities = mergedParams.relatedEntities || [];

          const missionDocs = await HiveMindMission.create(
            [
              {
                hiveId: new mongoose.Types.ObjectId(hiveId),
                title,
                description: desc,
                type: mType,
                relatedEntities,
                status: "pending",
                generatedAt: new Date(),
                generatedBy: "system",
              },
            ],
            { session }
          );

          const missionDoc = missionDocs[0]!;
          entitiesCreated.push({ entityId: missionDoc._id.toString(), entityType: "mission", title });
          executionOperations.push({
            operation: "create_mission",
            entityId: missionDoc._id.toString(),
            timestamp: new Date(),
            details: { title, type: mType },
          });
          break;
        }

        default:
          throw new Error(`Unsupported operation type: ${step.actionType}`);
      }
    }

    // 10. Commit transaction if active
    if (useTransactions && session) {
      await session.commitTransaction();
      console.log("[ExecutionEngine] Mongoose database transaction committed successfully.");
    }
  } catch (err: any) {
    executionSuccess = false;
    executionMessage = `Step Execution Failure: ${err.message}`;
    console.error(`[ExecutionEngine] ${executionMessage}`, err);

    // Abort transaction if active
    if (useTransactions && session) {
      await session.abortTransaction();
      console.log("[ExecutionEngine] Transaction rolled back. Database mutations reverted.");
    }

    // Determine failed step number
    const failedStep = plan.steps.find((s) => {
      // Find the step where executing failed
      const matchesOverride = stepOverrides[s.stepNumber];
      // Simple heuristic: the first step not logged to executionOperations
      const wasLogged = executionOperations.some((op) => op.operation === s.actionType);
      return !wasLogged;
    });

    entitiesFailed.push({
      stepNumber: failedStep ? failedStep.stepNumber : 1,
      error: err.message,
    });
  } finally {
    if (session) {
      session.endSession();
    }
  }

  // 11. Capture afterState snapshots
  const afterState: Record<string, any> = { nodes: {}, edges: {}, documents: {} };
  if (executionSuccess) {
    for (const created of entitiesCreated) {
      if (created.entityType === "node") {
        const node = await CanvasNode.findOne({ id: created.entityId, hiveId: new mongoose.Types.ObjectId(hiveId) }).lean().exec();
        if (node) afterState.nodes[node.id] = node;
      } else if (created.entityType === "edge") {
        const edge = await CanvasEdge.findOne({ id: created.entityId, hiveId: new mongoose.Types.ObjectId(hiveId) }).lean().exec();
        if (edge) afterState.edges[edge.id] = edge;
      } else if (created.entityType === "document") {
        const doc = await Document.findById(created.entityId).lean().exec();
        if (doc) afterState.documents[doc._id.toString()] = doc;
      }
    }
    for (const updated of entitiesUpdated) {
      if (updated.entityType === "node") {
        const node = await CanvasNode.findOne({ id: updated.entityId, hiveId: new mongoose.Types.ObjectId(hiveId) }).lean().exec();
        if (node) afterState.nodes[node.id] = node;
      } else if (updated.entityType === "edge") {
        const edge = await CanvasEdge.findOne({ id: updated.entityId, hiveId: new mongoose.Types.ObjectId(hiveId) }).lean().exec();
        if (edge) afterState.edges[edge.id] = edge;
      }
    }
  }

  // 12. Post-execution statistics & save
  const latencyMs = Math.round(performance.now() - startTime);

  plan.status = executionSuccess ? "executed" : useTransactions ? "failed" : "executed"; // standalone fallback partial state is marked as executed
  plan.executionResult = executionSuccess ? "success" : useTransactions ? "failed" : "partial";
  plan.executedBy = new mongoose.Types.ObjectId(actorId);
  plan.executedAt = new Date();
  plan.executionLatencyMs = latencyMs;
  plan.rollbackMetadata = { beforeState, afterState };
  plan.executionDetails = {
    entitiesCreated,
    entitiesUpdated,
    entitiesFailed,
    executionOperations,
  };

  plan.structuredAuditLogs.push({
    actorId: new mongoose.Types.ObjectId(actorId),
    actorName,
    action: executionSuccess ? "approve" : "reject", // log event matching action results
    notes: executionSuccess ? `Action plan executed successfully in ${latencyMs}ms.` : `Execution failed: ${executionMessage}`,
    timestamp: new Date(),
  });

  await plan.save();

  // 13. Invalidate Redis graph cache
  await invalidateGraphCache(hiveId);

  return {
    success: executionSuccess,
    message: executionMessage,
    plan,
  };
}
