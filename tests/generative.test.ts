/// <reference types="node" />
/**
 * Tests for GenerativeModel and high-level wrappers.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { configure, GenerativeModel, GenerativeResponse, GenerativeStreamResponse } from "../src/index.js";
import { CygnisAIError } from "../src/errors.js";
import { setGlobalClient } from "../src/generative.js";

const MOCK_API_KEY = "test-key";
const MOCK_BASE_URL = "http://test-api.cygnisai.com";

const VALID_RESPONSE = {
  id: "aaa-bbb-ccc",
  response: "Test response text",
  latency_ms: 10,
  redacted: false,
  usage: { total_tokens: 5 },
};

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
}

describe("GenerativeModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setGlobalClient(null);
  });

  it("throws if no global client is configured", () => {
    expect(() => new GenerativeModel("alpha2")).toThrow(CygnisAIError);
  });

  it("generateContent returns GenerativeResponse", async () => {
    mockFetch(200, VALID_RESPONSE);
    configure({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL, maxRetries: 0 });
    const model = new GenerativeModel("alpha2");
    const response = await model.generateContent("Hello");
    expect(response).toBeInstanceOf(GenerativeResponse);
    expect(response.text).toBe("Test response text");
    expect(response.latencyMs).toBe(10);
    expect(response.usage?.total_tokens).toBe(5);
  });

  it("toString() returns text", async () => {
    mockFetch(200, VALID_RESPONSE);
    configure({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL, maxRetries: 0 });
    const model = new GenerativeModel("alpha2");
    const response = await model.generateContent("Hello");
    expect(String(response)).toBe("Test response text");
  });

  it("generateContent with stream=true returns GenerativeStreamResponse", async () => {
    const streamBody = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"response":"Hi"}\ndata: [DONE]\n'));
        c.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(streamBody, { status: 200 }))
    );
    configure({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL, maxRetries: 0 });
    const model = new GenerativeModel("alpha2");
    const stream = await model.generateContent("Hello", { stream: true });
    expect(stream).toBeInstanceOf(GenerativeStreamResponse);
    const tokens: string[] = [];
    for await (const t of stream) tokens.push(t);
    expect(tokens.join("")).toBe("Hi");
  });
});

describe("configure()", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setGlobalClient(null);
  });

  it("throws if no api key is available", () => {
    const saved = process.env["CYGNIS_API_KEY"];
    delete process.env["CYGNIS_API_KEY"];
    expect(() => configure({ baseUrl: MOCK_BASE_URL })).toThrow();
    if (saved !== undefined) process.env["CYGNIS_API_KEY"] = saved;
  });

  it("accepts apiKey directly", () => {
    expect(() => configure({ apiKey: MOCK_API_KEY, baseUrl: MOCK_BASE_URL })).not.toThrow();
  });
});
