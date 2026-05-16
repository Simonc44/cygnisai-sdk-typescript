/**
 * CygnisAI TypeScript SDK
 *
 * @example
 * ```ts
 * import { configure, GenerativeModel } from "cygnisai-sdk";
 *
 * configure({ apiKey: "YOUR_KEY" });
 * const model = new GenerativeModel("alpha2");
 * const response = await model.generateContent("Hello!");
 * console.log(response.text);
 * ```
 *
 * @module cygnisai-sdk
 */

// ---------------------------------------------------------------------------
// Re-export everything
// ---------------------------------------------------------------------------

export type {
  ChatRequest,
  ChatResponse,
  CygnisAIClientOptions,
  ErrorBody,
  ErrorDetail,
  Message,
  Role,
  UsageInfo,
} from "./types.js";

export { CygnisAIClient, DEFAULT_BASE_URL } from "./client.js";

export {
  AuthenticationError,
  CygnisAIError,
  NetworkError,
  RateLimitError,
  ResponseValidationError,
  ServerError,
} from "./errors.js";

export {
  GenerativeModel,
  GenerativeResponse,
  GenerativeStreamResponse,
} from "./generative.js";

// ---------------------------------------------------------------------------
// configure() — global initialisation helper
// ---------------------------------------------------------------------------

import { CygnisAIClient } from "./client.js";
import type { CygnisAIClientOptions } from "./types.js";
import { setGlobalClient } from "./generative.js";

/**
 * Initialise the global CygnisAI client.
 *
 * Call this once at startup before using {@link GenerativeModel}.
 *
 * The `apiKey` falls back to the `CYGNIS_API_KEY` environment variable.
 *
 * @example
 * ```ts
 * configure({ apiKey: "YOUR_KEY", timeoutMs: 60_000 });
 * ```
 */
export function configure(options: CygnisAIClientOptions = {}): void {
  const client = new CygnisAIClient(options);
  setGlobalClient(client);
}
