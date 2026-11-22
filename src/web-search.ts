import { tool, type Tool } from "ai";
import { z } from "zod";
import { bingPromptLength, BING_PROMPT_LIMIT } from "./ai-answer.js";
import {
  countryCode,
  isUsableLink,
  lazyClient,
  toSources,
  type CloroToolOptions,
  type RawSource,
  type Source,
} from "./shared.js";

/** The search engines that {@link webSearch} can query. */
export type SearchEngine = "google" | "bing";

const SEARCH_ENGINE_NAMES: Record<SearchEngine, string> = {
  google: "Google",
  bing: "Bing",
};

/** Options for {@link webSearch}. */
export interface WebSearchOptions extends CloroToolOptions {
  /** The search engine to query. Default `"google"`. */
  engine?: SearchEngine;
  /** Maximum number of organic results to return, from 1 to 10. Default 10. */
  maxResults?: number;
  /**
   * Include the AI Overview when the search engine shows one. Default `true`.
   * The AI Overview adds 2 credits to each search.
   */
  includeAiOverview?: boolean;
}

/** One organic result from the results page. */
export interface WebSearchResultItem {
  position: number;
  title: string;
  link: string;
  snippet: string;
}

/** One ad on the results page. A field is absent when the page does not show it. */
export interface WebSearchAd {
  /** Position among the ads with the same `blockPosition` and `type`. */
  position?: number;
  /** `"top"`, `"middle"`, `"bottom"` or `"rhs"` (side rail). */
  blockPosition?: string;
  /** `"RESULT"` for a text ad, `"SHOPPING_CARD"` for a card. */
  type?: string;
  title?: string;
  link?: string;
  description?: string;
  /** The price as the page shows it. */
  price?: string;
  store?: string;
}

/** The output of the {@link webSearch} tool. */
export interface WebSearchOutput {
  query: string;
  /** The AI Overview, or `null` when the search engine shows none or you turned it off. */
  aiOverview: { text: string; sources: Source[] } | null;
  /** The top organic results, in the order the search engine shows them. */
  results: WebSearchResultItem[];
  /** The ads on the page, in page order. Empty when the page has none. */
  ads: WebSearchAd[];
}

interface RawOrganicResult {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
}

interface RawAd {
  position?: number;
  blockPosition?: string;
  type?: string;
  title?: string;
  url?: string;
  description?: string;
  price?: { raw?: string };
  store?: string;
}

// Bing Search returns the same shapes as Google Search.
interface RawSearchResult {
  organicResults?: RawOrganicResult[];
  ads?: RawAd[];
  aioverview?: { text?: string; sources?: RawSource[] } | null;
}

/** Converts raw ads to the useful fields, without empty fields. */
function toAds(raw: RawAd[] | undefined): WebSearchAd[] {
  return (raw ?? []).map(({ position, blockPosition, type, title, url, description, price, store }) => {
    const link = isUsableLink(url) ? url : undefined;
    const ad: WebSearchAd = { position, blockPosition, type, title, link, description, price: price?.raw, store };
    return Object.fromEntries(Object.entries(ad).filter(([, value]) => value));
  });
}

/**
 * Makes a web search tool for the AI SDK. The tool sends the query to Google
 * (or Bing) through the cloro API and returns the AI Overview (when the search
 * engine shows one), the top organic results with title, link and snippet, and
 * the ads on the page.
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
  const engine = options.engine ?? "google";
  const name = SEARCH_ENGINE_NAMES[engine];
  if (!name) {
    throw new Error(
      `Unknown engine "${engine}". Use one of: ${Object.keys(SEARCH_ENGINE_NAMES).join(", ")}.`,
    );
  }

  return tool({
    description:
      `Search ${name} and return the AI Overview (when ${name} shows one), the top organic results with title, link and snippet, and the ads on the page. ` +
      "Use it for current facts, recent events and other information that can change after your training data.",
    inputSchema: z.object({
      query: z.string().min(1).describe(`The search query, as you would type it into ${name}`),
    }),
    execute: async ({ query }): Promise<WebSearchOutput> => {
      const params = {
        query,
        country,
        ...(includeAiOverview ? { include: { aioverview: { markdown: false } } } : {}),
      };
      let response: { result?: RawSearchResult } | undefined;
      if (engine === "bing") {
        if (bingPromptLength(query) > BING_PROMPT_LIMIT) {
          throw new Error(
            `The query is too long for Bing Search: the limit is ${BING_PROMPT_LIMIT} characters after URL encoding. Use a shorter query.`,
          );
        }
        response = await client().monitor.bing(params);
      } else {
        response = await client().monitor.google(params);
      }
      const result: RawSearchResult = response?.result ?? {};

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

      return { query, aiOverview, results, ads: toAds(result.ads) };
    },
  });
}
