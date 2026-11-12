// Live test against the cloro API. It runs only when CLORO_API_KEY is set, and
// it uses credits: 7 for the search and 6 for the Gemini answer (sync prices).
//
//   CLORO_API_KEY=sk_live_... npm run test:live
import type { Tool } from "ai";
import { describe, expect, it } from "vitest";
import { aiAnswer, webSearch } from "../src/index.js";

// Runs a tool's execute function outside generateText.
async function run<I, O>(t: Tool<I, O>, input: I): Promise<O> {
  return (await t.execute!(input, { toolCallId: "test", messages: [], context: {} } as never)) as O;
}

describe.skipIf(!process.env.CLORO_API_KEY)("live", () => {
  it("webSearch returns organic results and the AI Overview", async () => {
    const output = await run(webSearch({ maxResults: 5 }), { query: "what is the boiling point of water at 2000 meters" });
    console.log(JSON.stringify(output, null, 2));

    expect(output.results.length).toBeGreaterThan(0);
    expect(output.results.length).toBeLessThanOrEqual(5);
    for (const r of output.results) {
      expect(r.link).toMatch(/^https?:\/\//);
      expect(r.title).not.toBe("");
    }
    // Google does not show an AI Overview for every query, so only check its shape.
    if (output.aiOverview) {
      expect(output.aiOverview.text.length).toBeGreaterThan(0);
    }
  }, 300_000);

  it("aiAnswer returns a Gemini answer", async () => {
    const output = await run(aiAnswer({ engine: "gemini" }), { prompt: "What is the capital of Portugal? Answer in one sentence." });
    console.log(JSON.stringify(output, null, 2));

    expect(output.engine).toBe("gemini");
    expect(output.text).toMatch(/Lisbon/i);
  }, 300_000);
});
