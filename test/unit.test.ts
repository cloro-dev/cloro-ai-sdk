import { generateText, isStepCount, type Tool } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiAnswer, webSearch } from "../src/index.js";
import { bingPromptLength } from "../src/ai-answer.js";

const GOTO = "https://www.google.com/goto?url=CAES123";

const googleResponse = {
  success: true,
  result: {
    aioverview: {
      text: "Water boils at about 93 °C at 2,000 meters.",
      markdown: "Water boils at about **93 °C** [Wiki](https://en.wikipedia.org/wiki/High-altitude_cooking)",
      sources: [
        { position: 1, label: "High-altitude cooking", url: "https://en.wikipedia.org/wiki/High-altitude_cooking", redirectLink: GOTO },
        { position: 2, label: "Duplicate", url: "https://en.wikipedia.org/wiki/High-altitude_cooking" },
        { position: 3, label: "Not resolved", url: "", redirectLink: GOTO },
      ],
    },
    organicResults: [
      { position: 1, title: "High-altitude cooking", link: "https://en.wikipedia.org/wiki/High-altitude_cooking", snippet: "At 2,438 m water boils at 92 °C.", page: 1 },
      { position: 2, title: "Not resolved", link: "", redirectLink: GOTO, snippet: "x" },
      { position: 3, title: "Goto link", link: GOTO, snippet: "x" },
      { position: 4, title: "Boiling points vs altitude", link: "https://www.engineeringtoolbox.com/boiling-points-water-altitude-d_1344.html" },
      { position: 5, title: "Calculator", link: "https://www.omnicalculator.com/chemistry/boiling-point-altitude", snippet: "Calculator." },
    ],
    peopleAlsoAsk: [],
  },
};

const answerResponse = {
  success: true,
  result: {
    text: "cloro is an API for search results and AI answers.",
    model: null,
    sources: [
      { position: 1, label: "cloro", url: "https://cloro.dev/" },
      { position: 2, label: "Shopping", url: "https://www.google.com/search?q=cloro&udm=28" },
    ],
  },
};

type FetchMock = ReturnType<typeof vi.fn>;

