# @cloro-dev/ai-sdk

[cloro](https://cloro.dev/?utm_source=ai-sdk&utm_medium=byok) tools for the [Vercel AI SDK](https://ai-sdk.dev).

- `webSearch` sends a query to Google and returns the AI Overview (when Google shows one) and the top organic results with title, link and snippet.
- `aiAnswer` asks ChatGPT, Gemini, Google AI Mode or Bing AI Mode a question and returns the answer with the sources it cites.

Each tool is a factory that returns an AI SDK `tool()` with a Zod input schema and a typed output.

## Install

```bash
npm install @cloro-dev/ai-sdk ai zod
```

The package supports `ai` 6 and 7, and `zod` 3.25.76 or later and 4.

## API key

Get an API key in the [cloro dashboard](https://dashboard.cloro.dev/api-keys?utm_source=ai-sdk&utm_medium=byok) and set it in the environment:

```bash
CLORO_API_KEY=sk_live_...
```

You can also give the key to each tool: `webSearch({ apiKey: "sk_live_..." })`. The tool reads the key when it runs, not when you make it.

## Example

```ts
import { generateText, isStepCount } from "ai";
import { webSearch } from "@cloro-dev/ai-sdk";

const { text } = await generateText({
  model: "openai/gpt-5-mini",
  prompt: "What is the boiling point of water at 2,000 meters?",
  tools: {
    webSearch: webSearch(),
  },
  stopWhen: isStepCount(3),
});

console.log(text);
```

This example uses a model through the Vercel AI Gateway (`AI_GATEWAY_API_KEY`). You can use a provider package such as `@ai-sdk/openai` instead. With `ai` 6, use `stepCountIs` in place of `isStepCount`.

## Tools

### `webSearch(options?)`

The model sends `{ query }`. The tool returns:

```ts
{
  query: string;
  aiOverview: { text: string; sources: { title: string; link: string }[] } | null;
  results: { position: number; title: string; link: string; snippet: string }[];
}
```

`aiOverview` is `null` when Google shows no AI Overview for the query, or when you set `includeAiOverview: false`. The tool removes results that have no resolved link.

| Option | Type | Default | Description |
| - | - | - | - |
| `apiKey` | `string` | `CLORO_API_KEY` | Your cloro API key. |
| `country` | `string` | `"US"` | ISO 3166-1 alpha-2 country code for the search, for example `"DE"`. |
| `maxResults` | `number` | `10` | Number of organic results to return, from 1 to 10 (the first results page). |
| `includeAiOverview` | `boolean` | `true` | Include the Google AI Overview. Set it to `false` to pay 2 credits less for each search. |

### `aiAnswer(options?)`

The model sends `{ prompt }`. The tool returns:

```ts
{
  engine: "chatgpt" | "gemini" | "google-ai-mode" | "bing-ai-mode";
  text: string;
  sources: { title: string; link: string }[];
}
```

| Option | Type | Default | Description |
| - | - | - | - |
| `apiKey` | `string` | `CLORO_API_KEY` | Your cloro API key. |
| `country` | `string` | `"US"` | ISO 3166-1 alpha-2 country code for the request. |
| `engine` | `"chatgpt" \| "gemini" \| "google-ai-mode" \| "bing-ai-mode"` | `"chatgpt"` | The AI engine to ask. |

To give the model more than one engine, make one tool for each engine:

```ts
import { aiAnswer, webSearch } from "@cloro-dev/ai-sdk";

const tools = {
  webSearch: webSearch(),
  askChatGPT: aiAnswer({ engine: "chatgpt" }),
  askGemini: aiAnswer({ engine: "gemini" }),
};
```

Bing AI Mode accepts a prompt of 3,500 characters or fewer after URL encoding. The tool refuses a longer prompt before it sends the request.

## Pricing

The tools use the cloro sync endpoints, which wait for the result. A sync request costs the base credits plus 2. The cost of each tool call:

| Tool call | Credits |
| - | - |
| `webSearch()` (with the AI Overview) | 7 (3 for the search, 2 for the AI Overview, 2 for sync) |
| `webSearch({ includeAiOverview: false })` | 5 |
| `aiAnswer({ engine: "chatgpt" })` | 7 |
| `aiAnswer({ engine: "gemini" })` | 6 |
| `aiAnswer({ engine: "google-ai-mode" })` | 6 |
| `aiAnswer({ engine: "bing-ai-mode" })` | 6 |

See [credit pricing](https://cloro.dev/docs/guides/providers?utm_source=ai-sdk&utm_medium=byok) and [plans](https://cloro.dev/pricing/?utm_source=ai-sdk&utm_medium=byok). Each response has the real charge in the `X-Credits-Charged` header.

## Errors

When the API refuses a request (for example, a bad API key or no credits), the tool throws an error with the API message. The AI SDK gives the error to the model as a tool error. The client tries again 2 times after a timeout, a connection error, a 429 or a 5xx response.

## Development

```bash
npm install
npm run typecheck
npm test                                   # unit tests with a mocked fetch
CLORO_API_KEY=sk_live_... npm run test:live # live test, uses 13 credits
npm run build
```

## Links

- [cloro API documentation](https://cloro.dev/docs?utm_source=ai-sdk&utm_medium=byok)
- [cloro Node SDK](https://www.npmjs.com/package/@cloro-dev/cloro), which this package uses

## License

MIT
