import { ContextBuilder } from "./contextBuilder";
import { LLMGateway } from "./gateway";
import { EnhancedAnalysisSchema, type EnhancedAnalysis } from "./schemas";
import { logger } from "@/lib/logger";

export interface LLMServiceResponse {
  data: EnhancedAnalysis | null;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  contextSizeTokens: number;
  fallbackActive: boolean;
  error?: string;
}

/**
 * Stateless Orchestrator for HiveMind LLM enhancement
 */
export class HiveMindLLMService {
  /**
   * Cleans potential markdown blocks and parses LLM text response
   */
  private static cleanAndParseJson(text: string): any {
    let cleaned = text.trim();
    
    // Strip markdown code blocks if any
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\n/, "") // strip opening ```json
        .replace(/\n```$/, "")         // strip closing ```
        .trim();
    }
    
    return JSON.parse(cleaned);
  }

  /**
   * Enhances rule-based analysis using the Nemotron LLM endpoint
   */
  static async enhance(data: {
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
  }): Promise<LLMServiceResponse> {
    const start = performance.now();

    // 1. Build compacted context and prompts
    let context;
    try {
      context = ContextBuilder.buildPrompt(data);
    } catch (buildErr: any) {
      return {
        data: null,
        latencyMs: performance.now() - start,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        contextSizeTokens: 0,
        fallbackActive: true,
        error: `Prompt builder failed: ${buildErr.message}`
      };
    }

    const contextSizeTokens = context.estimatedPromptTokens;
    logger.info(`[HiveMind LLM] Prompt constructed. Estimated Context: ${contextSizeTokens} tokens.`);

    // 2. Call the stateless LLM gateway
    const response = await LLMGateway.getCompletion(context.systemPrompt, context.userPrompt);

    if (response.error) {
      logger.error(`[HiveMind LLM] Gateway failed: ${response.error}. Activating rule-based fallback.`);
      return {
        data: null,
        latencyMs: response.latencyMs,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        contextSizeTokens,
        fallbackActive: true,
        error: response.error
      };
    }

    // 3. Clean, parse, and validate JSON output
    try {
      const parsedJson = this.cleanAndParseJson(response.content);
      const zodRes = EnhancedAnalysisSchema.safeParse(parsedJson);

      if (!zodRes.success) {
        const validationError = zodRes.error.issues
          .map((issue) => `[${issue.path.join(".")}] ${issue.message}`)
          .join(", ");
        
        logger.error(`[HiveMind LLM] Zod validation failed: ${validationError}. Activating rule-based fallback.`);
        
        return {
          data: null,
          latencyMs: response.latencyMs,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens,
          contextSizeTokens,
          fallbackActive: true,
          error: `Zod Validation Error: ${validationError}`
        };
      }

      logger.info(`[HiveMind LLM] Enhanced analysis generated successfully in ${response.latencyMs.toFixed(2)}ms.`);

      return {
        data: zodRes.data,
        latencyMs: response.latencyMs,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        contextSizeTokens,
        fallbackActive: false
      };

    } catch (parseErr: any) {
      logger.error(`[HiveMind LLM] JSON parsing error: ${parseErr.message}. Activating rule-based fallback.`);
      
      return {
        data: null,
        latencyMs: response.latencyMs,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens,
        contextSizeTokens,
        fallbackActive: true,
        error: `JSON Parse Error: ${parseErr.message}. Raw Content: ${response.content.substring(0, 100)}`
      };
    }
  }
}
