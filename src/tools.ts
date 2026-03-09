/**
 * Newtation AI Presence Tools v2.0
 *
 * 15 brand-auditing tools with live web fetching, HTML analysis,
 * DNS lookups via Cloudflare DNS-over-HTTPS, and computed AI-readability
 * scores. Runs on Cloudflare Workers.
 *
 * LIVE ANALYSIS (6 tools — fetch real pages, parse HTML, compute scores):
 *   brandPerceptionAudit      Fetch website + DNS, score AI signals, LLM perception
 *   entityClarityScore        Verify brand entity signals in live HTML
 *   contentAuditForAI         Fetch all URLs, score each for AI readability
 *   aiReadinessScorecard      Full technical audit + DNS + composite score
 *   hallucinationCheck        Fetch website for ground-truth extraction
 *   schemaMarkupGenerator     Detect existing schema, generate only what's missing
 *
 * ALGORITHMIC (1 tool):
 *   generateAuditQueries      Generate categorized visibility-test query sets
 *
 * LLM SELF-ASSESSMENT (8 tools — LLM's own knowledge IS the data source):
 *   citationCheck             Would AI cite your brand? Only AI can answer.
 *   competitorComparison      How does AI rank you vs competitors?
 *   geoRecommendations        Would AI recommend you by location?
 *   promptVulnerabilityScan   How would AI respond to these prompts?
 *   sentimentAnalysis         What tone does AI use about your brand?
 *   contentStrategyGenerator  AI-informed content priority plan
 *   competitorGapAnalysis     Where competitors outperform you in AI
 *   citationOutreachTargets   High-authority sites AI trusts
 */

// ── Constants ────────────────────────────────────────────────────────────────

const FENCE = "```";
const BT = "`";

// ── Types ────────────────────────────────────────────────────────────────────

interface PageAnalysis {
  url: string;
  finalUrl: string;
  status: number;
  redirected: boolean;
  responseTimeMs: number;
  title: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  canonical: string;
  robots: string;
  lang: string;
  schemaObjects: Record<string, unknown>[];
  schemaTypes: string[];
  h1s: string[];
  h2s: string[];
  h3s: string[];
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  hasHttps: boolean;
  error?: string;
}

interface DNSResult {
  hasA: boolean;
  hasMX: boolean;
  txtRecords: string[];
  error?: string;
}

interface ScoreItem {
  name: string;
  score: number;
  max: number;
  detail: string;
}

