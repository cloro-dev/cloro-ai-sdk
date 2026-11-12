import { Cloro } from "@cloro-dev/cloro";

/** Options that every cloro tool accepts. */
export interface CloroToolOptions {
  /** Your cloro API key. If you do not set it, the tool reads `CLORO_API_KEY`. */
  apiKey?: string;
  /** ISO 3166-1 alpha-2 country code for the request, for example `"US"` or `"DE"`. Default `"US"`. */
  country?: string;
}

/** A page that a result or an answer cites. */
export interface Source {
  title: string;
  link: string;
}

/** Raw source item, as the cloro API returns it. */
export interface RawSource {
  label?: string;
  url?: string;
}

/**
 * Returns a function that makes the cloro client on the first call. The tool
 * does not read the API key before it runs, so you can make the tools before
 * the environment has the key (for example, at build time).
 */
export function lazyClient(apiKey: string | undefined): () => Cloro {
  let client: Cloro | undefined;
  return () => {
    client ??= new Cloro(apiKey ? { apiKey } : {});
    return client;
  };
}

/** Returns the country code in upper case. The default is `"US"`. */
export function countryCode(country: string | undefined): string {
  return (country ?? "US").toUpperCase();
}

/**
 * Returns true for a link that a model can open. Google can send an empty link
 * or a `google.com/goto` redirect before cloro resolves it, and Google AI Mode
 * can cite a `google.com/search` URL. These links are not useful to a model.
 */
export function isUsableLink(link: string | undefined): link is string {
  if (!link) return false;
  return !/^https?:\/\/(www\.)?google\.[a-z.]+\/(goto|search)\b/i.test(link);
}

/** Converts raw sources to `{ title, link }`, without unusable or duplicate links. */
export function toSources(raw: RawSource[] | undefined): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const item of raw ?? []) {
    if (!isUsableLink(item.url) || seen.has(item.url)) continue;
    seen.add(item.url);
    sources.push({ title: item.label ?? "", link: item.url });
  }
  return sources;
}
