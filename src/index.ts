/**
 * Newtation AI Presence MCP Server — Remote (Cloudflare Workers)
 *
 * Exposes 15 brand auditing tools + 4 prompt templates via MCP over
 * Streamable HTTP, with GitHub OAuth. Deployable to Cloudflare Workers.
 *
 * Core Audit (5):
 *   - brand_perception_audit      : How AI describes your brand overall
 *   - citation_check              : Whether AI cites your brand as a source
 *   - competitor_comparison       : How your brand stacks up vs competitors in AI
 *   - entity_clarity_score        : How clearly AI understands what your brand is
 *   - geo_recommendations         : Whether AI recommends your brand by location
 *
 * Diagnostics (3):
 *   - prompt_vulnerability_scan   : Find prompts where AI gives wrong/weak answers
 *   - sentiment_analysis          : Likely tone when AI discusses your brand
 *   - hallucination_check         : Verify AI claims about your brand
 *
 * Strategy & Output (5):
 *   - content_strategy_generator  : Prioritized content plan from weak areas
 *   - competitor_gap_analysis     : Topics where competitors have stronger AI visibility
 *   - content_audit_for_ai        : Scores existing content for AI discoverability
 *   - citation_outreach_targets   : High-authority sites to target for backlinks
 *   - schema_markup_generator     : Generate paste-ready AI-optimized JSON-LD
 *
 * Generators (1):
 *   - generate_audit_queries      : Auto-generate categorized visibility test queries
 *
 * Summary (1):
 *   - ai_readiness_scorecard      : Full composite score across all dimensions
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { GitHubHandler } from "./github-handler";
import {
  aiReadinessScorecard,
  brandPerceptionAudit,
  citationCheck,
  citationOutreachTargets,
  competitorComparison,
  competitorGapAnalysis,
  contentAuditForAI,
  contentStrategyGenerator,
  entityClarityScore,
  generateAuditQueries,
  geoRecommendations,
  hallucinationCheck,
  promptVulnerabilityScan,
  schemaMarkupGenerator,
  sentimentAnalysis,
} from "./tools";

// All Newtation tools are read-only audits — they never modify external state.
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

// Tools that fetch external URLs (websites, DNS) for live analysis
const OPEN_WORLD_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

/**
 * Interface for the default handler expected by workers-oauth-provider.
 * It must expose a fetch() method matching the standard Workers signature.
 */
interface OAuthHandler {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>;
}

// Props passed through from the OAuth flow, available as this.props
type Props = {
  login: string;
  name: string;
  email: string;
  accessToken: string;
};