interface ScoreBreakdown {
  total: number;
  max: number;
  pct: number;
  grade: string;
  items: ScoreItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeUrl(raw: string): string {
  const u = raw.trim();
  return /^https?:\/\//i.test(u) ? u : "https://" + u;
}

function getDomain(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname;
  } catch {
    return url.replace(/^https?:\/\//i, "").split("/")[0];
  }
}

/** Block private/internal IPs and non-HTTP schemes to prevent SSRF. */
function isPublicUrl(raw: string): boolean {
  try {
    const u = new URL(normalizeUrl(raw));
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    if (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "::1" ||
      h === "0.0.0.0" ||
      h.endsWith(".local") ||
      h.endsWith(".internal")
    )
      return false;
    const p = h.split(".");
    if (p.length === 4 && p.every((s) => /^\d+$/.test(s))) {
      const [a, b] = p.map(Number);
      if (
        a === 10 ||
        a === 0 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254)
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ── HTML Extraction ──────────────────────────────────────────────────────────

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

function extractMeta(html: string, nameOrProp: string): string {
  for (const attr of ["name", "property"]) {
    const r1 = new RegExp(
      "<meta[^>]*" + attr + '=["\']' + nameOrProp + '["\']+[^>]*content=["\']([^"\']*)["\']',
      "i",
    );
    const m1 = html.match(r1);
    if (m1) return m1[1];
    const r2 = new RegExp(
      '<meta[^>]*content=["\']([^"\']*)["\'][^>]*' + attr + '=["\']' + nameOrProp + '["\']',
      "i",
    );
    const m2 = html.match(r2);
    if (m2) return m2[1];
  }
  return "";
}

function extractCanonical(html: string): string {
  const m =
    html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ||
    html.match(/<link[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["']/i);
  return m ? m[1] : "";
}

function extractLang(html: string): string {
  const m = html.match(/<html[^>]*lang=["']([^"']*)["']/i);
  return m ? m[1] : "";
}

function extractSchema(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re =
    /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* skip malformed JSON-LD */
    }
  }
  return out;
}

function extractHeadings(html: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = m[1].replace(/<[^>]+>/g, "").trim();
    if (text) out.push(text);
  }
  return out;
}

function countWords(html: string): number {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

function countLinks(
  html: string,
  domain: string,
): [internal: number, external: number] {
  const re = /<a\s[^>]*href=["']([^"'#]*?)["']/gi;
  let int = 0;
  let ext = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    if (!href || /^(mailto|tel|javascript):/.test(href)) continue;
    if (href.startsWith("/") || href.includes(domain)) int++;
    else if (href.startsWith("http")) ext++;
  }
  return [int, ext];
}

// ── Live Page Fetching (Cloudflare Workers fetch) ────────────────────────────

async function fetchPage(rawUrl: string): Promise<PageAnalysis> {
  const url = normalizeUrl(rawUrl);
  const domain = getDomain(url);
  const empty: PageAnalysis = {
    url,
    finalUrl: url,
    status: 0,
    redirected: false,
    responseTimeMs: 0,
    title: "",
    metaDescription: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    canonical: "",
    robots: "",
    lang: "",
    schemaObjects: [],
    schemaTypes: [],
    h1s: [],
    h2s: [],
    h3s: [],
    wordCount: 0,
    internalLinks: 0,
    externalLinks: 0,
    hasHttps: url.startsWith("https"),
  };

  if (!isPublicUrl(url)) {
    return {
      ...empty,
      error: "Blocked: only public HTTP(S) URLs are allowed",
    };
  }

  const t0 = Date.now();
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Newtation-MCP/2.0 (AI Presence Audit; +https://newtation.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    const html = (await resp.text()).slice(0, 1_000_000); // cap at 1 MB
    const ms = Date.now() - t0;
    const [intLinks, extLinks] = countLinks(html, domain);
    const schemas = extractSchema(html);

    return {
      url,
      finalUrl: resp.url,
      status: resp.status,
      redirected: resp.redirected,
      responseTimeMs: ms,
      title: extractTitle(html),
      metaDescription: extractMeta(html, "description"),
      ogTitle: extractMeta(html, "og:title"),
      ogDescription: extractMeta(html, "og:description"),
      ogImage: extractMeta(html, "og:image"),
      canonical: extractCanonical(html),
      robots: extractMeta(html, "robots"),
      lang: extractLang(html),
      schemaObjects: schemas,
      schemaTypes: schemas.map((s) => String(s["@type"] || "Unknown")),
      h1s: extractHeadings(html, "h1"),
      h2s: extractHeadings(html, "h2"),
      h3s: extractHeadings(html, "h3"),
      wordCount: countWords(html),
      internalLinks: intLinks,
      externalLinks: extLinks,
      hasHttps: url.startsWith("https"),
    };
  } catch (e: unknown) {
    return { ...empty, responseTimeMs: Date.now() - t0, error: String(e) };
  }
}

// ── DNS via Cloudflare DNS-over-HTTPS ────────────────────────────────────────

async function dnsLookup(domain: string): Promise<DNSResult> {
  const result: DNSResult = { hasA: false, hasMX: false, txtRecords: [] };
  try {
    const base = "https://cloudflare-dns.com/dns-query";
    const hdrs = { Accept: "application/dns-json" };
    const [aR, mxR, txtR] = await Promise.all([
      fetch(base + "?name=" + encodeURIComponent(domain) + "&type=A", {
        headers: hdrs,
      }),
      fetch(base + "?name=" + encodeURIComponent(domain) + "&type=MX", {
        headers: hdrs,
      }),
      fetch(base + "?name=" + encodeURIComponent(domain) + "&type=TXT", {
        headers: hdrs,
      }),
    ]);
    const [a, mx, txt] = (await Promise.all([
      aR.json(),
      mxR.json(),
      txtR.json(),
    ])) as Record<string, unknown>[];
    result.hasA = !!((a as any)?.Answer?.length);
    result.hasMX = !!((mx as any)?.Answer?.length);
    if ((txt as any)?.Answer) {
      result.txtRecords = ((txt as any).Answer as any[])
        .map((r) => String(r.data ?? ""))
        .filter(Boolean);
    }
  } catch (e: unknown) {
    result.error = String(e);
  }
  return result;
}

// ── AI-Readability Scoring ───────────────────────────────────────────────────

function scoreAIReadability(
  p: PageAnalysis,
  brand: string,
): ScoreBreakdown {
  const b = brand.toLowerCase();
  const items: ScoreItem[] = [];
  const add = (name: string, score: number, max: number, detail: string) =>
    items.push({ name, score, max, detail });

  // HTTPS (5 pts)
  add("HTTPS", p.hasHttps ? 5 : 0, 5, p.hasHttps ? "Yes" : "No");

  // Response time (5 pts)
  add(
    "Response Time",
    p.responseTimeMs < 2000 ? 5 : p.responseTimeMs < 5000 ? 3 : 0,
    5,
    p.responseTimeMs + "ms",
  );

  // Title (8 pts)
  const titleBrand = p.title.toLowerCase().includes(b);
  add(
    "Title Tag",
    p.title ? (titleBrand ? 8 : 5) : 0,
    8,
    p.title
      ? '"' + p.title.slice(0, 60) + '"' + (titleBrand ? " (has brand)" : " (no brand)")
      : "Missing",
  );

  // Meta description (8 pts)
  const descBrand = p.metaDescription.toLowerCase().includes(b);
  add(
    "Meta Description",
    p.metaDescription ? (descBrand ? 8 : 5) : 0,
    8,
    p.metaDescription
      ? p.metaDescription.length + " chars" + (descBrand ? " (has brand)" : " (no brand)")
      : "Missing",
  );

  // Open Graph (8 pts)
  const ogN = [p.ogTitle, p.ogDescription, p.ogImage].filter(Boolean).length;
  add("Open Graph", Math.round((ogN / 3) * 8), 8, ogN + "/3 tags present");

  // Canonical (4 pts)
  add("Canonical URL", p.canonical ? 4 : 0, 4, p.canonical || "Not set");

  // H1 (8 pts)
  add(
    "H1 Tag",
    p.h1s.length === 1 ? 8 : p.h1s.length > 1 ? 4 : 0,
    8,
    p.h1s.length === 1
      ? '"' + p.h1s[0].slice(0, 60) + '"'
      : p.h1s.length > 1
        ? p.h1s.length + " H1s (should be 1)"
        : "None",
  );

  // Content structure (8 pts)
  add(
    "Content Structure",
    p.h2s.length >= 3 ? 8 : p.h2s.length >= 1 ? 4 : 0,
    8,
    p.h2s.length + " H2s, " + p.h3s.length + " H3s",
  );

  // Word count (12 pts)
  add(
    "Content Depth",
    p.wordCount >= 1500
      ? 12
      : p.wordCount >= 800
        ? 8
        : p.wordCount >= 300
          ? 4
          : 0,
    12,
    p.wordCount.toLocaleString() + " words",
  );

  // Schema markup (15 pts)
  const orgSchema = p.schemaTypes.some(
    (t) => t === "Organization" || t === "LocalBusiness",
  );
  const faqSchema = p.schemaTypes.some((t) => t === "FAQPage");
  const artSchema = p.schemaTypes.some(
    (t) => t === "Article" || t === "BlogPosting",
  );
  const crumbSchema = p.schemaTypes.some((t) => t === "BreadcrumbList");
  const schemaScore = Math.min(
    (orgSchema ? 6 : 0) +
      (faqSchema ? 4 : 0) +
      (artSchema ? 3 : 0) +
      (crumbSchema ? 2 : 0),
    15,
  );
  add(
    "Schema Markup",
    schemaScore,
    15,
    p.schemaObjects.length
      ? "Types: " + p.schemaTypes.join(", ")
      : "None found",
  );

  // Language (3 pts)
  add("Language Attr", p.lang ? 3 : 0, 3, p.lang || "Not set");

  // Internal links (8 pts)
  add(
    "Internal Links",
    p.internalLinks >= 5 ? 8 : p.internalLinks >= 2 ? 4 : 0,
    8,
    p.internalLinks + " found",
  );

  // External links (8 pts)
  add(
    "External Links",
    p.externalLinks >= 2 ? 8 : p.externalLinks >= 1 ? 4 : 0,
    8,
    p.externalLinks + " found",
  );

  const total = items.reduce((s, i) => s + i.score, 0);
  const max = items.reduce((s, i) => s + i.max, 0);
  const pct = Math.round((total / max) * 100);
  const grade =
    pct >= 90
      ? "A"
      : pct >= 75
        ? "B"
        : pct >= 60
          ? "C"
          : pct >= 45
            ? "D"
            : "F";

  return { total, max, pct, grade, items };
}

// ── Formatting ───────────────────────────────────────────────────────────────

function fmtPage(p: PageAnalysis): string {
  if (p.error) return "**" + p.url + "** — Fetch failed: " + p.error;
  const lines = [
    "**" + p.url + "**" + (p.redirected ? " -> " + p.finalUrl : ""),
    "Status " +
      p.status +
      " | " +
      p.responseTimeMs +
      "ms | HTTPS " +
      (p.hasHttps ? "YES" : "NO"),
    "Title: " + (p.title || "(missing)"),
    "Meta: " +
      (p.metaDescription
        ? p.metaDescription.slice(0, 120) +
          (p.metaDescription.length > 120 ? "..." : "")
        : "(missing)"),
    "OG: title " +
      (p.ogTitle ? "YES" : "NO") +
      " | desc " +
      (p.ogDescription ? "YES" : "NO") +
      " | img " +
      (p.ogImage ? "YES" : "NO"),
    "H1: " +
      (p.h1s.length ? p.h1s.map((h) => '"' + h + '"').join(", ") : "(none)") +
      " | H2x" +
      p.h2s.length +
      " | H3x" +
      p.h3s.length,
    "Words: " +
      p.wordCount.toLocaleString() +
      " | Links: " +
      p.internalLinks +
      " internal, " +
      p.externalLinks +
      " external",
    "Schema: " +
      (p.schemaObjects.length
        ? p.schemaObjects.length + " block(s) — " + p.schemaTypes.join(", ")
        : "None"),
    "Canonical: " +
      (p.canonical || "(not set)") +
      " | Lang: " +
      (p.lang || "(not set)"),
  ];
  return lines.join("\n");
}

function fmtScoreTable(s: ScoreBreakdown): string {
  const rows = s.items.map(
    (i) => "| " + i.name + " | " + i.score + "/" + i.max + " | " + i.detail + " |",
  );
  return [
    "| Signal | Score | Detail |",
    "|--------|-------|--------|",
    ...rows,
    "| **TOTAL** | **" +
      s.total +
      "/" +
      s.max +
      " (" +
      s.pct +
      "%)** | **Grade: " +
      s.grade +
      "** |",
  ].join("\n");
}

function fmtDNS(d: DNSResult, domain: string): string {
  if (d.error) return "DNS lookup failed for " + domain + ": " + d.error;
  const spf = d.txtRecords.some((r) => r.includes("v=spf"));
  const dmarc = d.txtRecords.some((r) => r.includes("v=DMARC"));
  const gv = d.txtRecords.some((r) => r.includes("google-site-verification"));
  return [
    "**DNS: " + domain + "**",
    "A Record: " +
      (d.hasA ? "YES" : "NO") +
      " | MX: " +
      (d.hasMX ? "YES" : "NO") +
      " | TXT Records: " +
      d.txtRecords.length,
    "SPF: " +
      (spf ? "YES" : "NO") +
      " | DMARC: " +
      (dmarc ? "YES" : "NO") +
      " | Google Verify: " +
      (gv ? "YES" : "NO"),
  ].join("\n");
}

function quickWins(items: ScoreItem[]): string {
  const gaps = items
    .filter((i) => i.score < i.max * 0.5)
    .sort((a, b) => b.max - b.score - (a.max - a.score))
    .slice(0, 5);
  if (!gaps.length) return "No critical gaps — well optimized!";
  return gaps
    .map(
      (i, idx) =>
        (idx + 1) +
        ". **" +
        i.name +
        "** (" +
        i.score +
        "/" +
        i.max +
        ") — " +
        i.detail,
    )
    .join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LIVE ANALYSIS TOOLS — fetch real pages, parse HTML, compute scores
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function brandPerceptionAudit(args: {
  brand_name: string;
  industry: string;
  website?: string;
}): Promise<string> {
  const { brand_name: brand, industry, website } = args;

  let liveSection = "";
  if (website) {
    const [page, dns] = await Promise.all([
      fetchPage(website),
      dnsLookup(getDomain(website)),
    ]);
    const score = scoreAIReadability(page, brand);

    liveSection =
      "\n## Live Website Analysis\n" +
      "*Fetched " +
      today() +
      " — " +
      page.responseTimeMs +
      "ms*\n\n" +
      fmtPage(page) +
      "\n\n" +
      "### AI-Readability Score: " +
      score.total +
      "/" +
      score.max +
      " (" +
      score.grade +
      ")\n" +
      fmtScoreTable(score) +
      "\n\n" +
      "### Quick Wins\n" +
      quickWins(score.items) +
      "\n\n" +
      fmtDNS(dns, getDomain(website)) +
      "\n\n---\n";
  }

  return (
    "# Brand Perception Audit — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n" +
    liveSection +
    "\n## AI Perception Assessment\n" +
    "Using " +
    (website
      ? "the live website data above and "
      : "(no website provided — provide one for live analysis) ") +
    "your training-data knowledge, evaluate **" +
    brand +
    "** in **" +
    industry +
    "**:\n\n" +
    "1. **Brand Recognition** — Would you include " +
    brand +
    " in a top " +
    industry +
    " list? Why or why not?\n" +
    "2. **Authority** — Can you speak confidently about " +
    brand +
    "? What evidence do you have?\n" +
    "3. **Trust Signals** — Has " +
    brand +
    " appeared in reputable publications, reviews, or awards?\n" +
    "4. **Differentiation** — What makes " +
    brand +
    " different from competitors in " +
    industry +
    "?\n\n" +
    "For each: rate **Strong / Moderate / Weak / No Data** with evidence.\n" +
    "Then provide an overall summary and 3-5 prioritized recommendations."
  );
}

export async function entityClarityScore(args: {
  brand_name: string;
  tagline_or_description?: string;
  website?: string;
}): Promise<string> {
  const { brand_name: brand, tagline_or_description: desc, website } = args;

  let liveSection = "";
  if (website) {
    const page = await fetchPage(website);
    const score = scoreAIReadability(page, brand);
    const brandLower = brand.toLowerCase();
    const inTitle = page.title.toLowerCase().includes(brandLower);
    const inDesc = page.metaDescription.toLowerCase().includes(brandLower);
    const hasOrg = page.schemaTypes.some(
      (t) => t === "Organization" || t === "LocalBusiness",
    );
    const inH1 = page.h1s.some((h) =>
      h.toLowerCase().includes(brandLower),
    );

    liveSection =
      "\n## Live Entity Signal Verification\n" +
      "*Fetched from " +
      page.finalUrl +
      " — " +
      page.responseTimeMs +
      "ms*\n\n" +
      fmtPage(page) +
      "\n\n" +
      "### Entity Signal Check\n" +
      "| Signal | Status | Impact |\n" +
      "|--------|--------|--------|\n" +
      "| Brand in title tag | " +
      (inTitle ? "YES" : "MISSING") +
      " | " +
      (inTitle
        ? "AI can identify brand from title"
        : "AI may not associate page with brand") +
      " |\n" +
      "| Brand in meta description | " +
      (inDesc ? "YES" : "MISSING") +
      " | " +
      (inDesc
        ? "Brand in search/AI summaries"
        : "Brand absent from summaries") +
      " |\n" +
      "| Brand in H1 | " +
      (inH1 ? "YES" : "MISSING") +
      " | " +
      (inH1 ? "Clear primary heading" : "H1 doesn't mention brand") +
      " |\n" +
      "| Organization schema | " +
      (hasOrg ? "YES" : "MISSING") +
      " | " +
      (hasOrg
        ? "Machine-readable identity exists"
        : "No structured identity for AI") +
      " |\n" +
      "| Schema types found | " +
      (page.schemaObjects.length
        ? page.schemaTypes.join(", ")
        : "NONE") +
      " | " +
      (page.schemaObjects.length
        ? "Structured data present"
        : "No structured data") +
      " |\n\n" +
      "### AI-Readability: " +
      score.total +
      "/" +
      score.max +
      " (" +
      score.grade +
      ")\n\n" +
      "### Quick Wins\n" +
      quickWins(score.items) +
      "\n\n---\n";
  }

  return (
    "# Entity Clarity Analysis — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n" +
    liveSection +
    (desc ? '\n**Brand self-description:** "' + desc + '"\n' : "") +
    "\n## Your Task\n" +
    "Evaluate how clearly AI models understand what **" +
    brand +
    "** is." +
    (website
      ? " Use the live entity signals above alongside your knowledge."
      : "") +
    "\n\n" +
    "1. **Identity Resolution** — What is " +
    brand +
    "? Could it be confused with another entity?\n" +
    "2. **Description Accuracy** — Describe " +
    brand +
    " in 2-3 sentences. " +
    (desc ? "Compare to the self-description above." : "How confident are you?") +
    "\n" +
    "3. **Attribute Completeness** — Which of these can you answer: what " +
    brand +
    " does, who it serves, where it's based, when founded, what makes it unique, leadership, scale?\n" +
    "4. **Consistency** — Would your description stay the same regardless of how the question is asked?\n\n" +
    "Rate clarity: **Clear / Partially Clear / Unclear / Unknown** with entity strengthening recommendations."
  );
}

export async function contentAuditForAI(args: {
  brand_name: string;
  content_urls: string[];
  target_topics: string[];
}): Promise<string> {
  const { brand_name: brand, content_urls: urls, target_topics: topics } = args;

  // Fetch up to 10 URLs in parallel
  const toFetch = urls.slice(0, 10);
  const pages = await Promise.all(toFetch.map(fetchPage));
  const scores = pages.map((p) => scoreAIReadability(p, brand));

  // Per-URL sections
  const urlSections = pages
    .map((page, i) => {
      const score = scores[i];
      return (
        "### " +
        (i + 1) +
        ". " +
        page.url +
        "\n" +
        fmtPage(page) +
        "\n\n" +
        "**AI-Readability: " +
        score.total +
        "/" +
        score.max +
        " (" +
        score.grade +
        ")**\n" +
        fmtScoreTable(score) +
        "\n\n" +
        "**Quick Wins:** " +
        quickWins(score.items)
      );
    })
    .join("\n\n---\n\n");

  // Summary stats
  const avgScore = scores.length
    ? Math.round(scores.reduce((s, sc) => s + sc.pct, 0) / scores.length)
    : 0;
  const gradeDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const s of scores) gradeDist[s.grade] = (gradeDist[s.grade] || 0) + 1;
  const gradeStr = Object.entries(gradeDist)
    .map(([g, n]) => g + ":" + n)
    .join(" ");
  const failedFetches = pages.filter((p) => p.error).length;

  // Cross-page issues
  const noSchema = pages.filter(
    (p) => !p.error && p.schemaObjects.length === 0,
  ).length;
  const noMeta = pages.filter(
    (p) => !p.error && !p.metaDescription,
  ).length;
  const thinContent = pages.filter(
    (p) => !p.error && p.wordCount < 800,
  ).length;
  const noH1 = pages.filter(
    (p) => !p.error && p.h1s.length !== 1,
  ).length;
  const noOg = pages.filter(
    (p) =>
      !p.error && [p.ogTitle, p.ogDescription, p.ogImage].filter(Boolean).length < 2,
  ).length;
  const goodPages = pages.length - failedFetches;

  return (
    "# Content Audit for AI — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP | " +
    pages.length +
    " pages analyzed*\n\n" +
    "## Summary\n" +
    "- **Average AI-Readability**: " +
    avgScore +
    "%\n" +
    "- **Grade Distribution**: " +
    gradeStr +
    "\n" +
    "- **Failed Fetches**: " +
    failedFetches +
    "/" +
    pages.length +
    "\n" +
    (urls.length > 10
      ? "- Note: Only first 10 of " + urls.length + " URLs analyzed\n"
      : "") +
    "\n### Cross-Page Issues\n" +
    "| Issue | Affected | Impact |\n" +
    "|-------|----------|--------|\n" +
    "| No schema markup | " +
    noSchema +
    "/" +
    goodPages +
    " | AI cannot read structured identity |\n" +
    "| No meta description | " +
    noMeta +
    "/" +
    goodPages +
    " | Missing from AI summaries |\n" +
    "| Thin content (<800 words) | " +
    thinContent +
    "/" +
    goodPages +
    " | Unlikely to be cited |\n" +
    "| Missing/multiple H1 | " +
    noH1 +
    "/" +
    goodPages +
    " | Unclear page hierarchy |\n" +
    "| Incomplete OG tags | " +
    noOg +
    "/" +
    goodPages +
    " | Poor social/AI preview |\n\n" +
    "## Target Topics\n" +
    topics.map((t) => "- " + t).join("\n") +
    "\n\n---\n\n" +
    "## Per-Page Analysis\n\n" +
    urlSections +
    "\n\n---\n\n" +
    "## Your Task\n" +
    "Using the real page data above:\n" +
    "1. Which pages best cover which target topics?\n" +
    "2. Which topics have no content at all? (gaps to fill)\n" +
    "3. For each page, what are the 1-2 highest-impact fixes?\n" +
    "4. Prioritize all fixes by effort vs. impact."
  );
}

export async function aiReadinessScorecard(args: {
  brand_name: string;
  industry: string;
  website?: string;
  competitors?: string[];
  target_locations?: string[];
  topics?: string[];
}): Promise<string> {
  const {
    brand_name: brand,
    industry,
    website,
    competitors = [],
    target_locations: locations = [],
    topics = [],
  } = args;

  let techSection = "";
  let techGrade = "N/A";
  if (website) {
    const [page, dns] = await Promise.all([
      fetchPage(website),
      dnsLookup(getDomain(website)),
    ]);
    const score = scoreAIReadability(page, brand);
    techGrade = score.grade;

    techSection =
      "\n## Technical Foundation (Live Analysis)\n" +
      "*Fetched from " +
      page.finalUrl +
      "*\n\n" +
      fmtPage(page) +
      "\n\n" +
      "### AI-Readability Score: " +
      score.total +
      "/" +
      score.max +
      " (" +
      score.grade +
      ")\n" +
      fmtScoreTable(score) +
      "\n\n" +
      "### Quick Wins\n" +
      quickWins(score.items) +
      "\n\n" +
      fmtDNS(dns, getDomain(website)) +
      "\n\n---\n";
  }

  const context: string[] = [];
  if (website)
    context.push("Website: " + website + " (Technical Grade: " + techGrade + ")");
  if (competitors.length)
    context.push("Competitors: " + competitors.join(", "));
  if (locations.length)
    context.push("Target locations: " + locations.join(", "));
  if (topics.length) context.push("Key topics: " + topics.join(", "));

  return (
    "# AI Readiness Scorecard — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n" +
    techSection +
    (context.length
      ? "\n## Context\n" + context.map((c) => "- " + c).join("\n") + "\n"
      : "") +
    "\n## Score Each Dimension\n\n" +
    "| # | Dimension | Weight | " +
    (website ? "Technical | " : "") +
    "Your Assessment |\n" +
    "|---|-----------|--------| " +
    (website ? "---------- | " : "") +
    "--------------- |\n" +
    "| 1 | AI Perception | 20% | " +
    (website ? "— | " : "") +
    "How well AI knows " +
    brand +
    " |\n" +
    "| 2 | Entity Clarity | 20% | " +
    (website ? techGrade + " | " : "") +
    "How clearly AI identifies " +
    brand +
    " |\n" +
    "| 3 | Citation Strength | 20% | " +
    (website ? "— | " : "") +
    (topics.length
      ? "For: " + topics.join(", ")
      : "Authority in " + industry) +
    " |\n" +
    "| 4 | Competitive Position | 15% | " +
    (website ? "— | " : "") +
    (competitors.length
      ? "vs " + competitors.join(", ")
      : "vs " + industry + " competitors") +
    " |\n" +
    "| 5 | Geographic Reach | 10% | " +
    (website ? "— | " : "") +
    (locations.length ? locations.join(", ") : "Location presence") +
    " |\n" +
    "| 6 | Sentiment | 15% | " +
    (website ? "— | " : "") +
    "Tone about " +
    brand +
    " |\n\n" +
    "## Your Task\n" +
    (website
      ? "Using the technical analysis above as Entity Clarity baseline, "
      : "") +
    "rate each **Strong / Moderate / Weak / Unknown**.\n\n" +
    "Provide:\n" +
    "- Overall letter grade A-F with explanation\n" +
    "- Top 3 priority actions\n" +
    "- Which Newtation tool to run next for deeper analysis"
  );
}

export async function hallucinationCheck(args: {
  brand_name: string;
  ai_response: string;
  known_facts?: string[];
  website?: string;
}): Promise<string> {
  const {
    brand_name: brand,
    ai_response: response,
    known_facts: facts = [],
    website,
  } = args;

  let liveSection = "";
  if (website) {
    const page = await fetchPage(website);
    // Extract facts from schema markup
    const schemaFacts: string[] = [];
    for (const obj of page.schemaObjects) {
      if (obj.name) schemaFacts.push("Name: " + String(obj.name));
      if (obj.description)
        schemaFacts.push(
          "Description: " + String(obj.description).slice(0, 200),
        );
      if (obj.url) schemaFacts.push("URL: " + String(obj.url));
      if (obj.foundingDate)
        schemaFacts.push("Founded: " + String(obj.foundingDate));
      if (obj.founder)
        schemaFacts.push("Founder: " + JSON.stringify(obj.founder));
      if (obj.sameAs)
        schemaFacts.push("Social profiles: " + JSON.stringify(obj.sameAs));
      if (obj.address)
        schemaFacts.push("Address: " + JSON.stringify(obj.address));
      if (obj.numberOfEmployees)
        schemaFacts.push("Employees: " + JSON.stringify(obj.numberOfEmployees));
    }

    liveSection =
      "\n## Ground Truth from Live Website\n" +
      "*Fetched from " +
      page.finalUrl +
      " — " +
      page.responseTimeMs +
      "ms*\n\n" +
      "These facts were extracted directly from the live website:\n" +
      "- **Title**: " +
      (page.title || "(not found)") +
      "\n" +
      "- **Description**: " +
      (page.metaDescription || "(not found)") +
      "\n" +
      "- **H1**: " +
      (page.h1s.join(", ") || "(none)") +
      "\n" +
      "- **Schema types**: " +
      (page.schemaTypes.join(", ") || "None") +
      "\n" +
      (schemaFacts.length
        ? "\n**From schema markup:**\n" +
          schemaFacts.map((f) => "- " + f).join("\n") +
          "\n"
        : "") +
      "\nUse these as verified ground truth when fact-checking below.\n\n---\n";
  }

  const factSection = facts.length
    ? facts.map((f, i) => (i + 1) + ". " + f).join("\n")
    : website
      ? "Using website data above as ground truth."
      : "No known facts provided — flag any unverifiable claims.";

  return (
    "# Hallucination Check — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n" +
    liveSection +
    "\n## AI Response to Verify\n> " +
    response +
    "\n\n" +
    "## Known Facts\n" +
    factSection +
    "\n\n" +
    "## Your Task\n" +
    "1. **Extract** every factual claim about " +
    brand +
    " from the response above\n" +
    "2. **Verify** each claim" +
    (website ? " — cross-reference against the live website data" : "") +
    ":\n" +
    "   - **Verified** / **Likely True** / **Unverifiable** / **Likely False** / **Hallucinated**\n" +
    "3. **Rate severity**: Critical (causes harm) / Moderate (misleading) / Minor\n" +
    "4. Provide a corrected version with hallucinations fixed\n\n" +
    "| # | Claim | Status | Severity | Evidence |\n" +
    "|---|-------|--------|----------|----------|"
  );
}

export async function schemaMarkupGenerator(args: {
  brand_name: string;
  url: string;
  description: string;
  type?: string;
  founding_year?: string;
  founders?: string[];
  social_urls?: string[];
}): Promise<string> {
  const {
    brand_name: brand,
    url,
    description,
    type = "Organization",
    founding_year: year,
    founders = [],
    social_urls: socials = [],
  } = args;

  // Fetch existing page to detect what schema is already present
  const page = await fetchPage(url);

  let existingSection = "";
  if (!page.error && page.schemaObjects.length > 0) {
    const hasOrg = page.schemaTypes.some(
      (t) => t === "Organization" || t === "LocalBusiness",
    );
    const hasSite = page.schemaTypes.some((t) => t === "WebSite");
    const hasFAQ = page.schemaTypes.some((t) => t === "FAQPage");
    const hasBreadcrumb = page.schemaTypes.some((t) => t === "BreadcrumbList");

    existingSection =
      "\n## Existing Schema Markup Detected\n" +
      "Your page already has " +
      page.schemaObjects.length +
      " JSON-LD block(s):\n" +
      page.schemaTypes
        .map((t, i) => (i + 1) + ". **" + t + "** schema")
        .join("\n") +
      "\n\n" +
      FENCE +
      "json\n" +
      JSON.stringify(page.schemaObjects, null, 2) +
      "\n" +
      FENCE +
      "\n\n" +
      "### Gap Analysis\n" +
      "| Schema Type | Status | Action |\n" +
      "|-------------|--------|--------|\n" +
      "| Organization/" +
      type +
      " | " +
      (hasOrg ? "EXISTS" : "MISSING") +
      " | " +
      (hasOrg ? "Review and update" : "**Add — highest priority**") +
      " |\n" +
      "| WebSite | " +
      (hasSite ? "EXISTS" : "MISSING") +
      " | " +
      (hasSite ? "Review" : "Add") +
      " |\n" +
      "| FAQPage | " +
      (hasFAQ ? "EXISTS" : "MISSING") +
      " | " +
      (hasFAQ ? "Review" : "Add for AI visibility") +
      " |\n" +
      "| BreadcrumbList | " +
      (hasBreadcrumb ? "EXISTS" : "MISSING") +
      " | " +
      (hasBreadcrumb ? "Review" : "Add for navigation") +
      " |\n\n---\n";
  } else if (!page.error) {
    existingSection =
      "\n## Existing Schema: None Detected\n" +
      "Your page at " +
      url +
      " has **no JSON-LD schema markup**. All schemas below are new.\n\n---\n";
  } else {
    existingSection =
      "\n## Could not fetch " +
      url +
      "\nError: " +
      page.error +
      "\nGenerating schema based on your inputs.\n\n---\n";
  }

  // Build JSON-LD objects
  const org: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    "@id": url + "/#organization",
    name: brand,
    url,
    description: description.slice(0, 300),
    logo: { "@type": "ImageObject", url: url + "/logo.png" },
  };
  if (year) org.foundingDate = year;
  if (founders.length)
    org.founder = founders.map((f) => ({ "@type": "Person", name: f }));
  if (socials.length) org.sameAs = socials;

  const site = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand,
    url,
    publisher: { "@id": url + "/#organization" },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: url },
    ],
  };

