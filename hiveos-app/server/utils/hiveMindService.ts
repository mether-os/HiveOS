import mongoose from "mongoose";
import { getProjectContext, findRelatedEntities, searchKnowledge, getEntityContext } from "./unifiedContext";
import HiveMindRecommendation from "../models/HiveMindRecommendation";
import HiveMindMission from "../models/HiveMindMission";
import HiveMindSnapshot from "../models/HiveMindSnapshot";
import IntelligenceNotification from "../models/IntelligenceNotification";
import Activity from "../models/Activity";
import { HiveMindLLMService } from "../services/hivemind-llm/service";
import { PROMPT_VERSION, SCHEMA_VERSION } from "../services/hivemind-llm/contextBuilder";

const activeAnalysisQueue = new Set<string>();

/**
 * Triggers analysis running asynchronously in a background thread
 */
export async function runAnalysisBackground(hiveId: string): Promise<void> {
  if (activeAnalysisQueue.has(hiveId)) {
    console.log(`[HiveMind Background] Analysis already in progress for hive ${hiveId}. Skipping trigger.`);
    return;
  }
  activeAnalysisQueue.add(hiveId);
  console.log(`[HiveMind Background] Started background analysis worker for hive ${hiveId}...`);
  try {
    await runHiveMindAnalysis(hiveId);
  } catch (err: any) {
    console.error(`[HiveMind Background] Analysis failed for hive ${hiveId}:`, err.message);
  } finally {
    activeAnalysisQueue.delete(hiveId);
    console.log(`[HiveMind Background] Finished background analysis worker for hive ${hiveId}.`);
  }
}

// Interfaces mirroring the specifications
export interface StructuredRisk {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  reason: string;
  relatedEntities: Array<{ entityId: string; entityType: string; title: string }>;
  suggestedActions: string[];
}

export interface KnowledgeGap {
  id: string;
  title: string;
  type: "feature_no_prd" | "prd_no_task" | "arch_no_tech" | "github_no_feature";
  description: string;
  relatedEntities: Array<{ entityId: string; entityType: string; title: string }>;
}

export interface StructuredProjectSummary {
  executiveSummary: string;
  technicalSummary: string;
  sprintSummary: string;
  recentChanges: string[];
  keyRisks: string[];
  keyOpportunities: string[];
}

/**
 * DFS Cycle Detection to find circular dependencies in workspace graph
 */
export function detectCycles(nodes: any[], edges: any[]): string[][] {
  const adj: Record<string, string[]> = {};
  nodes.forEach((n) => (adj[n.id] = []));
  edges.forEach((e) => {
    if (adj[e.source]) adj[e.source]!.push(e.target);
  });

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const path: string[] = [];

  function dfs(u: string) {
    visited.add(u);
    recStack.add(u);
    path.push(u);

    const neighbors = adj[u] || [];
    for (const v of neighbors) {
      if (!visited.has(v)) {
        dfs(v);
      } else if (recStack.has(v)) {
        const cycleStartIdx = path.indexOf(v);
        if (cycleStartIdx !== -1) {
          const cycle = path.slice(cycleStartIdx);
          cycle.push(v);
          cycles.push(cycle);
        }
      }
    }

    recStack.delete(u);
    path.pop();
  }

  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      dfs(n.id);
    }
  });

  return cycles;
}

/**
 * Computes the Critical Path (longest prerequisite chain) in the DAG
 */
export function findCriticalPath(nodes: any[], edges: any[]): any[] {
  const adj: Record<string, string[]> = {};
  const nodeLookup = new Map(nodes.map((n) => [n.id, n]));
  nodes.forEach((n) => (adj[n.id] = []));
  edges.forEach((e) => {
    if (adj[e.source]) adj[e.source]!.push(e.target);
  });

  const memo: Record<string, { length: number; nextId: string | null }> = {};
  const visited = new Set<string>();

  function getLongestPathFrom(u: string): { length: number; nextId: string | null } {
    if (memo[u]) return memo[u];
    if (visited.has(u)) return { length: 0, nextId: null };

    visited.add(u);
    let maxLength = 0;
    let bestNextId: string | null = null;

    const neighbors = adj[u] || [];
    for (const v of neighbors) {
      const res = getLongestPathFrom(v);
      if (res.length + 1 > maxLength) {
        maxLength = res.length + 1;
        bestNextId = v;
      }
    }

    visited.delete(u);
    memo[u] = { length: maxLength, nextId: bestNextId };
    return memo[u];
  }

  let overallMaxLength = -1;
  let bestStartId: string | null = null;

  nodes.forEach((n) => {
    const res = getLongestPathFrom(n.id);
    if (res.length > overallMaxLength) {
      overallMaxLength = res.length;
      bestStartId = n.id;
    }
  });

  const path: any[] = [];
  let curr: string | null = bestStartId;
  const loopDetector = new Set<string>();

  while (curr) {
    if (loopDetector.has(curr)) break;
    loopDetector.add(curr);

    const node = nodeLookup.get(curr);
    if (node) path.push(node);
    curr = memo[curr]?.nextId || null;
    if (path.length > nodes.length) break;
  }

  return path;
}

/**
 * Helper to compute trust score (confidence) and explainability metadata for findings
 */
