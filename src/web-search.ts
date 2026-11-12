import { tool, type Tool } from "ai";
import { z } from "zod";
import {
  countryCode,
  isUsableLink,
  lazyClient,
  toSources,
  type CloroToolOptions,
  type RawSource,
  type Source,
} from "./shared.js";

/** Options for {@link webSearch}. */
export interface WebSearchOptions extends CloroToolOptions {
  /** Maximum number of organic results to return, from 1 to 10. Default 10. */
  maxResults?: number;
  /**
   * Include the Google AI Overview when Google shows one. Default `true`.
   * The AI Overview adds 2 credits to each search.
   */
  includeAiOverview?: boolean;
}

/** One organic result from the Google results page. */
export interface WebSearchResultItem {
  position: number;
  title: string;
  link: string;
  snippet: string;
}

/** The output of the {@link webSearch} tool. */
export interface WebSearchOutput {
  query: string;
  /** The Google AI Overview, or `null` when Google shows none or you turned it off. */
  aiOverview: { text: string; sources: Source[] } | null;
  /** The top organic results, in the order Google shows them. */
  results: WebSearchResultItem[];
}

interface RawOrganicResult {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
}

interface RawGoogleResult {
  organicResults?: RawOrganicResult[];
  aioverview?: { text?: string; sources?: RawSource[] } | null;
}

/**
 * Makes a web search tool for the AI SDK. The tool sends the query to Google
 * through the cloro API and returns the AI Overview (when Google shows one)
 * and the top organic results with title, link and snippet.
 *
 * @example
 * ```ts
 * import { generateText, isStepCount } from "ai";
 * import { webSearch } from "@cloro-dev/ai-sdk";
 *
 * const { text } = await generateText({
 *   model: "openai/gpt-5-mini",
 *   prompt: "What is the boiling point of water at 2,000 meters?",
 *   tools: { webSearch: webSearch() },
 *   stopWhen: isStepCount(3),
 * });
 * ```
 */
export function webSearch(options: WebSearchOptions = {}): Tool<{ query: string }, WebSearchOutput> {
  const client = lazyClient(options.apiKey);
  const country = countryCode(options.country);
  const maxResults = Math.min(Math.max(Math.trunc(options.maxResults ?? 10), 1), 10);
  const includeAiOverview = options.includeAiOverview ?? true;

  return tool({
    description:
      "Search Google and return the AI Overview (when Google shows one) and the top organic results with title, link and snippet. " +
      "Use it for current facts, recent events and other information that can change after your training data.",
    inputSchema: z.object({
      query: z.string().min(1).describe("The search query, as you would type it into Google"),
    }),
    execute: async ({ query }): Promise<WebSearchOutput> => {
      const response = await client().monitor.google({
        query,
        country,
        ...(includeAiOverview ? { include: { aioverview: { markdown: false } } } : {}),
      });
      const result: RawGoogleResult = response?.result ?? {};

      const results: WebSearchResultItem[] = [];
      for (const row of result.organicResults ?? []) {
        if (results.length >= maxResults) break;
        if (!isUsableLink(row.link)) continue;
        results.push({
          position: row.position ?? results.length + 1,
          title: row.title ?? "",
          link: row.link,
          snippet: row.snippet ?? "",
        });
      }

      const overview = includeAiOverview ? result.aioverview : null;
      const aiOverview = overview?.text
        ? { text: overview.text, sources: toSources(overview.sources) }
        : null;

      return { query, aiOverview, results };
    },
  });
}
