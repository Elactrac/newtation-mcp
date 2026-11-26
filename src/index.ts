/**
 * Newtation MCP — AI SEO (GEO / AEO) tools for Claude and other MCP clients.
 * Served at /mcp with no sign-in: every tool reads public web pages only.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import {
  analyzeOnpageSeo,
  extractAndValidateSchema,
  generateMissingSchema,
  analyzeInternalLinks,
  checkTechnicalFundamentals,
  simulateLlmCrawler,
  measurePageResponse,
  compareCompetitorContent,
  scoreAiAnswer,
  verifyBrandFacts,
  generateLlmsTxt,
  checkAiCrawlerAccess,
  auditSite,
  analyzeCitability,
  analyzeAiAnswers,
  checkEntityPresence,
  checkTrainingDataPresence,
  normalizeUrl,
} from "./tools";

const SERVER_INFO = { name: "newtation-mcp", version: "3.1.0" };

const SERVER_INSTRUCTIONS = `Newtation provides AI SEO tools (also called GEO, generative engine optimization, or AEO, answer engine optimization). They check whether AI assistants and AI search engines (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews, Microsoft Copilot) can crawl, read, understand and cite a website, and they generate the fixes.

Full audit of a site: check_ai_crawler_access and audit_site (site-wide), then analyze_citability and simulate_llm_crawler on key pages, check_entity_presence for the brand, and check_training_data_presence. Turn findings into fixes with generate_missing_schema and generate_llms_txt.

Testing what an AI model believes about a brand: write your answer from your own knowledge first, without searching or calling tools, then grade it with score_ai_answer (one answer) or verify_brand_facts (several question-and-answer pairs). Looking the brand up before answering makes the test meaningless.

Measuring AI share of voice: write realistic buyer questions for the brand's category, answer each from your own knowledge as you would for a real user, then pass the questions and answers to analyze_ai_answers. Answers from other assistants (ChatGPT, Perplexity, Gemini) can be added with an engine label.

All audit tools read public web pages only and change nothing.`;

const READ_ONLY_WEB = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

const READ_ONLY_LOCAL = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

/** Wraps a tool's JSON string; a top-level "error" key marks the result as a tool error. */
function toResult(text: string) {
  let isError = false;
  try {
    const parsed = JSON.parse(text);
    isError = !!parsed && typeof parsed === "object" && !Array.isArray(parsed) && "error" in parsed;
  } catch {
    // Non-JSON text is returned as-is.
  }
  return { content: [{ type: "text" as const, text }], ...(isError ? { isError: true } : {}) };
}

const urlArg = (what: string) => z.string().min(1).describe(`${what}, e.g. https://example.com (the https:// is optional)`);

