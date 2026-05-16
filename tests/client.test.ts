/// <reference types="node" />
/**
 * Tests for CygnisAIClient.
 * Run with: npm test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CygnisAIClient } from "../src/client.js";
import {
  AuthenticationError,
  CygnisAIError,
  NetworkError,
  RateLimitError,
  ResponseValidationError,
  ServerError,
} from "../src/errors.js";
import type { ChatRequest } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_API_KEY = "test-api-key-123";
const MOCK_BASE_URL = "http://test-api.cygnisai.com";

const VALID_RESPONSE = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  response: "This is a test reply.",
  latency_ms: 42,
  redacted: false,
  usage: { prompt_tokens: 5, completion_tokens: 8, total_tokens: 13 },
};

const BASIC_REQUEST: ChatRequest = {
  model: "alpha2",
  prompt: "Hello!",
  messages: [{ role: "user", content: "Hi" }],
  stream: false,
};

function makeClient(overrides: Partial<ConstructorParameters<typeof CygnisAIClient>[0]> = {}) {
  return new CygnisAIClient({
    apiKey: MOCK_API_KEY,
    baseUrl: MOCK_BASE_URL,
    maxRetries: 0, // no retries by default in tests to keep them fast
    ...overrides,
  });
}

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const bodyText = JSON.stringify(body);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(bodyText, {
        status,
        headers: { "Content-Type": "application/json", ...headers },
      })
    )
  );
}

function mockFetchStream(lines: string[], status = 200) {
  const body = lines.join("\n");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(stream, {
        status,
        headers: { "Content-Type": "text/event-stream" },
      })
    )
  );
}

// ---------------------------------------------------------------------------
// Tests: chat()
// ---------------------------------------------------------------------------

describe("CygnisAIClient.chat()", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a ChatResponse on 200", async () => {
    mockFetch(200, VALID_RESPONSE);
    const client = makeClient();
    const response = await client.chat(BASIC_REQUEST);
    expect(response.id).toBe(VALID_RESPONSE.id);
    expect(response.response).toBe(VALID_RESPONSE.response);
    expect(response.latency_ms).toBe(42);
    expect(response.usage.total_tokens).toBe(13);
  });

  it("always sends stream: false", async () => {
    mockFetch(200, VALID_RESPONSE);
    const client = makeClient();
    await client.chat({ ...BASIC_REQUEST, stream: true });
    const fetchMock = vi.mocked(fetch);
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(sentBody.stream).toBe(false);
  });

  it("throws AuthenticationError on 401", async () => {
    mockFetch(401, { detail: "Unauthorized" });
    const client = makeClient();
    await expect(client.chat(BASIC_REQUEST)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("throws AuthenticationError on 403", async () => {
    mockFetch(403, { detail: "Forbidden" });
    const client = makeClient();
    await expect(client.chat(BASIC_REQUEST)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("throws RateLimitError on 429 (no retries)", async () => {
    mockFetch(429, { detail: "Too many requests" });
    const client = makeClient({ maxRetries: 0 });
    await expect(client.chat(BASIC_REQUEST)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("retries on 429 and succeeds on second attempt", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        call++;
        const body = call === 1 ? { detail: "rate limited" } : VALID_RESPONSE;
        const status = call === 1 ? 429 : 200;
        return Promise.resolve(new Response(JSON.stringify(body), { status }));
      })
    );
    const client = makeClient({ maxRetries: 1 });
    const response = await client.chat(BASIC_REQUEST);
    expect(response.response).toBe(VALID_RESPONSE.response);
    expect(call).toBe(2);
  });

  it("throws ServerError on 500", async () => {
    mockFetch(500, { detail: "Internal server error" });
    const client = makeClient({ maxRetries: 0 });
    await expect(client.chat(BASIC_REQUEST)).rejects.toBeInstanceOf(ServerError);
  });

  it("throws ResponseValidationError on unexpected schema", async () => {
    mockFetch(200, { unexpected: "schema" });
    const client = makeClient();
    await expect(client.chat(BASIC_REQUEST)).rejects.toBeInstanceOf(ResponseValidationError);
  });

  it("throws CygnisAIError with status code on generic 4xx", async () => {
    mockFetch(422, { detail: "Unprocessable" });
    const client = makeClient();
    const err = await client.chat(BASIC_REQUEST).catch((e) => e);
    expect(err).toBeInstanceOf(CygnisAIError);
    expect(err.statusCode).toBe(422);
  });
});

// ---------------------------------------------------------------------------
// Tests: chatStream()
// ---------------------------------------------------------------------------

describe("CygnisAIClient.chatStream()", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("yields tokens and stops at [DONE]", async () => {
    mockFetchStream([
      'data: {"response": "Hello"}',
      'data: {"response": " world"}',
      'data: {"response": "!"}',
      "data: [DONE]",
    ]);

    const client = makeClient();
    const tokens: string[] = [];
    for await (const token of client.chatStream({ ...BASIC_REQUEST, stream: true })) {
      tokens.push(token);
    }
    expect(tokens.join("")).toBe("Hello world!");
  });

  it("throws ServerError on non-200 status", async () => {
    mockFetchStream([], 500);
    const client = makeClient();
    const gen = client.chatStream({ ...BASIC_REQUEST, stream: true });
    await expect(gen.next()).rejects.toBeInstanceOf(ServerError);
  });

  it("throws CygnisAIError on error embedded in stream body", async () => {
    mockFetchStream(['data: {"error": "Model overloaded"}']);
    const client = makeClient();

    await expect(async () => {
      for await (const _ of client.chatStream({ ...BASIC_REQUEST, stream: true })) {
        // iterate until error is thrown
      }
    }).rejects.toBeInstanceOf(CygnisAIError);
  });

  it("yields raw content if SSE line is not valid JSON", async () => {
    mockFetchStream(["data: plain text token", "data: [DONE]"]);
    const client = makeClient();
    const tokens: string[] = [];
    for await (const token of client.chatStream({ ...BASIC_REQUEST, stream: true })) {
      tokens.push(token);
    }
    expect(tokens).toContain("plain text token");
  });
});

// ---------------------------------------------------------------------------
// Tests: constructor
// ---------------------------------------------------------------------------

describe("CygnisAIClient constructor", () => {
  it("throws when no apiKey is provided and env var is absent", () => {
    const originalEnv = process.env["CYGNIS_API_KEY"];
    delete process.env["CYGNIS_API_KEY"];
    expect(() => new CygnisAIClient({ baseUrl: MOCK_BASE_URL })).toThrow();
    if (originalEnv !== undefined) process.env["CYGNIS_API_KEY"] = originalEnv;
  });

  it("reads CYGNIS_API_KEY from environment", () => {
    process.env["CYGNIS_API_KEY"] = "env-key";
    expect(() => new CygnisAIClient({ baseUrl: MOCK_BASE_URL })).not.toThrow();
    delete process.env["CYGNIS_API_KEY"];
  });

  it("strips trailing slash from baseUrl", () => {
    const client = new CygnisAIClient({ apiKey: MOCK_API_KEY, baseUrl: "http://example.com/" });
    expect(client.baseUrl).toBe("http://example.com");
  });
});
