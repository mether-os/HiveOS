import { logger } from "@/lib/logger";

export interface GatewayResponse {
  content: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  error?: string;
}

/**
 * Stateless gateway communicating with the NVIDIA NIM OpenAI-compatible API endpoint
 */
export class LLMGateway {
  private static endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";

  /**
   * Sends a completion request to the Nemotron endpoint
   */
  static async getCompletion(
    systemPrompt: string,
    userPrompt: string,
    timeoutMs: number = 30000
  ): Promise<GatewayResponse> {
    const apiKey = process.env.NVIDIA_NIM_API_KEY;
    // Default model if process.env.LLM_MODEL is not set or contains provider prefix
    const rawModel = process.env.LLM_MODEL || "nvidia_nim/nvidia/nemotron-3-nano-30b-a3b";
    
    // Extract the model name for the API payload: e.g. "nvidia/nemotron-3-nano-30b-a3b"
    const model = rawModel.includes("nvidia_nim/") 
      ? rawModel.replace("nvidia_nim/", "") 
      : rawModel;

    const start = performance.now();

    if (!apiKey) {
      const duration = performance.now() - start;
      return {
        content: "",
        latencyMs: duration,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        error: "NVIDIA_NIM_API_KEY environment variable is not defined."
      };
    }

    const payload = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1, // Keep it low for deterministic schema adherence
      max_tokens: 4096, // Ensure it fits budget
      chat_template_kwargs: {
        enable_thinking: false
      }
    };

    let attempt = 0;
    const maxRetries = 2;
    let delay = 1000;

    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timer);

        if (response.status === 429) {
          attempt++;
          if (attempt <= maxRetries) {
            logger.warn(`[LLM Gateway] Rate limit (429) hit. Retrying in ${delay}ms (Attempt ${attempt}/${maxRetries})...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            continue;
          }
          throw new Error("429 Too Many Requests (Rate limit exceeded after retries)");
        }

        if (response.status >= 500) {
          throw new Error(`500 Internal Server Error from LLM provider (Status: ${response.status})`);
        }

        if (!response.ok) {
          throw new Error(`LLM provider returned status ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        const duration = performance.now() - start;

        return {
          content,
          latencyMs: duration,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens
        };

      } catch (err: any) {
        clearTimeout(timer);
        
        // If abort triggered by timeout
        const isTimeout = err.name === "AbortError";
        const errorMsg = isTimeout ? `Request timed out after ${timeoutMs}ms` : err.message;
        
        attempt++;
        if (attempt <= maxRetries && !isTimeout && !err.message.includes("500")) {
          logger.warn(`[LLM Gateway] Request failed: ${errorMsg}. Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }

        const duration = performance.now() - start;
        return {
          content: "",
          latencyMs: duration,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          error: errorMsg
        };
      }
    }

    const duration = performance.now() - start;
    return {
      content: "",
      latencyMs: duration,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      error: "Maximum retries reached."
    };
  }
}
