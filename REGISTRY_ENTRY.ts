// Draft entry for content/tools-registry/registry.ts in vercel/ai.
// Add it to the `tools` array. It is not part of the npm package.
//
// Before the PR:
// - Publish @cloro-dev/ai-sdk to npm (the guide requires it).
// - Publish the docs page at docsUrl. The guide wants a page that explains how
//   the tool works with the AI SDK, not a home page. The page does not exist yet.
import type { Tool } from './registry';

export const cloro: Tool = {
  slug: 'cloro',
  name: 'cloro',
  description:
    'cloro gives agents live Google search results: the AI Overview and the top organic results with title, link and snippet, for a country you choose. A second tool returns the answer of ChatGPT, Gemini, Google AI Mode or Bing AI Mode with the sources it cites.',
  packageName: '@cloro-dev/ai-sdk',
  tags: ['search', 'web-search', 'google', 'ai-overview'],
  apiKeyEnvName: 'CLORO_API_KEY',
  installCommand: {
    pnpm: 'pnpm add @cloro-dev/ai-sdk',
    npm: 'npm install @cloro-dev/ai-sdk',
    yarn: 'yarn add @cloro-dev/ai-sdk',
    bun: 'bun add @cloro-dev/ai-sdk',
  },
  codeExample: `import { generateText, isStepCount } from 'ai';
import { webSearch } from '@cloro-dev/ai-sdk';

const { text } = await generateText({
  model: 'openai/gpt-5-mini',
  prompt: 'What is the boiling point of water at 2,000 meters?',
  tools: {
    webSearch: webSearch(),
  },
  stopWhen: isStepCount(3),
});

console.log(text);`,
  docsUrl:
    'https://cloro.dev/docs/integrations/vercel-ai-sdk?utm_source=ai-sdk&utm_medium=byok',
  apiKeyUrl:
    'https://dashboard.cloro.dev/api-keys?utm_source=ai-sdk&utm_medium=byok',
  websiteUrl: 'https://cloro.dev/?utm_source=ai-sdk&utm_medium=byok',
  npmUrl: 'https://www.npmjs.com/package/@cloro-dev/ai-sdk',
};
