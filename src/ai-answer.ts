import { tool, type Tool } from "ai";
import { z } from "zod";
import {
  countryCode,
  lazyClient,
  toSources,
  type CloroToolOptions,
  type RawSource,
  type Source,
} from "./shared.js";

/** The AI engines that {@link aiAnswer} can ask. */
export type AiEngine = "chatgpt" | "gemini" | "google-ai-mode" | "bing-ai-mode";

const ENGINE_NAMES: Record<AiEngine, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  "google-ai-mode": "Google AI Mode",
  "bing-ai-mode": "Bing AI Mode",
};

/** Bing puts the prompt in the page URL. The API refuses a longer encoded prompt. */
const BING_PROMPT_LIMIT = 3500;

/** Options for {@link aiAnswer}. */
export interface AiAnswerOptions extends CloroToolOptions {
  /** The AI engine to ask. Default `"chatgpt"`. */
  engine?: AiEngine;
}

/** The output of the {@link aiAnswer} tool. */
export interface AiAnswerOutput {
  engine: AiEngine;
  /** The answer text, as the engine shows it to a user. */
  text: string;
  /** The pages that the answer cites. */
  sources: Source[];
}

interface RawAnswer {
  text?: string;
  sources?: RawSource[];
}

/** Returns the length of the prompt as Bing encodes it in the page URL. */
export function bingPromptLength(prompt: string): number {
  return encodeURIComponent(prompt.trim()).replace(/%20/g, "+").length;
}

/**
 * Makes a tool that asks one AI engine (ChatGPT, Gemini, Google AI Mode or
 * Bing AI Mode) through the cloro API and returns its answer with the sources
 * it cites.
 *
 * @example
 * ```ts
 * import { aiAnswer } from "@cloro-dev/ai-sdk";
 *
 * const tools = { askChatGPT: aiAnswer({ engine: "chatgpt" }) };
 * ```
 */
export function aiAnswer(options: AiAnswerOptions = {}): Tool<{ prompt: string }, AiAnswerOutput> {
  const client = lazyClient(options.apiKey);
  const country = countryCode(options.country);
  const engine = options.engine ?? "chatgpt";
  const name = ENGINE_NAMES[engine];
  if (!name) {
    throw new Error(
      `Unknown engine "${engine}". Use one of: ${Object.keys(ENGINE_NAMES).join(", ")}.`,
    );
  }

  return tool({
    description:
      `Ask ${name} a question and return its answer text with the sources it cites. ` +
      `Use it to find out what ${name} tells its users about a topic, for example a brand, a product or a recent event.`,
    inputSchema: z.object({
      prompt: z.string().min(1).describe(`The question to ask ${name}`),
    }),
    execute: async ({ prompt }): Promise<AiAnswerOutput> => {
      const params = { prompt, country };
      let response: { result?: RawAnswer } | undefined;
      switch (engine) {
        case "chatgpt":
          response = await client().monitor.chatgpt(params);
          break;
        case "gemini":
          response = await client().monitor.gemini(params);
          break;
        case "google-ai-mode":
          response = await client().monitor.aimode(params);
          break;
        case "bing-ai-mode":
          if (bingPromptLength(prompt) > BING_PROMPT_LIMIT) {
            throw new Error(
              `The prompt is too long for Bing AI Mode: the limit is ${BING_PROMPT_LIMIT} characters after URL encoding. Use a shorter prompt.`,
            );
          }
          response = await client().monitor.bingAimode(params);
          break;
      }
      const result = response?.result ?? {};
      return { engine, text: result.text ?? "", sources: toSources(result.sources) };
    },
  });
}
