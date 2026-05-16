/**
 * CygnisAI SDK – Low-level async HTTP client.
 *
 * Handles authentication, serialisation, error mapping, retries and SSE streaming.
 */

import {
  AuthenticationError,
  CygnisAIError,
  NetworkError,
  RateLimitError,
  ResponseValidationError,
  ServerError,
} from "./errors.js";
import type { ChatRequest, ChatResponse, CygnisAIClientOptions, ErrorBody } from "./types.js";

// ---------------------------------------------------------------------------
// Universal env-var reader (Node.js, Bun, Deno)
// ---------------------------------------------------------------------------

function getEnvVar(key: string): string | undefined {
  // Node.js / Bun — process.env is available via @types/node
  if (typeof process !== "undefined" && process.env) {
    return process.env[key];
  }
  // Deno
  // @ts-ignore – Deno global is not in lib.dom
  if (typeof Deno !== "undefined") {
    // @ts-ignore
    return Deno.env.get(key) as string | undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_BASE_URL = "https://needlessly-faithful-gopher.ngrok-free.app";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const RETRY_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const SDK_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorMessage(body: ErrorBody): string {
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) {
    return body.detail
      .map((e) => `${(e.loc ?? ["?"]).slice(-1)[0]}: ${e.msg ?? ""}`)
      .join("; ");
  }
  return (
    (body.message as string | undefined) ??
    (body.error as string | undefined) ??
    JSON.stringify(body)
  );
}

function mapStatusError(
  status: number,
  message: string,
  details: unknown
): CygnisAIError {
  if (status === 401 || status === 403) return new AuthenticationError(message, status, details);
  if (status === 429) return new RateLimitError(message, status, details);
  if (status >= 500) return new ServerError(message, status, details);
  return new CygnisAIError(message, status, details);
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class CygnisAIClient {
  public readonly baseUrl: string;
  public readonly maxRetries: number;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: CygnisAIClientOptions = {}) {
    const apiKey =
      options.apiKey ??
      getEnvVar("CYGNIS_API_KEY");

    if (!apiKey) {
      throw new Error(
        "No API key provided. Pass apiKey in options or set the CYGNIS_API_KEY environment variable."
      );
    }

    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES);

    this.defaultHeaders = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": `cygnisai-typescript-sdk/${SDK_VERSION}`,
      ...options.defaultHeaders,
    };
  }

  // -------------------------------------------------------------------------
  // Internal: fetch with timeout
  // -------------------------------------------------------------------------

  private async fetchWithTimeout(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new NetworkError(`Request timed out after ${this.timeoutMs}ms`);
      }
      throw new NetworkError(`Network error: ${(err as Error).message}`, String(err));
    } finally {
      clearTimeout(timer);
    }
  }

  // -------------------------------------------------------------------------
  // Internal: POST with exponential-backoff retries
  // -------------------------------------------------------------------------

  private async postWithRetry(
    path: string,
    body: unknown
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method: "POST",
      headers: this.defaultHeaders,
      body: JSON.stringify(body),
    };

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, init);

        if (!RETRY_STATUS_CODES.has(response.status) || attempt === this.maxRetries) {
          return response;
        }

        const wait = Math.pow(2, attempt) * 1000;
        await sleep(wait);
      } catch (err) {
        lastError = err;
        if (err instanceof NetworkError && attempt < this.maxRetries) {
          const wait = Math.pow(2, attempt) * 1000;
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }

    throw new NetworkError(
      `Request failed after ${this.maxRetries + 1} attempts`,
      String(lastError)
    );
  }

  // -------------------------------------------------------------------------
  // Public: chat (non-streaming)
  // -------------------------------------------------------------------------

  /**
   * Send a chat request and return the complete response.
   *
   * @param request - ChatRequest payload
   * @returns Resolved ChatResponse
   * @throws {AuthenticationError} on 401/403
   * @throws {RateLimitError} on 429
   * @throws {ServerError} on 5xx
   * @throws {NetworkError} on connection failure / timeout
   * @throws {ResponseValidationError} if the response body is unexpected
   * @throws {CygnisAIError} for any other API error
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const payload = { ...request, stream: false };

    const raw = await this.postWithRetry("/v3/chat", payload);

    if (!raw.ok) {
      let body: ErrorBody = {};
      try {
        body = (await raw.json()) as ErrorBody;
      } catch { /* ignore */ }
      const msg = extractErrorMessage(body);
      throw mapStatusError(raw.status, `API error (HTTP ${raw.status}): ${msg}`, body);
    }

    let data: unknown;
    try {
      data = await raw.json();
    } catch (err) {
      throw new ResponseValidationError("Failed to parse API response as JSON", String(err));
    }

    if (!isValidChatResponse(data)) {
      throw new ResponseValidationError(
        "API response did not match expected schema",
        data
      );
    }

    return data;
  }

  // -------------------------------------------------------------------------
  // Public: chat_stream (SSE streaming)
  // -------------------------------------------------------------------------

  /**
   * Send a chat request and yield tokens as they arrive via SSE.
   *
   * @param request - ChatRequest payload
   * @returns AsyncGenerator yielding string tokens
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const payload = { ...request, stream: true };
    const url = `${this.baseUrl}/v3/chat`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let raw: Response;
    try {
      raw = await fetch(url, {
        method: "POST",
        headers: this.defaultHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error).name === "AbortError") {
        throw new NetworkError(`Streaming request timed out after ${this.timeoutMs}ms`);
      }
      throw new NetworkError(`Network error: ${(err as Error).message}`, String(err));
    }

    if (!raw.ok) {
      clearTimeout(timer);
      let body: ErrorBody = {};
      try {
        body = (await raw.json()) as ErrorBody;
      } catch { /* ignore */ }
      const msg = extractErrorMessage(body);
      throw mapStatusError(raw.status, `API error (HTTP ${raw.status}): ${msg}`, body);
    }

    if (!raw.body) {
      clearTimeout(timer);
      throw new ServerError("Response body is null — cannot stream");
    }

    const reader = raw.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        // Flush remaining buffer when the stream ends
        if (done) {
          if (buffer.trim()) {
            yield* processSSELine(buffer.trim());
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const rawLine of lines) {
          yield* processSSELine(rawLine.trim());
        }
      }
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }
  }
}

// ---------------------------------------------------------------------------
// SSE line processor (extracted to allow reuse for buffer flush)
// ---------------------------------------------------------------------------

function* processSSELine(line: string): Generator<string, void, unknown> {
  if (!line) return;
  if (!line.startsWith("data:")) return;

  const content = line.slice(5).trim();
  if (content === "[DONE]") return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    yield content;
    return;
  }

  if (typeof parsed !== "object" || parsed === null) {
    yield String(parsed);
    return;
  }

  const data = parsed as Record<string, unknown>;

  if ("error" in data || "detail" in data) {
    const errVal = data["error"] ?? data["detail"];
    const errMsg = typeof errVal === "string" ? errVal : JSON.stringify(errVal);
    throw new CygnisAIError(`Server error in stream: ${errMsg}`, undefined, data);
  }

  const token =
    (data["response"] as string | undefined) ??
    (data["text"] as string | undefined) ??
    "";
  if (token) yield token;
}

function isValidChatResponse(v: unknown): v is ChatResponse {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj["id"] === "string" &&
    typeof obj["response"] === "string" &&
    typeof obj["latency_ms"] === "number" &&
    typeof obj["redacted"] === "boolean" &&
    typeof obj["usage"] === "object" &&
    obj["usage"] !== null
  );
}
