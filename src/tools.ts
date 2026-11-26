/**
 * Newtation AI SEO tool implementations.
 * Deterministic: every tool fetches public pages and computes its result; no LLM calls.
 */

// ─── Math & NLP Helpers ──────────────────────────────────────────────────────

const STOP_WORDS = new Set(["the","and","are","for","with","this","that","from","your","you","our","can","has","have","was","will","but","they","all","not","how","what","who","which","when","why","out","about","more","their","there","here","some","any","into","just","like"]);

function countSyllables(word: string): number {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const match = word.match(/[aeiouy]{1,2}/g);
  return match ? match.length : 1;
}

function getReadability(text: string) {
  const sentences = text.split(/[.!?]+/).filter(Boolean).length || 1;
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length || 1;
  const syllables = words.reduce((acc, word) => acc + countSyllables(word), 0);
  const score = 0.39 * (wordCount / sentences) + 11.8 * (syllables / wordCount) - 15.59;
  const gradeLevel = Math.max(0, Math.round(score * 10) / 10);
  
  let difficulty = "Standard";
  if (gradeLevel < 6) difficulty = "Very Easy";
  else if (gradeLevel > 12) difficulty = "Hard (Academic/Technical)";
  else if (gradeLevel > 9) difficulty = "Moderate";
  
  return { grade_level: gradeLevel, difficulty };
}

function getNGrams(text: string, n: number, limit: number = 5) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const grams: Record<string, number> = {};
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n).join(' ');
    grams[gram] = (grams[gram] || 0) + 1;
  }
  return Object.entries(grams)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(g => ({ phrase: g[0], count: g[1] }));
}

