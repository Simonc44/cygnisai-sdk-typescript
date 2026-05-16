/**
 * CygnisAI SDK – Public TypeScript types and interfaces.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type Role = "user" | "assistant" | "system";

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

export interface Message {
  role: Role;
  content: string;
}

export interface ChatRequest {
  model: string;
  prompt: string;
  messages?: Message[];
  stream?: boolean;
}

export interface UsageInfo {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  [key: string]: unknown; // allow extra fields from the API
}

export interface ChatResponse {
  id: string;
  response: string;
  latency_ms: number;
  redacted: boolean;
  usage: UsageInfo;
}

// ---------------------------------------------------------------------------
// Error shapes
// ---------------------------------------------------------------------------

export interface ErrorDetail {
  loc?: string[];
  msg?: string;
  type?: string;
}

export interface ErrorBody {
  code?: string;
  message?: string;
  detail?: string | ErrorDetail[];
  error?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

export interface CygnisAIClientOptions {
  /** Your CygnisAI API key. Falls back to the CYGNIS_API_KEY environment variable. */
  apiKey?: string;
  /** Override the default API base URL. */
  baseUrl?: string;
  /** HTTP timeout in milliseconds (default: 30 000). */
  timeoutMs?: number;
  /** Number of automatic retries on transient errors (default: 3). */
  maxRetries?: number;
  /** Extra headers merged into every request. */
  defaultHeaders?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// High-level response wrappers
// ---------------------------------------------------------------------------

export interface GenerativeResponseOptions {
  text: string;
  fullResponse?: ChatResponse;
}
