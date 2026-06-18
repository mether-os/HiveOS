import mongoose from "mongoose";
import { z } from "zod";
import { buildAgentContext } from "../../utils/agentRegistry";
import HiveMindSnapshot from "../../models/HiveMindSnapshot";
import WorkflowRun from "../../models/WorkflowRun";
import { LLMGateway } from "../hivemind-llm/gateway";
import { logger } from "@/lib/logger";

// 1. Zod schemas for validation and safety
export const ChatActionSchema = z.object({
  type: z.enum(["run_agent", "create_workflow_proposal", "create_action_plan", "modify_structure"]),
  title: z.string(),
  description: z.string(),
  payload: z.record(z.string(), z.any())
});

// A robust preprocessor to handle strings, arrays of strings, or undefined/null values gracefully
const StringOrArrayPreprocess = z.preprocess((val) => {
  if (val === undefined || val === null) {
    return "";
  }
  if (Array.isArray(val)) {
    return val.map(item => String(item)).join(", ");
  }
  return String(val);
}, z.string());

export const HiveMindChatResponseSchema = z.object({
  answer: StringOrArrayPreprocess,
  reasoning: StringOrArrayPreprocess.default(""),
  evidence: StringOrArrayPreprocess.default(""),
  citations: z.object({
    nodes: z.array(z.string()).default([]),
    documents: z.array(z.string()).default([]),
    workflows: z.array(z.string()).default([])
  }).default({ nodes: [], documents: [], workflows: [] }),
  suggestedActions: z.array(ChatActionSchema).default([])
});

export type HiveMindChatResponse = z.infer<typeof HiveMindChatResponseSchema>;

/**
 * Programmatic summarization of messages older than the last 20 to prevent context explosion
 */
export function summarizeOlderMessages(messages: { role: string; content: string }[]): string {
  if (messages.length <= 20) return "";
  
  const older = messages.slice(0, messages.length - 20);
  let summary = "Summary of previous conversation context:\n";
  older.forEach((m) => {
    const roleName = m.role === "user" ? "User" : "HiveMind";
    const snippet = m.content.length > 100 ? m.content.substring(0, 100) + "..." : m.content;
    summary += `- ${roleName}: ${snippet}\n`;
  });
  
  return summary + "\n";
}

/**
 * Data retrieval layer encapsulating database fetches for chat context
 */
export async function retrieveChatContext(hiveId: string) {
  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);

  // 1. Graph topology, cycles, documents, and activities
  const agentCtx = await buildAgentContext(hiveId);

  // 2. Latest 3 snapshots
  const snapshots = await HiveMindSnapshot.find({ hiveId: hiveObjectId })
    .sort({ timestamp: -1 })
    .limit(3)
    .lean()
    .exec();

  // 3. Latest 5 workflow runs
  const workflowRuns = await WorkflowRun.find({ hiveId: hiveObjectId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean()
    .exec();

  // 4. Active proposed runs
  const proposedRuns = await WorkflowRun.find({
    hiveId: hiveObjectId,
    status: "proposed"
  }).lean().exec();

  return {
    ...agentCtx,
    snapshots,
    workflowRuns,
    proposedRuns
  };
}

/**
 * Formats context into a readable string for the LLM prompt
 */
function formatChatContext(ctx: any): string {
  let contextText = ctx.contextText; // Contains nodes, edges, cycle counts, centrality

  contextText += `\n=== HISTORICAL SNAPSHOTS (LATEST 3) ===\n`;
  if (ctx.snapshots.length === 0) {
    contextText += `No intelligence snapshots recorded.\n`;
  } else {
    ctx.snapshots.forEach((s: any, idx: number) => {
      contextText += `Snapshot ${idx + 1} (${new Date(s.timestamp).toLocaleDateString()}):\n`;
      contextText += `  Health Score: ${s.healthScore}\n`;
      contextText += `  Risks Count: ${s.risksCount}\n`;
      contextText += `  Gaps Count: ${s.gapsCount}\n`;
      contextText += `  Recommendations Count: ${s.recommendationsCount}\n`;
      contextText += `  Momentum Score: ${s.momentumScore}\n`;
    });
  }

  contextText += `\n=== WORKFLOW RUN HISTORY (LATEST 5) ===\n`;
  if (ctx.workflowRuns.length === 0) {
    contextText += `No workflow executions found.\n`;
  } else {
    ctx.workflowRuns.forEach((r: any) => {
      contextText += `- Run ID: ${r._id.toString()} | Name: "${r.name}" | Status: ${r.status} | Risk: ${r.workflowRiskLevel}\n`;
    });
  }

  contextText += `\n=== PROPOSED WORKFLOW RUNS ===\n`;
  if (ctx.proposedRuns.length === 0) {
    contextText += `No pending proposed workflows.\n`;
  } else {
    ctx.proposedRuns.forEach((r: any) => {
      contextText += `- Proposed Run ID: ${r._id.toString()} | Name: "${r.name}" | Risk: ${r.workflowRiskLevel} | Agent: ${r.proposedByAgentId || "none"}\n`;
    });
  }

  return contextText;
}

/**
 * Clean markdown blocks and parse JSON response
 */
function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\n/, "") // strip opening ```json
      .replace(/\n```$/, "")         // strip closing ```
      .trim();
  }
  return JSON.parse(cleaned);
}

