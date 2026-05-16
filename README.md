# CygnisAI TypeScript SDK

The official TypeScript/JavaScript SDK for the CygnisAI API.  
Works in **Node.js ≥ 18**, **Deno**, **Bun**, and modern **browsers** (via the native `fetch` API).

> **Note:** API access is currently in **private beta**.

---

## Installation

```bash
npm install cygnisai-sdk
# or
yarn add cygnisai-sdk
# or
pnpm add cygnisai-sdk
```

---

## Quick Start

```ts
import { configure, GenerativeModel } from "cygnisai-sdk";

configure({ apiKey: "YOUR_API_KEY" });

const model = new GenerativeModel("alpha2");
const response = await model.generateContent("Give me a TypeScript tip.");
console.log(response.text);
```

### Environment variable

Set `CYGNIS_API_KEY` and call `configure()` without arguments:

```ts
configure(); // reads process.env.CYGNIS_API_KEY automatically
```

---

## Streaming

```ts
const stream = await model.generateContent("Tell me a story.", { stream: true });

for await (const token of stream) {
  process.stdout.write(token);
}
```

---

## Conversation history

```ts
import { configure, GenerativeModel } from "cygnisai-sdk";
import type { Message } from "cygnisai-sdk";

configure({ apiKey: "YOUR_KEY" });
const model = new GenerativeModel("alpha2");

const history: Message[] = [
  { role: "user", content: "My name is Alice." },
  { role: "assistant", content: "Hello Alice!" },
];

const response = await model.generateContent("What is my name?", { messages: history });
console.log(response.text); // "Your name is Alice."
```

---

## Low-level client

```ts
import { CygnisAIClient } from "cygnisai-sdk";

const client = new CygnisAIClient({
  apiKey: "YOUR_KEY",
  timeoutMs: 60_000,
  maxRetries: 5,
});

const response = await client.chat({
  model: "alpha2",
  prompt: "What is 2+2?",
});
console.log(response.response); // "4"
```

---

## Error handling

```ts
import {
  configure,
  GenerativeModel,
  AuthenticationError,
  RateLimitError,
  ServerError,
  NetworkError,
  CygnisAIError,
} from "cygnisai-sdk";

configure({ apiKey: "YOUR_KEY" });
const model = new GenerativeModel("alpha2");

try {
  const response = await model.generateContent("Hello!");
  console.log(response.text);
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.error("Invalid API key.");
  } else if (err instanceof RateLimitError) {
    console.error("Too many requests — slow down.");
  } else if (err instanceof ServerError) {
    console.error(`Server error ${err.statusCode}: ${err.message}`);
  } else if (err instanceof NetworkError) {
    console.error("Could not reach the API.");
  } else if (err instanceof CygnisAIError) {
    console.error(`SDK error: ${err.message}`);
  }
}
```

---

## Configuration options

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `CYGNIS_API_KEY` env var | Your secret API key |
| `baseUrl` | `string` | production URL | Override the API base URL |
| `timeoutMs` | `number` | `30000` | HTTP timeout in milliseconds |
| `maxRetries` | `number` | `3` | Retries on transient errors (429, 5xx) |
| `defaultHeaders` | `Record<string, string>` | `{}` | Extra headers added to every request |

---

## Available Models

| Model | Description | Status |
|---|---|---|
| **`alpha_v01`** | Lightweight prototyping | Stable |
| **`alpha1`** | Balanced, fast response | Stable |
| **`alpha2`** | Most capable, complex reasoning | Stable |

---

## Feature Status

- [x] `GenerativeModel` high-level interface
- [x] Streaming (`stream: true`)
- [x] Typed exceptions
- [x] Automatic retries with exponential backoff
- [x] `CYGNIS_API_KEY` environment variable
- [x] Dual ESM / CommonJS build
- [x] Full TypeScript types & declaration files
- [x] Node.js + browser compatible (native `fetch`)
- [ ] Public access (closed beta)

---

## Development

```bash
npm install
npm run build      # compile to dist/
npm test           # run Vitest test suite
npm run typecheck  # tsc --noEmit
```

---

## Licence

MIT — see `LICENCE` for details.