function getCosineSimilarity(text1: string, text2: string) {
  const getFreq = (text: string) => {
    const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    const freq: Record<string, number> = {};
    words.forEach(w => freq[w] = (freq[w] || 0) + 1);
    return freq;
  };
  const freq1 = getFreq(text1);
  const freq2 = getFreq(text2);
  const allWords = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);
  
  let dotProduct = 0, mag1 = 0, mag2 = 0;
  allWords.forEach(w => {
    const v1 = freq1[w] || 0;
    const v2 = freq2[w] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

// ─── Fetching Helpers ────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15000;
const DEFAULT_UA = "Mozilla/5.0 (compatible; NewtationBot/2.0; +https://newtation.ai)";

/**
 * Normalizes a user-supplied URL and rejects ones that can't be a public website.
 * Throws an Error whose message tells the caller how to fix the input.
 */
export function normalizeUrl(input: string): URL {
  const raw = (input ?? "").trim();
  if (!raw) throw new Error("No URL provided. Pass a public website URL such as https://example.com.");
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error(`"${raw}" is not a valid URL. Pass a public website URL such as https://example.com.`);
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Only http and https URLs are supported (got ${parsed.protocol}).`);
  }
  if (
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host) ||
    host.startsWith("[")
  ) {
    throw new Error(`"${host}" is not a public website. These tools only audit publicly reachable sites.`);
  }
  return parsed;
}

async function fetchHtml(
  url: string,
  userAgent: string = DEFAULT_UA,
): Promise<{ html: string; ttfb: number; totalTime: number; size: number; status: number; headers: Headers; finalUrl: string }> {
  const start = Date.now();
  const reqUrl = normalizeUrl(url).href;

  let response: Response;
  try {
    response = await fetch(reqUrl, {
      headers: {
        "User-Agent": userAgent,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e: any) {
    const reason = e?.name === "TimeoutError" ? `no response within ${FETCH_TIMEOUT_MS / 1000}s` : e?.message ?? "network error";
    throw new Error(`Could not reach ${reqUrl} (${reason}). Check the URL is public and spelled correctly.`);
  }

  const ttfb = Date.now() - start;
  const html = await response.text();
  const totalTime = Date.now() - start;

  return { html, ttfb, totalTime, size: html.length, status: response.status, headers: response.headers, finalUrl: response.url || reqUrl };
}

/** fetchHtml that throws an actionable error on HTTP 4xx/5xx or a non-HTML response. */
async function fetchOk(url: string) {
  const res = await fetchHtml(url);
  if (res.status >= 400) {
    const hint = res.status === 403 || res.status === 429
      ? " The site may be blocking automated requests (bot protection or a firewall), which AI crawlers often hit too."
      : res.status === 404 ? " Check the page path is correct." : "";
    throw new Error(`HTTP ${res.status} fetching ${res.finalUrl}.${hint}`);
  }
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (type && !/html|xml/.test(type)) {
    throw new Error(`${res.finalUrl} is not a web page (it returned ${type}). Pass the URL of an HTML page.`);
  }
  return res;
}

/** Escapes text for use inside a RegExp, in a form that is also valid with the "u" flag. */
function escapeRegex(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|\/]/g, "\\$&");
}

/** True when robots directives (meta robots or X-Robots-Tag) say noindex. "none" counts as a directive, not as the value in "max-image-preview:none". */
export function hasNoindex(directives: string): boolean {
  return /\bnoindex\b|(?<!max-image-preview:\s*)\bnone\b/i.test(directives);
}

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, " ");
}

function extractText(html: string): string {
  const noScripts = stripScriptsAndStyles(html);
  const bodyMatch = noScripts.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1] : noScripts;
  return decodeEntities(bodyHtml.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function getWordCount(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function getKeywordDensity(text: string, keyword: string): { count: number; density: string } {
  if (!keyword) return { count: 0, density: "0.00%" };
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;
  if (totalWords === 0) return { count: 0, density: "0.00%" };
  
  // Letter/digit lookarounds instead of \b, so keywords ending in symbols ("C++", "C#") still match.
  const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(keyword)}(?![\\p{L}\\p{N}])`, 'giu');
  const matches = text.match(regex);
  const count = matches ? matches.length : 0;
  
  return { count, density: ((count / totalWords) * 100).toFixed(2) + "%" };
}

// Scans each <meta> tag on its own; a document-wide lazy regex goes quadratic on large pages.
function extractMetaMatch(html: string, name: string): string {
  const target = name.toLowerCase();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = m[0].match(/\b(?:name|property)\s*=\s*["']([^"']*)["']/i);
    if (!key || key[1].toLowerCase() !== target) continue;
    const content = m[0].match(/\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const value = content ? (content[1] ?? content[2] ?? "") : "";
    if (value) return value;
  }
  return "Missing";
}

// ─── 1. analyze_onpage_seo ───────────────────────────────────────────────────

export async function analyzeOnpageSeo(args: { url: string; target_keyword?: string }): Promise<string> {
  const { url, target_keyword } = args;
  try {
    const { html, status } = await fetchHtml(url);
    if (status >= 400) return JSON.stringify({ error: `HTTP ${status} fetching URL` });

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "Missing";
    const desc = extractMetaMatch(html, "description");

    const h1s = Array.from(html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map(m => m[1].replace(/<[^>]+>/g, "").trim());
    const h2s = Array.from(html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)).map(m => m[1].replace(/<[^>]+>/g, "").trim());
    
    const text = extractText(html);
    const wordCount = getWordCount(text);
    const keywordStats = target_keyword ? getKeywordDensity(text, target_keyword) : null;
    const readability = getReadability(text);
    
    // N-Grams
    const bigrams = getNGrams(text, 2, 5);
    const trigrams = getNGrams(text, 3, 5);

    let keywordInTitle = false;
    let keywordInH1 = false;
    if (target_keyword) {
      const kwRegex = new RegExp(escapeRegex(target_keyword), "i");
      keywordInTitle = kwRegex.test(title);
      keywordInH1 = h1s.some(h1 => kwRegex.test(h1));
    }

    return JSON.stringify({
      url,
      status,
      title: { text: title, length: title.length, keyword_present: keywordInTitle },
      meta_description: { text: desc, length: desc.length },
      headings: {
        h1_count: h1s.length,
        h1_texts: h1s,
        h1_keyword_present: keywordInH1,
        h2_count: h2s.length,
        h2_texts: h2s.slice(0, 5)
      },
      content: {
        word_count: wordCount,
        readability: readability,
        target_keyword: target_keyword || "None provided",
        keyword_density: keywordStats,
        semantic_topics: {
          top_bigrams: bigrams,
          top_trigrams: trigrams
        }
      }
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── 2. extract_and_validate_schema ──────────────────────────────────────────

export async function extractAndValidateSchema(args: { url: string }): Promise<string> {
  try {
    const { html } = await fetchOk(args.url);
    const scriptMatches = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));
    
    const schemas: any[] = [];
    const typesFound: string[] = [];

    for (const match of scriptMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        schemas.push(parsed);
        if (Array.isArray(parsed)) {
          parsed.forEach(p => { if (p["@type"]) typesFound.push(p["@type"]); });
        } else if (parsed["@type"]) {
          typesFound.push(parsed["@type"]);
        } else if (parsed["@graph"]) {
          parsed["@graph"].forEach((g: any) => { if (g["@type"]) typesFound.push(g["@type"]); });
        }
      } catch (e) {
        // invalid block
      }
    }

    return JSON.stringify({
      url: args.url,
      schema_blocks_found: scriptMatches.length,
      valid_blocks_parsed: schemas.length,
      schema_types_detected: Array.from(new Set(typesFound)),
      raw_schemas: schemas.slice(0, 3)
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── 3. generate_missing_schema ──────────────────────────────────────────────

export const SUPPORTED_SCHEMA_TYPES = ["Organization", "WebSite", "FAQPage"] as const;

export function generateMissingSchema(args: {
  brand_name: string;
  url: string;
  description: string;
  missing_types: string[];
  logo_url?: string;
  same_as?: string[];
  faqs?: { question: string; answer: string }[];
}): string {
  const { brand_name, description, missing_types } = args;
  try {
    const site = normalizeUrl(args.url);
    const root = `${site.origin}/`;
    const orgId = `${root}#organization`;
    const websiteId = `${root}#website`;

    const requested = new Set(missing_types.map((t) => t.trim().toLowerCase()));
    const unsupported = missing_types.filter((t) => !SUPPORTED_SCHEMA_TYPES.some((s) => s.toLowerCase() === t.trim().toLowerCase()));
    const graph: any[] = [];
    const todo: string[] = [];

    if (requested.has("organization")) {
      const org: any = {
        "@type": "Organization",
        "@id": orgId,
        "name": brand_name,
        "url": root,
        "description": description,
      };
      if (args.logo_url) org.logo = normalizeUrl(args.logo_url).href;
      else todo.push("Add a \"logo\" URL to Organization (a square PNG/SVG of your logo) — AI engines and Google use it for brand panels.");
      const sameAs = (args.same_as ?? []).map((u) => u.trim()).filter(Boolean);
      if (sameAs.length) org.sameAs = sameAs;
      else todo.push("Add \"sameAs\" links to your official profiles (LinkedIn, Crunchbase, Wikipedia/Wikidata, X, YouTube). This is the strongest signal AI uses to recognise you as one entity.");
      graph.push(org);
    }

    if (requested.has("website")) {
      graph.push({
        "@type": "WebSite",
        "@id": websiteId,
        "url": root,
        "name": brand_name,
        "publisher": { "@id": orgId },
      });
    }

    if (requested.has("faqpage")) {
      const faqs = args.faqs?.length ? args.faqs : [{ question: `What is ${brand_name}?`, answer: description }];
      if (!args.faqs?.length) todo.push("Only one placeholder question was generated. Pass real customer questions in `faqs` — FAQ answers are among the passages AI engines quote most.");
      graph.push({
        "@type": "FAQPage",
        "@id": `${root}#faq`,
        "isPartOf": { "@id": websiteId },
        "mainEntity": faqs.map((f) => ({
          "@type": "Question",
          "name": f.question,
          "acceptedAnswer": { "@type": "Answer", "text": f.answer },
        })),
      });
    }

    if (graph.length === 0) {
      return JSON.stringify({
        error: `None of the requested types are supported. Supported types: ${SUPPORTED_SCHEMA_TYPES.join(", ")}.`,
      });
    }

    const schema = { "@context": "https://schema.org", "@graph": graph };
    return JSON.stringify({
      instructions: "Paste this inside a <script type=\"application/ld+json\"> tag in the <head> of your homepage. FAQPage belongs on the page that actually shows those questions and answers.",
      schema_generated: schema,
      paste_ready_html: `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`,
      ...(todo.length ? { to_complete: todo } : {}),
      ...(unsupported.length ? { skipped_types: unsupported, note: `Supported types: ${SUPPORTED_SCHEMA_TYPES.join(", ")}.` } : {}),
      validate_with: "https://validator.schema.org/",
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── 4. analyze_internal_links ───────────────────────────────────────────────

export async function analyzeInternalLinks(args: { url: string }): Promise<string> {
  try {
    const { html } = await fetchOk(args.url);
    const domain = normalizeUrl(args.url).hostname;
    
    const linkMatches = Array.from(html.matchAll(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
    
    let internalCount = 0;
    let externalCount = 0;
    const internalAnchors: string[] = [];

    for (const match of linkMatches) {
      const href = match[1];
      const anchor = match[2].replace(/<[^>]+>/g, "").trim();
      if (!href || href.startsWith("javascript:") || href.startsWith("mailto:")) continue;

      if (href.startsWith("/") || href.includes(domain)) {
        internalCount++;
        if (anchor && anchor.length > 2) internalAnchors.push(anchor);
      } else if (href.startsWith("http")) {
        externalCount++;
      }
    }

    const anchorFreq = internalAnchors.reduce((acc, curr) => {
      acc[curr] = (acc[curr] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topAnchors = Object.entries(anchorFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(entry => ({ anchor: entry[0], count: entry[1] }));

    return JSON.stringify({
      url: args.url,
      links: {
        total_internal: internalCount,
        total_external: externalCount,
        internal_to_external_ratio: externalCount === 0 ? "100% internal" : (internalCount / externalCount).toFixed(2)
      },
      top_internal_anchors: topAnchors
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── 5. check_technical_fundamentals ─────────────────────────────────────────

export async function checkTechnicalFundamentals(args: { url: string }): Promise<string> {
  try {
    const { html, status } = await fetchHtml(args.url);
    
    const robots = extractMetaMatch(html, "robots");
    const viewport = extractMetaMatch(html, "viewport");
    
    let canonical = "Missing";
    const canMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["'](.*?)["']/i);
    if (canMatch) canonical = canMatch[1];
    
    const hasLang = /<html[^>]*lang=["'](.*?)["']/i.test(html);

    // OpenGraph & Twitter Cards
    const ogTitle = extractMetaMatch(html, "og:title");
    const ogImage = extractMetaMatch(html, "og:image");
    const twitterCard = extractMetaMatch(html, "twitter:card");

    return JSON.stringify({
      url: args.url,
      http_status: status,
      indexability: {
        robots_meta: robots !== "Missing" ? robots : "Not explicitly defined (defaults to index, follow)",
        is_indexable: !robots.toLowerCase().includes("noindex")
      },
      canonical_tag: canonical,
      mobile_friendly: {
        viewport_meta_present: viewport !== "Missing",
        viewport_value: viewport
      },
      accessibility: { html_lang_present: hasLang },
      social_graph: {
        og_title_present: ogTitle !== "Missing",
        og_image_present: ogImage !== "Missing",
        twitter_card_present: twitterCard !== "Missing"
      }
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── 6. simulate_llm_crawler ─────────────────────────────────────────────────

/**
 * Most AI crawlers (GPTBot, ClaudeBot, PerplexityBot, CCBot) fetch raw HTML and do not run
 * JavaScript. A page whose content only appears after JS runs is close to invisible to them.
 */
function assessJsDependency(html: string, visibleWords: number) {
  const emptyAppRoot = /<div[^>]+id=["'](root|app|__next|__nuxt|svelte|q-app)["'][^>]*>\s*<\/div>/i.test(html);
  const scriptCount = (html.match(/<script\b/gi) ?? []).length;
  const enableJsNotice = /<noscript[^>]*>[\s\S]{0,300}?(enable|turn on)\s+javascript/i.test(html);
  const signals: string[] = [];
  if (emptyAppRoot) signals.push("Empty app root element (<div id=\"root\"> etc.) — content is injected by JavaScript");
  if (enableJsNotice) signals.push("<noscript> notice asking visitors to enable JavaScript");
  if (visibleWords < 150) signals.push(`Only ${visibleWords} words of readable text in the raw HTML`);
  if (scriptCount >= 15) signals.push(`${scriptCount} <script> tags`);

  const risk = (emptyAppRoot || enableJsNotice) && visibleWords < 250 ? "HIGH"
    : visibleWords < 100 ? "HIGH"
    : visibleWords < 250 && scriptCount >= 10 ? "MEDIUM"
    : "LOW";

  return {
    risk,
    signals,
    meaning: risk === "LOW"
      ? "Content is present in the raw HTML, so AI crawlers that don't run JavaScript can read it."
      : "AI crawlers such as GPTBot, ClaudeBot and PerplexityBot generally do not run JavaScript. They likely see little or none of this page's content, so they can't learn from it or cite it.",
    ...(risk === "LOW" ? {} : {
      fix: "Serve the main content as HTML from the server: enable server-side rendering or static pre-rendering (e.g. Next.js SSR/SSG, Nuxt SSR, Astro, or a prerender service). Check the result by viewing the page source (not the inspector) and confirming the text is there.",
    }),
  };
}

export async function simulateLlmCrawler(args: { url: string }): Promise<string> {
  try {
    const { html } = await fetchOk(args.url);
    const noScripts = stripScriptsAndStyles(html);
    
    const bodyMatch = noScripts.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let content = bodyMatch ? bodyMatch[1] : noScripts;
    
    content = content.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
    content = content.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
    content = content.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
    content = content.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");
    content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");
    content = content.replace(/<[^>]+>/g, "");
    content = content.replace(/\n\s*\n/g, "\n\n").trim();

    const wordCount = getWordCount(content);
    const estimatedTokens = Math.ceil(wordCount * 1.3);
    const jsDependency = assessJsDependency(html, wordCount);

    return JSON.stringify({
      url: args.url,
      javascript_dependency: jsDependency,
      llm_context_usage: {
        estimated_llm_tokens: estimatedTokens,
        context_window_fit: estimatedTokens < 8000 ? "Fits perfectly in all models" : estimatedTokens < 100000 ? "Fits in Claude/GPT-4" : "Too large, will be truncated"
      },
      warning: "This is how AI models (like ChatGPT or Claude) 'see' your page when they crawl it. If it looks empty, you have a client-side rendering issue.",
      crawled_text_preview: content.substring(0, 1500) + (content.length > 1500 ? "\n\n...[TRUNCATED]" : "")
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── 7. measure_page_response ────────────────────────────────────────────────

export async function measurePageResponse(args: { url: string }): Promise<string> {
  try {
    const { ttfb, totalTime, size, status } = await fetchHtml(args.url);
    return JSON.stringify({
      url: args.url,
      http_status: status,
      performance: {
        time_to_first_byte_ms: ttfb,
        total_fetch_time_ms: totalTime,
        html_payload_size_kb: (size / 1024).toFixed(2),
        speed_rating: ttfb < 300 ? "Excellent" : ttfb < 800 ? "Fair" : "Poor"
      }
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── score_ai_answer (Live AI Perception Test) ──────────────────────────────

const BOILERPLATE_WORDS = new Set(["cookie","cookies","privacy","policy","terms","conditions","login","signin","signup","subscribe","newsletter","copyright","rights","reserved","browser","javascript","menu","skip","learn","explore","started","start","request","demo","contact","download","click","browse","accept","manage","preferences","settings","help","support","blog","careers","company","product","products","features","pricing","page","website","email","today","join","read","were","been","being","also","other","every","each","them","then","than","only","over","under","after","before","because","during","without","within","across","between","through","does","doing","done","gets","getting","goes","going","know","knows","still","even","much","many","very","well","back","down","right","where","here","play","best","new","get","see","use","using","make","makes","made","take","need","want","free","really","things","thing","beyond","already","instantly","everything","anything","ever"]);

const NON_ENTITY_WORDS = new Set(["I","It","Its","The","They","Their","This","That","These","Those","However","While","Although","If","In","On","At","As","For","With","Also","Some","Many","Most","AI","Their","There","Overall","Additionally","Founded","Known","Based","Would","Yes","No"]);

function lightStem(w: string): string {
  return w.length > 4 ? w.replace(/(ing|ers|ies|ed|es|s)$/, "") : w;
}

function contentWords(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w) && !BOILERPLATE_WORDS.has(w));
}

// Returns display words (most frequent original form), keyed internally by stem.
function getTopKeywords(text: string, limit: number): { stem: string; display: string }[] {
  const freq: Record<string, number> = {};
  const originals: Record<string, Record<string, number>> = {};
  contentWords(text).forEach(w => {
    const s = lightStem(w);
    freq[s] = (freq[s] || 0) + 1;
    originals[s] = originals[s] || {};
    originals[s][w] = (originals[s][w] || 0) + 1;
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([stem]) => ({
      stem,
      display: Object.entries(originals[stem]).sort((a, b) => b[1] - a[1])[0][0],
    }));
}

// Multi-word capitalized sequences (skipping sentence-initial single words), years, and number+unit figures.
function extractEntities(answer: string, brandName: string): string[] {
  const entities = new Set<string>();
  const brandLower = brandName.toLowerCase();
  for (const sentence of answer.split(/(?<=[.!?])\s+/)) {
    const tokens = sentence.split(/\s+/);
    let run: string[] = [];
    tokens.forEach((raw, i) => {
      const tok = raw.replace(/[^A-Za-z0-9'&.-]/g, "").replace(/[.,]+$/, "");
      const isCap = /^[A-Z][A-Za-z0-9'&.-]*$/.test(tok) && tok.length > 1 && !NON_ENTITY_WORDS.has(tok);
      if (isCap && !(i === 0 && run.length === 0 && !/^[A-Z][a-z]*[A-Z]/.test(tok) && tokens.length > 1 && !/^[A-Z]/.test(tokens[1] ?? ""))) {
        run.push(tok);
        // List separators ("Evernote, Coda, and Asana") end the current entity
        if (/[,;:]$/.test(raw.trim())) {
          entities.add(run.join(" "));
          run = [];
        }
      } else {
        if (run.length) entities.add(run.join(" "));
        run = [];
      }
    });
    if (run.length) entities.add(run.join(" "));
  }
  for (const m of answer.match(/\b(19|20)\d{2}\b/g) ?? []) entities.add(m);
  for (const m of answer.match(/\b\d[\d,]*(\.\d+)?\s*(%|(million|billion|thousand|users|customers|employees|countries)\b)/gi) ?? []) entities.add(m.trim());
  for (const m of answer.match(/[$€£₹]\s?\d[\d,]*(\.\d+)?/g) ?? []) entities.add(m.replace(/\s/g, ""));
  return [...entities].filter(e => !e.toLowerCase().includes(brandLower) && !brandLower.includes(e.toLowerCase()));
}

function detectNotRecognized(text: string): boolean {
  return /\b(don'?t|do not|cannot|can'?t|not)\b.{0,50}\b(know|familiar|information|aware|confident|certain)\b|no (reliable |specific )?(information|data|knowledge)|couldn'?t find|unable to (find|verify)/i.test(text);
}

/** True when the answer opens by saying it doesn't know, with no "but…" that goes on to state something. */
function opensWithNotKnowing(answer: string): boolean {
  const firstSentence = answer.split(/(?<=[.!?])\s+/)[0];
  return detectNotRecognized(firstSentence) && !/\b(but|however|though|although|that said)\b/i.test(answer);
}

export async function scoreAiAnswer(args: { ai_answer: string; url: string; brand_name: string }): Promise<string> {
  const { ai_answer, url, brand_name } = args;
  try {
    const base = normalizeUrl(url);
    const [main, about] = await Promise.allSettled([
      fetchHtml(base.href),
      fetchHtml(`${base.origin}/about`),
    ]);
    if (main.status === "rejected") return JSON.stringify({ error: main.reason?.message ?? "Failed to fetch ground-truth URL" });
    if (main.value.status >= 400) return JSON.stringify({ error: `HTTP ${main.value.status} fetching ground-truth URL` });

    let truthText = extractText(main.value.html);
    const sources = [base.href];
    if (about.status === "fulfilled" && about.value.status === 200) {
      truthText += " " + extractText(about.value.html);
      sources.push(`${base.origin}/about`);
    }
    const truthLower = truthText.toLowerCase();
    const answerLower = ai_answer.toLowerCase();

    // 0. Did the AI recognize the brand at all?
    const notRecognized = opensWithNotKnowing(ai_answer);

    const brandMentions = (answerLower.match(new RegExp(brand_name.toLowerCase().replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "g")) || []).length;

    if (notRecognized) {
      return JSON.stringify({
        brand: brand_name,
        ground_truth_sources: sources,
        ai_recognition: "NOT RECOGNIZED — the AI does not know this brand",
        ai_knowledge_score: "5/100",
        interpretation: "This is the most important finding possible: the brand is effectively invisible to this AI. Users asking about your category will only hear about competitors.",
        recommended_actions: [
          "Establish entity foundations: Organization schema markup (use generate_missing_schema), consistent name/description across the site",
          "Get listed on high-authority sources AI models train on: Wikipedia/Wikidata (if notable), Crunchbase, G2, industry directories",
          "Publish definitional content: a clear 'What is " + brand_name + "?' page with crawlable, citeable copy",
          "Run check_ai_crawler_access basics: verify robots.txt is not blocking GPTBot/ClaudeBot so future crawls can learn the brand",
        ],
      }, null, 2);
    }

    // 1. Topic coverage — word-level with light stemming so phrasing differences don't matter
    const answerStems = new Set(contentWords(ai_answer).map(lightStem));
    const truthKeywords = getTopKeywords(truthText, 12);

    // Dedupe sliding-window bigrams: skip any that share a word with one already kept
    const truthBigrams: string[] = [];
    const usedWords = new Set<string>();
    for (const g of getNGrams(truthText, 2, 30)) {
      const words = g.phrase.split(" ");
      if (words.some(w => BOILERPLATE_WORDS.has(w) || usedWords.has(lightStem(w)))) continue;
      if (words.every(w => /^\d+$/.test(w))) continue; // number runs (sample card numbers, phone numbers) aren't topics
      truthBigrams.push(g.phrase);
      words.forEach(w => usedWords.add(lightStem(w)));
      if (truthBigrams.length >= 8) break;
    }

    // Drop single keywords already represented inside a kept bigram
    const dedupedKeywords = truthKeywords.filter(k => !usedWords.has(k.stem));
    const knownKeywords = dedupedKeywords.filter(k => answerStems.has(k.stem)).map(k => k.display);
    const missingKeywords = dedupedKeywords.filter(k => !answerStems.has(k.stem)).map(k => k.display);
    const knownBigrams = truthBigrams.filter(b => b.split(" ").every(w => answerStems.has(lightStem(w))));
    const missingBigrams = truthBigrams.filter(b => !b.split(" ").every(w => answerStems.has(lightStem(w))));
    const totalTopics = dedupedKeywords.length + truthBigrams.length;
    const coverage = totalTopics ? (knownKeywords.length + knownBigrams.length) / totalTopics : 0;

    // 2. Semantic alignment — holistic vocabulary overlap (cosine), normalized against
    // the ~0.25 ceiling a good one-paragraph summary reaches vs. a full page
    const cosine = getCosineSimilarity(ai_answer, truthText);
    const alignment = Math.min(1, cosine / 0.25);

    // 3. Entity fact-check: names/years/figures the AI stated, verified against the site
    const entities = extractEntities(ai_answer, brand_name);
    const verified = entities.filter(e => truthLower.includes(e.toLowerCase()));
    const unverified = entities.filter(e => !truthLower.includes(e.toLowerCase()));
    const entityRatio = entities.length ? verified.length / entities.length : 0.5;

    // Entities named in a competitive context get comparison-content advice, not fact-check advice
    const competitors = new Set<string>();
    for (const sentence of ai_answer.split(/(?<=[.!?])\s+/)) {
      if (/competitor|alternative|rival|versus|\bvs\b|compared? (to|with)|similar (to|tool|product)/i.test(sentence)) {
        for (const e of entities) if (e.length > 2 && sentence.includes(e)) competitors.add(e);
      }
    }
    const unverifiedFacts = unverified.filter(e => !competitors.has(e));

    const score = Math.min(100, Math.round(coverage * 40 + alignment * 40 + entityRatio * 20));

    const actions: string[] = [];
    for (const t of [...missingBigrams, ...missingKeywords].slice(0, 3)) {
      actions.push(`AI never mentioned "${t}" — one of your site's core topics. Publish crawlable, citeable content that ties ${brand_name} to it.`);
    }
    if (competitors.size > 0) {
      actions.push(`AI associates you with: ${[...competitors].join(", ")}. Publish comparison content ("${brand_name} vs ${[...competitors][0]}") to control that narrative instead of letting AI write it for you.`);
    }
    for (const e of unverifiedFacts.slice(0, 3)) {
      actions.push(`AI claims "${e}" but your site never confirms it. If TRUE: state it on your site so AI answers stay verifiable. If FALSE: it's a hallucination — publish authoritative corrections.`);
    }
    if (brandMentions < 2) actions.push("AI barely names the brand in its own answer — strengthen entity clarity (Organization schema, consistent brand naming).");

    return JSON.stringify({
      brand: brand_name,
      ground_truth_sources: sources,
      ai_recognition: "Recognized",
      ai_knowledge_score: `${score}/100`,
      score_breakdown: {
        topic_coverage: `${(coverage * 100).toFixed(0)}% of your site's core topics (${Math.round(coverage * 40)}/40 pts)`,
        semantic_alignment: `${(alignment * 100).toFixed(0)}% vocabulary alignment with your site (${Math.round(alignment * 40)}/40 pts)`,
        fact_verification: `${verified.length}/${entities.length} specific claims verified on your site (${Math.round(entityRatio * 20)}/20 pts)`,
      },
      topics: {
        ai_knows: [...knownBigrams, ...knownKeywords],
        ai_is_missing: [...missingBigrams, ...missingKeywords],
      },
      knowledge_lag: (() => {
        const bigramCoverage = truthBigrams.length ? knownBigrams.length / truthBigrams.length : 1;
        return {
          note: "Multi-word topics represent your site's CURRENT positioning. If AI misses them while knowing older single-word basics, its model of your brand is stale (training-data lag).",
          lag_severity: bigramCoverage >= 0.5 ? "Low — AI's model of the brand is reasonably current" : bigramCoverage >= 0.25 ? "Moderate — AI is roughly a product cycle behind your positioning" : "Severe — AI describes an outdated version of the brand",
          current_positioning_ai_has_not_absorbed: missingBigrams,
          fix: "AI models learn from wide, repeated coverage. Get the missing positioning into third-party content (launch posts, reviews, directories, press) — not just your own site.",
        };
      })(),
      fact_check: {
        note: "Specific names, years, and figures the AI stated. 'Unverified' means your site doesn't confirm them — they may still be true (verify manually), or they may be hallucinations.",
        verified_on_your_site: verified,
        not_verifiable_from_your_site: unverifiedFacts,
        competitors_ai_associates_with_you: [...competitors],
      },
      brand_mentions_in_answer: brandMentions,
      recommended_actions: actions,
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── verify_brand_facts (Hallucination Stress Test) ─────────────────────────

/** An answer that hedges but still states specifics ("I'm not certain, but…") is a claim to check, not a knowledge gap. */
function admitsNotKnowing(answer: string, entities: string[]): boolean {
  if (!detectNotRecognized(answer)) return false;
  return entities.length === 0 || opensWithNotKnowing(answer);
}

const MAX_EXTRA_PAGES = 5;

export async function verifyBrandFacts(args: {
  url: string;
  brand_name: string;
  qa_pairs: { question: string; answer: string }[];
  extra_pages?: string[];
}): Promise<string> {
  const { url, brand_name, qa_pairs } = args;
  try {
    const base = normalizeUrl(url);
    const extraPages = (args.extra_pages ?? []).slice(0, MAX_EXTRA_PAGES).map((u) => normalizeUrl(u).href);
    const paths = [...new Set([base.href, `${base.origin}/about`, `${base.origin}/pricing`, ...extraPages])];
    const pages = await Promise.allSettled(paths.map((p) => fetchHtml(p)));
    const sources: string[] = [];
    let truthText = "";
    pages.forEach((p, i) => {
      if (p.status === "fulfilled" && p.value.status === 200) {
        truthText += " " + extractText(p.value.html);
        sources.push(paths[i]);
      }
    });
    const extraNotLoaded = extraPages.filter((p) => !sources.includes(p));
    if (!truthText.trim()) return JSON.stringify({ error: "Could not fetch any ground-truth pages from " + base.origin });
    const truthLower = truthText.toLowerCase();

    let unverifiedTotal = 0;
    let dontKnowCount = 0;
    const allUnverified: string[] = [];

    const results = qa_pairs.map(({ question, answer }) => {
      const entities = extractEntities(answer, brand_name);
      if (admitsNotKnowing(answer, entities)) {
        dontKnowCount++;
        return {
          question,
          status: "AI ADMITS IT DOESN'T KNOW",
          risk: "Knowledge gap — prospects asking this get nothing (or a competitor).",
        };
      }
      const verified = entities.filter(e => truthLower.includes(e.toLowerCase()));
      const unverified = entities.filter(e => !truthLower.includes(e.toLowerCase()));
      unverifiedTotal += unverified.length;
      allUnverified.push(...unverified);
      return {
        question,
        status: entities.length === 0 ? "NO SPECIFIC CLAIMS MADE" : unverified.length === 0 ? "FULLY GROUNDED" : "CONTAINS UNVERIFIED CLAIMS",
        claims_verified_on_your_site: verified,
        claims_your_site_does_not_confirm: unverified,
      };
    });

    const flaggedCount = results.filter(r => r.status === "CONTAINS UNVERIFIED CLAIMS").length;
    const riskLevel =
      flaggedCount > 0 ? `NEEDS REVIEW — ${flaggedCount} of ${qa_pairs.length} answers state names, dates or figures that the pages checked don't confirm. Each may be true but not published on those pages, or a hallucination; check them one by one`
      : dontKnowCount >= qa_pairs.length * 0.5 ? "KNOWLEDGE GAP — AI knows too little to hallucinate; you're invisible on key questions"
      : "LOW — AI's answers stay grounded in verifiable facts";

    const actions: string[] = [];
    if (allUnverified.length) {
      actions.push(`Publish or confirm these facts on your site so AI claims become verifiable: ${[...new Set(allUnverified)].slice(0, 6).join(", ")}. Any that are FALSE need authoritative corrections (press, updated About page, Wikidata).`);
    }
    if (dontKnowCount > 0) {
      actions.push(`AI drew a blank on ${dontKnowCount} question(s) — publish clear, crawlable pages answering exactly those questions (FAQ schema helps).`);
    }
    if (flaggedCount === 0 && dontKnowCount === 0) {
      actions.push("Answers are well grounded. Re-run quarterly — AI knowledge drifts with every model release.");
    }

    return JSON.stringify({
      brand: brand_name,
      ground_truth_sources: sources,
      ...(extraNotLoaded.length ? { extra_pages_not_loaded: extraNotLoaded } : {}),
      hallucination_risk: riskLevel,
      ...(flaggedCount > 0 ? {
        next_step: `Only the pages in ground_truth_sources were checked, and these facts may be published elsewhere on the site. Ask the user which pages state them (for example a company, team, contact, press or FAQ page), then call verify_brand_facts again with those URLs in extra_pages (up to ${MAX_EXTRA_PAGES}).`,
      } : {}),
      questions_tested: qa_pairs.length,
      questions_with_unverified_claims: flaggedCount,
      questions_ai_could_not_answer: dontKnowCount,
      note: "'Unverified' means your site doesn't confirm the claim — verify manually whether each is true (then publish it) or false (then correct it publicly).",
      results,
      recommended_actions: actions,
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── generate_llms_txt ───────────────────────────────────────────────────────

const LLMS_TXT_SKIP = /login|signin|signup|register|privacy|terms|cookie|legal|cart|checkout|account|unsubscribe|#|mailto:|javascript:|tel:|\.(png|jpg|jpeg|svg|gif|pdf|zip|css|js)(\?|$)/i;
const LLMS_TXT_KEY_PATHS = /about|pricing|docs|documentation|features|product|services|faq|blog|guide|how-it-works|customers|case-stud|integrations|api/i;

export async function generateLlmsTxt(args: { url: string; description?: string }): Promise<string> {
  try {
    const base = normalizeUrl(args.url);
    const { html, status } = await fetchHtml(base.href);
    if (status >= 400) return JSON.stringify({ error: `HTTP ${status} fetching URL` });

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const siteName = extractMetaMatch(html, "og:site_name");
    const title = decodeEntities(siteName !== "Missing" ? siteName : titleMatch ? titleMatch[1].trim().split(/\s*[|–—-]\s*/)[0] : base.hostname);
    const desc = args.description || (extractMetaMatch(html, "description") !== "Missing" ? decodeEntities(extractMetaMatch(html, "description")) : `Website of ${title}.`);

    // Collect internal links with human anchors
    const seen = new Map<string, string>(); // path -> anchor
    for (const m of html.matchAll(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const href = m[1];
      // Drop aria-hidden children (decorative duplicates and icons) before reading the link text.
      const anchor = decodeEntities(m[2].replace(/<(\w+)\b[^>]*\baria-hidden=["']true["'][^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (!anchor || anchor.length < 3 || anchor.length > 60 || LLMS_TXT_SKIP.test(href)) continue;
      let abs: URL;
      try {
        abs = new URL(href, base.href);
      } catch {
        continue;
      }
      if (abs.hostname !== base.hostname || abs.pathname === "/") continue;
      const path = abs.origin + abs.pathname;
      if (!seen.has(path)) seen.set(path, anchor);
    }

    const entries = [...seen.entries()];
    const isKey = (path: string) => LLMS_TXT_KEY_PATHS.test(new URL(path).pathname);
    const key = entries.filter(([path]) => isKey(path)).slice(0, 12);
    const optional = entries.filter(([path]) => !isKey(path)).slice(0, 8);

    let llmsTxt = `# ${title}\n\n> ${desc}\n`;
    if (key.length) {
      llmsTxt += `\n## Key Pages\n\n${key.map(([path, anchor]) => `- [${anchor}](${path})`).join("\n")}\n`;
    }
    if (optional.length) {
      llmsTxt += `\n## Optional\n\n${optional.map(([path, anchor]) => `- [${anchor}](${path})`).join("\n")}\n`;
    }

    return JSON.stringify({
      url: base.href,
      llms_txt: llmsTxt,
      deploy_instructions: `Save this as a plain-text file served at ${base.origin}/llms.txt (same place as robots.txt). It follows the llmstxt.org standard: an H1 with the site name, a one-line blockquote summary, then curated link sections AI agents use to navigate your site efficiently.`,
      links_included: key.length + optional.length,
      tip: "Review the anchors — they came from your site's own link text. Rewrite any vague ones ('Learn more') into descriptive labels before deploying.",
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── 8. compare_competitor_content ───────────────────────────────────────────

type Edge = "you" | "competitor" | "tie";

type PageFetchRecord = {
  url: string;
  role: string;
  status: number | "failed";
  error?: string;
};

type CompetitorSiteProfile = {
  origin: string;
  pages: PageFetchRecord[];
  combined_text: string;
  word_count: number;
  readability: { grade_level: number; difficulty: string };
  title: string;
  meta_description: string;
  h1s: string[];
  h2s: string[];
  top_keywords: { stem: string; display: string }[];
  top_bigrams: { phrase: string; count: number }[];
  schema_types: string[];
  technical: {
    indexable: boolean;
    robots_meta: string;
    canonical: string;
    viewport: boolean;
    html_lang: boolean;
    og_title: boolean;
    og_image: boolean;
    twitter_card: boolean;
  };
  technical_score: number;
  ai_crawl: { estimated_tokens: number; crawlable_word_count: number };
  performance: { avg_ttfb_ms: number; avg_payload_kb: number };
  keyword?: {
    count: number;
    density: string;
    in_title: boolean;
    in_h1: boolean;
    in_h2: boolean;
    in_meta: boolean;
    placement_score: number;
  };
};

function collectSchemaTypes(html: string): string[] {
  const types: string[] = [];
  const pushType = (t: unknown) => {
    if (typeof t === "string") types.push(t);
    else if (Array.isArray(t)) t.forEach((x) => { if (typeof x === "string") types.push(x); });
  };
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node["@type"]) pushType(node["@type"]);
    if (node["@graph"]) walk(node["@graph"]);
  };
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(match[1])); } catch { /* invalid block */ }
  }
  return [...new Set(types)];
}

function extractHeadings(html: string, tag: "h1" | "h2"): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  return Array.from(html.matchAll(re))
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function findKeyInternalPaths(html: string, base: URL, limit: number): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const m of html.matchAll(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>/gi)) {
    const href = m[1];
    if (LLMS_TXT_SKIP.test(href)) continue;
    let abs: URL;
    try { abs = new URL(href, base.href); } catch { continue; }
    if (abs.hostname !== base.hostname || abs.pathname === "/" || abs.pathname === "") continue;
    if (!LLMS_TXT_KEY_PATHS.test(abs.pathname)) continue;
    const path = abs.origin + abs.pathname.replace(/\/$/, "");
    if (seen.has(path)) continue;
    seen.add(path);
    paths.push(path);
    if (paths.length >= limit) break;
  }
  return paths;
}

function headingThemeStems(headings: string[]): Set<string> {
  const stems = new Set<string>();
  for (const h of headings) {
    for (const w of contentWords(h)) stems.add(lightStem(w));
  }
  return stems;
}

function filteredBigrams(text: string, limit: number): { phrase: string; count: number }[] {
  const usedWords = new Set<string>();
  const out: { phrase: string; count: number }[] = [];
  for (const g of getNGrams(text, 2, 40)) {
    const words = g.phrase.split(" ");
    if (words.some((w) => BOILERPLATE_WORDS.has(w) || usedWords.has(lightStem(w)))) continue;
    out.push(g);
    words.forEach((w) => usedWords.add(lightStem(w)));
    if (out.length >= limit) break;
  }
  return out;
}

function phraseOwnedBy(phrase: string, textStems: Set<string>): boolean {
  return phrase.split(" ").every((w) => textStems.has(lightStem(w)));
}

async function buildCompetitorSiteProfile(
  url: string,
  targetKeyword?: string,
): Promise<CompetitorSiteProfile> {
  const base = normalizeUrl(url);
  const pages: PageFetchRecord[] = [];
  const homeResult = await Promise.allSettled([fetchHtml(base.href)]);
  if (homeResult[0].status === "rejected") {
    throw new Error(`Failed to fetch ${base.href}: ${homeResult[0].reason?.message ?? "unknown error"}`);
  }
  const home = homeResult[0].value;
  pages.push({ url: base.href, role: "homepage", status: home.status });
  if (home.status >= 400) {
    throw new Error(`HTTP ${home.status} fetching ${base.href}`);
  }

  const candidates = new Map<string, string>(); // url -> role
  const aboutUrl = `${base.origin}/about`;
  const pricingUrl = `${base.origin}/pricing`;
  candidates.set(aboutUrl, "about");
  candidates.set(pricingUrl, "pricing");
  for (const p of findKeyInternalPaths(home.html, base, 3)) {
    if (p === aboutUrl || p === pricingUrl || p === base.origin || p === base.href.replace(/\/$/, "")) continue;
    if (!candidates.has(p)) candidates.set(p, "key_page");
  }

  // Cap at 4 pages total (homepage + up to 3 more)
  const extraUrls = [...candidates.entries()].slice(0, 3);
  const extraFetches = await Promise.allSettled(extraUrls.map(([u]) => fetchHtml(u)));

  let combinedText = extractText(home.html);
  let ttfbSum = home.ttfb;
  let sizeSum = home.size;
  let perfCount = 1;
  const schemaTypes = new Set(collectSchemaTypes(home.html));
  const h1s = extractHeadings(home.html, "h1");
  const h2s = extractHeadings(home.html, "h2");

  extraFetches.forEach((result, i) => {
    const [pageUrl, role] = extraUrls[i];
    if (result.status === "rejected") {
      pages.push({ url: pageUrl, role, status: "failed", error: result.reason?.message ?? "fetch failed" });
      return;
    }
    pages.push({ url: pageUrl, role, status: result.value.status });
    if (result.value.status !== 200) return;
    combinedText += " " + extractText(result.value.html);
    ttfbSum += result.value.ttfb;
    sizeSum += result.value.size;
    perfCount += 1;
    collectSchemaTypes(result.value.html).forEach((t) => schemaTypes.add(t));
    h1s.push(...extractHeadings(result.value.html, "h1"));
    h2s.push(...extractHeadings(result.value.html, "h2"));
  });

  const titleMatch = home.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : "Missing";
  const meta = extractMetaMatch(home.html, "description");
  const robots = extractMetaMatch(home.html, "robots");
  let canonical = "Missing";
  const canMatch = home.html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["'](.*?)["']/i);
  if (canMatch) canonical = canMatch[1];
  const viewport = extractMetaMatch(home.html, "viewport");
  const hasLang = /<html[^>]*lang=["']/i.test(home.html);
  const ogTitle = extractMetaMatch(home.html, "og:title");
  const ogImage = extractMetaMatch(home.html, "og:image");
  const twitterCard = extractMetaMatch(home.html, "twitter:card");
  const indexable = !robots.toLowerCase().includes("noindex");

  let technicalScore = 0;
  if (indexable) technicalScore += 1;
  if (canonical !== "Missing") technicalScore += 1;
  if (viewport !== "Missing") technicalScore += 1;
  if (hasLang) technicalScore += 1;
  if (ogTitle !== "Missing") technicalScore += 1;
  if (ogImage !== "Missing") technicalScore += 1;
  if (twitterCard !== "Missing") technicalScore += 1;

  const crawlableWordCount = getWordCount(combinedText);
  const wordCount = crawlableWordCount;
  const readability = getReadability(combinedText);

  const profile: CompetitorSiteProfile = {
    origin: base.origin,
    pages,
    combined_text: combinedText,
    word_count: wordCount,
    readability,
    title,
    meta_description: meta,
    h1s: [...new Set(h1s)].slice(0, 12),
    h2s: [...new Set(h2s)].slice(0, 20),
    top_keywords: getTopKeywords(combinedText, 15),
    top_bigrams: filteredBigrams(combinedText, 12),
    schema_types: [...schemaTypes].sort(),
    technical: {
      indexable,
      robots_meta: robots !== "Missing" ? robots : "Not explicitly defined (defaults to index, follow)",
      canonical,
      viewport: viewport !== "Missing",
      html_lang: hasLang,
      og_title: ogTitle !== "Missing",
      og_image: ogImage !== "Missing",
      twitter_card: twitterCard !== "Missing",
    },
    technical_score: technicalScore,
    ai_crawl: {
      estimated_tokens: Math.ceil(crawlableWordCount * 1.3),
      crawlable_word_count: crawlableWordCount,
    },
    performance: {
      avg_ttfb_ms: Math.round(ttfbSum / perfCount),
      avg_payload_kb: Math.round((sizeSum / perfCount / 1024) * 100) / 100,
    },
  };

  if (targetKeyword) {
    const kwStats = getKeywordDensity(combinedText, targetKeyword);
    const kwRe = new RegExp(targetKeyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");
    const inTitle = kwRe.test(title);
    const inH1 = h1s.some((h) => kwRe.test(h));
    const inH2 = h2s.some((h) => kwRe.test(h));
    const inMeta = meta !== "Missing" && kwRe.test(meta);
    let placement = 0;
    if (inTitle) placement += 2;
    if (inH1) placement += 2;
    if (inH2) placement += 1;
    if (inMeta) placement += 1;
    if (kwStats.count > 0) placement += 1;
    profile.keyword = {
      count: kwStats.count,
      density: kwStats.density,
      in_title: inTitle,
      in_h1: inH1,
      in_h2: inH2,
      in_meta: inMeta,
      placement_score: placement,
    };
  }

  return profile;
}

function edgeByHigher(you: number, competitor: number, margin = 0): Edge {
  if (Math.abs(you - competitor) <= margin) return "tie";
  return you > competitor ? "you" : "competitor";
}

function edgeByLower(you: number, competitor: number, margin = 0): Edge {
  if (Math.abs(you - competitor) <= margin) return "tie";
  return you < competitor ? "you" : "competitor";
}

export async function compareCompetitorContent(args: {
  your_url: string;
  competitor_url: string;
  target_keyword?: string;
}): Promise<string> {
  try {
    const keyword = args.target_keyword?.trim() || undefined;
    const [you, competitor] = await Promise.all([
      buildCompetitorSiteProfile(args.your_url, keyword),
      buildCompetitorSiteProfile(args.competitor_url, keyword),
    ]);

    const cosSim = getCosineSimilarity(you.combined_text, competitor.combined_text);
    const youStems = new Set(contentWords(you.combined_text).map(lightStem));
    const compStems = new Set(contentWords(competitor.combined_text).map(lightStem));

    const theyHaveYouLack = competitor.top_bigrams
      .filter((g) => !phraseOwnedBy(g.phrase, youStems))
      .slice(0, 8);
    const youHaveTheyLack = you.top_bigrams
      .filter((g) => !phraseOwnedBy(g.phrase, compStems))
      .slice(0, 8);

    const youTopicStems = new Set(you.top_keywords.map((k) => k.stem));
    const compTopicStems = new Set(competitor.top_keywords.map((k) => k.stem));
    const topicsTheyHave = competitor.top_keywords.filter((k) => !youTopicStems.has(k.stem)).map((k) => k.display);
    const topicsYouHave = you.top_keywords.filter((k) => !compTopicStems.has(k.stem)).map((k) => k.display);

    const youH2Stems = headingThemeStems(you.h2s);
    const compH2Stems = headingThemeStems(competitor.h2s);
    const headingGapsTheyHave = competitor.h2s.filter((h) => {
      const stems = [...headingThemeStems([h])];
      return stems.length > 0 && stems.every((s) => !youH2Stems.has(s));
    }).slice(0, 8);
    const headingGapsYouHave = you.h2s.filter((h) => {
      const stems = [...headingThemeStems([h])];
      return stems.length > 0 && stems.every((s) => !compH2Stems.has(s));
    }).slice(0, 8);

    const youSchema = new Set(you.schema_types);
    const compSchema = new Set(competitor.schema_types);
    const schemaTheyHave = competitor.schema_types.filter((t) => !youSchema.has(t));
    const schemaYouHave = you.schema_types.filter((t) => !compSchema.has(t));

    const contentDepthEdge = edgeByHigher(you.word_count, competitor.word_count, Math.max(50, competitor.word_count * 0.08));
    const topicEdge: Edge = topicsTheyHave.length === topicsYouHave.length
      ? "tie"
      : topicsTheyHave.length < topicsYouHave.length
        ? "you"
        : "competitor";

    const keywordEdge: Edge = !you.keyword || !competitor.keyword
      ? "tie"
      : edgeByHigher(you.keyword.placement_score, competitor.keyword.placement_score);
    const schemaEdge = edgeByHigher(you.schema_types.length, competitor.schema_types.length);
    const technicalEdge = edgeByHigher(you.technical_score, competitor.technical_score);
    const aiCrawlEdge = edgeByHigher(you.ai_crawl.crawlable_word_count, competitor.ai_crawl.crawlable_word_count, 80);
    const speedEdge = edgeByLower(you.performance.avg_ttfb_ms, competitor.performance.avg_ttfb_ms, 50);

    const scorecard = {
      content_depth: {
        you: you.word_count,
        competitor: competitor.word_count,
        edge: contentDepthEdge,
        note: "Total crawlable words across fetched pages",
      },
      topic_coverage: {
        topics_only_on_competitor: topicsTheyHave.length,
        topics_only_on_you: topicsYouHave.length,
        edge: topicEdge,
        note: "Unique top-keyword themes after stemming",
      },
      keyword_targeting: {
        you_placement_score: you.keyword?.placement_score ?? null,
        competitor_placement_score: competitor.keyword?.placement_score ?? null,
        edge: keyword ? keywordEdge : "tie",
        note: keyword
          ? "Title/H1/H2/meta + on-page density for the target keyword"
          : "Provide target_keyword to score keyword targeting",
      },
      schema_richness: {
        you_types: you.schema_types.length,
        competitor_types: competitor.schema_types.length,
        edge: schemaEdge,
      },
      technical_readiness: {
        you_score: `${you.technical_score}/7`,
        competitor_score: `${competitor.technical_score}/7`,
        edge: technicalEdge,
      },
      ai_crawlability: {
        you_tokens: you.ai_crawl.estimated_tokens,
        competitor_tokens: competitor.ai_crawl.estimated_tokens,
        edge: aiCrawlEdge,
        note: "More crawlable text generally gives AI more citeable ground truth",
      },
      speed: {
        you_avg_ttfb_ms: you.performance.avg_ttfb_ms,
        competitor_avg_ttfb_ms: competitor.performance.avg_ttfb_ms,
        edge: speedEdge,
      },
      content_similarity: {
        cosine_similarity_score: `${(cosSim * 100).toFixed(2)}%`,
        meaning:
          cosSim > 0.8
            ? "Highly identical semantic structure (risk of undifferentiated content)"
            : cosSim > 0.5
              ? "Similar topic coverage with room to differentiate"
              : "Highly differentiated content structure",
      },
    };

    const recommended_actions: string[] = [];
    if (contentDepthEdge === "competitor") {
      recommended_actions.push(
        `Content depth gap: competitor has ~${competitor.word_count - you.word_count} more crawlable words across key pages. Expand thin pages or add missing /about /pricing /product copy.`,
      );
    }
    if (theyHaveYouLack.length > 0) {
      recommended_actions.push(
        `Close semantic gaps — competitor uses phrases you lack: ${theyHaveYouLack.slice(0, 5).map((g) => `"${g.phrase}"`).join(", ")}.`,
      );
    }
    if (headingGapsTheyHave.length > 0) {
      recommended_actions.push(
        `Add H2 sections covering competitor themes you miss: ${headingGapsTheyHave.slice(0, 4).map((h) => `"${h}"`).join(", ")}.`,
      );
    }
    if (schemaTheyHave.length > 0) {
      recommended_actions.push(
        `Ship schema types competitor has and you don't: ${schemaTheyHave.join(", ")}. Use generate_missing_schema for Organization/WebSite/FAQPage.`,
      );
    }
    if (keyword && you.keyword && competitor.keyword && keywordEdge === "competitor") {
      const missing: string[] = [];
      if (!you.keyword.in_title && competitor.keyword.in_title) missing.push("title");
      if (!you.keyword.in_h1 && competitor.keyword.in_h1) missing.push("H1");
      if (!you.keyword.in_meta && competitor.keyword.in_meta) missing.push("meta description");
      if (!you.keyword.in_h2 && competitor.keyword.in_h2) missing.push("H2");
      recommended_actions.push(
        missing.length
          ? `Keyword "${keyword}": place it in your ${missing.join(", ")} (competitor already does).`
          : `Keyword "${keyword}": increase on-page usage — competitor density ${competitor.keyword.density} vs yours ${you.keyword.density}.`,
      );
    }
    if (technicalEdge === "competitor") {
      const fixes: string[] = [];
      if (!you.technical.viewport && competitor.technical.viewport) fixes.push("viewport meta");
      if (!you.technical.html_lang && competitor.technical.html_lang) fixes.push("html lang");
      if (!you.technical.og_title && competitor.technical.og_title) fixes.push("Open Graph title");
      if (!you.technical.og_image && competitor.technical.og_image) fixes.push("Open Graph image");
      if (!you.technical.twitter_card && competitor.technical.twitter_card) fixes.push("Twitter card");
      if (you.technical.canonical === "Missing" && competitor.technical.canonical !== "Missing") fixes.push("canonical");
      if (fixes.length) recommended_actions.push(`Technical readiness: add ${fixes.join(", ")}.`);
    }
    if (speedEdge === "competitor") {
      recommended_actions.push(
        `Speed: your avg TTFB (${you.performance.avg_ttfb_ms}ms) is slower than competitor (${competitor.performance.avg_ttfb_ms}ms). Reduce server/response latency on key pages.`,
      );
    }
    if (aiCrawlEdge === "competitor") {
      recommended_actions.push(
        "AI crawlability: competitor exposes more indexable text. Prefer server-rendered copy over JS-only content on entity pages.",
      );
    }
    if (recommended_actions.length === 0) {
      recommended_actions.push(
        "You lead or tie on measured dimensions. Double down on unique topics you already own and publish comparison content that cites your differentiators.",
      );
    }

    return JSON.stringify(
      {
        evidence_disclaimer:
          "Observed from publicly fetchable HTML only. Not search rankings, impressions, or share-of-voice.",
        sites: {
          you: {
            origin: you.origin,
            pages_fetched: you.pages,
            word_count: you.word_count,
            readability: you.readability,
            title: you.title,
            schema_types: you.schema_types,
            technical: you.technical,
            performance: you.performance,
            ai_crawl: you.ai_crawl,
          },
          competitor: {
            origin: competitor.origin,
            pages_fetched: competitor.pages,
            word_count: competitor.word_count,
            readability: competitor.readability,
            title: competitor.title,
            schema_types: competitor.schema_types,
            technical: competitor.technical,
            performance: competitor.performance,
            ai_crawl: competitor.ai_crawl,
          },
        },
        scorecard,
        semantic_gaps: {
          competitor_phrases_you_lack: theyHaveYouLack,
          your_phrases_competitor_lacks: youHaveTheyLack,
          competitor_topics_you_lack: topicsTheyHave,
          your_topics_competitor_lacks: topicsYouHave,
        },
        keyword_battle: keyword && you.keyword && competitor.keyword
          ? {
              target_keyword: keyword,
              you: you.keyword,
              competitor: competitor.keyword,
              edge: keywordEdge,
            }
          : {
              target_keyword: null,
              note: "Pass target_keyword for title/H1/meta/density head-to-head",
            },
        heading_and_topic_gaps: {
          h2_themes_competitor_has_you_lack: headingGapsTheyHave,
          h2_themes_you_have_competitor_lacks: headingGapsYouHave,
          your_h2_sample: you.h2s.slice(0, 8),
          competitor_h2_sample: competitor.h2s.slice(0, 8),
        },
        schema_gap: {
          competitor_has_you_lack: schemaTheyHave,
          you_have_competitor_lacks: schemaYouHave,
        },
        recommended_actions,
      },
      null,
      2,
    );
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── check_ai_crawler_access ─────────────────────────────────────────────────

type CrawlerPurpose = "search" | "training" | "user";

type AiCrawler = { token: string; operator: string; purpose: CrawlerPurpose; powers: string };

// Product tokens as documented by each operator. "search" bots decide whether you can be
// cited in AI answers today; "training" bots decide whether future models learn about you.
const AI_CRAWLERS: AiCrawler[] = [
  { token: "OAI-SearchBot", operator: "OpenAI", purpose: "search", powers: "ChatGPT search results and citations" },
  { token: "ChatGPT-User", operator: "OpenAI", purpose: "user", powers: "ChatGPT reading a page when a user asks it to" },
  { token: "GPTBot", operator: "OpenAI", purpose: "training", powers: "Training data for OpenAI models" },
  { token: "Claude-SearchBot", operator: "Anthropic", purpose: "search", powers: "Claude web search results and citations" },
  { token: "Claude-User", operator: "Anthropic", purpose: "user", powers: "Claude reading a page when a user asks it to" },
  { token: "ClaudeBot", operator: "Anthropic", purpose: "training", powers: "Training data for Claude models" },
  { token: "PerplexityBot", operator: "Perplexity", purpose: "search", powers: "Perplexity answers and citations" },
  { token: "Perplexity-User", operator: "Perplexity", purpose: "user", powers: "Perplexity reading a page when a user asks it to" },
  { token: "Googlebot", operator: "Google", purpose: "search", powers: "Google Search, AI Overviews and AI Mode" },
  { token: "Google-Extended", operator: "Google", purpose: "training", powers: "Gemini training and grounding (control token, not a separate crawler)" },
  { token: "Bingbot", operator: "Microsoft", purpose: "search", powers: "Bing and Microsoft Copilot answers (Bing's index also feeds other AI search tools)" },
  { token: "Applebot", operator: "Apple", purpose: "search", powers: "Siri and Spotlight suggestions" },
  { token: "Applebot-Extended", operator: "Apple", purpose: "training", powers: "Apple Intelligence training (control token)" },
  { token: "DuckAssistBot", operator: "DuckDuckGo", purpose: "search", powers: "DuckDuckGo AI-assisted answers" },
  { token: "Amazonbot", operator: "Amazon", purpose: "search", powers: "Alexa and Amazon AI answers" },
  { token: "meta-externalagent", operator: "Meta", purpose: "training", powers: "Meta AI training and features" },
  { token: "MistralAI-User", operator: "Mistral", purpose: "user", powers: "Le Chat reading a page when a user asks it to" },
  { token: "CCBot", operator: "Common Crawl", purpose: "training", powers: "Common Crawl, an open dataset used to train many AI models" },
];

// Real user-agent strings for a live check of whether a firewall/CDN treats AI crawlers differently.
const LIVE_PROBES: { token: string; ua: string }[] = [
  { token: "GPTBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.1; +https://openai.com/gptbot)" },
  { token: "ClaudeBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" },
  { token: "PerplexityBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
];
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type RobotsRule = { allow: boolean; path: string };
type RobotsGroup = { agents: string[]; rules: RobotsRule[] };

/** Parses robots.txt into user-agent groups (RFC 9309). */
export function parseRobotsTxt(txt: string): { groups: RobotsGroup[]; sitemaps: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const idx = line.indexOf(":");
    if (!line || idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "sitemap") {
      if (value) sitemaps.push(value);
    } else {
      // An empty "Disallow:" means "allow everything", so it adds no rule.
      if (current && (key === "allow" || key === "disallow") && value) {
        current.rules.push({ allow: key === "allow", path: value });
      }
      lastWasAgent = false;
    }
  }
  return { groups, sitemaps };
}

function robotsPatternMatches(pattern: string, path: string): boolean {
  let src = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  if (src.endsWith("\\$")) src = src.slice(0, -2) + "$";
  return new RegExp("^" + src).test(path);
}

/**
 * Decides whether a crawler may fetch a path: use the group naming the crawler (or "*" if none),
 * then the longest matching rule wins, with Allow winning ties.
 */
export function robotsAllows(
  parsed: { groups: RobotsGroup[] },
  token: string,
  path: string,
): { allowed: boolean; group: string; rule: string | null } {
  const t = token.toLowerCase();
  const named = parsed.groups.filter((g) => g.agents.some((a) => a === t || a.startsWith(t + "/")));
  const groups = named.length ? named : parsed.groups.filter((g) => g.agents.includes("*"));
  if (!groups.length) return { allowed: true, group: "none", rule: null };
  let best: RobotsRule | null = null;
  for (const r of groups.flatMap((g) => g.rules)) {
    if (!robotsPatternMatches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return {
    allowed: best ? best.allow : true,
    group: named.length ? token : "*",
    rule: best ? `${best.allow ? "Allow" : "Disallow"}: ${best.path}` : null,
  };
}

function looksLikeChallenge(status: number, headers: Headers, html: string): boolean {
  return status === 403 || status === 429 || status === 503 ||
    headers.get("cf-mitigated") === "challenge" ||
    /<title>\s*(just a moment|attention required|access denied)/i.test(html) ||
    /cf-chl-|challenge-platform|captcha-delivery\.com|px-captcha/i.test(html.slice(0, 20000));
}

export async function checkAiCrawlerAccess(args: { url: string }): Promise<string> {
  try {
    const target = normalizeUrl(args.url);
    const path = (target.pathname || "/") + target.search;

    const [robotsRes, browserRes, llmsRes, ...probeRes] = await Promise.allSettled([
      fetchHtml(`${target.origin}/robots.txt`),
      fetchHtml(target.href, BROWSER_UA),
      fetchHtml(`${target.origin}/llms.txt`),
      ...LIVE_PROBES.map((p) => fetchHtml(target.href, p.ua)),
    ]);

    if (browserRes.status === "rejected") {
      return JSON.stringify({ error: (browserRes.reason as Error)?.message ?? `Could not reach ${target.href}` });
    }
    const page = browserRes.value;

    // robots.txt — 4xx means "no rules"; 5xx/unreachable means crawlers assume everything is blocked (RFC 9309).
    let robotsState: "found" | "missing" | "server_error" | "unreachable" = "missing";
    let parsed: ReturnType<typeof parseRobotsTxt> = { groups: [], sitemaps: [] };
    let robotsStatus: number | null = null;
    if (robotsRes.status === "fulfilled") {
      robotsStatus = robotsRes.value.status;
      const body = robotsRes.value.html;
      if (robotsStatus >= 500) robotsState = "server_error";
      else if (robotsStatus < 400 && !/^\s*<(!doctype|html)/i.test(body)) {
        robotsState = "found";
        parsed = parseRobotsTxt(body);
      }
    } else {
      robotsState = "unreachable";
    }
    const robotsBlocksAll = robotsState === "server_error" || robotsState === "unreachable";

    const crawlers = AI_CRAWLERS.map((c) => {
      const verdict = robotsBlocksAll
        ? { allowed: false, group: "n/a", rule: `robots.txt ${robotsState === "server_error" ? `returned HTTP ${robotsStatus}` : "unreachable"} — crawlers treat this as "block everything"` }
        : robotsAllows(parsed, c.token, path);
      return { bot: c.token, operator: c.operator, purpose: c.purpose, powers: c.powers, allowed: verdict.allowed, decided_by: verdict.rule ?? `no matching rule (group: ${verdict.group})` };
    });

    // Page-level directives
    const metaRobots = extractMetaMatch(page.html, "robots").toLowerCase();
    const xRobots = (page.headers.get("x-robots-tag") ?? "").toLowerCase();
    const directives = `${metaRobots === "missing" ? "" : metaRobots} ${xRobots}`;
    const noindex = hasNoindex(directives);
    const nosnippet = /\bnosnippet\b/.test(directives);
    const noai = /\bnoai\b/.test(directives);

    // Live firewall/CDN probe: does the site answer a browser but refuse AI crawler user-agents?
    const browserOk = page.status < 400 && !looksLikeChallenge(page.status, page.headers, page.html);
    const firewall = LIVE_PROBES.map((p, i) => {
      const r = probeRes[i];
      if (r.status === "rejected") return { bot: p.token, result: "request failed", blocked: false };
      const blocked = browserOk && looksLikeChallenge(r.value.status, r.value.headers, r.value.html);
      return { bot: p.token, http_status: r.value.status, blocked };
    });

    // llms.txt
    let llmsTxt: { present: boolean; note: string };
    if (llmsRes.status === "fulfilled" && llmsRes.value.status === 200 && !/^\s*<(!doctype|html)/i.test(llmsRes.value.html) && llmsRes.value.html.trim().startsWith("#")) {
      llmsTxt = { present: true, note: `${target.origin}/llms.txt found.` };
    } else {
      llmsTxt = { present: false, note: "No llms.txt. Optional and not yet used by most AI engines, but cheap to add — generate_llms_txt builds one." };
    }

    const blockedSearch = crawlers.filter((c) => !c.allowed && (c.purpose === "search" || c.purpose === "user"));
    const blockedTraining = crawlers.filter((c) => !c.allowed && c.purpose === "training");
    const firewallBlocked = firewall.filter((f) => f.blocked);

    const issues: { severity: "critical" | "high" | "medium" | "low"; issue: string; fix: string }[] = [];
    if (robotsBlocksAll) {
      issues.push({ severity: "critical", issue: `robots.txt ${robotsState === "server_error" ? `returns HTTP ${robotsStatus}` : "could not be fetched"}, so well-behaved crawlers assume the whole site is off-limits.`, fix: "Make /robots.txt return HTTP 200 (or 404 if you want no rules)." });
    }
    if (noindex) {
      issues.push({ severity: "critical", issue: "This page tells crawlers not to index it (noindex via meta robots or X-Robots-Tag).", fix: "Remove noindex from this page if you want it to appear in search and AI answers." });
    }
    for (const c of blockedSearch.filter((c) => c.bot === "Googlebot" || c.bot === "Bingbot")) {
      issues.push({ severity: "critical", issue: `${c.bot} is blocked (${c.decided_by}). This removes you from ${c.powers}.`, fix: `Allow ${c.bot} in robots.txt.` });
    }
    const otherSearch = blockedSearch.filter((c) => c.bot !== "Googlebot" && c.bot !== "Bingbot");
    if (otherSearch.length) {
      issues.push({ severity: "high", issue: `AI search/answer crawlers blocked: ${otherSearch.map((c) => c.bot).join(", ")}. These decide whether you can be cited in ${[...new Set(otherSearch.map((c) => c.operator))].join(", ")} answers today.`, fix: "Add the robots.txt lines in paste_ready_robots_txt." });
    }
    if (firewallBlocked.length) {
      issues.push({ severity: "high", issue: `Your firewall/CDN answers a normal browser but blocks requests identifying as ${firewallBlocked.map((f) => f.bot).join(", ")}.`, fix: "Check your CDN's bot settings (e.g. Cloudflare → Security → Bots → 'Block AI bots' / AI Crawl Control) and allow the AI crawlers you want. Note: firewalls that verify crawler IP addresses may treat the real bots differently, so confirm in your CDN's logs." });
    }
    if (nosnippet) {
      issues.push({ severity: "medium", issue: "nosnippet is set, which stops Google (including AI Overviews) from quoting this page.", fix: "Remove nosnippet unless you deliberately want to prevent quoting." });
    }
    if (blockedTraining.length) {
      issues.push({ severity: "low", issue: `Training crawlers blocked: ${blockedTraining.map((c) => c.bot).join(", ")}. Future AI models will know less about your brand.`, fix: "This is a business choice. If you want AI models to learn about you, allow them; blocking them doesn't affect AI search citations." });
    }
    if (noai) {
      issues.push({ severity: "low", issue: "A 'noai' directive is set. It is non-standard and most AI crawlers ignore it, but it signals you opt out of AI use.", fix: "Remove it if you want AI visibility." });
    }
    if (robotsState === "found" && parsed.sitemaps.length === 0) {
      issues.push({ severity: "low", issue: "robots.txt doesn't list a sitemap.", fix: `Add "Sitemap: ${target.origin}/sitemap.xml" (or your sitemap's real URL) to robots.txt so crawlers find every page.` });
    }
    if (!llmsTxt.present) {
      issues.push({ severity: "low", issue: "No llms.txt file.", fix: "Run generate_llms_txt and upload the result to /llms.txt." });
    }

    let score = 100;
    if (robotsBlocksAll) score -= 60;
    if (noindex) score -= 50;
    score -= blockedSearch.filter((c) => c.bot === "Googlebot" || c.bot === "Bingbot").length * 25;
    score -= Math.min(40, otherSearch.length * 10);
    score -= Math.min(30, firewallBlocked.length * 10);
    if (nosnippet) score -= 10;
    score -= Math.min(15, blockedTraining.length * 3);
    if (!llmsTxt.present) score -= 3;
    score = Math.max(0, Math.min(100, score));

    const allowLines = (list: typeof crawlers) =>
      robotsBlocksAll || !list.length ? null : list.map((c) => `User-agent: ${c.bot}\nAllow: /`).join("\n\n");
    const pasteReady = allowLines(blockedSearch);
    const optionalTraining = allowLines(blockedTraining);

    return JSON.stringify({
      url: target.href,
      ai_crawler_access_score: `${score}/100`,
      summary: issues.some((i) => i.severity === "critical")
        ? "Critical: search engines or AI crawlers are blocked from this page."
        : blockedSearch.length || firewallBlocked.length
          ? "AI answer engines are partly blocked — some assistants can't read or cite this site."
          : "AI search crawlers can reach this page.",
      robots_txt: {
        url: `${target.origin}/robots.txt`,
        state: robotsState,
        http_status: robotsStatus,
        sitemaps: parsed.sitemaps,
      },
      ai_crawlers: crawlers,
      firewall_check: {
        note: browserOk
          ? "Fetched the page as a normal browser and as each AI crawler. 'blocked' means the site answered the browser but refused or challenged the crawler."
          : `Inconclusive: the site also refused a normal browser request from our server (HTTP ${page.status}), so this check can't tell whether AI crawlers are treated differently. Check your CDN/firewall bot settings directly.`,
        browser_status: page.status,
        results: firewall,
      },
      page_directives: {
        meta_robots: metaRobots === "missing" ? null : metaRobots,
        x_robots_tag: xRobots || null,
        noindex,
        nosnippet,
      },
      llms_txt: llmsTxt,
      issues,
      ...(pasteReady ? {
        paste_ready_robots_txt: pasteReady,
        paste_instructions: "Add these groups to robots.txt. A crawler that has its own group ignores the '*' group, so these lines override a blanket Disallow. If a bot already has its own group with Disallow rules, edit that group instead of adding a second one.",
      } : {}),
      ...(optionalTraining ? { optional_allow_training_crawlers: optionalTraining } : {}),
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── Shared helpers for the site-level tools ─────────────────────────────────

const API_UA = "NewtationBot/2.0 (+https://newtation.ai; contact@newtation.ai)";
const AI_SEARCH_BOTS = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot", "Googlebot", "Bingbot"];

function bareHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

async function fetchJson(url: string, timeoutMs = 15000): Promise<{ status: number; data: any; text: string }> {
  const res = await fetch(url, { headers: { "User-Agent": API_UA, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, data, text };
}

async function fetchRobots(origin: string): Promise<ReturnType<typeof parseRobotsTxt>> {
  try {
    const r = await fetchHtml(`${origin}/robots.txt`);
    if (r.status < 400 && !/^\s*<(!doctype|html)/i.test(r.html)) return parseRobotsTxt(r.html);
  } catch { /* treat as no rules */ }
  return { groups: [], sitemaps: [] };
}

/** Runs async work over items with a fixed concurrency. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = { status: "fulfilled", value: await fn(items[i]) }; }
      catch (e) { out[i] = { status: "rejected", reason: e }; }
    }
  });
  await Promise.all(workers);
  return out;
}

// ─── audit_site ──────────────────────────────────────────────────────────────

type SitemapEntry = { url: string; lastmod?: string };

function xmlLocs(xml: string, tag: "url" | "sitemap"): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const m of xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "gi"))) {
    const loc = m[1].match(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/i)?.[1];
    if (!loc) continue;
    const lastmod = m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i)?.[1];
    out.push({ url: decodeEntities(loc), lastmod });
  }
  return out;
}

async function collectSitemapUrls(candidates: string[], host: string): Promise<{ entries: SitemapEntry[]; sitemaps_read: string[] }> {
  const sitemapsRead: string[] = [];
  const entries: SitemapEntry[] = [];
  const sameHost = (u: string) => { try { return bareHost(new URL(u).hostname) === bareHost(host); } catch { return false; } };

  for (const sm of candidates) {
    if (/\.gz($|\?)/i.test(sm)) continue;
    let xml: string;
    try {
      const r = await fetchHtml(sm);
      if (r.status >= 400) continue;
      xml = r.html;
    } catch { continue; }
    sitemapsRead.push(sm);
    entries.push(...xmlLocs(xml, "url").filter((e) => sameHost(e.url)));
    const children = xmlLocs(xml, "sitemap").map((e) => e.url).filter((u) => !/\.gz($|\?)/i.test(u)).slice(0, 3);
    const childResults = await Promise.allSettled(children.map((c) => fetchHtml(c)));
    childResults.forEach((r, i) => {
      if (r.status !== "fulfilled" || r.value.status >= 400) return;
      sitemapsRead.push(children[i]);
      entries.push(...xmlLocs(r.value.html, "url").filter((e) => sameHost(e.url)));
    });
    if (entries.length) break;
  }
  return { entries, sitemaps_read: sitemapsRead };
}

/** Picks pages round-robin across top-level sections so /blog, /docs, /product etc. are all sampled. */
function sampleAcrossSections(urls: string[], max: number): string[] {
  const groups = new Map<string, string[]>();
  for (const u of urls) {
    let key = "/";
    try { key = "/" + (new URL(u).pathname.split("/").filter(Boolean)[0] ?? ""); } catch { continue; }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(u);
  }
  const lists = [...groups.values()];
  const picked: string[] = [];
  for (let round = 0; picked.length < max && lists.some((l) => l.length > round); round++) {
    for (const l of lists) {
      if (l[round] && picked.length < max) picked.push(l[round]);
    }
  }
  return picked;
}

function homepageLinks(html: string, base: URL): string[] {
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["']/gi)) {
    if (LLMS_TXT_SKIP.test(m[1])) continue;
    try {
      const abs = new URL(m[1], base.href);
      if (bareHost(abs.hostname) !== bareHost(base.hostname)) continue;
      seen.add(abs.origin + abs.pathname);
    } catch { /* skip */ }
  }
  return [...seen];
}

function normForCompare(u: string): string {
  try {
    const x = new URL(u);
    return bareHost(x.hostname) + x.pathname.replace(/\/$/, "");
  } catch { return u; }
}

export async function auditSite(args: { url: string; max_pages?: number }): Promise<string> {
  try {
    const base = normalizeUrl(args.url);
    const maxPages = Math.min(20, Math.max(3, Math.round(args.max_pages ?? 15)));
    const robots = await fetchRobots(base.origin);

    const candidates = robots.sitemaps.length
      ? robots.sitemaps.slice(0, 2)
      : [`${base.origin}/sitemap.xml`, `${base.origin}/sitemap_index.xml`];
    const { entries, sitemaps_read } = await collectSitemapUrls(candidates, base.hostname);

    let source: string;
    let pool: string[];
    const lastmodByUrl = new Map(entries.map((e) => [normForCompare(e.url), e.lastmod]));
    if (entries.length) {
      source = `sitemap (${entries.length} URLs listed)`;
      pool = [...new Set(entries.map((e) => e.url))];
    } else {
      const home = await fetchOk(base.origin + "/");
      pool = homepageLinks(home.html, base);
      source = `homepage links (no readable sitemap at ${candidates.join(" or ")})`;
    }
    const home = `${base.origin}/`;
    const sample = [home, ...sampleAcrossSections(pool.filter((u) => normForCompare(u) !== normForCompare(home)), maxPages - 1)];

    const results = await mapLimit(sample, 5, (u) => fetchHtml(u));

    type Row = {
      url: string; status: number | "failed"; title?: string; words?: number; js_risk?: string;
      schema_types?: string[]; canonical?: "self" | "other" | "missing"; noindex?: boolean;
      blocked_for?: string[]; h1_count?: number; meta_description?: boolean; lastmod?: string; score: number;
    };
    const rows: Row[] = results.map((r, i) => {
      const url = sample[i];
      const path = (() => { try { const x = new URL(url); return x.pathname + x.search; } catch { return "/"; } })();
      const blocked_for = AI_SEARCH_BOTS.filter((t) => !robotsAllows(robots, t, path).allowed);
      if (r.status === "rejected") return { url, status: "failed", blocked_for, score: 0 };
      const { html, status, headers, finalUrl } = r.value;
      if (status >= 400) return { url, status, blocked_for, score: 0 };
      const text = extractText(html);
      const words = getWordCount(text);
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim() : "";
      const canonHref = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
        ?? html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1];
      let canonical: Row["canonical"] = "missing";
      if (canonHref) {
        try { canonical = normForCompare(new URL(canonHref, finalUrl).href) === normForCompare(finalUrl) ? "self" : "other"; }
        catch { canonical = "missing"; }
      }
      const directives = `${extractMetaMatch(html, "robots")} ${headers.get("x-robots-tag") ?? ""}`.toLowerCase();
      const noindex = hasNoindex(directives);
      const js_risk = assessJsDependency(html, words).risk;
      const schema_types = collectSchemaTypes(html);
      const h1_count = extractHeadings(html, "h1").length;
      const meta_description = extractMetaMatch(html, "description") !== "Missing";

      let score = 100;
      if (noindex) score -= 50;
      if (blocked_for.length) score -= 40;
      if (js_risk === "HIGH") score -= 40; else if (js_risk === "MEDIUM") score -= 15;
      if (words < 200) score -= 15;
      if (!schema_types.length) score -= 10;
      if (!title) score -= 15;
      if (!meta_description) score -= 5;
      if (h1_count !== 1) score -= 5;

      return {
        url, status, title, words, js_risk, schema_types, canonical, noindex, blocked_for, h1_count, meta_description,
        lastmod: lastmodByUrl.get(normForCompare(url)), score: Math.max(0, score),
      };
    });

    const ok = rows.filter((r) => typeof r.status === "number" && r.status < 400);
    const issue = (severity: string, name: string, list: Row[], fix: string) =>
      list.length ? [{ severity, issue: name, pages: list.length, examples: list.slice(0, 5).map((r) => r.url), fix }] : [];

    const titleCounts = new Map<string, number>();
    ok.forEach((r) => r.title && titleCounts.set(r.title, (titleCounts.get(r.title) ?? 0) + 1));

    const issues = [
      ...issue("critical", "Pages that fail to load (error or unreachable)", rows.filter((r) => r.status === "failed" || (typeof r.status === "number" && r.status >= 400)), "Fix or redirect these URLs, and remove dead ones from the sitemap."),
      ...issue("high", "Pages blocked for AI search crawlers in robots.txt", ok.filter((r) => r.blocked_for?.length), "Allow OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot and Bingbot on pages you want cited (run check_ai_crawler_access for paste-ready lines)."),
      ...issue("high", "Pages marked noindex", ok.filter((r) => r.noindex), "Remove noindex from pages you want in search and AI answers. Keep it only on pages you deliberately hide."),
      ...issue("high", "Content depends on JavaScript (AI crawlers likely see little)", ok.filter((r) => r.js_risk === "HIGH"), "Serve these pages with server-side rendering or static pre-rendering."),
      ...issue("medium", "Thin pages (under 200 words of readable text)", ok.filter((r) => (r.words ?? 0) < 200), "Add substantive, specific content, or merge thin pages into stronger ones."),
      ...issue("medium", "No structured data (JSON-LD)", ok.filter((r) => !r.schema_types?.length), "Add Schema.org markup that fits each page type (Organization on the homepage, Article, Product, FAQPage, etc.)."),
      ...issue("medium", "Missing <title>", ok.filter((r) => !r.title), "Give every page a unique, descriptive title."),
      ...issue("medium", "Duplicate titles", ok.filter((r) => r.title && (titleCounts.get(r.title) ?? 0) > 1), "Make each page's title unique so engines can tell pages apart."),
      ...issue("low", "Missing meta description", ok.filter((r) => !r.meta_description), "Add a one-sentence factual summary as the meta description."),
      ...issue("low", "Missing or multiple H1 headings", ok.filter((r) => r.h1_count !== 1), "Use exactly one H1 that states what the page is about."),
      ...issue("low", "Canonical points to a different URL", ok.filter((r) => r.canonical === "other"), "Check these are intentional; a canonical elsewhere tells engines to credit the other URL."),
    ];

    const lastmods = entries.map((e) => e.lastmod).filter(Boolean).map((d) => Date.parse(d!)).filter((n) => !Number.isNaN(n));
    const yearAgo = Date.now() - 365 * 24 * 3600 * 1000;
    const freshness = lastmods.length
      ? {
          urls_with_lastmod: lastmods.length,
          updated_in_last_12_months: `${Math.round((lastmods.filter((t) => t >= yearAgo).length / lastmods.length) * 100)}%`,
          note: "From sitemap <lastmod>. AI search engines favour recently updated pages for time-sensitive questions. Many sites set lastmod automatically, so treat this as a rough signal.",
        }
      : { note: "The sitemap has no <lastmod> dates. Adding accurate ones helps crawlers prioritise updated pages." };

    const siteScore = Math.round(rows.reduce((a, r) => a + r.score, 0) / rows.length);

    return JSON.stringify({
      site: base.origin,
      ai_readiness_score: `${siteScore}/100`,
      pages_checked: rows.length,
      page_source: source,
      sitemaps_read,
      sampling_note: rows.length < pool.length + 1
        ? `Checked ${rows.length} pages sampled across the site's sections, not every page. Treat counts as a sample.`
        : "Checked every page found.",
      issues,
      freshness,
      pages: rows.map((r) => ({
        url: r.url, status: r.status, score: r.score, words: r.words, js_risk: r.js_risk,
        schema: r.schema_types, noindex: r.noindex, blocked_for: r.blocked_for?.length ? r.blocked_for : undefined,
        canonical: r.canonical, title: r.title,
      })),
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── analyze_citability ──────────────────────────────────────────────────────

const FLUFF_WORDS = /\b(innovative|cutting[- ]edge|seamless(ly)?|world[- ]class|revolutionary|best[- ]in[- ]class|game[- ]chang\w*|next[- ]gen(eration)?|leverag\w*|synerg\w*|robust|state[- ]of[- ]the[- ]art|unparalleled|transformative|empower\w*|unlock\w*|supercharg\w*|elevate|holistic|disrupt\w*)\b/gi;
const QUESTION_HEADING = /\?\s*$|^(how|what|why|when|where|which|who|can|does|do|is|are|should|will)\b/i;
const DEFINITIONAL = /\b(is|are|was|means|refers to|lets|helps|allows|enables|costs?|takes?|works|includes?|provides?|offers?|supports?|starts? at|requires?)\b/i;
const WEAK_OPENER = /^(in today'?s|welcome|are you|have you|imagine|looking for|ever wondered|let'?s|we |our )/i;
const STAT_RE = /(?:[$€£₹]\s?\d[\d,.]*\s?(?:k|m|bn|million|billion)?)|\b\d[\d,.]*\s?(?:%|percent|x\b|million|billion|thousand|users|customers|hours|days|minutes)|\b(?:19|20)\d{2}\b/gi;
const SOURCE_RE = /\b(according to|study|survey|report(ed)?|research(ers)?|data from|source:|found that|published)\b/i;

type Section = { heading: string; html: string; text: string; words: number };

function splitSections(html: string): Section[] {
  const body = stripScriptsAndStyles(html).match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? stripScriptsAndStyles(html);
  const parts = body.split(/(<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>)/i);
  const sections: Section[] = [];
  let heading = "(intro)";
  let buf = "";
  const flush = () => {
    const text = decodeEntities(buf.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const words = getWordCount(text);
    if (words >= 15) sections.push({ heading, html: buf, text, words });
  };
  for (const part of parts) {
    if (/^<h[1-3]/i.test(part)) {
      flush();
      heading = decodeEntities(part.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() || "(untitled)";
      buf = "";
    } else {
      buf += part;
    }
  }
  flush();
  return sections;
}

function scoreSection(s: Section, host: string) {
  const firstSentence = s.text.split(/(?<=[.!?])\s+/)[0] ?? "";
  const fsWords = getWordCount(firstSentence);
  const answerFirst = fsWords >= 6 && fsWords <= 35 && DEFINITIONAL.test(firstSentence) && !WEAK_OPENER.test(firstSentence);
  const stats = (s.text.match(STAT_RE) ?? []).length;
  const externalLinks = [...s.html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)]
    .filter((m) => { try { return bareHost(new URL(m[1]).hostname) !== bareHost(host); } catch { return false; } }).length;
  const sourced = externalLinks > 0 || SOURCE_RE.test(s.text);
  const structured = /<(ul|ol|table)\b/i.test(s.html);
  const questionHeading = QUESTION_HEADING.test(s.heading);
  const fluff = (s.text.match(FLUFF_WORDS) ?? []).length;
  const goodLength = s.words >= 40 && s.words <= 300;

  let score = 0;
  if (answerFirst) score += 25;
  score += stats >= 3 ? 20 : stats >= 1 ? 12 : 0;
  if (sourced) score += 15;
  if (structured) score += 10;
  if (goodLength) score += 15; else if (s.words > 300 && s.words <= 500) score += 7;
  if (questionHeading) score += 10;
  if (fluff <= 1) score += 5;

  const fixes: string[] = [];
  if (!answerFirst) fixes.push("Open with a direct one-sentence answer to what the heading asks (e.g. \"X is…\", \"X costs…\"), then add detail.");
  if (stats === 0) fixes.push("Add specific facts: numbers, prices, dates, named customers or results.");
  if (!sourced) fixes.push("Back key claims with a source: link to data, a study or documentation.");
  if (!structured && s.words > 120) fixes.push("Break details into a list or table so they can be lifted cleanly.");
  if (s.words > 300) fixes.push(`At ${s.words} words this section is long; split it under more specific subheadings.`);
  if (s.words < 40) fixes.push("Too short to stand alone as an answer; expand it or merge it with a neighbouring section.");
  if (!questionHeading && s.heading !== "(intro)") fixes.push("Phrase the heading the way people ask the question (e.g. \"How much does X cost?\").");
  if (fluff > 1) fixes.push(`Replace vague marketing words (${[...new Set((s.text.match(FLUFF_WORDS) ?? []).map((w) => w.toLowerCase()))].slice(0, 4).join(", ")}) with concrete claims.`);

  return { score, answerFirst, stats, sourced, structured, questionHeading, fluff, fixes, firstSentence };
}

export async function analyzeCitability(args: { url: string }): Promise<string> {
  try {
    const { html, finalUrl } = await fetchOk(args.url);
    const host = new URL(finalUrl).hostname;
    const sections = splitSections(html);
    if (!sections.length) {
      return JSON.stringify({
        url: finalUrl,
        citability_score: "0/100",
        verdict: "No readable text sections in the raw HTML. If the page looks full in a browser, its content is probably rendered by JavaScript, which most AI crawlers can't see. Run simulate_llm_crawler to confirm.",
      }, null, 2);
    }

    const scored = sections.map((s) => ({ s, r: scoreSection(s, host) }));
    const totalWords = scored.reduce((a, x) => a + x.s.words, 0);
    const pageScore = Math.round(scored.reduce((a, x) => a + x.r.score * x.s.words, 0) / totalWords);

    const schemaTypes = collectSchemaTypes(html);
    const rawSchema = html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi)?.join(" ") ?? "";
    const hasAuthor = extractMetaMatch(html, "author") !== "Missing" || /rel=["']author["']/i.test(html) || /"author"\s*:/.test(rawSchema) || /class=["'][^"']*\b(author|byline)\b/i.test(html);
    const published = extractMetaMatch(html, "article:published_time");
    const modified = extractMetaMatch(html, "article:modified_time");
    const schemaDate = rawSchema.match(/"date(Modified|Published)"\s*:\s*"([^"]+)"/)?.[2];
    const timeTag = html.match(/<time[^>]*datetime=["']([^"']+)["']/i)?.[1];
    const latestDate = [modified, published, schemaDate, timeTag].find((d) => d && d !== "Missing");
    const questionHeadings = scored.filter((x) => QUESTION_HEADING.test(x.s.heading)).length;
    const totalStats = scored.reduce((a, x) => a + x.r.stats, 0);

    const excerpt = (x: (typeof scored)[number]) => {
      const two = x.s.text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
      return two.length > 320 ? two.slice(0, 317) + "…" : two;
    };

    return JSON.stringify({
      url: finalUrl,
      citability_score: `${pageScore}/100`,
      verdict: pageScore >= 70 ? "Highly quotable: AI engines have clear, specific passages to lift."
        : pageScore >= 45 ? "Partly quotable: some sections give AI clean answers, others are vague or hard to extract."
        : "Hard to quote: few sections give a direct, specific, sourced answer AI could cite.",
      method: "Each section (text under an H1-H3) is scored on what makes a passage easy for AI answers to quote: a direct answer first (25), specific facts and numbers (20), sources (15), 40-300 words (15), lists or tables (10), a question-style heading (10), and little marketing fluff (5). The page score is weighted by section length. Research on generative engine optimization found that adding statistics, quotations and source citations makes content more likely to appear in AI answers.",
      page_signals: {
        sections: sections.length,
        words: totalWords,
        numbers_and_facts: totalStats,
        question_style_headings: questionHeadings,
        faq_schema: schemaTypes.includes("FAQPage"),
        author_shown: hasAuthor,
        last_updated: latestDate ?? null,
        lists_and_tables: (html.match(/<(ul|ol|table)\b/gi) ?? []).length,
      },
      page_fixes: [
        ...(!hasAuthor ? ["Show who wrote or reviewed the page (name, role) and add author to the structured data. Named expertise is a trust signal."] : []),
        ...(!latestDate ? ["Show a visible 'last updated' date and set dateModified in the structured data. AI search favours fresh content for time-sensitive questions."] : []),
        ...(questionHeadings < 2 && sections.length >= 4 ? ["Add an FAQ section answering the real questions buyers ask, phrased as questions, with FAQPage schema."] : []),
      ],
      most_quotable: [...scored].sort((a, b) => b.r.score - a.r.score).slice(0, 3).map((x) => ({
        heading: x.s.heading, score: x.r.score, excerpt: excerpt(x),
      })),
      needs_work: [...scored].filter((x) => x.r.score < 60).sort((a, b) => a.r.score - b.r.score).slice(0, 5).map((x) => ({
        heading: x.s.heading, score: x.r.score, words: x.s.words, opens_with: x.r.firstSentence.slice(0, 200), fixes: x.r.fixes,
      })),
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── analyze_ai_answers (AI share of voice) ──────────────────────────────────

const POSITIVE_CUES = /\b(recommend\w*|best|leading|popular|great|excellent|strong|ideal|top|trusted|reliable|easy|standout|favou?rite|well[- ]known|powerful|affordable)\b/i;
const NEGATIVE_CUES = /\b(expensive|pricey|limited|lacks?|lacking|drawbacks?|downsides?|complex|complicated|steep|outdated|issues?|concerns?|complaints?|weak|slow|buggy|not recommended|avoid)\b/i;

function nameRegex(name: string): RegExp {
  const esc = escapeRegex(name.trim()).replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}(?=$|[^\\p{L}\\p{N}])`, "iu");
}

function firstIndex(text: string, re: RegExp): number {
  const m = re.exec(text);
  return m ? m.index + (m[1]?.length ?? 0) : -1;
}

/** Brand-like names that lead list items: "1. **Notion** — …", "- Asana: …". */
function listLeadNames(answer: string): string[] {
  const names: string[] = [];
  for (const line of answer.split("\n")) {
    const m = line.match(/^\s*(?:\d+[.)]|[-*•])\s+(?:\*\*|__)?([A-Z0-9][\w&.'+-]*(?:\s+[A-Z0-9][\w&.'+-]*){0,3})(?:\*\*|__)?\s*(?:[-—–:(]|$)/);
    if (m && m[1].length > 1 && !NON_ENTITY_WORDS.has(m[1])) names.push(m[1].replace(/[.:]+$/, ""));
  }
  return names;
}

function hostsIn(urls: string[]): string[] {
  const out: string[] = [];
  for (const u of urls) {
    try { out.push(bareHost(new URL(u.replace(/[).,\]]+$/, "")).hostname)); } catch { /* skip */ }
  }
  return out;
}

export function analyzeAiAnswers(args: {
  brand_name: string;
  brand_domain?: string;
  competitors?: string[];
  answers: { prompt: string; answer: string; engine?: string; cited_urls?: string[] }[];
}): string {
  try {
    const brand = args.brand_name.trim();
    if (!brand) return JSON.stringify({ error: "brand_name is required." });
    if (!args.answers?.length) return JSON.stringify({ error: "Pass at least one { prompt, answer } in answers." });
    const brandHost = args.brand_domain ? bareHost(normalizeUrl(args.brand_domain).hostname) : null;
    const brandRe = nameRegex(brand);
    const competitors = [...new Set((args.competitors ?? []).map((c) => c.trim()).filter((c) => c && c.toLowerCase() !== brand.toLowerCase()))];

    const mentionCounts = new Map<string, number>(); // answers mentioning each named brand
    const otherCounts = new Map<string, number>();
    const citedCounts = new Map<string, number>();
    const perEngine = new Map<string, { answers: number; mentioned: number }>();

    const results = args.answers.map(({ prompt, answer, engine, cited_urls }) => {
      const eng = engine?.trim() || "this assistant";
      // Earliest of the brand name and its domain; -1 when neither appears.
      const nameIdx = firstIndex(answer, brandRe);
      const hostIdx = brandHost ? answer.toLowerCase().indexOf(brandHost) : -1;
      const brandIdx = nameIdx >= 0 && hostIdx >= 0 ? Math.min(nameIdx, hostIdx) : Math.max(nameIdx, hostIdx);
      const mentioned = brandIdx >= 0;

      const named: { name: string; idx: number }[] = [];
      if (mentioned) named.push({ name: brand, idx: brandIdx });
      for (const c of competitors) {
        const idx = firstIndex(answer, nameRegex(c));
        if (idx >= 0) { named.push({ name: c, idx }); mentionCounts.set(c, (mentionCounts.get(c) ?? 0) + 1); }
      }
      const known = new Set([brand, ...competitors].map((n) => n.toLowerCase()));
      for (const n of new Set(listLeadNames(answer))) {
        if (known.has(n.toLowerCase()) || n.toLowerCase().includes(brand.toLowerCase())) continue;
        const idx = answer.indexOf(n);
        named.push({ name: n, idx });
        otherCounts.set(n, (otherCounts.get(n) ?? 0) + 1);
      }
      named.sort((a, b) => a.idx - b.idx);
      const rank = mentioned ? named.findIndex((n) => n.name === brand) + 1 : null;

      let sentiment: string | null = null;
      if (mentioned) {
        const sentences = answer.split(/(?<=[.!?])\s+|\n+/).filter((s) => brandRe.test(s));
        const pos = sentences.some((s) => POSITIVE_CUES.test(s));
        const neg = sentences.some((s) => NEGATIVE_CUES.test(s));
        sentiment = pos && neg ? "mixed" : pos ? "positive" : neg ? "negative" : "neutral";
      }

      const hosts = [...new Set(hostsIn([...(cited_urls ?? []), ...(answer.match(/https?:\/\/[^\s)\]>"']+/g) ?? [])]))];
      hosts.forEach((h) => citedCounts.set(h, (citedCounts.get(h) ?? 0) + 1));
      const brandCited = brandHost ? hosts.some((h) => h === brandHost || h.endsWith("." + brandHost)) : null;

      const e = perEngine.get(eng) ?? { answers: 0, mentioned: 0 };
      e.answers++; if (mentioned) e.mentioned++;
      perEngine.set(eng, e);

      return {
        prompt, engine: eng, mentioned, rank, brands_in_order: named.map((n) => n.name), sentiment,
        ...(hosts.length ? { cited_domains: hosts, your_site_cited: brandCited } : {}),
      };
    });

    const n = results.length;
    const mentionedCount = results.filter((r) => r.mentioned).length;
    const ranks = results.map((r) => r.rank).filter((r): r is number => r !== null);
    const totalNamed = mentionedCount + [...mentionCounts.values()].reduce((a, b) => a + b, 0);
    const leaderboard = [
      { name: brand, answers_mentioning: mentionedCount, you: true },
      ...competitors.map((c) => ({ name: c, answers_mentioning: mentionCounts.get(c) ?? 0, you: false })),
    ].sort((a, b) => b.answers_mentioning - a.answers_mentioning)
      .map((x) => ({ ...x, share_of_voice: totalNamed ? `${Math.round((x.answers_mentioning / totalNamed) * 100)}%` : "0%" }));

    const missed = results.filter((r) => !r.mentioned);
    const topOthers = [...otherCounts.entries()].filter(([, c]) => c >= Math.min(2, n)).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topCited = [...citedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    const citedAnswers = results.filter((r) => "your_site_cited" in r);

    const actions: string[] = [];
    if (missed.length) {
      actions.push(`You weren't mentioned in ${missed.length} of ${n} answers. For each missed question, publish a page that answers it directly and names ${brand} as an option (see missed_prompts).`);
    }
    const leader = leaderboard.find((x) => !x.you && x.answers_mentioning > mentionedCount);
    if (leader) actions.push(`${leader.name} appears in more answers than you. Publish an honest "${brand} vs ${leader.name}" comparison page and get listed alongside them on review and comparison sites.`);
    if (ranks.length && ranks.reduce((a, b) => a + b, 0) / ranks.length > 2.5) actions.push("When you're mentioned, you tend to come late in the list. Strengthen third-party proof: reviews, analyst and media mentions, and 'best X' roundups that rank you highly.");
    if (topOthers.length) actions.push(`AI also names brands you didn't list as competitors: ${topOthers.map(([name]) => name).join(", ")}. Check whether they're competing for the same questions.`);
    if (topCited.length) actions.push(`The sites AI cites most here are ${topCited.slice(0, 5).map(([h]) => h).join(", ")}. Getting covered or listed on these sources is the most direct route into these answers.`);
    if (citedAnswers.length && !citedAnswers.some((r) => (r as any).your_site_cited)) actions.push("Your own site wasn't cited in any answer that listed sources. Run analyze_citability on your key pages to make them easier to quote.");
    if (results.some((r) => r.sentiment === "negative" || r.sentiment === "mixed")) actions.push("Some answers mention you with caveats. Read those sentences and address the specific concern on your site (pricing page, feature docs, FAQs).");

    return JSON.stringify({
      brand,
      answers_analyzed: n,
      mention_rate: `${Math.round((mentionedCount / n) * 100)}% (${mentionedCount}/${n})`,
      average_position_when_mentioned: ranks.length ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 : null,
      first_place_answers: ranks.filter((r) => r === 1).length,
      share_of_voice: leaderboard,
      by_engine: Object.fromEntries([...perEngine.entries()].map(([k, v]) => [k, `${v.mentioned}/${v.answers} mentioned`])),
      other_brands_ai_mentions: topOthers.map(([name, count]) => ({ name, answers: count })),
      most_cited_domains: topCited.map(([domain, count]) => ({ domain, answers: count })),
      missed_prompts: missed.map((r) => ({ prompt: r.prompt, engine: r.engine, mentioned_instead: r.brands_in_order })),
      answers: results,
      note: "Position = order of first mention among the brands found in each answer. Sentiment is a rough keyword signal; read the sentences before acting on it. Results reflect these answers only; AI answers vary between runs and engines.",
      recommended_actions: actions,
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── check_entity_presence ───────────────────────────────────────────────────

const ORG_TYPES = /^(Organization|Corporation|LocalBusiness|OnlineBusiness|OnlineStore|NGO|EducationalOrganization|SoftwareApplication|Brand|Store|ProfessionalService)$/;

// Wikidata properties worth having on a company item: what AI uses to describe and link the entity.
const WIKIDATA_PROPS: Record<string, string> = {
  P856: "official website",
  P154: "logo",
  P571: "founding date",
  P159: "headquarters",
  P452: "industry",
  P112: "founders",
  P4264: "LinkedIn company ID",
  P2088: "Crunchbase ID",
  P2002: "X (Twitter) username",
  P2397: "YouTube channel ID",
};

const PROFILE_HOSTS: [string, RegExp][] = [
  ["Wikidata", /wikidata\.org/],
  ["Wikipedia", /wikipedia\.org/],
  ["LinkedIn", /linkedin\.com/],
  ["Crunchbase", /crunchbase\.com/],
  ["X / Twitter", /(twitter|x)\.com/],
  ["YouTube", /youtube\.com/],
  ["GitHub", /github\.com/],
  ["Instagram", /instagram\.com/],
  ["Facebook", /facebook\.com/],
];

function findOrgNode(html: string): any | null {
  const nodes: any[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    nodes.push(n);
    if (n["@graph"]) walk(n["@graph"]);
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1])); } catch { /* invalid block */ }
  }
  return nodes.find((n) => [].concat(n["@type"] ?? []).some((t: string) => typeof t === "string" && ORG_TYPES.test(t))) ?? null;
}

export async function checkEntityPresence(args: { brand_name: string; url: string }): Promise<string> {
  try {
    const brand = args.brand_name.trim();
    if (!brand) return JSON.stringify({ error: "brand_name is required." });
    const site = normalizeUrl(args.url);
    const siteHost = bareHost(site.hostname);

    const [homeRes, searchRes] = await Promise.allSettled([
      fetchOk(site.origin + "/"),
      fetchJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(brand)}&language=en&uselang=en&type=item&limit=7&format=json`),
    ]);
    if (homeRes.status === "rejected") return JSON.stringify({ error: (homeRes.reason as Error).message });
    const html = homeRes.value.html;

    // On-site entity signals
    const org = findOrgNode(html);
    const sameAs: string[] = org ? [].concat(org.sameAs ?? []).filter((s: unknown) => typeof s === "string") : [];
    const profilesLinked = PROFILE_HOSTS.filter(([, re]) => sameAs.some((u) => re.test(u))).map(([name]) => name);
    const titleBrand = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const ogSiteName = extractMetaMatch(html, "og:site_name");
    const namesSeen = {
      schema_name: org?.name ?? null,
      og_site_name: ogSiteName === "Missing" ? null : decodeEntities(ogSiteName),
      title: titleBrand || null,
    };
    const brandLower = brand.toLowerCase();
    const inconsistent = Object.entries(namesSeen).filter(([, v]) => v && !String(v).toLowerCase().includes(brandLower)).map(([k]) => k);

    // Wikidata / Wikipedia
    let wikidata: any = { status: "lookup failed" };
    let matched: any = null;
    const candidates: { id: string; label: string; description?: string }[] =
      searchRes.status === "fulfilled" ? (searchRes.value.data?.search ?? []).map((s: any) => ({ id: s.id, label: s.label, description: s.description })) : [];
    if (searchRes.status === "fulfilled") {
      if (candidates.length) {
        const ent = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${candidates.map((c) => c.id).join("|")}&props=claims|sitelinks|descriptions|labels&sitefilter=enwiki&languages=en&format=json`);
        const entities = ent.data?.entities ?? {};
        for (const c of candidates) {
          const e = entities[c.id];
          const sites: string[] = (e?.claims?.P856 ?? []).map((cl: any) => cl?.mainsnak?.datavalue?.value).filter(Boolean);
          if (sites.some((u) => { try { return bareHost(new URL(u).hostname) === siteHost; } catch { return false; } })) {
            matched = { c, e };
            break;
          }
        }
      }
      if (matched) {
        const claims = matched.e.claims ?? {};
        const enwiki = matched.e.sitelinks?.enwiki?.title;
        wikidata = {
          status: "found",
          item: `https://www.wikidata.org/wiki/${matched.c.id}`,
          label: matched.c.label,
          description: matched.e.descriptions?.en?.value ?? null,
          properties_present: Object.entries(WIKIDATA_PROPS).filter(([p]) => claims[p]?.length).map(([, label]) => label),
          properties_missing: Object.entries(WIKIDATA_PROPS).filter(([p]) => !claims[p]?.length).map(([, label]) => label),
          wikipedia: enwiki ? `https://en.wikipedia.org/wiki/${encodeURIComponent(enwiki.replace(/ /g, "_"))}` : null,
        };
      } else {
        wikidata = {
          status: "not found",
          note: candidates.length
            ? `No Wikidata item for "${brand}" lists ${siteHost} as its official website. Items with this name: ${candidates.slice(0, 4).map((c) => `${c.label} (${c.description ?? "no description"})`).join("; ")}. If one of these is you, add your website (P856) to it.`
            : `No Wikidata item matches "${brand}".`,
        };
      }
    }

    let score = 0;
    if (org) score += 20;
    score += Math.min(15, profilesLinked.length * 5);
    if (wikidata.status === "found") score += 25;
    if (wikidata.wikipedia) score += 20;
    if (wikidata.status === "found") score += Math.round(10 * (wikidata.properties_present.length / Object.keys(WIKIDATA_PROPS).length));
    if (!inconsistent.length) score += 10;

    const actions: string[] = [];
    if (!org) actions.push("Add Organization structured data to your homepage (generate_missing_schema builds it).");
    if (org && !org.logo) actions.push("Add a logo to your Organization structured data.");
    if (profilesLinked.length < 3) actions.push(`Add sameAs links to your official profiles in the Organization structured data. Currently linked: ${profilesLinked.join(", ") || "none"}.`);
    if (wikidata.status === "found" && !profilesLinked.includes("Wikidata")) actions.push(`Add your Wikidata item (${wikidata.item}) to sameAs. It's the strongest link between your site and the knowledge graphs AI relies on.`);
    if (wikidata.status === "found" && wikidata.properties_missing.length) actions.push(`Complete your Wikidata item: add ${wikidata.properties_missing.slice(0, 5).join(", ")}. Cite a reliable source for each statement.`);
    if (wikidata.status === "not found") actions.push("Consider creating a Wikidata item if you meet its notability policy (a reliable public source describing you is usually enough), with your official website, founding date, HQ and industry. Don't create one if you don't qualify; it will be deleted.");
    if (wikidata.status === "found" && !wikidata.wikipedia) actions.push("No English Wikipedia article. Don't write one yourself (conflict of interest); earn independent press and analyst coverage, which is what Wikipedia editors need to cite.");
    if (inconsistent.length) actions.push(`Use "${brand}" consistently. These don't contain it: ${inconsistent.join(", ")}.`);

    return JSON.stringify({
      brand,
      site: site.origin,
      entity_score: `${score}/100`,
      why_it_matters: "AI models recognise a brand as one entity when the same facts and links appear in structured data, knowledge graphs (Wikidata, Wikipedia) and consistent profiles. Unrecognised entities get described vaguely, confused with others, or left out.",
      on_site: {
        organization_schema: !!org,
        schema_types_on_homepage: collectSchemaTypes(html),
        logo_in_schema: !!org?.logo,
        same_as_links: sameAs,
        profiles_linked: profilesLinked,
        names_seen: namesSeen,
      },
      wikidata,
      recommended_actions: actions,
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── check_training_data_presence ────────────────────────────────────────────

export async function checkTrainingDataPresence(args: { url: string }): Promise<string> {
  try {
    const site = normalizeUrl(args.url);
    const host = bareHost(site.hostname);

    const [collRes, robots] = await Promise.all([
      fetchJson("https://index.commoncrawl.org/collinfo.json", 15000).catch(() => null),
      fetchRobots(site.origin),
    ]);
    const ccbotAllowed = robotsAllows(robots, "CCBot", "/").allowed;
    const ccbotBlockedAction = "robots.txt blocks CCBot, so Common Crawl can't collect your pages. Allow it if you want future AI models to learn from your site.";
    // Common Crawl's index is a free public service and is often down; report what could still be checked.
    const indexUnavailable = (problem: string) => JSON.stringify({
      site: host,
      verdict: `UNKNOWN: the Common Crawl index didn't respond (${problem}), so this site's captures couldn't be checked. The index is a free public service and often overloaded; try again in a few minutes.`,
      robots_txt_allows_ccbot: ccbotAllowed,
      recommended_actions: ccbotAllowed ? [] : [ccbotBlockedAction],
    }, null, 2);

    const crawls: { id: string; name: string; "cdx-api": string }[] = Array.isArray(collRes?.data) ? collRes!.data : [];
    if (!crawls.length) return indexUnavailable("its crawl list didn't load");

    // Newest crawl first; fall back to the previous one if the index server times out.
    let crawl = crawls[0];
    let lines: string[] | null = null;
    let found = true;
    let lastProblem = "no response";
    for (const c of crawls.slice(0, 3)) {
      try {
        const r = await fetchJson(`${c["cdx-api"]}?url=${encodeURIComponent(host)}&matchType=domain&output=json&limit=500&fl=url,status`, 25000);
        crawl = c;
        if (r.status === 404) { lines = []; found = false; break; }
        if (r.status >= 400) { lastProblem = `HTTP ${r.status}`; continue; }
        lines = r.text.split("\n").filter(Boolean);
        break;
      } catch (e: any) {
        lastProblem = e?.name === "TimeoutError" ? "timed out" : "connection failed";
      }
    }
    if (lines === null) return indexUnavailable(lastProblem);

    const records = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as { url: string; status: string }[];
    const statusCounts: Record<string, number> = {};
    records.forEach((r) => { statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1; });
    const ok = records.filter((r) => r.status === "200");
    const uniquePages = [...new Set(ok.map((r) => normForCompare(r.url)))];
    const homepageCaptured = ok.some((r) => { try { const u = new URL(r.url); return bareHost(u.hostname) === host && (u.pathname === "/" || u.pathname === ""); } catch { return false; } });
    const blockedCaptures = (statusCounts["403"] ?? 0) + (statusCounts["429"] ?? 0) + (statusCounts["503"] ?? 0);
    const capped = records.length >= 500;

    const verdict = !found || !ok.length
      ? "ABSENT: no pages from this site were captured in the latest Common Crawl."
      : uniquePages.length < 10 && !capped
        ? `THIN: only ${uniquePages.length} page(s) captured in the latest Common Crawl.`
        : `PRESENT: ${capped ? "500+" : uniquePages.length} page captures from this site in the latest Common Crawl.`;

    const actions: string[] = [];
    if (!ccbotAllowed) actions.push(ccbotBlockedAction);
    if (blockedCaptures > 0) actions.push(`${blockedCaptures} capture(s) got a 403/429/503 error, which suggests your firewall or CDN blocked the crawler. Check its bot settings.`);
    if (!homepageCaptured && ok.length) actions.push("Your homepage wasn't captured. Make sure it returns HTTP 200 to crawlers and isn't behind a bot challenge.");
    if (!ok.length && ccbotAllowed) actions.push("Common Crawl finds pages by following links. Earn links from other sites (directories, partners, press, communities) and list every page in your sitemap.");

    return JSON.stringify({
      site: host,
      crawl: crawl.name,
      verdict,
      why_it_matters: "Common Crawl is an open archive of the web and one of the most widely used sources of AI training data. If your site isn't in it, models trained on it learn less about you. AI companies also run their own crawlers (GPTBot, ClaudeBot, Google-Extended), so this is one strong signal, not the full picture.",
      captures: {
        total_records: capped ? "500+" : records.length,
        unique_pages_ok: capped ? `${uniquePages.length}+` : uniquePages.length,
        homepage_captured: homepageCaptured,
        http_status_counts: statusCounts,
        sample_pages: uniquePages.slice(0, 10),
      },
      robots_txt_allows_ccbot: ccbotAllowed,
      recommended_actions: actions,
    }, null, 2);
  } catch (e: any) {
    return JSON.stringify({ error: e.message });
  }
}
