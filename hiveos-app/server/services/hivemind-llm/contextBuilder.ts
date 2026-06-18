export const PROMPT_VERSION = "1.1.0";
export const SCHEMA_VERSION = "1.1.0";

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export interface CompactedContext {
  promptVersion: string;
  schemaVersion: string;
  systemPrompt: string;
  userPrompt: string;
  estimatedPromptTokens: number;
}

/**
 * Completely stateless Context Compactor and Prompt Builder
 */
export class ContextBuilder {
  /**
   * Constructs the prompt payload with relevance-based compaction
   */
  static buildPrompt(data: {
    nodes: any[];
    edges: any[];
    documents: any[];
    activities: any[];
    criticalPathNodeIds: string[];
    cycleNodeIds: string[];
    bottleneckNodeIds: string[];
    spofNodeIds: string[];
    blockedChainNodeIds: string[];
    baselineHealthScore: number;
  }): CompactedContext {
    const {
      nodes,
      edges,
      documents,
      activities,
      criticalPathNodeIds,
      cycleNodeIds,
      bottleneckNodeIds,
      spofNodeIds,
      blockedChainNodeIds,
      baselineHealthScore
    } = data;

    // 1. Assign Priority Classes to Nodes
    // Priority 1: Critical Path / Cycles / Bottlenecks / SPOF / Blocked Chains
    // Priority 2: Active Risks
    // Priority 3: Blocked Work
    // Priority 4: Nodes linked to recent GitHub activity
    // Priority 5: Nodes linked to documents
    // Priority 6: Remaining nodes (others)
    
    const nodeScores = new Map<string, number>();
    
    nodes.forEach((node) => {
      let score = 6; // default (lowest priority)
      
      const isCritical = criticalPathNodeIds.includes(node.id) || 
                         cycleNodeIds.includes(node.id) || 
                         bottleneckNodeIds.includes(node.id) || 
                         spofNodeIds.includes(node.id) ||
                         blockedChainNodeIds.includes(node.id);
      
      const isActiveRisk = node.category === "Risk" && 
                           node.data?.status !== "Done" && 
                           node.data?.status !== "Resolved";
                           
      const isBlocked = node.data?.status === "Blocked";

      const hasRecentActivity = activities.some((act) => 
        act.graphLinks?.some((link: any) => link.nodeId === node.id)
      );

      const hasDocument = documents.some((doc) => doc.nodeId === node.id);

      if (isCritical) {
        score = 1;
      } else if (isActiveRisk) {
        score = 2;
      } else if (isBlocked) {
        score = 3;
      } else if (hasRecentActivity) {
        score = 4;
      } else if (hasDocument) {
        score = 5;
      }
      
      nodeScores.set(node.id, score);
    });

    // 2. Prioritize Documents
    // Priority 5: Linked to high-priority (P1-P3) nodes
    // Priority 6: Other documents
    const docScores = new Map<string, number>();
    documents.forEach((doc) => {
      let score = 6;
      if (doc.nodeId) {
        const nodeScore = nodeScores.get(doc.nodeId) || 6;
        if (nodeScore <= 3) {
          score = 5;
        }
      }
      docScores.set(doc._id ? doc._id.toString() : doc.id || "", score);
    });

    // 3. Prioritize Activities
    // Priority 4: Recent activities linked to P1-P4 nodes
    // Priority 6: Other activities
    const actScores = new Map<string, number>();
    activities.forEach((act) => {
      let score = 6;
      const linkedToPriority = act.graphLinks?.some((link: any) => {
        const nScore = nodeScores.get(link.nodeId) || 6;
        return nScore <= 4;
      });
      if (linkedToPriority) {
        score = 4;
      }
      actScores.set(act._id ? act._id.toString() : act.id || "", score);
    });

    // 4. Prioritize Edges
    // High-priority: edges connecting P1-P4 nodes
    const edgeScores = new Map<string, number>();
    edges.forEach((edge) => {
      const scoreA = nodeScores.get(edge.source) || 6;
      const scoreB = nodeScores.get(edge.target) || 6;
      edgeScores.set(edge.id || `${edge.source}-${edge.target}`, Math.max(scoreA, scoreB));
    });

    // 5. Dynamic Relevance Threshold Selection Loop
    // Limit context block size to ~2000 tokens (estimated as 8000 characters)
    const TOKEN_BUDGET = 2000;
    let maxPriorityToInclude = 6;
    let contextStr = "";
    let tokens = 0;

    const buildContextAtThreshold = (threshold: number): string => {
      // Filter elements whose priority is <= threshold
      const filteredNodes = nodes.filter((n) => (nodeScores.get(n.id) || 6) <= threshold);
      const filteredEdges = edges.filter((e) => (edgeScores.get(e.id || `${e.source}-${e.target}`) || 6) <= threshold);
      const filteredDocs = documents.filter((d) => (docScores.get(d._id ? d._id.toString() : d.id || "") || 6) <= threshold);
      const filteredActs = activities.filter((a) => (actScores.get(a._id ? a._id.toString() : a.id || "") || 6) <= threshold);

      const activeNodes = filteredNodes.map((n) => {
        const priority = nodeScores.get(n.id) || 6;
        return `- Node: ${n.id} [${n.category}] "${n.title}" - Status: ${n.data?.status || "Todo"}, Owner: ${n.data?.owner || n.data?.assignee || "Unassigned"}, PriorityClass: P${priority}`;
      }).join("\n");

      const activeEdges = filteredEdges.map((e) => 
        `- Edge: ${e.source} -> ${e.target} (${e.relationType || "prerequisite"})`
      ).join("\n");

      const activeDocs = filteredDocs.map((d) => {
        const priority = docScores.get(d._id ? d._id.toString() : d.id || "") || 6;
        const contentSnippet = priority === 5 && d.content
          ? d.content.substring(0, 150).replace(/\n/g, " ") + (d.content.length > 150 ? "..." : "")
          : "Omitted";
        return `- Document: "${d.title}" [${d.type}] - NodeRef: ${d.nodeId || "None"}, PriorityClass: P${priority}, Content: ${contentSnippet}`;
      }).join("\n");

      const activeActs = filteredActs.slice(0, 10).map((a) => {
        const priority = actScores.get(a._id ? a._id.toString() : a.id || "") || 6;
        const dateStr = a.timestamp ? new Date(a.timestamp).toISOString().substring(0, 10) : "";
        return `- Activity [${dateStr}] Actor: ${a.actorName} - ${a.eventType}: "${a.title}", PriorityClass: P${priority}`;
      }).join("\n");

      return `## Project Context Graphs
### Canvas Nodes
${activeNodes || "No active nodes listed in this budget."}

### Canvas Edges
${activeEdges || "No active edges."}

### Project Documents
${activeDocs || "No documents."}

### Recent Activity Logs
${activeActs || "No activities."}`;
    };

    // Iteratively decrease maxPriorityToInclude if we exceed the budget
    for (let p = 6; p >= 1; p--) {
      maxPriorityToInclude = p;
      contextStr = buildContextAtThreshold(p);
      tokens = estimateTokens(contextStr);
      if (tokens <= TOKEN_BUDGET) {
        break;
      }
    }

    // Secondary emergency pruning if even at P1 we exceed the budget
    if (tokens > TOKEN_BUDGET) {
      // Emergency cut: take only first 10 nodes, first 10 edges, 0 docs, 0 activities
      const filteredNodes = nodes.filter((n) => (nodeScores.get(n.id) || 6) === 1).slice(0, 10);
      const filteredEdges = edges.filter((e) => {
        const score = edgeScores.get(e.id || `${e.source}-${e.target}`) || 6;
        return score === 1;
      }).slice(0, 10);

      const activeNodes = filteredNodes.map((n) => `- Node: ${n.id} [${n.category}] "${n.title}" - Status: ${n.data?.status || "Todo"}, PriorityClass: P1`).join("\n");
      const activeEdges = filteredEdges.map((e) => `- Edge: ${e.source} -> ${e.target}`).join("\n");

      contextStr = `## Project Context Graphs (Emergency Compacted P1 Only)
### Canvas Nodes
${activeNodes}

### Canvas Edges
${activeEdges}`;
      tokens = estimateTokens(contextStr);
    }

    // 6. Build prompts
    const systemPrompt = `You are the HiveMind Intelligence enhancement agent for HiveOS.
You are stateless. You ingest rule-based structural graph diagnostics alongside compacted project context, and return qualitative AI analysis enhancements.

You must output a single valid JSON object. Do not include markdown codeblocks (except standard \`\`\`json blocks), explanations, or chatbot conversational filler.

CRITICAL: Do not write any conversational preamble or thinking block. Start your output directly with the JSON object.

CRITICAL: Limit the risks, gaps, recommendations, and missions arrays to a maximum of 2 items each. Do not generate more than 2 items per array.

CRITICAL: Keep all JSON string values (like reason, description, executiveSummary, technicalSummary, sprintSummary, suggestedActions, etc.) extremely short, concise, and direct (maximum 1 sentence per field, under 15 words).

CRITICAL: DO NOT include numerical confidence values in the JSON output.

CRITICAL ENUM CONSTRAINTS:
- For risks, the severity MUST be exactly one of: "low", "medium", "high", "critical". No other values are allowed.
- For gaps, the type MUST be exactly one of: "feature_no_prd", "prd_no_task", "arch_no_tech", "github_no_feature". No other values are allowed.
- For recommendations, the type MUST be exactly one of: "document", "relationship", "task", "architecture", "owner". No other values are allowed.

Output JSON structure validation schema:
{
  "healthScore": number,
  "risks": [
    {
      "id": string,
      "title": string,
      "severity": "low" | "medium" | "high" | "critical",
      "reason": string,
      "relatedEntities": [{"entityId": string, "entityType": "node" | "document" | "activity" | "mutation", "title": string}],
      "suggestedActions": [string],
      "sourceNodes": [string],
      "sourceDocuments": [string],
      "sourceActivities": [string]
    }
  ],
  "gaps": [
    {
      "id": string,
      "title": string,
      "type": "feature_no_prd" | "prd_no_task" | "arch_no_tech" | "github_no_feature",
      "description": string,
      "relatedEntities": [{"entityId": string, "entityType": "node" | "document" | "activity" | "mutation", "title": string}],
      "sourceNodes": [string],
      "sourceDocuments": [string],
      "sourceActivities": [string]
    }
  ],
  "recommendations": [
    {
      "type": "document" | "relationship" | "task" | "architecture" | "owner",
      "title": string,
      "reason": string,
      "relatedEntities": [{"entityId": string, "entityType": "node" | "document" | "activity" | "mutation", "title": string}],
      "suggestedActions": [string],
      "sourceNodes": [string],
      "sourceDocuments": [string],
      "sourceActivities": [string]
    }
  ],
  "missions": [
    {
      "title": string,
      "description": string,
      "type": string,
      "relatedEntities": [{"entityId": string, "entityType": "node" | "document" | "activity" | "mutation", "title": string}]
    }
  ],
  "summary": {
    "executiveSummary": string,
    "technicalSummary": string,
    "sprintSummary": string,
    "recentChanges": [string],
    "keyRisks": [string],
    "keyOpportunities": [string]
  }
}

Constraint:
- You must NOT mutate graph nodes, edges, or document collections. You can only analyze and recommend actions.
- You must remain stateless and validate Zod properties.`;

    const userPrompt = `## Rule-Based Diagnostics (Reasoning Baseline)
- Baseline Health Score: ${baselineHealthScore}/100
- Detected Cycles Node IDs: ${JSON.stringify(cycleNodeIds)}
- Bottleneck Node IDs: ${JSON.stringify(bottleneckNodeIds)}
- SPOF Node IDs: ${JSON.stringify(spofNodeIds)}
- Blocked Chain Node IDs: ${JSON.stringify(blockedChainNodeIds)}
- Critical Path Node IDs: ${JSON.stringify(criticalPathNodeIds)}

## Compacted Project Context (Relevance Prioritized, Max priority level included: P${maxPriorityToInclude})
${contextStr}

Analyze the rule-based diagnostics and context. Recalculate the healthScore and refine/extend the risks, gaps, recommendations, and missions.
Add clear developer context to owner recommendations if unassigned features have recent GitHub activity.
Return the structured JSON payload:`;

    const totalPromptText = systemPrompt + "\n" + userPrompt;
    
    return {
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION,
      systemPrompt,
      userPrompt,
      estimatedPromptTokens: estimateTokens(totalPromptText)
    };
  }
}