export function computeTrustAndExplainability(
  item: any,
  baselineRules: { risks: any[]; gaps: any[]; recs: any[] },
  edges: any[],
  effectivenessMultipliers?: Record<string, number>
): {
  sourceNodes: string[];
  sourceDocuments: string[];
  sourceActivities: string[];
  sourceType: "graph" | "document" | "activity" | "hybrid";
  sourceCount: number;
  confidence: number;
} {
  // 1. Gather raw arrays from LLM/rule item, falling back to relatedEntities
  const sourceNodes: string[] = Array.from(new Set(item.sourceNodes || []));
  const sourceDocuments: string[] = Array.from(new Set(item.sourceDocuments || []));
  const sourceActivities: string[] = Array.from(new Set(item.sourceActivities || []));

  // Fallback scan of relatedEntities
  if (item.relatedEntities && Array.isArray(item.relatedEntities)) {
    item.relatedEntities.forEach((ent: any) => {
      const type = String(ent.entityType).toLowerCase().trim();
      const id = String(ent.entityId);
      if (type === "node" && !sourceNodes.includes(id)) {
        sourceNodes.push(id);
      } else if (type === "document" && !sourceDocuments.includes(id)) {
        sourceDocuments.push(id);
      } else if (type === "activity" && !sourceActivities.includes(id)) {
        sourceActivities.push(id);
      }
    });
  }

  const sourceCount = sourceNodes.length + sourceDocuments.length + sourceActivities.length;

  // 2. sourceType mapping
  let sourceType: "graph" | "document" | "activity" | "hybrid" = "graph";
  if (sourceNodes.length > 0 && sourceDocuments.length > 0) {
    sourceType = "hybrid";
  } else if (sourceNodes.length > 0 && sourceActivities.length > 0) {
    sourceType = "hybrid";
  } else if (sourceDocuments.length > 0 && sourceActivities.length > 0) {
    sourceType = "hybrid";
  } else if (sourceDocuments.length > 0) {
    sourceType = "document";
  } else if (sourceActivities.length > 0) {
    sourceType = "activity";
  }

  // 3. Rule-Engine Agreement check
  let ruleAgreement = false;
  const itemTitleLower = String(item.title || "").toLowerCase();

  // Check risks agreement
  const matchesRisk = baselineRules.risks.some(
    (r) =>
      r.title.toLowerCase().includes(itemTitleLower) ||
      itemTitleLower.includes(r.title.toLowerCase()) ||
      r.relatedEntities.some((re: any) => sourceNodes.includes(re.entityId))
  );

  // Check gaps agreement
  const matchesGap = baselineRules.gaps.some(
    (g) =>
      g.title.toLowerCase().includes(itemTitleLower) ||
      itemTitleLower.includes(g.title.toLowerCase()) ||
      g.relatedEntities.some((re: any) => sourceNodes.includes(re.entityId) || sourceDocuments.includes(re.entityId))
  );

  // Check recs agreement
  const matchesRec = baselineRules.recs.some(
    (rec) =>
      rec.title.toLowerCase().includes(itemTitleLower) ||
      itemTitleLower.includes(rec.title.toLowerCase()) ||
      rec.relatedEntities.some((re: any) => sourceNodes.includes(re.entityId))
  );

  if (matchesRisk || matchesGap || matchesRec) {
    ruleAgreement = true;
  }

  // 4. Calculate Confidence Score
  // Start from agreement baseline: 0.8 if rule agreed, 0.5 otherwise
  let confidence = ruleAgreement ? 0.8 : 0.5;

  // Boost for supporting entities: +0.05 per node (max +0.1)
  confidence += Math.min(0.1, sourceNodes.length * 0.05);

  // Boost for supporting docs: +0.05 per doc (max +0.05)
  confidence += Math.min(0.05, sourceDocuments.length * 0.05);

  // Boost for supporting activities: +0.05 per activity (max +0.05)
  confidence += Math.min(0.05, sourceActivities.length * 0.05);

  // Boost for explicit graph connections: check if any of our sourceNodes are connected by edges
  let hasExplicitEdge = false;
  if (sourceNodes.length >= 2) {
    hasExplicitEdge = edges.some(
      (e) => sourceNodes.includes(e.source) && sourceNodes.includes(e.target)
    );
  }
  if (hasExplicitEdge) {
    confidence += 0.1;
  }

  // Apply recommendation effectiveness multiplier feedback if applicable
  if (item.type && effectivenessMultipliers) {
    const mult = effectivenessMultipliers[item.type];
    if (mult !== undefined) {
      confidence *= mult;
    }
  }


  // Clamp confidence to [0.1, 1.0]
  confidence = Math.max(0.1, Math.min(1.0, confidence));
  // Round to 2 decimal places
  confidence = Math.round(confidence * 100) / 100;

  return {
    sourceNodes,
    sourceDocuments,
    sourceActivities,
    sourceType,
    sourceCount,
    confidence
  };
}

/**
 * Calculates effectiveness rating per recommendation type based on accepted/completed rates,
 * health improvements, and risk reductions in snapshot history.
 */
export async function getRecommendationEffectiveness(hiveId: string): Promise<Record<string, number>> {
  const types = ["document", "relationship", "task", "architecture", "owner"];
  const multiplierMap: Record<string, number> = {};

  for (const t of types) {
    multiplierMap[t] = 1.0;
  }

  try {
    const recs = await HiveMindRecommendation.find({
      hiveId: new mongoose.Types.ObjectId(hiveId),
    }).lean().exec();

    if (recs.length === 0) return multiplierMap;

    const byType: Record<string, any[]> = {};
    for (const t of types) {
      byType[t] = recs.filter((r) => r.type === t);
    }

    for (const t of types) {
      const list = byType[t] || [];
      if (list.length === 0) continue;

      const acceptedCount = list.filter((r) => ["accepted", "completed"].includes(r.status)).length;
      const completedCount = list.filter((r) => r.status === "completed").length;
      const dismissedCount = list.filter((r) => r.status === "dismissed").length;

      const acceptedRate = acceptedCount / (acceptedCount + dismissedCount + 1);
      const completionRate = completedCount / (acceptedCount + 1);

      let totalHealthImprovement = 0;
      let totalRiskReduction = 0;
      let resolvedCount = 0;

      const completedRecs = list.filter((r) => r.status === "completed" && r.completedAt);
      for (const cr of completedRecs) {
        const beforeSnap = await HiveMindSnapshot.findOne({
          hiveId: new mongoose.Types.ObjectId(hiveId),
          timestamp: { $lt: cr.completedAt },
        })
          .sort({ timestamp: -1 })
          .lean()
          .exec();

        const afterSnap = await HiveMindSnapshot.findOne({
          hiveId: new mongoose.Types.ObjectId(hiveId),
          timestamp: { $gt: cr.completedAt },
        })
          .sort({ timestamp: 1 })
          .lean()
          .exec();

        if (beforeSnap && afterSnap) {
          resolvedCount++;
          const deltaHealth = afterSnap.healthScore - beforeSnap.healthScore;
          const deltaRisk = beforeSnap.risksCount - afterSnap.risksCount;
          if (deltaHealth > 0) totalHealthImprovement += deltaHealth;
          if (deltaRisk > 0) totalRiskReduction += deltaRisk;
        }
      }

      const healthImprovementFactor = resolvedCount > 0 ? Math.min(1.0, totalHealthImprovement / resolvedCount / 100) : 0.5;
      const riskReductionFactor = resolvedCount > 0 ? Math.min(1.0, totalRiskReduction / resolvedCount / 10) : 0.5;

      const score = 0.4 * acceptedRate + 0.4 * completionRate + 0.1 * healthImprovementFactor + 0.1 * riskReductionFactor;
      // Convert to a multiplier between 0.5 and 1.5
      multiplierMap[t] = 0.5 + score;
    }
  } catch (err) {
    console.error("[HiveMind Service] Error calculating effectiveness multiplier:", err);
  }

  return multiplierMap;
}

/**
 * Deduplicates and updates incident notifications surfaced by HiveMind diagnostics.
 */
