/**
 * CygnisAI SDK – High-level GenerativeModel interface.
 * Mirrors the Python SDK's GenerativeModel / GenerativeResponse API.
 */

import { CygnisAIClient } from "./client.js";
import { CygnisAIError } from "./errors.js";
import type { ChatResponse, Message, UsageInfo } from "./types.js";

// ---------------------------------------------------------------------------
// Response wrappers
// ---------------------------------------------------------------------------

/**
 * Wraps a completed non-streaming response from the API.
 */
export class GenerativeResponse {
  public readonly text: string;
  private readonly _fullResponse: ChatResponse | undefined;

  constructor(text: string, fullResponse?: ChatResponse) {
    this.text = text;
    this._fullResponse = fullResponse ?? undefined;
  }

  toString(): string {
    return this.text;
  }

  /** The raw ChatResponse object, if available. */
  get fullResponse(): ChatResponse | undefined {
    return this._fullResponse;
  }

  /** Token-usage statistics, if available. */
  get usage(): UsageInfo | undefined {
    return this._fullResponse?.usage;
  }

  /** Round-trip latency reported by the API (ms). */
  get latencyMs(): number | undefined {
    return this._fullResponse?.latency_ms;
  }
}

/**
 * Wraps an async generator that yields tokens from a streaming response.
 */
export class GenerativeStreamResponse implements AsyncIterable<string> {
  constructor(private readonly generator: AsyncGenerator<string, void, unknown>) {}

  [Symbol.asyncIterator](): AsyncGenerator<string, void, unknown> {
    return this.generator;
  }
}

// ---------------------------------------------------------------------------
// GenerativeModel
// ---------------------------------------------------------------------------

/**
 * High-level interface for a CygnisAI language model.
 *
 * Uses the global client configured via {@link configure}.
 *
 * @example
 * ```ts
 * import { configure, GenerativeModel } from "cygnisai-sdk";
 *
 * configure({ apiKey: "YOUR_KEY" });
 * const model = new GenerativeModel("alpha2");
 * const response = await model.generateContent("Give me a TypeScript tip.");
 * console.log(response.text);
 * ```
 */
export class GenerativeModel {
  public readonly modelName: string;
  private readonly client: CygnisAIClient;

  constructor(modelName: string, client?: CygnisAIClient) {
    if (!modelName) throw new Error("modelName must not be empty.");
    this.modelName = modelName;

    // Resolve the client: explicit > global > error
    const resolved = client ?? getGlobalClient();
    if (!resolved) {
      throw new CygnisAIError(
        "CygnisAI client is not configured. " +
          'Call configure({ apiKey: "YOUR_KEY" }) before using GenerativeModel.'
      );
    }
    this.client = resolved;
  }

  /**
   * Generate text from a prompt.
   *
   * @param prompt - Question or instruction for the model.
   * @param options.messages - Optional conversation history.
   * @param options.stream - When `true`, returns a {@link GenerativeStreamResponse}.
   */
  async generateContent(
    prompt: string,
    options: { messages?: Message[]; stream?: false }
  ): Promise<GenerativeResponse>;

  async generateContent(
    prompt: string,
    options: { messages?: Message[]; stream: true }
  ): Promise<GenerativeStreamResponse>;

  async generateContent(
    prompt: string,
    options: { messages?: Message[]; stream?: boolean } = {}
  ): Promise<GenerativeResponse | GenerativeStreamResponse> {
    const { messages, stream = false } = options;

    if (stream) {
      const gen = this.client.chatStream({
        model: this.modelName,
        prompt,
        ...(messages !== undefined ? { messages } : {}),
        stream: true,
      });
      return new GenerativeStreamResponse(gen);
    }

    const fullResponse = await this.client.chat({
      model: this.modelName,
      prompt,
      ...(messages !== undefined ? { messages } : {}),
      stream: false,
    });
    return new GenerativeResponse(fullResponse.response, fullResponse);
  }
}

// ---------------------------------------------------------------------------
// Global client registry (used by configure / GenerativeModel)
// ---------------------------------------------------------------------------

let _globalClient: CygnisAIClient | null = null;

export function getGlobalClient(): CygnisAIClient | null {
  return _globalClient;
}

export function setGlobalClient(client: CygnisAIClient | null): void {
  _globalClient = client;
}