export class NewtationMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "newtation-mcp",
    version: "2.0.0",
  });

  async init() {
    // ── brand_perception_audit ──────────────────────────────────────────
    this.server.tool(
      "brand_perception_audit",
      "Analyze how AI models perceive your brand. If a website URL is provided, " +
        "performs live page fetching to analyze HTML, meta tags, schema markup, DNS, " +
        "and computes an AI-readability score. Combines real data with LLM perception analysis.",
      {
        brand_name: z.string().describe("The brand or company name to audit (e.g. 'Newtation')"),
        industry: z.string().describe("Industry or category (e.g. 'SEO agency', 'SaaS', 'e-commerce')"),
        website: z.string().optional().describe("Brand website URL (optional, used for context)"),
      },
      { title: "Brand Perception Audit", ...OPEN_WORLD_ANNOTATIONS },
      async ({ brand_name, industry, website }) => ({
        content: [
          {
            type: "text" as const,
            text: await brandPerceptionAudit({ brand_name, industry, website }),
          },
        ],
      }),
    );

    // ── citation_check ──────────────────────────────────────────────────
    this.server.tool(
      "citation_check",
      "Check whether and how AI models cite your brand as a credible source. " +
        "Returns citation likelihood, content gaps, and actionable recommendations.",
      {
        brand_name: z.string().describe("Brand name to check citation status for"),
        topics: z
          .array(z.string())
          .describe(
            "Topics you want to be cited for (e.g. ['AI SEO', 'brand visibility', 'MCP servers'])",
          ),
      },
      { title: "Citation Check", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, topics }) => ({
        content: [
          {
            type: "text" as const,
            text: citationCheck({ brand_name, topics }),
          },
        ],
      }),
    );

    // ── competitor_comparison ────────────────────────────────────────────
    this.server.tool(
      "competitor_comparison",
      "Compare how AI models perceive your brand versus your key competitors. " +
        "Surfaces which competitor is winning AI mindshare and why.",
      {
        brand_name: z.string().describe("Your brand name"),
        competitors: z.array(z.string()).describe("List of competitor brand names to compare against"),
        category: z.string().describe("The market category or service type being compared"),
      },
      { title: "Competitor Comparison", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, competitors, category }) => ({
        content: [
          {
            type: "text" as const,
            text: competitorComparison({ brand_name, competitors, category }),
          },
        ],
      }),
    );

    // ── entity_clarity_score ────────────────────────────────────────────
    this.server.tool(
      "entity_clarity_score",
      "Score how clearly AI models understand your brand. If a website is provided, " +
        "fetches it live to verify entity signals (brand in title, meta, schema). " +
        "Returns entity clarity assessment with specific fixes.",
      {
        brand_name: z.string().describe("Brand name to score"),
        tagline_or_description: z
          .string()
          .optional()
          .describe("Your brand's own description of itself (from homepage or About page)"),
        website: z.string().optional().describe("Brand website URL for live entity signal verification"),
      },
      { title: "Entity Clarity Score", ...OPEN_WORLD_ANNOTATIONS },
      async ({ brand_name, tagline_or_description, website }) => ({
        content: [
          {
            type: "text" as const,
            text: await entityClarityScore({ brand_name, tagline_or_description, website }),
          },
        ],
      }),
    );

    // ── geo_recommendations ─────────────────────────────────────────────
    this.server.tool(
      "geo_recommendations",
      "Test whether AI recommends your brand when users ask location-specific questions. " +
        "Returns which cities/regions your brand appears in and which it's missing from.",
      {
        brand_name: z.string().describe("Brand name to check"),
        service: z.string().describe("The service or product to test recommendations for"),
        target_locations: z
          .array(z.string())
          .describe(
            "Cities or regions you want to appear in (e.g. ['New York', 'London', 'Sydney'])",
          ),
      },
      { title: "Geographic Recommendations", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, service, target_locations }) => ({
        content: [
          {
            type: "text" as const,
            text: geoRecommendations({ brand_name, service, target_locations }),
          },
        ],
      }),
    );

    // ── prompt_vulnerability_scan ────────────────────────────────────────
    this.server.tool(
      "prompt_vulnerability_scan",
      "Test a set of prompts real users might ask about your brand and surface " +
        "where AI gives wrong, weak, or missing answers. Identifies critical " +
        "vulnerabilities in your AI presence.",
      {
        brand_name: z.string().describe("Brand name to scan"),
        prompts: z
          .array(z.string())
          .describe(
            "Prompts to test (e.g. ['Is Acme a good SEO agency?', 'What does Acme do?', 'Acme vs competitors'])",
          ),
      },
      { title: "Prompt Vulnerability Scan", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, prompts }) => ({
        content: [
          {
            type: "text" as const,
            text: promptVulnerabilityScan({ brand_name, prompts }),
          },
        ],
      }),
    );

    // ── sentiment_analysis ──────────────────────────────────────────────
    this.server.tool(
      "sentiment_analysis",
      "Analyze the likely sentiment and tone when AI discusses your brand. " +
        "Breaks down sentiment across aspects like quality, pricing, service, " +
        "innovation, and reliability.",
      {
        brand_name: z.string().describe("Brand name to analyze sentiment for"),
        aspects: z
          .array(z.string())
          .optional()
          .describe(
            "Brand aspects to analyze (defaults to quality, pricing, customer service, innovation, reliability)",
          ),
      },
      { title: "Sentiment Analysis", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, aspects }) => ({
        content: [
          {
            type: "text" as const,
            text: sentimentAnalysis({ brand_name, aspects }),
          },
        ],
      }),
    );

    // ── content_strategy_generator ──────────────────────────────────────
    this.server.tool(
      "content_strategy_generator",
      "Generate a prioritized content plan based on your brand's weak areas. " +
        "Tells you exactly what to publish, in what order, on which platforms, " +
        "and how to optimize for AI visibility.",
      {
        brand_name: z.string().describe("Brand name"),
        industry: z.string().describe("Your industry or category"),
        weak_areas: z
          .array(z.string())
          .describe(
            "Topics or areas where your brand is weak in AI (from citation_check or other audits)",
          ),
        target_audience: z
          .string()
          .optional()
          .describe("Who you're trying to reach (e.g. 'CMOs at mid-market SaaS companies')"),
      },
      { title: "Content Strategy Generator", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, industry, weak_areas, target_audience }) => ({
        content: [
          {
            type: "text" as const,
            text: contentStrategyGenerator({ brand_name, industry, weak_areas, target_audience }),
          },
        ],
      }),
    );

    // ── competitor_gap_analysis ─────────────────────────────────────────
    this.server.tool(
      "competitor_gap_analysis",
      "Identify specific topics where competitors have stronger AI visibility than " +
        "your brand. Analyzes score gaps across topics and provides prioritized actions " +
        "to close the competitive gap.",
      {
        brand_name: z.string().describe("Your brand name"),
        competitors: z.array(z.string()).describe("List of competitor brand names"),
        topics: z
          .array(z.string())
          .describe(
            "Topics to analyze (e.g. ['AI SEO', 'brand monitoring', 'content strategy'])",
          ),
        industry: z.string().describe("Your industry or market category"),
      },
      { title: "Competitor Gap Analysis", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, competitors, topics, industry }) => ({
        content: [
          {
            type: "text" as const,
            text: competitorGapAnalysis({ brand_name, competitors, topics, industry }),
          },
        ],
      }),
    );

    // ── content_audit_for_ai ────────────────────────────────────────────
    this.server.tool(
      "content_audit_for_ai",
      "Fetches up to 10 content URLs live, parses HTML, and scores each for AI " +
        "discoverability (meta tags, schema, headings, word count, links). Returns " +
        "per-page AI-readability grades and cross-page issue summary.",
      {
        brand_name: z.string().describe("Brand name"),
        content_urls: z
          .array(z.string())
          .describe(
            "URLs of your content to audit (blog posts, landing pages, etc.)",
          ),
        target_topics: z
          .array(z.string())
          .describe(
            "Topics you want your content to be discoverable for",
          ),
      },
      { title: "Content Audit for AI", ...OPEN_WORLD_ANNOTATIONS },
      async ({ brand_name, content_urls, target_topics }) => ({
        content: [
          {
            type: "text" as const,
            text: await contentAuditForAI({ brand_name, content_urls, target_topics }),
          },
        ],
      }),
    );

    // ── citation_outreach_targets ───────────────────────────────────────
    this.server.tool(
      "citation_outreach_targets",
      "Generate a prioritized list of high-authority sites to target for backlinks " +
        "and citations. Provides outreach strategies, email templates, and tracking " +
        "guidance for building your citation network.",
      {
        brand_name: z.string().describe("Brand name"),
        industry: z.string().describe("Your industry or category"),
        topics: z
          .array(z.string())
          .describe(
            "Topics you want citations for (e.g. ['SEO', 'AI presence', 'brand monitoring'])",
          ),
        target_count: z
          .number()
          .optional()
          .describe("Number of target sites to return (default: 10)"),
      },
      { title: "Citation Outreach Targets", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, industry, topics, target_count }) => ({
        content: [
          {
            type: "text" as const,
            text: citationOutreachTargets({ brand_name, industry, topics, target_count }),
          },
        ],
      }),
    );

    // ── ai_readiness_scorecard ──────────────────────────────────────────
    this.server.tool(
      "ai_readiness_scorecard",
      "Comprehensive AI readiness score. If a website is provided, fetches it live " +
        "for technical scoring (HTML, meta, schema, DNS). Evaluates 6 dimensions: " +
        "perception, entity clarity, citations, competition, geography, sentiment.",
      {
        brand_name: z.string().describe("Brand name to score"),
        industry: z.string().describe("Your industry or category"),
        website: z.string().optional().describe("Brand website URL"),
        competitors: z
          .array(z.string())
          .optional()
          .describe("Competitor brand names for competitive scoring"),
        target_locations: z
          .array(z.string())
          .optional()
          .describe("Target cities/regions for geographic scoring"),
        topics: z
          .array(z.string())
          .optional()
          .describe("Key topics for citation scoring"),
      },
      { title: "AI Readiness Scorecard", ...OPEN_WORLD_ANNOTATIONS },
      async ({ brand_name, industry, website, competitors, target_locations, topics }) => ({
        content: [
          {
            type: "text" as const,
            text: await aiReadinessScorecard({ brand_name, industry, website, competitors, target_locations, topics }),
          },
        ],
      }),
    );

    // ── generate_audit_queries ──────────────────────────────────────────
    this.server.tool(
      "generate_audit_queries",
      "Generate a comprehensive set of queries to test your brand's AI visibility. " +
        "Creates categorized queries (discovery, comparison, reputation, use-case) " +
        "with a testing protocol and maps each query to the best Newtation tool.",
      {
        brand_name: z.string().describe("Brand name"),
        industry: z.string().describe("Industry or category"),
        focus_areas: z
          .array(z.string())
          .optional()
          .describe("Specific topics or services to focus on"),
        competitor_names: z
          .array(z.string())
          .optional()
          .describe("Known competitors to include in comparison queries"),
      },
      { title: "Generate Audit Queries", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, industry, focus_areas, competitor_names }) => ({
        content: [
          {
            type: "text" as const,
            text: generateAuditQueries({ brand_name, industry, focus_areas, competitor_names }),
          },
        ],
      }),
    );

    // ── hallucination_check ─────────────────────────────────────────────
    this.server.tool(
      "hallucination_check",
      "Fact-check AI-generated text about your brand. If a website is provided, " +
        "fetches it live to extract ground-truth facts from HTML and schema markup. " +
        "Returns claim-by-claim verification with severity ratings.",
      {
        brand_name: z.string().describe("Brand name to verify claims about"),
        ai_response: z.string().describe("The AI-generated text to fact-check"),
        known_facts: z
          .array(z.string())
          .optional()
          .describe("Known true facts about your brand to cross-reference against"),
        website: z.string().optional().describe("Brand website URL — fetched live for ground-truth extraction"),
      },
      { title: "Hallucination Check", ...OPEN_WORLD_ANNOTATIONS },
      async ({ brand_name, ai_response, known_facts, website }) => ({
        content: [
          {
            type: "text" as const,
            text: await hallucinationCheck({ brand_name, ai_response, known_facts, website }),
          },
        ],
      }),
    );

    // ── schema_markup_generator ──────────────────────────────────────────
    this.server.tool(
      "schema_markup_generator",
      "Fetches your website to detect existing JSON-LD schema, then generates " +
        "paste-ready markup for what's missing (Organization, WebSite, FAQ, " +
        "BreadcrumbList). The highest-ROI technical fix for AI visibility.",
      {
        brand_name: z.string().describe("Brand name"),
        url: z.string().describe("Brand website URL (e.g. 'https://example.com')"),
        description: z.string().describe("What your brand does (1-2 sentences)"),
        type: z
          .string()
          .optional()
          .describe("Schema type: 'Organization', 'LocalBusiness', or 'Product' (default: Organization)"),
        founding_year: z.string().optional().describe("Year the brand was founded"),
        founders: z.array(z.string()).optional().describe("Founder names"),
        social_urls: z
          .array(z.string())
          .optional()
          .describe("Social profile URLs (LinkedIn, Twitter, etc.)"),
      },
      { title: "Schema Markup Generator", ...OPEN_WORLD_ANNOTATIONS },
      async ({ brand_name, url, description, type, founding_year, founders, social_urls }) => ({
        content: [
          {
            type: "text" as const,
            text: await schemaMarkupGenerator({
              brand_name,
              url,
              description,
              type,
              founding_year,
              founders,
              social_urls,
            }),
          },
        ],
      }),
    );

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Prompt Templates
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    this.server.prompt(
      "full_brand_audit",
      "Run a comprehensive AI presence audit across all dimensions — perception, entity clarity, citations, competitive position, and more",
      {
        brand_name: z.string().describe("Brand name to audit"),
        industry: z.string().describe("Industry or category"),
        website: z.string().optional().describe("Brand website URL"),
        competitors: z.string().optional().describe("Comma-separated competitor names"),
      },
      async ({ brand_name, industry, website, competitors }) => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `Run a comprehensive AI presence audit for "${brand_name}" in ${industry}${website ? ` (${website})` : ""}.`,
                competitors ? `Compare against: ${competitors}.` : "",
                "",
                "Run these tools in order, analyzing the results of each before proceeding:",
                "1. `ai_readiness_scorecard` — get the overall picture",
                "2. `entity_clarity_score` — check if AI knows who we are",
                "3. `brand_perception_audit` — detailed perception analysis",
                "4. `citation_check` with 5 key industry topics",
                "5. `generate_audit_queries` — create a visibility testing plan",
                "",
                "After all tools complete, provide an executive summary with: overall grade, top 3 critical findings, and a 30-day action plan.",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          },
        ],
      }),
    );

    this.server.prompt(
      "quick_health_check",
      "Fast 2-tool check to see how visible your brand is in AI — perfect for a first look",
      {
        brand_name: z.string().describe("Brand name"),
        industry: z.string().describe("Industry"),
      },
      async ({ brand_name, industry }) => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Quick AI health check for "${brand_name}" in ${industry}.\n\nRun \`entity_clarity_score\` and \`brand_perception_audit\`, then give me a 1-paragraph summary: how visible is my brand in AI, and what's the single most important thing to fix?`,
            },
          },
        ],
      }),
    );

    this.server.prompt(
      "competitive_deep_dive",
      "Head-to-head competitive analysis — find where you're losing AI mindshare and how to win it back",
      {
        brand_name: z.string().describe("Your brand name"),
        competitors: z.string().describe("Comma-separated competitor names"),
        industry: z.string().describe("Industry or category"),
      },
      async ({ brand_name, competitors, industry }) => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `Deep competitive analysis: "${brand_name}" vs ${competitors} in ${industry}.`,
                "",
                "1. Run `competitor_comparison` to see who's winning AI mindshare",
                "2. Run `competitor_gap_analysis` with 5 key industry topics",
                "3. Run `generate_audit_queries` with the competitor names",
                "",
                "Synthesize into: who's the AI visibility leader, where are we losing, and what's the fastest way to close the gap.",
              ].join("\n"),
            },
          },
        ],
      }),
    );

    this.server.prompt(
      "fix_my_ai_presence",
      "Get actionable fixes you can deploy this week — schema markup, content plan, and hallucination cleanup",
      {
        brand_name: z.string().describe("Brand name"),
        url: z.string().describe("Brand website URL"),
        description: z.string().describe("What your brand does (1-2 sentences)"),
      },
      async ({ brand_name, url, description }) => ({
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `I need to fix "${brand_name}"'s AI presence. Website: ${url}. We are: ${description}`,
                "",
                "1. Run `entity_clarity_score` with my description",
                "2. Run `hallucination_check` — ask yourself what you know about my brand, then verify it",
                "3. Run `schema_markup_generator` to generate paste-ready JSON-LD",
                "4. Run `content_strategy_generator` based on any weak areas found",
                "",
                "Give me a prioritized fix list I can execute this week, starting with the schema markup code.",
              ].join("\n"),
            },
          },
        ],
      }),
    );
  }
}

// ── Export: OAuth-wrapped MCP server ──────────────────────────────────────────

export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: NewtationMCP.serve("/mcp"),
  defaultHandler: GitHubHandler as unknown as OAuthHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