function mockFetch(body: unknown, status = 200): FetchMock {
  const fn = vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

function sentRequest(fn: FetchMock, call = 0) {
  const [url, init] = fn.mock.calls[call] as [string, RequestInit];
  return {
    url,
    body: JSON.parse(init.body as string),
    headers: init.headers as Record<string, string>,
  };
}

// Runs a tool's execute function outside generateText.
async function run<I, O>(t: Tool<I, O>, input: I): Promise<O> {
  return (await t.execute!(input, { toolCallId: "test", messages: [], context: {} } as never)) as O;
}

beforeEach(() => {
  vi.stubEnv("CLORO_API_KEY", "sk_test_env");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("webSearch", () => {
  it("sends a Google request with the AI Overview and returns a compact result", async () => {
    const fn = mockFetch(googleResponse);
    const output = await run(webSearch(), { query: "boiling point of water at 2000 m" });

    const req = sentRequest(fn);
    expect(req.url).toBe("https://api.cloro.dev/v1/monitor/google");
    expect(req.headers.Authorization).toBe("Bearer sk_test_env");
    expect(req.body).toEqual({
      query: "boiling point of water at 2000 m",
      country: "US",
      include: { aioverview: { markdown: false } },
    });

    expect(output).toEqual({
      query: "boiling point of water at 2000 m",
      aiOverview: {
        text: "Water boils at about 93 °C at 2,000 meters.",
        sources: [{ title: "High-altitude cooking", link: "https://en.wikipedia.org/wiki/High-altitude_cooking" }],
      },
      results: [
        { position: 1, title: "High-altitude cooking", link: "https://en.wikipedia.org/wiki/High-altitude_cooking", snippet: "At 2,438 m water boils at 92 °C." },
        { position: 4, title: "Boiling points vs altitude", link: "https://www.engineeringtoolbox.com/boiling-points-water-altitude-d_1344.html", snippet: "" },
        { position: 5, title: "Calculator", link: "https://www.omnicalculator.com/chemistry/boiling-point-altitude", snippet: "Calculator." },
      ],
      ads: [],
    });
  });

  it("applies the country, maxResults and includeAiOverview options", async () => {
    const fn = mockFetch(googleResponse);
    const output = await run(webSearch({ country: "de", maxResults: 1, includeAiOverview: false }), { query: "wetter berlin" });

    expect(sentRequest(fn).body).toEqual({ query: "wetter berlin", country: "DE" });
    expect(output.aiOverview).toBeNull();
    expect(output.results).toHaveLength(1);
  });

  it("sends a Bing request when engine is bing and reads the same shapes", async () => {
    const fn = mockFetch(googleResponse);
    const tool = webSearch({ engine: "bing", country: "gb" });
    const output = await run(tool, { query: "boiling point of water at 2000 m" });

    const req = sentRequest(fn);
    expect(req.url).toBe("https://api.cloro.dev/v1/monitor/bing");
    expect(req.body).toEqual({
      query: "boiling point of water at 2000 m",
      country: "GB",
      include: { aioverview: { markdown: false } },
    });
    expect(output.aiOverview?.text).toBe("Water boils at about 93 °C at 2,000 meters.");
    expect(output.results).toHaveLength(3);
    expect(tool.description).toContain("Search Bing");
  });

  it.each(["google", "bing"] as const)("returns the %s ads with the useful fields", async (engine) => {
    mockFetch({
      success: true,
      result: {
        organicResults: [],
        ads: [
          { position: 1, blockPosition: "top", type: "RESULT", title: "Wok Sale", url: "https://shop.example/woks", page: 1, domain: "shop.example", description: "Carbon steel woks." },
          { position: 1, blockPosition: "rhs", type: "SHOPPING_CARD", title: "14 in Wok", url: GOTO, page: 1, price: { value: 29, currency: "$", raw: "$29.00" }, store: "Shop" },
          {},
        ],
      },
    });
    const output = await run(webSearch({ engine, maxResults: 1 }), { query: "wok" });
    expect(output.ads).toStrictEqual([
      { position: 1, blockPosition: "top", type: "RESULT", title: "Wok Sale", link: "https://shop.example/woks", description: "Carbon steel woks." },
      { position: 1, blockPosition: "rhs", type: "SHOPPING_CARD", title: "14 in Wok", price: "$29.00", store: "Shop" },
      {},
    ]);
  });

  it("refuses a Bing query over the URL limit before it sends a request", async () => {
    const fn = mockFetch(googleResponse);
    const query = "é".repeat(600); // 6 encoded characters each: 3,600
    await expect(run(webSearch({ engine: "bing" }), { query })).rejects.toThrow(/too long/);
    expect(fn).not.toHaveBeenCalled();
  });

  it("refuses an unknown search engine", () => {
    expect(() => webSearch({ engine: "yahoo" as never })).toThrow(/Unknown engine/);
  });

  it("returns a null AI Overview when Google shows none", async () => {
    mockFetch({ success: true, result: { organicResults: [] } });
    const output = await run(webSearch(), { query: "x" });
    expect(output).toEqual({ query: "x", aiOverview: null, results: [], ads: [] });
  });

  it("uses the apiKey option before CLORO_API_KEY", async () => {
    const fn = mockFetch(googleResponse);
    await run(webSearch({ apiKey: "sk_test_option" }), { query: "x" });
    expect(sentRequest(fn).headers.Authorization).toBe("Bearer sk_test_option");
  });

  it("does not need the API key until the tool runs", async () => {
    vi.stubEnv("CLORO_API_KEY", "");
    const tool = webSearch();
    await expect(run(tool, { query: "x" })).rejects.toThrow(/CLORO_API_KEY/);
  });

  it("throws the API error message", async () => {
    mockFetch({ success: false, error: { message: "Invalid API key" } }, 401);
    await expect(run(webSearch(), { query: "x" })).rejects.toThrow("Invalid API key");
  });

  it("works as a tool in generateText", async () => {
    mockFetch(googleResponse);
    let call = 0;
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        call += 1;
        const usage = {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        };
        if (call === 1) {
          return {
            content: [
              { type: "tool-call", toolCallId: "c1", toolName: "webSearch", input: JSON.stringify({ query: "boiling point" }) },
            ],
            finishReason: { unified: "tool-calls", raw: "tool_calls" },
            usage,
            warnings: [],
          };
        }
        return {
          content: [{ type: "text", text: "About 93 °C." }],
          finishReason: { unified: "stop", raw: "stop" },
          usage,
          warnings: [],
        };
      },
    });

    const { text, steps } = await generateText({
      model,
      prompt: "What is the boiling point of water at 2,000 meters?",
      tools: { webSearch: webSearch() },
      stopWhen: isStepCount(3),
    });

    expect(text).toBe("About 93 °C.");
    const toolResult = steps[0]!.toolResults[0]!;
    expect(toolResult.toolName).toBe("webSearch");
    expect((toolResult.output as { results: unknown[] }).results).toHaveLength(3);
  });
});

describe("aiAnswer", () => {
  it.each([
    ["chatgpt", "/v1/monitor/chatgpt"],
    ["gemini", "/v1/monitor/gemini"],
    ["google-ai-mode", "/v1/monitor/aimode"],
    ["bing-ai-mode", "/v1/monitor/bing/aimode"],
  ] as const)("sends %s requests to %s", async (engine, path) => {
    const fn = mockFetch(answerResponse);
    const output = await run(aiAnswer({ engine, country: "gb" }), { prompt: "What is cloro?" });

    const req = sentRequest(fn);
    expect(req.url).toBe(`https://api.cloro.dev${path}`);
    expect(req.body).toEqual({ prompt: "What is cloro?", country: "GB" });
    expect(output).toEqual({
      engine,
      text: "cloro is an API for search results and AI answers.",
      sources: [{ title: "cloro", link: "https://cloro.dev/" }],
    });
  });

  it("uses ChatGPT by default and names the engine in the description", () => {
    expect(aiAnswer().description).toContain("ChatGPT");
    expect(aiAnswer({ engine: "bing-ai-mode" }).description).toContain("Bing AI Mode");
  });

  it("refuses an unknown engine", () => {
    expect(() => aiAnswer({ engine: "perplexity" as never })).toThrow(/Unknown engine/);
  });

  it("refuses a Bing AI Mode prompt over the URL limit before it sends a request", async () => {
    const fn = mockFetch(answerResponse);
    const prompt = "é".repeat(600); // 6 encoded characters each: 3,600
    expect(bingPromptLength(prompt)).toBe(3600);
    await expect(run(aiAnswer({ engine: "bing-ai-mode" }), { prompt })).rejects.toThrow(/too long/);
    expect(fn).not.toHaveBeenCalled();
  });

  it("counts a space as one character in the Bing limit", () => {
    expect(bingPromptLength("  a b  ")).toBe(3);
  });
});