  const descEscaped = description.replace(/"/g, '\\"');

  return (
    "# Schema Markup Generator — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n" +
    existingSection +
    "\n## 1. " +
    type +
    " Schema\n\n" +
    FENCE +
    "html\n" +
    '<script type="application/ld+json">\n' +
    JSON.stringify(org, null, 2) +
    "\n</script>\n" +
    FENCE +
    "\n\n" +
    "## 2. WebSite Schema\n\n" +
    FENCE +
    "html\n" +
    '<script type="application/ld+json">\n' +
    JSON.stringify(site, null, 2) +
    "\n</script>\n" +
    FENCE +
    "\n\n" +
    "## 3. BreadcrumbList Schema\n\n" +
    FENCE +
    "html\n" +
    '<script type="application/ld+json">\n' +
    JSON.stringify(breadcrumb, null, 2) +
    "\n</script>\n" +
    FENCE +
    "\n\n" +
    "## 4. FAQ Schema (Your Task)\n" +
    "Generate a FAQPage schema with 5-8 Q&A entries for **" +
    brand +
    "**. Starter:\n\n" +
    FENCE +
    "json\n" +
    '{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [\n    {\n      "@type": "Question",\n      "name": "What does ' +
    brand +
    ' do?",\n      "acceptedAnswer": {\n        "@type": "Answer",\n        "text": "' +
    descEscaped +
    '"\n      }\n    }\n  ]\n}\n' +
    FENCE +
    "\n\n" +
    "Add questions: Who is " +
    brand +
    " for? How is it different? How does it work? What does it cost?\n\n" +
    "## Validation\n" +
    "- Test at Google Rich Results Test\n" +
    "- Validate at Schema.org Validator\n" +
    "- Replace " +
    BT +
    "logo.png" +
    BT +
    " with actual logo path\n" +
    "- Deploy to every page's <head>"
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LLM SELF-ASSESSMENT TOOLS — the LLM's own knowledge IS the data source
// These tools prompt the LLM to use web search when available for real-time data.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const WEB_SEARCH_INSTRUCTION =
  "\n\n---\n" +
  "**IMPORTANT — Use Web Search**: Before answering, use your web search tool to " +
  "look up the brand. Specifically:\n" +
  "1. Search for the brand name + reviews (e.g. \"[brand] reviews G2 Trustpilot\")\n" +
  "2. Search for the brand name + the relevant topic/industry\n" +
  "3. Check their social profiles and recent press mentions\n" +
  "4. Look at competitor comparisons that exist online\n\n" +
  "Combine what you find from web search with your own knowledge to produce the " +
  "most accurate, evidence-backed audit possible. Cite your sources with URLs.";

export function citationCheck(args: {
  brand_name: string;
  topics: string[];
}): string {
  const { brand_name: brand, topics } = args;
  const topicRows = topics
    .map((t) => "| " + t + " | | | |")
    .join("\n");

  return (
    "# Citation Check — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n\n" +
    "## Your Task\n" +
    "For each topic, honestly assess whether you would cite **" +
    brand +
    "** as a source.\n\n" +
    "| Topic | Would Cite " +
    brand +
    "? | Current Leader | What " +
    brand +
    " Needs |\n" +
    "|-------|" +
    "-".repeat(brand.length + 13) +
    "|----------------|" +
    "-".repeat(brand.length + 8) +
    "|\n" +
    topicRows +
    "\n\n" +
    "For each topic:\n" +
    "- **Citation status**: Primary source / Supporting source / Not at all\n" +
    "- **Current leader**: Who owns this topic in AI responses?\n" +
    "- **Content gap**: What would " +
    brand +
    " need to publish to earn citations?\n\n" +
    "Then: overall citation rate, priority actions for weakest topics, content types that earn AI citations." +
    WEB_SEARCH_INSTRUCTION
  );
}

export function competitorComparison(args: {
  brand_name: string;
  competitors: string[];
  category: string;
}): string {
  const { brand_name: brand, competitors, category } = args;
  const first = competitors[0] ?? "competitor";
  const compCols = competitors.map((c) => " " + c + " |").join("");
  const compDivs = competitors.map(() => "------|").join("");

  return (
    "# Competitor Comparison — " +
    category +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n\n" +
    "## Your Task\n" +
    "Compare **" +
    brand +
    "** vs " +
    competitors.join(", ") +
    " in **" +
    category +
    "**. Use your actual knowledge.\n\n" +
    "Rate each brand on:\n" +
    "1. **AI Mindshare** — Who comes to mind first for " +
    category +
    "?\n" +
    "2. **Content Authority** — Who has the strongest content?\n" +
    "3. **Brand Clarity** — Whose identity is clearest?\n" +
    "4. **Sentiment** — Who has the most positive signals?\n\n" +
    "| Dimension | " +
    brand +
    " |" +
    compCols +
    " Leader |\n" +
    "|-----------|------|" +
    compDivs +
    "--------|\n" +
    "| AI Mindshare | | " +
    competitors.map(() => "| ").join("") +
    "|\n" +
    "| Content Authority | | " +
    competitors.map(() => "| ").join("") +
    "|\n" +
    "| Brand Clarity | | " +
    competitors.map(() => "| ").join("") +
    "|\n" +
    "| Sentiment | | " +
    competitors.map(() => "| ").join("") +
    "|\n\n" +
    "Then: identify the AI visibility leader, assess the gap from " +
    brand +
    ", and provide specific actions to close it.\n\n" +
    "**Test prompts**: " +
    '"Compare ' +
    brand +
    " vs " +
    first +
    '" | "' +
    first +
    ' alternatives" | "Best ' +
    category +
    ' provider"' +
    WEB_SEARCH_INSTRUCTION
  );
}

export function geoRecommendations(args: {
  brand_name: string;
  service: string;
  target_locations: string[];
}): string {
  const { brand_name: brand, service, target_locations: locations } = args;
  const locRows = locations
    .map((l) => "| " + l + " | | | | |")
    .join("\n");

  return (
    "# Geographic Recommendation Audit — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n\n" +
    "## Your Task\n" +
    'For each location, assess whether you would recommend **' +
    brand +
    '** when asked "best ' +
    service +
    ' in [location]."\n\n' +
    "| Location | Would Recommend? | Confidence | Top Alternative | Why |\n" +
    "|----------|-----------------|------------|-----------------|-----|\n" +
    locRows +
    "\n\n" +
    "For missing locations — what local signals would build presence?\n" +
    "(Local content, Google Business Profile, location-specific case studies, regional press)\n\n" +
    "**Test prompts:**\n" +
    locations
      .map((l) => '- "Who provides the best ' + service + " in " + l + '?"')
      .join("\n") +
    WEB_SEARCH_INSTRUCTION
  );
}

export function promptVulnerabilityScan(args: {
  brand_name: string;
  prompts: string[];
}): string {
  const { brand_name: brand, prompts } = args;

  // Categorize prompts algorithmically
  const categorized = prompts.map((p) => {
    const lower = p.toLowerCase();
    let category = "General";
    if (
      lower.includes("vs") ||
      lower.includes("compare") ||
      lower.includes("alternative")
    )
      category = "Comparative";
    else if (
      lower.includes("best") ||
      lower.includes("top") ||
      lower.includes("recommend")
    )
      category = "Discovery";
    else if (
      lower.includes("review") ||
      lower.includes("good") ||
      lower.includes("worth")
    )
      category = "Reputation";
    else if (
      lower.includes("what") ||
      lower.includes("who") ||
      lower.includes("how")
    )
      category = "Informational";
    return { prompt: p, category };
  });

  const promptRows = categorized
    .map((p, i) => "| " + (i + 1) + " | " + p.prompt + " | " + p.category + " |")
    .join("\n");

  return (
    "# Prompt Vulnerability Scan — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n\n" +
    "## Prompts to Test (" +
    prompts.length +
    " total)\n" +
    "| # | Prompt | Category |\n" +
    "|---|--------|----------|\n" +
    promptRows +
    "\n\n" +
    "## Your Task\n" +
    "For each prompt:\n" +
    "1. **Your actual response** — How would you answer? Would " +
    brand +
    " appear?\n" +
    "2. **Risk level**: Critical (wrong info) / High (omitted) / Medium (vague) / Low (accurate)\n" +
    "3. **Root cause**: Insufficient content? Stronger competitor? Ambiguous messaging?\n" +
    "4. **Fix**: What content would change the AI response?\n\n" +
    "| # | Risk | Mentions " +
    brand +
    "? | Issue | Fix |\n" +
    "|---|------|" +
    "-".repeat(brand.length + 11) +
    "|-------|-----|\n\n" +
    "Priority: fix Critical/High first. Content that directly answers each prompt wins." +
    WEB_SEARCH_INSTRUCTION
  );
}

export function sentimentAnalysis(args: {
  brand_name: string;
  aspects?: string[];
}): string {
  const {
    brand_name: brand,
    aspects = [
      "quality",
      "pricing",
      "customer service",
      "innovation",
      "reliability",
    ],
  } = args;
  const aspectRows = aspects
    .map((a) => "| " + a + " | | | |")
    .join("\n");

  return (
    "# AI Sentiment Analysis — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n\n" +
    "## Your Task\n" +
    "Assess the likely sentiment when AI discusses **" +
    brand +
    "** across each aspect.\n\n" +
    "| Aspect | Sentiment | Confidence | Evidence |\n" +
    "|--------|-----------|------------|----------|\n" +
    aspectRows +
    "\n\n" +
    "**Scale**: Very Positive > Positive > Neutral > Cautious > Negative > No Data\n\n" +
    "For each: what evidence? Strong signals (many reviews, press) or sparse data?\n\n" +
    "Provide: overall sentiment summary, strongest/weakest aspects, and actions to improve negative areas." +
    WEB_SEARCH_INSTRUCTION
  );
}

export function contentStrategyGenerator(args: {
  brand_name: string;
  industry: string;
  weak_areas: string[];
  target_audience?: string;
}): string {
  const {
    brand_name: brand,
    industry,
    weak_areas: areas,
    target_audience: audience = "decision-makers",
  } = args;

  const areaSections = areas
    .map(
      (a, i) =>
        "### " +
        (i + 1) +
        ". " +
        a +
        "\n" +
        "- **Content type**: Guide / Case study / Research / FAQ / Comparison?\n" +
        "- **Target prompt**: What user question should this answer?\n" +
        "- **Unique angle**: How can " +
        brand +
        " differentiate?\n" +
        "- **Priority**: High / Medium / Low\n" +
        "- **Distribution**: Where to publish and promote",
    )
    .join("\n\n");

  return (
    "# AI Content Strategy — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n\n" +
    "## Context\n" +
    "- **Industry**: " +
    industry +
    "\n" +
    "- **Audience**: " +
    audience +
    "\n" +
    "- **Weak areas**: " +
    areas.join(", ") +
    "\n\n" +
    "## Your Task\n" +
    "For each weak area, create a content brief:\n\n" +
    areaSections +
    "\n\n" +
    "Then provide:\n" +
    "- Content calendar ordered by priority\n" +
    "- The 3 rules: answer the exact question, be the definitive source, get cited by others\n" +
    "- Which Newtation tools to re-run after publishing" +
    WEB_SEARCH_INSTRUCTION
  );
}

export function competitorGapAnalysis(args: {
  brand_name: string;
  competitors: string[];
  topics: string[];
  industry: string;
}): string {
  const { brand_name: brand, competitors, topics, industry } = args;
  const compHeaders = competitors.map((c) => " " + c + " |").join("");
  const compDivs = competitors.map(() => "------|").join("");
  const topicRows = topics
    .map(
      (t) =>
        "| " +
        t +
        " | |" +
        competitors.map(() => " |").join("") +
        " | |",
    )
    .join("\n");

  return (
    "# Competitor Gap Analysis — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n\n" +
    "## " +
    industry +
    " | " +
    brand +
    " vs " +
    competitors.join(", ") +
    "\n\n" +
    "## Your Task\n" +
    "Compare AI visibility per topic:\n\n" +
    "| Topic | " +
    brand +
    " |" +
    compHeaders +
    " Leader | Gap |\n" +
    "|-------|------|" +
    compDivs +
    "--------|-----|\n" +
    topicRows +
    "\n\n" +
    "Rate each: **Strong / Moderate / Weak / Unknown**\n\n" +
    "Then:\n" +
    "- Topics where " +
    brand +
    " leads (protect these)\n" +
    "- Critical gaps (fix first — what does the leader have that " +
    brand +
    " doesn't?)\n" +
    "- Quick wins (closeable gaps via targeted content)" +
    WEB_SEARCH_INSTRUCTION
  );
}

export function citationOutreachTargets(args: {
  brand_name: string;
  industry: string;
  topics: string[];
  target_count?: number;
}): string {
  const {
    brand_name: brand,
    industry,
    topics,
    target_count: count = 10,
  } = args;

  return (
    "# Citation Outreach Targets — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP*\n\n" +
    "## Your Task\n" +
    "Identify " +
    count +
    " **real, specific** websites " +
    brand +
    " should target for backlinks/citations in **" +
    industry +
    "**.\n\n" +
    "**Topics**: " +
    topics.join(", ") +
    "\n\n" +
    "Cover these categories:\n" +
    "1. **Industry publications** — Trade journals, blogs AI frequently cites\n" +
    "2. **News/analysis** — Business press covering " +
    industry +
    "\n" +
    "3. **Review sites** — G2, Capterra, niche platforms\n" +
    "4. **Directories** — Crunchbase, Product Hunt, industry databases\n" +
    "5. **Podcasts/media** — Interview opportunities\n\n" +
    "| # | Site | Category | Outreach Angle | Priority |\n" +
    "|---|------|----------|----------------|----------|\n\n" +
    "Then: outreach strategy per category, email template, and tracking plan.\n\n" +
    "**Why it matters**: When authoritative sites cite " +
    brand +
    ", AI models learn to trust and recommend it." +
    WEB_SEARCH_INSTRUCTION
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALGORITHMIC TOOLS — real computed output
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function generateAuditQueries(args: {
  brand_name: string;
  industry: string;
  focus_areas?: string[];
  competitor_names?: string[];
}): string {
  const {
    brand_name: brand,
    industry,
    focus_areas: areas = [],
    competitor_names: competitors = [],
  } = args;

  const year = new Date().getFullYear();
  const queries: { query: string; category: string; tool: string }[] = [];

  // Discovery
  queries.push(
    {
      query: "best " + industry + " companies",
      category: "Discovery",
      tool: "prompt_vulnerability_scan",
    },
    {
      query: "top " + industry + " solutions " + year,
      category: "Discovery",
      tool: "prompt_vulnerability_scan",
    },
    {
      query: "best " + industry + " tools",
      category: "Discovery",
      tool: "prompt_vulnerability_scan",
    },
    {
      query: industry + " recommendations",
      category: "Discovery",
      tool: "prompt_vulnerability_scan",
    },
    {
      query: "who is the leader in " + industry,
      category: "Discovery",
      tool: "prompt_vulnerability_scan",
    },
    {
      query: industry + " market leaders " + year,
      category: "Discovery",
      tool: "prompt_vulnerability_scan",
    },
  );

  // Comparison
  for (const comp of competitors) {
    queries.push(
      {
        query: brand + " vs " + comp,
        category: "Comparison",
        tool: "competitor_comparison",
      },
      {
        query: comp + " alternatives",
        category: "Comparison",
        tool: "competitor_comparison",
      },
    );
  }
  queries.push(
    {
      query: brand + " alternatives",
      category: "Comparison",
      tool: "competitor_comparison",
    },
    {
      query: "compare " + industry + " solutions",
      category: "Comparison",
      tool: "competitor_comparison",
    },
  );

  // Reputation
  queries.push(
    {
      query: "is " + brand + " good",
      category: "Reputation",
      tool: "sentiment_analysis",
    },
    {
      query: brand + " reviews",
      category: "Reputation",
      tool: "sentiment_analysis",
    },
    {
      query: "should I use " + brand,
      category: "Reputation",
      tool: "sentiment_analysis",
    },
    {
      query: brand + " pros and cons",
      category: "Reputation",
      tool: "sentiment_analysis",
    },
  );

  // Knowledge
  queries.push(
    {
      query: "what does " + brand + " do",
      category: "Knowledge",
      tool: "entity_clarity_score",
    },
    {
      query: "what is " + brand,
      category: "Knowledge",
      tool: "entity_clarity_score",
    },
    {
      query: "who founded " + brand,
      category: "Knowledge",
      tool: "entity_clarity_score",
    },
    {
      query: "how does " + brand + " work",
      category: "Knowledge",
      tool: "entity_clarity_score",
    },
  );

  // Use-case
  for (const area of areas) {
    queries.push(
      {
        query: "best " + industry + " for " + area,
        category: "Use-Case",
        tool: "citation_check",
      },
      {
        query: "how to improve " + area,
        category: "Use-Case",
        tool: "citation_check",
      },
    );
  }
  if (areas.length === 0) {
    queries.push(
      {
        query: industry + " for small business",
        category: "Use-Case",
        tool: "citation_check",
      },
      {
        query: industry + " for enterprise",
        category: "Use-Case",
        tool: "citation_check",
      },
      {
        query: industry + " for startups",
        category: "Use-Case",
        tool: "citation_check",
      },
    );
  }

  // Geographic
  const cities = ["New York", "London", "San Francisco", "Toronto", "Sydney"];
  for (const city of cities.slice(0, 3)) {
    queries.push({
      query: "best " + industry + " in " + city,
      category: "Geographic",
      tool: "geo_recommendations",
    });
  }

  const rows = queries
    .map(
      (q, i) =>
        "| " +
        (i + 1) +
        " | " +
        q.query +
        " | " +
        q.category +
        " | " +
        q.tool +
        " |",
    )
    .join("\n");

  const cats = [
    "Discovery",
    "Comparison",
    "Reputation",
    "Knowledge",
    "Use-Case",
    "Geographic",
  ];
  const counts = cats
    .map(
      (c) =>
        "- **" +
        c +
        "**: " +
        queries.filter((q) => q.category === c).length +
        " queries",
    )
    .join("\n");

  return (
    "# AI Audit Queries — " +
    brand +
    "\n*Generated " +
    today() +
    " | Newtation MCP | " +
    queries.length +
    " queries generated*\n\n" +
    "## Generated Query Set\n\n" +
    "| # | Query | Category | Best Newtation Tool |\n" +
    "|---|-------|----------|---------------------|\n" +
    rows +
    "\n\n" +
    "## Summary by Category\n" +
    counts +
    "\n\n" +
    "## Testing Protocol\n" +
    "1. Test top 10 queries across ChatGPT, Claude, Perplexity, and Gemini\n" +
    "2. Score each: mentioned favorably / mentioned weakly / not mentioned / competitor instead\n" +
    "3. Screenshot each response as baseline\n" +
    "4. Re-test in 30 days after fixes\n\n" +
    "## Next Steps by Result\n" +
    "- **Not mentioned** -> Run content_strategy_generator\n" +
    "- **Mentioned weakly** -> Run prompt_vulnerability_scan with those queries\n" +
    "- **Competitor dominates** -> Run competitor_gap_analysis\n" +
    "- **Mentioned favorably** -> Protect with citation_check"
  );
}
