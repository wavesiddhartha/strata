import * as cheerio from "cheerio";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const USER_AGENT =
  "Mozilla/5.0 (compatible; StrataResearchBot/1.0; +https://github.com/wavesiddhartha)";

/**
 * Real web search with no API key — uses DuckDuckGo's HTML endpoint
 * (html.duckduckgo.com/html/), which is meant for lightweight/no-JS
 * clients and doesn't require registration. This is the one piece that
 * makes "Research" actually research rather than the model guessing from
 * training data — see STRATA_NOTEBOOK_PLAN.md §2 for why this matters.
 *
 * Honest tradeoff: this is an unofficial, undocumented endpoint. It can
 * change shape or rate-limit without notice. If this starts failing in
 * practice, swap in a paid search API (Brave Search API, Tavily, or
 * SerpAPI all have straightforward drop-in equivalents) — everything
 * downstream of `webSearch()` only depends on the SearchResult shape.
 */
export async function webSearch(query: string, limit = 4): Promise<SearchResult[]> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    method: "GET",
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Search request failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];

  $(".result").each((_, el) => {
    if (results.length >= limit) return;
    const anchor = $(el).find(".result__a").first();
    const title = anchor.text().trim();
    const url = decodeDuckDuckGoRedirect(anchor.attr("href") ?? "");
    const snippet = $(el).find(".result__snippet").text().trim();
    if (title && url) results.push({ title, url, snippet });
  });

  return results;
}

// DuckDuckGo's HTML results link out through a redirect like
// //duckduckgo.com/l/?uddg=<encoded target>&rut=... — the real URL is the
// uddg query param.
function decodeDuckDuckGoRedirect(href: string): string {
  try {
    const url = new URL(href, "https://duckduckgo.com");
    const target = url.searchParams.get("uddg");
    return target ? decodeURIComponent(target) : href;
  } catch {
    return href;
  }
}

/** Fetches a page and strips it down to readable body text, truncated. */
export async function fetchPageText(url: string, maxChars = 2500): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Fetch failed: HTTP ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, svg, form").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return text.slice(0, maxChars);
}