export async function syncNotifications(
  hiveId: string,
  incidents: Array<{
    type: "new_risk" | "stale_work" | "missing_ownership" | "dependency_issue";
    fingerprint: string;
    title: string;
    message: string;
    severity: "low" | "medium" | "high" | "critical";
  }>
) {
  const now = new Date();
  for (const inc of incidents) {
    try {
      const existing = await IntelligenceNotification.findOne({
        hiveId: new mongoose.Types.ObjectId(hiveId),
        fingerprint: inc.fingerprint,
        read: false,
      }).exec();

      if (existing) {
        existing.occurrenceCount += 1;
        existing.lastDetectedAt = now;
        existing.title = inc.title;
        existing.message = inc.message;
        existing.severity = inc.severity;
        await existing.save();
      } else {
        await IntelligenceNotification.create({
          hiveId: new mongoose.Types.ObjectId(hiveId),
          type: inc.type,
          fingerprint: inc.fingerprint,
          title: inc.title,
          message: inc.message,
          severity: inc.severity,
          read: false,
          firstDetectedAt: now,
          lastDetectedAt: now,
          occurrenceCount: 1,
        });
      }
    } catch (err) {
      console.error("[HiveMind Service] Error syncing notification:", err);
    }
  }
}

/**
 * Calculates Project Momentum Score based on activity, missions, risks, and recommendation adoptions.
 */
export async function calculateProjectMomentumScore(
  hiveId: string,
  missionsCompletionRate: number,
  nodes: any[],
  syncedRecs: any[]
): Promise<number> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activityCount = await Activity.countDocuments({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      timestamp: { $gte: sevenDaysAgo },
    });
    const activityScore = Math.min(100, activityCount * 5); // 20 events = 100

    const missionsScore = missionsCompletionRate;

    const riskNodes = nodes.filter((n) => n.category === "Risk");
    const resolvedRisksCount = riskNodes.filter((n) => n.data?.status === "Done" || n.data?.status === "Resolved").length;
    const activeRisksCount = riskNodes.filter((n) => n.data?.status !== "Done" && n.data?.status !== "Resolved").length;
    const totalRisks = resolvedRisksCount + activeRisksCount;
    const risksScore = totalRisks > 0 ? (resolvedRisksCount / totalRisks) * 100 : 100;

    const totalRecs = await HiveMindRecommendation.countDocuments({ hiveId: new mongoose.Types.ObjectId(hiveId) });
    const acceptedCount = await HiveMindRecommendation.countDocuments({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      status: { $in: ["accepted", "completed"] },
    });
    const adoptionScore = totalRecs > 0 ? (acceptedCount / totalRecs) * 100 : 100;

    const momentum = 0.3 * activityScore + 0.3 * missionsScore + 0.2 * risksScore + 0.2 * adoptionScore;
    return Math.min(100, Math.max(0, Math.round(momentum)));
  } catch (err) {
    console.error("[HiveMind Service] Error calculating momentum score:", err);
    return 100;
  }
}

export interface ITeamIntelligence {
  contributors: Array<{
    actorName: string;
    avatar?: string;
    activityCount: number;
    assignedTasksCount: number;
  }>;
  ownershipMap: Record<string, string[]>;
  workloads: Record<string, { todo: number; inProgress: number; blocked: number; done: number }>;
  activityPatterns: {
    hourly: Record<number, number>;
    daily: Record<number, number>;
  };
  busFactor: {
    score: number;
    warnings: string[];
    singleOwnerCriticalPathNodes: string[];
    knowledgeConcentrators: string[];
  };
}

/**
 * Compiles Team Workload summaries and Bus Factor Analysis.
 */
export async function getTeamIntelligence(hiveId: string, nodes: any[]): Promise<ITeamIntelligence> {
  const activities = await Activity.find({ hiveId: new mongoose.Types.ObjectId(hiveId) }).lean().exec();
  
  const contributorsMap = new Map<string, { activityCount: number; avatar?: string }>();
  activities.forEach((act) => {
    const key = act.actorName;
    const val = contributorsMap.get(key) || { activityCount: 0, avatar: act.actorAvatar };
    val.activityCount++;
    contributorsMap.set(key, val);
  });

  const workloads: Record<string, { todo: number; inProgress: number; blocked: number; done: number }> = {};
  const ownershipMap: Record<string, string[]> = {};

  nodes.forEach((node) => {
    const owner = node.data?.owner || node.data?.assignee;
    if (owner) {
      const ownerStr = String(owner);
      
      if (!workloads[ownerStr]) {
        workloads[ownerStr] = { todo: 0, inProgress: 0, blocked: 0, done: 0 };
      }
      const status = String(node.data?.status || "Todo").toLowerCase();
      if (status === "todo") workloads[ownerStr]!.todo++;
      else if (status === "in progress") workloads[ownerStr]!.inProgress++;
      else if (status === "blocked") workloads[ownerStr]!.blocked++;
      else if (status === "done" || status === "resolved") workloads[ownerStr]!.done++;

      if (!ownershipMap[ownerStr]) {
        ownershipMap[ownerStr] = [];
      }
      ownershipMap[ownerStr]!.push(node.title);
    }
  });

  const contributors = Array.from(contributorsMap.entries()).map(([name, val]) => {
    const work = workloads[name];
    const assignedTasksCount = work ? (work.todo + work.inProgress + work.blocked + work.done) : 0;
    return {
      actorName: name,
      avatar: val.avatar,
      activityCount: val.activityCount,
      assignedTasksCount,
    };
  });

  const hourly: Record<number, number> = {};
  const daily: Record<number, number> = {};
  for (let i = 0; i < 24; i++) hourly[i] = 0;
  for (let i = 0; i < 7; i++) daily[i] = 0;

  activities.forEach((act) => {
    const date = new Date(act.timestamp);
    const h = date.getHours();
    const d = date.getDay();
    hourly[h] = (hourly[h] ?? 0) + 1;
    daily[d] = (daily[d] ?? 0) + 1;
  });

  const db = mongoose.connection.db;
  const edges = db ? await db.collection("canvasedges").find({ hiveId: new mongoose.Types.ObjectId(hiveId) }).toArray() : [];
  const cp = findCriticalPath(nodes, edges);
  const cpOwnerCounts: Record<string, number> = {};
  let cpOwnedCount = 0;
  let cpUnownedCount = 0;
  const singleOwnerCriticalPathNodes: string[] = [];

  cp.forEach((node) => {
    const owner = node.data?.owner || node.data?.assignee;
    if (owner) {
      const ownerStr = String(owner);
      cpOwnerCounts[ownerStr] = (cpOwnerCounts[ownerStr] ?? 0) + 1;
      cpOwnedCount++;
    } else {
      cpUnownedCount++;
    }
  });

  const warnings: string[] = [];
  const knowledgeConcentrators: string[] = [];

  const cpThreshold = cp.length > 0 ? cp.length * 0.5 : 0;
  Object.entries(cpOwnerCounts).forEach(([owner, count]) => {
    if (count > cpThreshold && cp.length > 1) {
      warnings.push(`Single point of failure on critical path: ${owner} owns ${count}/${cp.length} nodes.`);
      singleOwnerCriticalPathNodes.push(owner);
    }
  });

  const assignableNodes = nodes.filter((n) => n.category === "Feature" || n.category === "Task");
  const assignableThreshold = assignableNodes.length * 0.7;
  Object.entries(ownershipMap).forEach(([owner, ownedNodes]) => {
    const ownedAssignableCount = ownedNodes.filter((title) => {
      const n = nodes.find((node) => node.title === title);
      return n && (n.category === "Feature" || n.category === "Task");
    }).length;
    
    if (ownedAssignableCount > assignableThreshold && assignableNodes.length > 2) {
      warnings.push(`Critical knowledge concentration: ${owner} owns ${ownedAssignableCount}/${assignableNodes.length} features.`);
      knowledgeConcentrators.push(owner);
    }
  });

  const workloadsList = Object.values(workloads).map((w) => w.todo + w.inProgress + w.blocked + w.done);
  if (workloadsList.length > 1) {
    const avg = workloadsList.reduce((a, b) => a + b, 0) / workloadsList.length;
    const sqDiff = workloadsList.map((v) => Math.pow(v - avg, 2));
    const stdDev = Math.sqrt(sqDiff.reduce((a, b) => a + b, 0) / workloadsList.length);
    if (stdDev > 2) {
      warnings.push(`Workload imbalance detected: Standard deviation of task assignments is high (${stdDev.toFixed(1)}).`);
    }
  }

  let score = 5;
  if (warnings.length > 0) score -= Math.min(4, warnings.length);
  if (cpUnownedCount > 0) score -= 1;
  score = Math.max(1, score);

  return {
    contributors,
    ownershipMap,
    workloads,
    activityPatterns: { hourly, daily },
    busFactor: {
      score,
      warnings,
      singleOwnerCriticalPathNodes,
      knowledgeConcentrators,
    },
  };
}

