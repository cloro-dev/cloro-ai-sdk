/**
 * cloro tools for the Vercel AI SDK.
 *
 * - `webSearch`: the Google or Bing results page (AI Overview and organic results).
 * - `aiAnswer`: the answer of ChatGPT, Gemini, Google AI Mode or Bing AI Mode, with its sources.
 */
export { webSearch } from "./web-search.js";
export type { SearchEngine, WebSearchOptions, WebSearchOutput, WebSearchResultItem } from "./web-search.js";
export { aiAnswer } from "./ai-answer.js";
export type { AiAnswerOptions, AiAnswerOutput, AiEngine } from "./ai-answer.js";
export type { CloroToolOptions, Source } from "./shared.js";