/**
 * Main Orchestrator for Conversational HiveMind
 */
export class HiveMindChatService {
  /**
   * Processes a chat query, builds context, triggers completions, and validates response schema.
   */
  static async query(params: {
    hiveId: string;
    messages: { role: string; content: string }[];
    mode: "analyst" | "architect" | "product" | "risk";
  }): Promise<{
    response: HiveMindChatResponse;
    latencyMs: number;
    validationSuccess: boolean;
  }> {
    const start = performance.now();
    const { hiveId, messages, mode } = params;

    // 1. Retrieve and Format Context (reuse existing buildAgentContext / compaction)
    const rawContext = await retrieveChatContext(hiveId);
    const contextText = formatChatContext(rawContext);

    // 2. Handle memory constraints (> 20 messages summarized)
    const olderSummary = summarizeOlderMessages(messages);
    const activeMessages = messages.slice(-20);

    // 3. Define Perspective System Instructions
    let perspectiveInstruction = "";
    if (mode === "analyst") {
      perspectiveInstruction = "You are in Project Analyst mode. Focus on high-level workspace quality, health score trends, opportunites, recent activities, and developer workloads.";
    } else if (mode === "architect") {
      perspectiveInstruction = "You are in Architect mode. Focus on system architecture, graph topologies, cycles, bottlenecks, and critical paths. Analyze circular dependencies and explain topological loops.";
    } else if (mode === "product") {
      perspectiveInstruction = "You are in Product Strategist mode. Focus on feature alignment, requirements definitions, specification gaps (such as features without PRDs), and product deliverables.";
    } else if (mode === "risk") {
      perspectiveInstruction = "You are in Risk Analyst mode. Focus on security vulnerabilities, single points of failure, blocked tasks, unassigned critical nodes, and active threats.";
    }

    const systemPrompt = `You are HiveMind, the intelligent collaborative project companion. Your goal is to answer queries and explain the project status using provided context.

${perspectiveInstruction}

=== MANDATORY FORMAT INSTRUCTIONS ===
You MUST respond with a strictly valid JSON object matching this schema:
{
  "answer": "Main markdown response text explaining the answer to the user.",
  "reasoning": "Mandatory explanation of the diagnostic reasoning behind this answer.",
  "evidence": "Mandatory summary of the evidence items supporting this answer.",
  "citations": {
    "nodes": ["Array of node IDs explicitly mentioned in the answer. Must match real IDs in context."],
    "documents": ["Array of document IDs explicitly mentioned in the answer. Must match real IDs in context."],
    "workflows": ["Array of workflow run/template IDs explicitly mentioned in the answer. Must match real IDs in context."]
  },
  "suggestedActions": [
    {
      "type": "run_agent" | "create_workflow_proposal" | "create_action_plan" | "modify_structure",
      "title": "Action title shown on UI button",
      "description": "Brief description of the action",
      "payload": {
        "agentId": "architect",
        "nodes": [
          { "action": "create" | "update" | "delete", "id": "node-unique-slug", "category": "Feature" | "Task" | "Tech Stack" | "Audience" | "Risk", "title": "Node Title", "description": "Node Description", "data": { "status": "Todo", "priority": "High" } }
        ],
        "edges": [
          { "action": "create" | "delete", "source": "source-node-slug", "target": "target-node-slug", "relationType": "depends_on" }
        ],
        "documents": [
          { "action": "create" | "update", "title": "Document Title", "type": "prd" | "trd" | "architecture", "content": "Markdown content here", "linkedNodeId": "associated-node-slug" }
        ]
      }
    }
  ]
}

=== CITATION INTEGRITY RULE ===
If the user asks a factual question about the current status, metrics, or details of the project (e.g., "What is the health score?", "Are there any cycles?", "Show me tasks for X"), and no relevant nodes, documents, or workflows exist in the context to answer it, you MUST return "I do not have enough evidence to answer." in the "answer" field.
This rule does NOT apply to:
1. Greetings, conversational replies, and help queries (e.g. "hi", "how are you", "what can you do").
2. Requests to add, modify, delete, or connect nodes, tasks, or documents (structural edits). If you need more information to carry out the edit, ask clarifying questions in the "answer" field instead of returning the fallback.
3. Diagnostic explanations or advice where you are not asserting a specific fact about the project's data.

=== SUGGESTION SAFETY RULE ===
Suggested actions must ONLY use: "run_agent", "create_workflow_proposal", "create_action_plan", "modify_structure".
If the user asks to add, remove, update, or connect nodes, tasks, or documents, you MUST use "modify_structure" with nodes, edges, or documents in the payload. Do not suggest other mutation actions.

=== SYSTEM CONTEXT DATA ===
${contextText}

${olderSummary}`;

    // Assemble user query with history
    let userPrompt = "Conversational history:\n";
    activeMessages.forEach((msg) => {
      userPrompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
    });
    userPrompt += "ASSISTANT (respond only in JSON object):";

    // 4. Invoke LLM completions using existing Gateway
    const gatewayRes = await LLMGateway.getCompletion(systemPrompt, userPrompt);
    const latencyMs = Math.round(performance.now() - start);

    if (gatewayRes.error) {
      logger.error(`[HiveMind Chat] Gateway failed: ${gatewayRes.error}`);
      return {
        response: {
          answer: "I encountered an error communicating with the intelligence service.",
          reasoning: "LLM Gateway failure.",
          evidence: "Gateway error log.",
          citations: { nodes: [], documents: [], workflows: [] },
          suggestedActions: []
        },
        latencyMs,
        validationSuccess: false
      };
    }

    // 5. Parse, Validate, and enforce Citation Integrity
    try {
      logger.info(`[HiveMind Chat] Raw LLM content received: ${gatewayRes.content}`);
      const parsedJson = cleanAndParseJson(gatewayRes.content);
      const zodRes = HiveMindChatResponseSchema.safeParse(parsedJson);

      if (!zodRes.success) {
        logger.error(`[HiveMind Chat] Zod validation failed. Raw Content: ${gatewayRes.content}`);
        logger.error(`[HiveMind Chat] Zod validation error: ${zodRes.error.message}`);
        return {
          response: {
            answer: "The response returned by the intelligence engine was malformed.",
            reasoning: "Zod Schema mismatch.",
            evidence: zodRes.error.message,
            citations: { nodes: [], documents: [], workflows: [] },
            suggestedActions: []
          },
          latencyMs,
          validationSuccess: false
        };
      }

      const responseData = zodRes.data;

      // Programmatically enforce Citation Integrity Fallback only for factual claims
      const totalCitations =
        responseData.citations.nodes.length +
        responseData.citations.documents.length +
        responseData.citations.workflows.length;

      const hasSuggestedActions = responseData.suggestedActions && responseData.suggestedActions.length > 0;

      const lastUserMessage = messages[messages.length - 1]?.content?.trim().toLowerCase() || "";
      const isGreeting = ["hi", "hello", "hey", "greetings", "yo", "hi there", "hello there"].some(g => {
        return lastUserMessage === g || lastUserMessage.startsWith(g + " ") || lastUserMessage.startsWith(g + "!");
      });

      // We should only enforce the fallback if it's not a greeting, not a question/clarification, and not a suggested action proposal
      const isQuestionOrClarification = responseData.answer.includes("?") || 
        responseData.answer.toLowerCase().includes("clarify") || 
        responseData.answer.toLowerCase().includes("please specify") || 
        responseData.answer.toLowerCase().includes("what type of");

      if (totalCitations === 0 && !hasSuggestedActions && !isGreeting && !isQuestionOrClarification) {
        // Only override if the LLM did not already return the fallback
        if (!responseData.answer.trim().toLowerCase().includes("enough evidence")) {
          responseData.answer = "I do not have enough evidence to answer.";
          responseData.evidence = "No supporting citations found in context.";
          responseData.suggestedActions = [];
        }
      }

      // 1. If it has suggested actions but the answer is the fallback, make it friendly
      if (hasSuggestedActions && responseData.answer.trim().toLowerCase().includes("enough evidence")) {
        responseData.answer = "I have formulated a structural proposal for your request. Please review the suggested actions below to apply these changes to the project brain.";
      }

      // 2. Handle general greetings to keep it conversational
      if (isGreeting && responseData.answer.trim().toLowerCase().includes("enough evidence")) {
        responseData.answer = "Hello! I am HiveMind, the project intelligence companion. Ask me anything about your project's health, tasks, architecture, or documents.";
        responseData.evidence = "Conversational greeting fallback.";
      }

      return {
        response: responseData,
        latencyMs,
        validationSuccess: true
      };

    } catch (err: any) {
      logger.error(`[HiveMind Chat] JSON parse failed: ${err.message}`);
      return {
        response: {
          answer: "I could not interpret the intelligence service's output.",
          reasoning: "JSON parsing failure.",
          evidence: err.message,
          citations: { nodes: [], documents: [], workflows: [] },
          suggestedActions: []
        },
        latencyMs,
        validationSuccess: false
      };
    }
  }
}