/**
 * Main Analysis Runner for HiveMind
 */
export async function runHiveMindAnalysis(hiveId: string, options?: { skipLLM?: boolean }) {
  // 1. Gather all project data using context APIs exclusively (Restricted)
  const context = await getProjectContext(hiveId);
  const nodes = context.nodes || [];
  const edges = context.edges || [];
  const activeDocs = context.activeDocuments || [];
  const recentActs = context.recentActivities || [];

  const nodeLookup = new Map<string, any>(nodes.map((n) => [n.id, n]));

  // Fetch recommendation effectiveness multiplier feedback
  const effectivenessMultipliers = await getRecommendationEffectiveness(hiveId);

  // A. Dependency Traversals Engine
  // 1. Cycle detection
  const cycles = detectCycles(nodes, edges);

  // 2. Bottlenecks (nodes with degree centrality > 3)
  const nodeDegrees: Record<string, number> = {};
  edges.forEach((edge: any) => {
    nodeDegrees[edge.source] = (nodeDegrees[edge.source] ?? 0) + 1;
    nodeDegrees[edge.target] = (nodeDegrees[edge.target] ?? 0) + 1;
  });

  const bottlenecks = nodes
    .filter((n) => (nodeDegrees[n.id] ?? 0) > 3)
    .map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category,
      degree: nodeDegrees[n.id],
    }));

  // 3. Single Points of Failure (SPOF) (out-degree > 2 and in-degree > 0)
  const inDegrees: Record<string, number> = {};
  const outDegrees: Record<string, number> = {};
  edges.forEach((edge: any) => {
    outDegrees[edge.source] = (outDegrees[edge.source] ?? 0) + 1;
    inDegrees[edge.target] = (inDegrees[edge.target] ?? 0) + 1;
  });

  const spofs = nodes
    .filter((n) => (outDegrees[n.id] ?? 0) > 2 && (inDegrees[n.id] ?? 0) > 0)
    .map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category,
      outDegree: outDegrees[n.id],
    }));

  // 4. Critical Path
  const criticalPath = findCriticalPath(nodes, edges);

  // 5. Blocked chains
  // Find all blocked nodes
  const blockedNodes = nodes.filter((n) => n.data?.status === "Blocked");
  const blockedChainNodeIds = new Set<string>();

  // Run downstream walks for each blocked node
  const adjList: Record<string, string[]> = {};
  nodes.forEach((n) => (adjList[n.id] = []));
  edges.forEach((e) => {
    if (adjList[e.source]) adjList[e.source]!.push(e.target);
  });

  function markDownstreamBlocked(nodeId: string) {
    if (blockedChainNodeIds.has(nodeId)) return;
    blockedChainNodeIds.add(nodeId);
    const neighbors = adjList[nodeId] || [];
    neighbors.forEach((neigh) => markDownstreamBlocked(neigh));
  }

  blockedNodes.forEach((bNode) => {
    // Traverse downstream
    const neighbors = adjList[bNode.id] || [];
    neighbors.forEach((neigh) => markDownstreamBlocked(neigh));
  });

  const blockedChains = Array.from(blockedChainNodeIds)
    .map((id) => nodeLookup.get(id))
    .filter(Boolean);

  // B. Knowledge Gap Detection Engine
  const gaps: KnowledgeGap[] = [];

  // Gap 1: Feature Node without PRD Document
  const docFeatureNodeIds = new Set(activeDocs.map((d) => d.nodeId).filter(Boolean));
  const features = nodes.filter((n) => n.category === "Feature");

  features.forEach((feat) => {
    if (!docFeatureNodeIds.has(feat.id)) {
      gaps.push({
        id: `gap-prd-${feat.id}`,
        title: `Missing Spec: ${feat.title}`,
        type: "feature_no_prd",
        description: `Feature node "${feat.title}" exists on the canvas but lacks a corresponding PRD document spec.`,
        relatedEntities: [{ entityId: feat.id, entityType: "node", title: feat.title }],
      });
    }
  });

  // Gap 2: PRD Spec without Tasks
  const prdDocs = activeDocs.filter((d) => d.type === "prd");
  prdDocs.forEach((doc) => {
    if (doc.nodeId) {
      // Check if this doc representer node has connected canvas edges to any Task node
      const hasTaskConnection = edges.some((e: any) => {
        if (e.source === doc.nodeId) {
          const targetNode = nodeLookup.get(e.target);
          return targetNode?.category === "Task";
        }
        if (e.target === doc.nodeId) {
          const sourceNode = nodeLookup.get(e.source);
          return sourceNode?.category === "Task";
        }
        return false;
      });

      if (!hasTaskConnection) {
        gaps.push({
          id: `gap-task-${doc._id.toString()}`,
          title: `Spec Lacks Implementation Tasks: ${doc.title}`,
          type: "prd_no_task",
          description: `Document "${doc.title}" is flagged as a PRD, but its canvas representation has no related task nodes.`,
          relatedEntities: [{ entityId: doc._id.toString(), entityType: "document", title: doc.title }],
        });
      }
    }
  });

  // Gap 3: Architecture Node without connected Tech Stack
  const archNodes = nodes.filter((n) => n.category === "Architecture");
  archNodes.forEach((arch) => {
    const hasTechStack = edges.some((e: any) => {
      const otherId = e.source === arch.id ? e.target : e.source === arch.id ? null : e.target === arch.id ? e.source : null;
      if (otherId) {
        const otherNode = nodeLookup.get(otherId);
        return otherNode?.category === "Tech Stack";
      }
      return false;
    });

    if (!hasTechStack) {
      gaps.push({
        id: `gap-tech-${arch.id}`,
        title: `Unsupported Architecture: ${arch.title}`,
        type: "arch_no_tech",
        description: `Architecture component "${arch.title}" is listed on the graph but is not linked to any technical implementation stack nodes.`,
        relatedEntities: [{ entityId: arch.id, entityType: "node", title: arch.title }],
      });
    }
  });

  // Gap 4: GitHub Activity without linked Node
  recentActs.forEach((act) => {
    if (!act.graphLinks || act.graphLinks.length === 0) {
      gaps.push({
        id: `gap-git-${act._id.toString()}`,
        title: `Unlinked GitHub Activity: ${act.title}`,
        type: "github_no_feature",
        description: `Recent GitHub activity event "${act.title}" by ${act.actorName} lacks direct connections to project feature nodes.`,
        relatedEntities: [{ entityId: act._id.toString(), entityType: "activity", title: act.title }],
      });
    }
  });

  // C. Compute Health & Risks Engine
  const risks: StructuredRisk[] = [];

  // Unresolved Risk Nodes on canvas
  const riskNodes = nodes.filter((n) => n.category === "Risk" && n.data?.status !== "Done" && n.data?.status !== "Resolved");
  riskNodes.forEach((r) => {
    risks.push({
      id: `risk-node-${r.id}`,
      title: `Active Project Risk: ${r.title}`,
      severity: r.data?.priority === "High" ? "high" : "medium",
      confidence: 0.9,
      reason: `Unresolved risk item: "${r.description || "No description provided."}"`,
      relatedEntities: [{ entityId: r.id, entityType: "node", title: r.title }],
      suggestedActions: ["Create a mitigation plan task node", "Assign an owner to investigate"],
    });
  });

  // Circular Dependency Risks
  cycles.forEach((cycle, index) => {
    risks.push({
      id: `risk-cycle-${index}`,
      title: `Circular Dependency Loop`,
      severity: "critical",
      confidence: 1.0,
      reason: `System architecture deadlock found: ${cycle.map((id) => nodeLookup.get(id)?.title || id).join(" -> ")}`,
      relatedEntities: cycle.map((id) => ({
        entityId: id,
        entityType: "node",
        title: nodeLookup.get(id)?.title || id,
      })),
      suggestedActions: ["Sever one of the prerequisite edges in the cycle", "Refactor module encapsulation"],
    });
  });

  // Blocked Feature nodes
  blockedNodes.forEach((bNode) => {
    risks.push({
      id: `risk-blocked-${bNode.id}`,
      title: `Work Blocked: ${bNode.title}`,
      severity: "high",
      confidence: 0.95,
      reason: `Node "${bNode.title}" status is explicitly set to Blocked.`,
      relatedEntities: [{ entityId: bNode.id, entityType: "node", title: bNode.title }],
      suggestedActions: ["Investigate upstream blockers", "Reallocate developers to non-blocked workflows"],
    });
  });

  // Compute Health Score
  let healthScore = 50; // Neutral baseline
  let positiveScore = 0;
  let negativeScore = 0;

  // POSITIVE SIGNALS (Max +50)
  // 1. Linked Feature ↔ PRD (+3 per link, max +15)
  const linkedPRDsCount = activeDocs.filter((d) => d.type === "prd" && d.nodeId).length;
  positiveScore += Math.min(15, linkedPRDsCount * 3);

  // 2. Assigned Owner (+2 per assigned node, max +15)
  const assignedNodesCount = nodes.filter((n) => n.data?.owner || n.data?.assignee || n.createdBy).length;
  positiveScore += Math.min(15, assignedNodesCount * 2);

  // 3. Connected Architecture (+3 each, max +10)
  const connectedArchCount = archNodes.filter((arch) =>
    edges.some((e: any) => e.source === arch.id || e.target === arch.id)
  ).length;
  positiveScore += Math.min(10, connectedArchCount * 3);

  // 4. Recent Activity (+2 per activity, max +10)
  positiveScore += Math.min(10, recentActs.length * 2);

  // 5. Resolved Risks (+5 each, max +10)
  const resolvedRisksCount = nodes.filter(
    (n) => n.category === "Risk" && (n.data?.status === "Done" || n.data?.status === "Resolved")
  ).length;
  positiveScore += Math.min(10, resolvedRisksCount * 5);

  // NEGATIVE SIGNALS (Max -50)
  // 1. Cycles (-15 each)
  negativeScore += cycles.length * 15;
  // 2. Blocked nodes (-5 each)
  negativeScore += blockedNodes.length * 5;
  // 3. Unresolved Risk nodes (-5 each)
  negativeScore += riskNodes.length * 5;
  // 4. Orphans (-3 each)
  const connectedNodeIds = new Set<string>();
  edges.forEach((edge: any) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });
  const orphansCount = nodes.filter((n) => n.category === "Feature" && !connectedNodeIds.has(n.id)).length;
  negativeScore += orphansCount * 3;
  // 5. Unassigned work (-2 each)
  const unassignedCount = nodes.filter((n) => !n.data?.owner && !n.data?.assignee).length;
  negativeScore += unassignedCount * 2;
  // 6. Gaps (-3 each)
  negativeScore += gaps.length * 3;

  // Clamp signals
  positiveScore = Math.min(50, positiveScore);
  negativeScore = Math.min(50, negativeScore);

  healthScore = Math.max(0, Math.min(100, healthScore + positiveScore - negativeScore));

  // D. Build Rule-Based Recommendations List (used as baseline/fallback)
  const ruleRecs: any[] = [];

  // Gap-based recommendations
  gaps.forEach((gap) => {
    if (gap.type === "feature_no_prd" && gap.relatedEntities[0]) {
      ruleRecs.push({
        type: "document",
        title: `Create PRD specification for ${gap.relatedEntities[0].title}`,
        reason: `Feature node lacks documentation. A detailed PRD is required to outline user specifications and technical requirements.`,
        confidence: 0.85,
        relatedEntities: gap.relatedEntities,
        suggestedActions: ["Create PRD document in workspace Docs section", "Link PRD to feature node on Canvas"],
      });
    } else if (gap.type === "arch_no_tech" && gap.relatedEntities[0]) {
      ruleRecs.push({
        type: "architecture",
        title: `Link Technical Stack to ${gap.relatedEntities[0].title}`,
        reason: `Architecture design component is floating. Linking it to a database or framework tech stack node provides alignment on implementation tools.`,
        confidence: 0.75,
        relatedEntities: gap.relatedEntities,
        suggestedActions: ["Connect architecture node to technical framework node"],
      });
    }
  });

  // Risk-based recommendations
  risks.forEach((risk) => {
    if (risk.severity === "critical") {
      ruleRecs.push({
        type: "relationship",
        title: `Break Circular Dependencies in loop`,
        reason: `Graph contains structural loop dependencies. Severing one link resolves prerequisite blocks and clarifies critical path order.`,
        confidence: 0.95,
        relatedEntities: risk.relatedEntities,
        suggestedActions: risk.suggestedActions,
      });
    }
  });

  // Owner recommendations
  const unassignedFeatures = nodes.filter((n) => (n.category === "Feature" || n.category === "Task") && !n.data?.owner && !n.data?.assignee);
  unassignedFeatures.forEach((feat) => {
    ruleRecs.push({
      type: "owner",
      title: `Assign owner to ${feat.title}`,
      reason: `Work item is unassigned. Assigning a project engineer ensures ownership and progress accountability.`,
      confidence: 0.8,
      relatedEntities: [{ entityId: feat.id, entityType: "node", title: feat.title }],
      suggestedActions: ["Modify node details to designate owner"],
    });
  });

  // F. Structured Summary Engine (Rule-based fallback payload)
  const sprintTodo = nodes.filter((n) => n.data?.status === "Todo").length;
  const sprintProgress = nodes.filter((n) => n.data?.status === "In Progress").length;
  const sprintBlocked = nodes.filter((n) => n.data?.status === "Blocked").length;
  const sprintDone = nodes.filter((n) => n.data?.status === "Done").length;

  const summaryPayload: StructuredProjectSummary = {
    executiveSummary: `The project health is currently graded at ${
      healthScore >= 90 ? "A" : healthScore >= 80 ? "B" : healthScore >= 70 ? "C" : healthScore >= 60 ? "D" : "F"
    } (${healthScore}/100) with ${risks.length} active risk warnings and ${gaps.length} documentation/link gaps identified.`,
    technicalSummary: `Workspace contains ${archNodes.length} architecture blocks and ${
      nodes.filter((n) => n.category === "Tech Stack").length
    } tech stack listings. Prerequisite chain depth is currently ${criticalPath.length} nodes.`,
    sprintSummary: `Sprint tracker: ${sprintTodo} Todo, ${sprintProgress} In Progress, ${sprintBlocked} Blocked, ${sprintDone} Completed tasks.`,
    recentChanges: context.recentTimeline.map(
      (m: any) => `[${new Date(m.timestamp).toLocaleDateString()}] ${m.actorName} performed: ${m.eventType} on ${m.entityType}`
    ),
    keyRisks: risks.slice(0, 3).map((r) => r.title),
    keyOpportunities: ruleRecs.slice(0, 3).map((rec) => rec.title),
  };

  // E. Invoke Stateless LLM Enhancement Layer
  let llmResult = null;
  const skipLLM = options?.skipLLM || false;

  if (!skipLLM) {
    const criticalPathNodeIds = criticalPath.map((n) => n.id);
    const cycleNodeIds = Array.from(new Set(cycles.flat()));
    const bottleneckNodeIds = bottlenecks.map((b) => b.id);
    const spofNodeIds = spofs.map((s) => s.id);
    const blockedChainNodeIds = Array.from(new Set(blockedChains.map((b) => b.id)));

    try {
      llmResult = await HiveMindLLMService.enhance({
        nodes,
        edges,
        documents: activeDocs,
        activities: recentActs,
        criticalPathNodeIds,
        cycleNodeIds,
        bottleneckNodeIds,
        spofNodeIds,
        blockedChainNodeIds,
        baselineHealthScore: healthScore
      });
    } catch (err: any) {
      console.error("[HiveMind Service] Error calling LLM enhancement:", err.message);
    }
  }

  // F. Resolve Analysis Outputs (Merge LLM or Fallback to Rule-Based)
  let finalHealthScore = healthScore;
  let finalRisks = risks;
  let finalGaps = gaps;
  let finalRecs: any[] = [];
  let finalMissions: any[] = [];
  let finalSummary: StructuredProjectSummary = summaryPayload;
  let llmMetricsRecord: any = null;

  if (llmResult && !llmResult.fallbackActive && llmResult.data) {
    // LLM Enhancement Path
    const enhanced = llmResult.data;
    finalHealthScore = enhanced.healthScore;
    
    // Enrich with server-computed trust score and explainability arrays
    finalRisks = enhanced.risks.map((risk: any) => {
      const enriched = computeTrustAndExplainability(risk, { risks, gaps, recs: ruleRecs }, edges);
      return { ...risk, ...enriched };
    });

    finalGaps = enhanced.gaps.map((gap: any) => {
      const enriched = computeTrustAndExplainability(gap, { risks, gaps, recs: ruleRecs }, edges);
      return { ...gap, ...enriched };
    });

    finalRecs = enhanced.recommendations.map((rec: any) => {
      const enriched = computeTrustAndExplainability(rec, { risks, gaps, recs: ruleRecs }, edges, effectivenessMultipliers);
      return { ...rec, ...enriched };
    });

    finalMissions = enhanced.missions;
    finalSummary = enhanced.summary;

    llmMetricsRecord = {
      contextSizeTokens: llmResult.contextSizeTokens,
      promptSizeTokens: llmResult.contextSizeTokens, // estimated
      responseLatencyMs: llmResult.latencyMs,
      tokenUsage: {
        promptTokens: llmResult.promptTokens,
        completionTokens: llmResult.completionTokens,
        totalTokens: llmResult.totalTokens
      },
      fallbackActive: false
    };
  } else {
    // Rule-Based Fallback Path
    finalRisks = risks.map((risk: any) => {
      const enriched = computeTrustAndExplainability(risk, { risks, gaps, recs: ruleRecs }, edges);
      return { ...risk, ...enriched };
    });

    finalGaps = gaps.map((gap: any) => {
      const enriched = computeTrustAndExplainability(gap, { risks, gaps, recs: ruleRecs }, edges);
      return { ...gap, ...enriched };
    });

    finalRecs = ruleRecs.map((rec: any) => {
      const enriched = computeTrustAndExplainability(rec, { risks, gaps, recs: ruleRecs }, edges, effectivenessMultipliers);
      return { ...rec, ...enriched };
    });

    // Build rule-based potential missions
    const potentialMissions: any[] = [];
    if (cycles.length > 0 && cycles[0]) {
      potentialMissions.push({
        title: "Break Circular Loop Dependency",
        description: `Prerequisites form a circular loop in the graph. Modify connections to clear critical path blocks.`,
        type: "resolve_cycle",
        relatedEntities: cycles[0].map((id) => ({
          entityId: id,
          entityType: "node",
          title: nodeLookup.get(id)?.title || id,
        })),
      });
    }
    unassignedFeatures.slice(0, 2).forEach((feat) => {
      potentialMissions.push({
        title: `Assign Owner to "${feat.title}"`,
        description: `Designate a project lead or developer for the unassigned node "${feat.title}" to start implementation tracking.`,
        type: "assign_owner",
        relatedEntities: [{ entityId: feat.id, entityType: "node", title: feat.title }],
      });
    });
    gaps.filter((g) => g.type === "feature_no_prd").slice(0, 2).forEach((gap) => {
      if (gap.relatedEntities[0]) {
        potentialMissions.push({
          title: `Link PRD Spec to "${gap.relatedEntities[0].title}"`,
          description: `Create and associate a Product Requirements Document spec for the feature "${gap.relatedEntities[0].title}".`,
          type: "link_prd",
          relatedEntities: gap.relatedEntities,
        });
      }
    });
    while (potentialMissions.length < 3) {
      potentialMissions.push({
        title: "Verify Canvas Node Alignments",
        description: "Review current collaborative canvas layout nodes. Ensure clean structural paths.",
        type: "audit_graph",
        relatedEntities: [],
      });
    }

    finalMissions = potentialMissions.slice(0, 3);
    finalSummary = summaryPayload;

    llmMetricsRecord = {
      contextSizeTokens: llmResult ? llmResult.contextSizeTokens : 0,
      promptSizeTokens: llmResult ? llmResult.contextSizeTokens : 0,
      responseLatencyMs: llmResult ? llmResult.latencyMs : 0,
      tokenUsage: {
        promptTokens: llmResult ? llmResult.promptTokens : 0,
        completionTokens: llmResult ? llmResult.completionTokens : 0,
        totalTokens: llmResult ? llmResult.totalTokens : 0
      },
      fallbackActive: true,
      error: llmResult?.error || "LLM Gateway invocation returned fallback state or timed out."
    };
  }

  // H. Sync Notifications (Deduplicated Alerts Engine)
  const notificationsToSync: Array<{
    type: "new_risk" | "stale_work" | "missing_ownership" | "dependency_issue";
    fingerprint: string;
    title: string;
    message: string;
    severity: "low" | "medium" | "high" | "critical";
  }> = [];

  // 1. Dependency loops
  cycles.forEach((cycle, index) => {
    notificationsToSync.push({
      type: "dependency_issue",
      fingerprint: `cycle:${cycle.sort().join(",")}`,
      title: "Circular Dependency Loop",
      message: `System architecture deadlock found: ${cycle.map((id) => nodeLookup.get(id)?.title || id).join(" -> ")}`,
      severity: "critical",
    });
  });

  // 2. Blocked nodes
  blockedNodes.forEach((node) => {
    notificationsToSync.push({
      type: "dependency_issue",
      fingerprint: `blocked_node:${node.id}`,
      title: `Work Blocked: ${node.title}`,
      message: `Task node "${node.title}" status is set to Blocked.`,
      severity: "high",
    });
  });

  // 3. Missing ownership on critical path nodes
  criticalPath.forEach((node) => {
    if (!node.data?.owner && !node.data?.assignee) {
      notificationsToSync.push({
        type: "missing_ownership",
        fingerprint: `missing_owner_cp:${node.id}`,
        title: `Missing Owner on Critical Path: ${node.title}`,
        message: `Critical path node "${node.title}" lacks an assigned owner.`,
        severity: "high",
      });
    }
  });

  // 4. Missing ownership on general feature nodes
  features.forEach((feat) => {
    if (!feat.data?.owner && !feat.data?.assignee && !criticalPath.some((cpn) => cpn.id === feat.id)) {
      notificationsToSync.push({
        type: "missing_ownership",
        fingerprint: `missing_owner:${feat.id}`,
        title: `Missing Owner: ${feat.title}`,
        message: `Feature node "${feat.title}" has no designated owner.`,
        severity: "medium",
      });
    }
  });

  // 5. Stale work detection (5 days no update)
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
  nodes.forEach((n) => {
    const isTaskOrFeature = n.category === "Feature" || n.category === "Task";
    const isNotDone = n.data?.status !== "Done" && n.data?.status !== "Resolved";
    const isStale = n.updatedAt && new Date(n.updatedAt) < fiveDaysAgo;
    if (isTaskOrFeature && isNotDone && isStale) {
      notificationsToSync.push({
        type: "stale_work",
        fingerprint: `stale_work:${n.id}`,
        title: `Stale Work: ${n.title}`,
        message: `Work node "${n.title}" has not been updated since ${new Date(n.updatedAt).toLocaleDateString()}.`,
        severity: "medium",
      });
    }
  });

  // 6. Active Risks
  finalRisks.forEach((risk) => {
    notificationsToSync.push({
      type: "new_risk",
      fingerprint: `risk:${risk.id}`,
      title: risk.title,
      message: risk.reason,
      severity: risk.severity,
    });
  });

  await syncNotifications(hiveId, notificationsToSync);

  // G. Database Sync Actions
  // 1. Sync Recommendations
  const existingRecs = await HiveMindRecommendation.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
  }).exec();

  const activeRecIds: string[] = [];
  const recBulkOps: any[] = [];

  for (const rec of finalRecs) {
    const match = existingRecs.find(
      (er) =>
        er.title === rec.title &&
        er.relatedEntities.length === rec.relatedEntities.length &&
        er.relatedEntities[0]?.entityId === rec.relatedEntities[0]?.entityId
    );

    if (match) {
      activeRecIds.push(match._id.toString());
      if (match.status === "active") {
        recBulkOps.push({
          updateOne: {
            filter: { _id: match._id },
            update: { 
              $set: { 
                reason: rec.reason, 
                confidence: rec.confidence,
                sourceNodes: rec.sourceNodes,
                sourceDocuments: rec.sourceDocuments,
                sourceActivities: rec.sourceActivities,
                sourceType: rec.sourceType,
                sourceCount: rec.sourceCount
              } 
            }
          }
        });
      }
    } else {
      const newId = new mongoose.Types.ObjectId();
      activeRecIds.push(newId.toString());
      recBulkOps.push({
        insertOne: {
          document: {
            _id: newId,
            hiveId: new mongoose.Types.ObjectId(hiveId),
            ...rec,
            status: "active"
          }
        }
      });
    }
  }

  for (const er of existingRecs) {
    if (er.status === "active" && !activeRecIds.includes(er._id.toString())) {
      recBulkOps.push({
        updateOne: {
          filter: { _id: er._id },
          update: { $set: { status: "completed", completedAt: new Date() } }
        }
      });
    }
  }

  if (recBulkOps.length > 0) {
    await HiveMindRecommendation.bulkWrite(recBulkOps);
  }

  const syncedRecs = await HiveMindRecommendation.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
    status: { $in: ["active", "accepted"] },
  }).lean().exec();

  // 2. Sync Daily Missions
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  let todayMissions = await HiveMindMission.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
    generatedAt: { $gte: startOfDay },
  }).lean().exec();

  if (todayMissions.length === 0) {
    const isLlmPath = !!(llmResult && !llmResult.fallbackActive && llmResult.data);
    const selectedMissions = finalMissions.map((m) => {
      // Find trace origins
      let sourceRisk: string | undefined = undefined;
      let sourceRecommendation: string | undefined = undefined;
      let sourceGap: string | undefined = undefined;

      if (m.relatedEntities && Array.isArray(m.relatedEntities)) {
        for (const rel of m.relatedEntities) {
          const matchingRisk = finalRisks.find((r) => r.relatedEntities.some((re) => re.entityId === rel.entityId));
          if (matchingRisk) {
            sourceRisk = matchingRisk.id;
          }
          const matchingRec = syncedRecs.find((rec) => rec.relatedEntities.some((re) => re.entityId === rel.entityId));
          if (matchingRec) {
            sourceRecommendation = matchingRec._id.toString();
          }
          const matchingGap = finalGaps.find((g) => g.relatedEntities.some((re) => re.entityId === rel.entityId));
          if (matchingGap) {
            sourceGap = matchingGap.id;
          }
        }
      }

      return {
        hiveId: new mongoose.Types.ObjectId(hiveId),
        title: m.title,
        description: m.description,
        type: m.type,
        relatedEntities: m.relatedEntities || [],
        status: "pending",
        generatedAt: new Date(),
        generatedBy: isLlmPath ? ("llm" as const) : ("system" as const),
        sourceRisk,
        sourceRecommendation,
        sourceGap,
      };
    });
    
    if (selectedMissions.length > 0) {
      await HiveMindMission.insertMany(selectedMissions);
    }

    todayMissions = await HiveMindMission.find({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      generatedAt: { $gte: startOfDay },
    }).lean().exec();
  }

  const missionBulkOps: any[] = [];
  for (const mission of todayMissions) {
    if (mission.status === "pending" || mission.status === "assigned") {
      let isCompleted = false;

      if (mission.type === "assign_owner" && mission.relatedEntities[0]) {
        const matchingNode = nodes.find((n) => n.id === mission.relatedEntities[0]!.entityId);
        if (matchingNode && (matchingNode.data?.owner || matchingNode.data?.assignee)) {
          isCompleted = true;
        }
      } else if (mission.type === "link_prd" && mission.relatedEntities[0]) {
        const matchingDoc = activeDocs.find(
          (d) => d.type === "prd" && d.nodeId === mission.relatedEntities[0]!.entityId
        );
        if (matchingDoc) {
          isCompleted = true;
        }
      } else if (mission.type === "resolve_cycle") {
        if (cycles.length === 0) {
          isCompleted = true;
        }
      }

      if (isCompleted) {
        missionBulkOps.push({
          updateOne: {
            filter: { _id: mission._id },
            update: { $set: { status: "completed", completedAt: new Date() } }
          }
        });
        mission.status = "completed";
      }
    }
  }

  if (missionBulkOps.length > 0) {
    await HiveMindMission.bulkWrite(missionBulkOps);
  }

  const allMissions = await HiveMindMission.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
  }).exec();

  const completedMissionsCount = allMissions.filter((m) => m.status === "completed").length;
  const missionsCompletionRate = allMissions.length > 0 ? (completedMissionsCount / allMissions.length) * 100 : 100;

  // Lifecycle counters for Snapshot
  const allRecs = await HiveMindRecommendation.find({ hiveId: new mongoose.Types.ObjectId(hiveId) }).exec();
  const acceptedRecommendationsCount = allRecs.filter((r) => r.status === "accepted").length;
  const completedRecommendationsCount = allRecs.filter((r) => r.status === "completed").length;
  const dismissedRecommendationsCount = allRecs.filter((r) => r.status === "dismissed").length;

  // Calculate Project Momentum Score
  const momentumScore = await calculateProjectMomentumScore(hiveId, missionsCompletionRate, nodes, syncedRecs);

  // 3. Save snapshot containing Prompt Version, Schema Version, LLM metrics, and momentum
  const activeMissionsSnapshot = todayMissions.map((m) => ({
    id: m._id.toString(),
    title: m.title,
    description: m.description,
    status: m.status,
  }));

  const snapshot = await HiveMindSnapshot.create({
    hiveId: new mongoose.Types.ObjectId(hiveId),
    healthScore: finalHealthScore,
    risksCount: finalRisks.length,
    gapsCount: finalGaps.length,
    recommendationsCount: syncedRecs.length,
    acceptedRecommendationsCount,
    completedRecommendationsCount,
    dismissedRecommendationsCount,
    missionsCompletionRate,
    momentumScore,
    risks: finalRisks,
    recommendations: syncedRecs,
    gaps: finalGaps,
    missions: activeMissionsSnapshot,
    promptVersion: PROMPT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    llmMetrics: llmMetricsRecord,
    timestamp: new Date(),
  });

  return {
    healthScore: finalHealthScore,
    grade: finalHealthScore >= 90 ? "A" : finalHealthScore >= 80 ? "B" : finalHealthScore >= 70 ? "C" : finalHealthScore >= 60 ? "D" : "F",
    risks: finalRisks,
    gaps: finalGaps,
    recommendations: syncedRecs,
    missions: todayMissions,
    summary: finalSummary,
    nodes,
    dependencyTraversals: {
      cycles,
      bottlenecks,
      spofs,
      criticalPath,
      blockedChains,
    },
    snapshotId: snapshot._id.toString(),
    momentumScore,
  };
}