/** Registers the AI SEO tools and prompt workflows on a server. */
function registerTools(server: McpServer, targetLimiter: RateLimit) {
  /** Runs a web tool unless the site it targets has been checked too often in the last minute. */
  const limited = async (urls: string[], run: () => Promise<string>) => {
    for (const u of urls) {
      let host: string;
      try {
        host = normalizeUrl(u).hostname.replace(/^www\./, "");
      } catch {
        continue; // the tool itself reports the invalid URL
      }
      const { success } = await targetLimiter.limit({ key: host });
      if (!success) {
        return toResult(JSON.stringify({ error: `Too many checks of ${host} in the last minute. Wait a minute and try again.` }));
      }
    }
    return toResult(await run());
  };

  server.tool(
    "check_ai_crawler_access",
    "Checks whether AI crawlers can reach a website. Evaluates robots.txt for 18 AI and search bots (OpenAI OAI-SearchBot, ChatGPT-User and GPTBot; Anthropic Claude-SearchBot, Claude-User and ClaudeBot; PerplexityBot; Googlebot and Google-Extended; Bingbot; Applebot; CCBot; and more), tests whether the site's firewall or CDN blocks AI crawler user-agents, and checks noindex/nosnippet directives and llms.txt. Returns an access score, a verdict per bot, issues with fixes, and paste-ready robots.txt lines. Use it first when someone asks why ChatGPT, Claude, Perplexity or Google AI Overviews don't show or cite their site.",
    { url: urlArg("Page or site to check") },
    { title: "Check AI Crawler Access", ...READ_ONLY_WEB },
    async ({ url }) => limited([url], () => checkAiCrawlerAccess({ url })),
  );

  server.tool(
    "simulate_llm_crawler",
    "Shows a page the way AI crawlers see it: the text in the raw HTML without running JavaScript, converted to Markdown, with a token estimate and a JavaScript-dependency risk rating. Most AI crawlers don't run JavaScript, so content that only appears after scripts run is invisible to them. Use it to diagnose why AI can't read or quote a page.",
    { url: urlArg("Page to view as an AI crawler") },
    { title: "Simulate AI Crawler", ...READ_ONLY_WEB },
    async ({ url }) => limited([url], () => simulateLlmCrawler({ url })),
  );

  server.tool(
    "analyze_onpage_seo",
    "On-page SEO for one URL: title, meta description, H1/H2 structure, word count, readability grade, target-keyword placement and density, and the page's most frequent 2- and 3-word phrases. Use it for page-level content and keyword checks.",
    {
      url: urlArg("Page to analyze"),
      target_keyword: z.string().optional().describe("Keyword or phrase to check placement and density for"),
    },
    { title: "Analyze On-Page SEO", ...READ_ONLY_WEB },
    async ({ url, target_keyword }) => limited([url], () => analyzeOnpageSeo({ url, target_keyword })),
  );

  server.tool(
    "extract_and_validate_schema",
    "Lists the Schema.org structured data (JSON-LD) on a page: which types are present (Organization, Product, FAQPage and so on), how many blocks parse as valid JSON, and samples of each. Use it to see which structured facts AI engines and Google can read from a page.",
    { url: urlArg("Page to read structured data from") },
    { title: "Extract & Validate Schema", ...READ_ONLY_WEB },
    async ({ url }) => limited([url], () => extractAndValidateSchema({ url })),
  );

  server.tool(
    "generate_missing_schema",
    "Generates paste-ready Schema.org JSON-LD for Organization, WebSite and FAQPage, linked with @id, from details you supply. Leaves out fields it can't know (logo, profile links) and lists them to complete. Use it after extract_and_validate_schema shows these types are missing. Doesn't fetch anything.",
    {
      brand_name: z.string().min(1).describe("The brand or company name"),
      url: urlArg("The brand's website"),
      description: z.string().min(1).describe("One or two factual sentences describing what the brand does"),
      missing_types: z.array(z.string()).min(1).describe("Types to generate: any of Organization, WebSite, FAQPage"),
      logo_url: z.string().optional().describe("Full URL of the brand's logo image"),
      same_as: z.array(z.string()).optional().describe("Official profile URLs (LinkedIn, Crunchbase, Wikipedia, Wikidata, X, YouTube...)"),
      faqs: z.array(z.object({ question: z.string(), answer: z.string() })).optional()
        .describe("Real questions and answers shown on the page, for FAQPage"),
    },
    { title: "Generate Missing Schema", ...READ_ONLY_LOCAL },
    async (args) => toResult(generateMissingSchema(args)),
  );

  server.tool(
    "generate_llms_txt",
    "Builds a ready-to-upload llms.txt file (the llmstxt.org format that points AI agents to a site's key pages) from the site's real internal links: site name, one-line summary, and Key Pages and Optional sections.",
    {
      url: urlArg("The website"),
      description: z.string().optional().describe("One-line site summary (defaults to the meta description)"),
    },
    { title: "Generate llms.txt", ...READ_ONLY_WEB },
    async ({ url, description }) => limited([url], () => generateLlmsTxt({ url, description })),
  );

  server.tool(
    "check_technical_fundamentals",
    "Checks a page's indexing and sharing basics: HTTP status, robots meta, canonical tag, mobile viewport, html lang, and Open Graph and Twitter card tags.",
    { url: urlArg("Page to check") },
    { title: "Check Technical Fundamentals", ...READ_ONLY_WEB },
    async ({ url }) => limited([url], () => checkTechnicalFundamentals({ url })),
  );

  server.tool(
    "analyze_internal_links",
    "Counts a page's internal and external links and lists the most common internal anchor texts. Use it to judge how well a page connects to the rest of the site.",
    { url: urlArg("Page to analyze") },
    { title: "Analyze Internal Links", ...READ_ONLY_WEB },
    async ({ url }) => limited([url], () => analyzeInternalLinks({ url })),
  );

  server.tool(
    "measure_page_response",
    "Times a single live fetch of a page: time to first byte, total fetch time and HTML size. Slow or heavy pages are crawled less by search and AI bots.",
    { url: urlArg("Page to time") },
    { title: "Measure Page Response", ...READ_ONLY_WEB },
    async ({ url }) => limited([url], () => measurePageResponse({ url })),
  );

  server.tool(
    "compare_competitor_content",
    "Head-to-head comparison of two sites from their public HTML. Fetches the homepage and key pages (/about, /pricing, linked product pages) for both, then returns a scorecard (content depth, topics, keyword placement, structured data, technical readiness, AI crawlability, speed), the topics, headings and schema types each side has that the other lacks, and prioritized actions. Pass target_keyword for a keyword head-to-head. Based on page content only, not rankings or AI share of voice.",
    {
      your_url: urlArg("Your site"),
      competitor_url: urlArg("Competitor's site"),
      target_keyword: z.string().optional().describe("Keyword to compare in title, H1, H2, meta description and body"),
    },
    { title: "Compare Competitor Content", ...READ_ONLY_WEB },
    async ({ your_url, competitor_url, target_keyword }) =>
      limited([your_url, competitor_url], () => compareCompetitorContent({ your_url, competitor_url, target_keyword })),
  );

  server.tool(
    "score_ai_answer",
    "Grades an AI-written description of a brand against the brand's live website (homepage and /about): topic coverage, vocabulary alignment, which specific claims the site confirms, competitors the AI associates with the brand, and how out of date the AI's picture is. Returns a 0-100 AI knowledge score and fixes. The answer must be written from the model's own knowledge before any searching or tool use.",
    {
      ai_answer: z.string().min(1).describe("The AI's description of the brand, written from its own knowledge before any searching or tool use"),
      url: urlArg("The brand's website (used as ground truth)"),
      brand_name: z.string().min(1).describe("The brand name"),
    },
    { title: "Score AI Answer", ...READ_ONLY_WEB },
    async ({ ai_answer, url, brand_name }) => limited([url], () => scoreAiAnswer({ ai_answer, url, brand_name })),
  );

  server.tool(
    "verify_brand_facts",
    "Fact-checks AI-written answers to questions about a brand against the brand's live website: the homepage, /about and /pricing, plus any extra_pages passed. Returns a verdict per question, the names, dates and figures those pages don't confirm, and an overall hallucination risk level. The answers must be written from the model's own knowledge before any searching or tool use.",
    {
      url: urlArg("The brand's website (used as ground truth)"),
      brand_name: z.string().min(1).describe("The brand name"),
      qa_pairs: z.array(z.object({
        question: z.string(),
        answer: z.string().describe("The AI's answer, written from its own knowledge before any searching or tool use"),
      })).min(1).describe("Questions and the AI's from-memory answers"),
      extra_pages: z.array(z.string()).max(5).optional()
        .describe("Up to 5 other pages that state the brand's facts, e.g. its company, team, contact, press or FAQ page"),
    },
    { title: "Verify Brand Facts", ...READ_ONLY_WEB },
    async ({ url, brand_name, qa_pairs, extra_pages }) => limited([url], () => verifyBrandFacts({ url, brand_name, qa_pairs, extra_pages })),
  );

  server.tool(
    "audit_site",
    "Audits a whole website for AI search readiness. Reads the sitemap (or homepage links), samples up to 20 pages across the site's sections, and checks each for errors, noindex, robots.txt blocks on AI search crawlers, JavaScript-only content, thin content, missing structured data, titles and H1s. Returns a site score, issues ranked by severity with example URLs, sitemap freshness and a per-page table. Use it for site-wide AI SEO audits rather than single pages.",
    {
      url: urlArg("The website"),
      max_pages: z.number().int().min(3).max(20).optional().describe("Pages to sample, 3-20 (default 15)"),
    },
    { title: "Audit Site for AI Search", ...READ_ONLY_WEB },
    async ({ url, max_pages }) => limited([url], () => auditSite({ url, max_pages })),
  );

  server.tool(
    "analyze_citability",
    "Scores how quotable a page is for AI answers. Splits the page into sections by heading and rates each on what makes passages easy for ChatGPT, Perplexity and Google AI Overviews to cite: a direct answer first, specific facts and numbers, sources, length, lists or tables, question-style headings, and marketing fluff. Returns a page score, the most quotable passages, the weakest sections with specific rewrite advice, and trust signals (author, last-updated date, FAQ).",
    { url: urlArg("Page to score") },
    { title: "Analyze Citability", ...READ_ONLY_WEB },
    async ({ url }) => limited([url], () => analyzeCitability({ url })),
  );

  server.tool(
    "analyze_ai_answers",
    "Measures a brand's AI share of voice from AI answers to buyer questions. Takes answers written by this or any other assistant (answers from ChatGPT, Perplexity or Gemini can be pasted in with an engine label) and returns how often the brand is mentioned, its position versus competitors, share of voice, other brands the AI names, the domains cited, rough sentiment, and the questions where the brand is missing. Doesn't fetch anything.",
    {
      brand_name: z.string().min(1).describe("The brand to measure"),
      brand_domain: z.string().optional().describe("The brand's website, to detect citations of it"),
      competitors: z.array(z.string()).optional().describe("Competitor brand names to compare against"),
      answers: z.array(z.object({
        prompt: z.string().describe("The question asked"),
        answer: z.string().describe("The AI's full answer"),
        engine: z.string().optional().describe("Which assistant answered, e.g. Claude, ChatGPT, Perplexity"),
        cited_urls: z.array(z.string()).optional().describe("Source URLs the answer cited, if any"),
      })).min(1).describe("Questions and the AI answers to them"),
    },
    { title: "Analyze AI Share of Voice", ...READ_ONLY_LOCAL },
    async (args) => toResult(analyzeAiAnswers(args)),
  );

  server.tool(
    "check_entity_presence",
    "Checks whether AI can recognise a brand as a distinct entity: Organization structured data and sameAs profile links on the homepage, brand-name consistency, and whether Wikidata has an item for the brand (matched by its official website) with key facts and an English Wikipedia article. Returns an entity score and fixes.",
    {
      brand_name: z.string().min(1).describe("The brand or company name"),
      url: urlArg("The brand's website"),
    },
    { title: "Check Entity Presence", ...READ_ONLY_WEB },
    async ({ brand_name, url }) => limited([url], () => checkEntityPresence({ brand_name, url })),
  );

  server.tool(
    "check_training_data_presence",
    "Checks whether a site appears in the latest Common Crawl, the open web archive widely used to train AI models: pages captured, homepage presence, crawl errors, and whether robots.txt allows CCBot. The Common Crawl index is slow, so this can take up to 30 seconds.",
    { url: urlArg("The website") },
    { title: "Check AI Training Data Presence", ...READ_ONLY_WEB },
    async ({ url }) => limited([url], () => checkTrainingDataPresence({ url })),
  );

  server.prompt(
    "ai_visibility_audit",
    "Full AI SEO audit of a website: can AI crawlers reach it, can they read it, do they understand it, plus a ranked fix list with paste-ready code.",
    {
      url: z.string().describe("Website to audit"),
      brand_name: z.string().optional().describe("Brand name (taken from the site if left out)"),
    },
    ({ url, brand_name }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Run a full AI visibility audit for ${url}: can AI assistants and AI search engines (ChatGPT, Claude, Perplexity, Gemini, Google AI Overviews) reach, read, understand and cite this site?

STEP 1 — Call these tools:
1. \`check_ai_crawler_access\` on ${url}
2. \`audit_site\` on ${url}
3. \`analyze_citability\` and \`simulate_llm_crawler\` on the homepage and on the most important page \`audit_site\` found (pricing, product or a key guide)
4. \`check_entity_presence\` for ${brand_name ? `"${brand_name}"` : "the brand (take its name from the site)"} and ${url}
5. \`check_training_data_presence\` on ${url}

STEP 2 — If the homepage is missing Organization or WebSite structured data, call \`generate_missing_schema\`. If there's no llms.txt, call \`generate_llms_txt\`.

STEP 3 — Write the report in plain language for a marketer, in exactly this structure:

# AI Visibility Score: [0-100]
Weight it: Access 30 (crawler access, firewall, noindex, Common Crawl presence), Readability 20 (JavaScript dependency and site-wide issues), Understanding 25 (structured data and entity presence), Quotability 25 (citability). One sentence on what the score means.

| Area | Score | Status |
|---|---|---|
| Access | x/30 | ... |
| Readability | x/20 | ... |
| Understanding | x/25 | ... |
| Quotability | x/25 | ... |

## Fix first
The 3-5 highest-impact fixes, most important first. For each: what's wrong (with the evidence from the tool), why it matters for AI visibility, and the fix. Include paste-ready code blocks (robots.txt lines, JSON-LD, llms.txt) wherever a tool produced them.

## Send this to your developer
A short checklist of the technical changes, written so it can be forwarded as-is.

## What's already working
2-3 things the site does well.

---
*This audit sampled the site at one point in time. Run it again after making changes.*`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "ai_share_of_voice_test",
    "Asks this AI the questions buyers ask in a brand's category, then measures how often the brand is mentioned versus competitors, and where it's missing.",
    {
      brand_name: z.string().describe("Brand to measure"),
      url: z.string().describe("Brand website"),
      category: z.string().describe("What the brand sells, e.g. 'project management software for agencies'"),
      competitors: z.string().optional().describe("Comma-separated competitor names"),
    },
    ({ brand_name, url, category, competitors }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `We're measuring AI share of voice for "${brand_name}" in: ${category}.

STEP 1 — Write 8 realistic questions a buyer would ask an AI assistant when choosing ${category}. Don't name ${brand_name} in them. Mix "best X for Y" questions, problem-led questions ("how do I…"), and${competitors ? ` one or two that name ${competitors}` : " one or two comparison questions"}.

STEP 2 — Answer each question from your own knowledge, the way you'd answer a real user who asked it. Don't search or call tools, and don't favour or avoid ${brand_name} because of this test. Name specific products where you normally would.

STEP 3 — Call \`analyze_ai_answers\` with brand_name="${brand_name}", brand_domain="${url}"${competitors ? `, competitors=[${competitors.split(",").map((c) => JSON.stringify(c.trim())).join(", ")}]` : ""}, and each question with your answer (engine "Claude").

STEP 4 — Report:

# AI Share of Voice: ${brand_name}
**Mentioned in [x] of 8 answers** · average position [n]

| Brand | Answers mentioning | Share of voice |
|---|---|---|

## Where you're missing
Each question you weren't mentioned in, and who was named instead.

## What to do
The tool's recommended actions, made specific to ${category}.

Then offer: "Paste answers from ChatGPT, Perplexity or Gemini to the same questions and I'll add them to the comparison."

---
*This measured one AI engine, once. AI answers vary between runs and between engines.*`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "live_ai_perception_test",
    "Tests what THIS AI actually believes about a brand, then grades it against the brand's real website.",
    {
      brand_name: z.string().describe("Brand to test"),
      url: z.string().describe("Brand website URL (ground truth)"),
    },
    ({ brand_name, url }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `We are running a Live AI Perception Test for "${brand_name}".

STEP 1 — Answer from YOUR OWN knowledge only. Do NOT call any tools or fetch anything yet. Write 1 paragraph answering:
- What is ${brand_name} and what do they do?
- What are they known for? Who are their main competitors?
- Would you recommend them, and for what?

If you genuinely don't know the brand, say exactly that — it's a valid (and important) result.

STEP 2 — Call the \`score_ai_answer\` tool with your STEP 1 paragraph verbatim as \`ai_answer\`, url="${url}", brand_name="${brand_name}".

STEP 3 — Present the results as:

# 🧠 What AI Actually Believes About ${brand_name}
> [Your STEP 1 answer]

# 📊 Graded Against Reality: [score]/100
- **Topics AI knows:** [list]
- **Topics AI is missing:** [list]
- **Potential hallucinations:** [list, or "None detected"]

# ⏳ AI Knowledge Lag
[From the knowledge_lag section: severity + which current positioning topics AI hasn't absorbed]

# 🛠 What This Means
[2-3 sentences: what to publish/fix so AI engines learn the missing topics]

---
*This tested one AI engine, once. Other assistants may know more or less, and answers change with each model release.*`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "hallucination_stress_test",
    "Asks THIS AI the risky factual questions prospects ask about a brand, then fact-checks every answer against the brand's real website.",
    {
      brand_name: z.string().describe("Brand to stress-test"),
      url: z.string().describe("Brand website URL (ground truth)"),
    },
    ({ brand_name, url }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `We are running a Hallucination Stress Test for "${brand_name}" — testing what you tell prospects when ${brand_name} isn't in the room.

STEP 1 — Answer each question below from YOUR OWN knowledge only. Do NOT call any tools or fetch anything yet. 1-3 sentences each. If you don't know, say exactly that — honest gaps matter as much as wrong answers.

1. What does ${brand_name}'s pricing look like?
2. Who founded ${brand_name}, and when?
3. Where is ${brand_name} headquartered / which locations do they serve?
4. Does ${brand_name} offer a free tier or trial?
5. What are ${brand_name}'s main products or services today?
6. Is ${brand_name} still active and growing?

STEP 2 — Call \`verify_brand_facts\` with url="${url}", brand_name="${brand_name}", and your STEP 1 answers verbatim as qa_pairs.

STEP 3 — Present the results as:

# 🎭 What AI Tells Your Prospects About ${brand_name}

## ⚠️ Hallucination Risk: [risk level from the tool]

| Question | AI's Claim | Verdict |
|----------|-----------|---------|
[one row per question: shortened claim + status from the tool]

## 🚨 Claims Your Site Can't Back Up
[list, or "None — answers are well grounded"]

## 🛠 Fix List
[the tool's recommended_actions]

If the tool returned a next_step, ask me which pages on ${url} state the unconfirmed facts (company, team, contact, press or FAQ pages) and offer to re-run \`verify_brand_facts\` with them as extra_pages.

---
*This tested one AI engine, once. Answers change with each model release.*`,
          },
        },
      ],
    }),
  );

  server.prompt(
    "run_seo_action_plan",
    "Quick single-page check: on-page SEO, technical basics and structured data, with a score and prioritized fixes.",
    {
      url: z.string().describe("URL to audit"),
      keyword: z.string().optional().describe("Target keyword"),
    },
    ({ url, keyword }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please run a lightning-fast SEO & AI Presence audit for ${url}${keyword ? ` targeting the keyword "${keyword}"` : ""}.

First, execute the following tools:
1. \`analyze_onpage_seo\`
2. \`check_technical_fundamentals\`
3. \`extract_and_validate_schema\`

Then, analyze the returned data and output EXACTLY this structure (do not add conversational fluff before or after):

# 🔢 AI & SEO Readiness Score: [Calculate 0-100 based on the data]
*(Brief 1-sentence justification for the score)*

## 🚨 Top Issues (Priority Order)
- [Issue 1 based on hard data]
- [Issue 2 based on hard data]
- [Issue 3 based on hard data]

## 🛠 Fix This (Actionable)
- **Issue:** [Name]
**Fix:** [Specific instruction based on the data]
- **Issue:** [Name]
**Fix:** [Specific instruction based on the data]

## ✨ AI Suggestions
[Provide 2-3 specific suggestions for better semantic coverage, intent matching, or schema additions]

---
*This checked a single page. Use \`audit_site\` for a site-wide check and \`compare_competitor_content\` to compare against a competitor.*`,
          },
        },
      ],
    }),
  );

}

/** AI SEO MCP server (Durable Object per session). */
export class NewtationMCP extends McpAgent<Env> {
  server = new McpServer(SERVER_INFO, { instructions: SERVER_INSTRUCTIONS });

  async init() {
    registerTools(this.server, this.env.TARGET_RATE_LIMITER);
  }
}

export default NewtationMCP.serve("/mcp", { binding: "MCP_OBJECT" });
