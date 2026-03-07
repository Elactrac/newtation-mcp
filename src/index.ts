/**
 * Newtation AI Presence MCP Server — Remote (Cloudflare Workers)
 *
 * Exposes 12 brand auditing tools via the MCP protocol over Streamable HTTP,
 * with GitHub OAuth for authentication. Deployable to Cloudflare Workers.
 *
 * Core Audit:
 *   - brand_perception_audit      : How AI describes your brand overall
 *   - citation_check              : Whether AI cites your brand as a source
 *   - competitor_comparison       : How your brand stacks up vs competitors in AI
 *   - entity_clarity_score        : How clearly AI understands what your brand is
 *   - geo_recommendations         : Whether AI recommends your brand by location
 *
 * Diagnostics:
 *   - prompt_vulnerability_scan   : Find prompts where AI gives wrong/weak answers
 *   - sentiment_analysis          : Likely tone when AI discusses your brand
 *
 * Strategy & Output:
 *   - content_strategy_generator  : Prioritized content plan from weak areas
 *   - competitor_gap_analysis     : Topics where competitors have stronger AI visibility
 *   - content_audit_for_ai        : Scores existing content for AI discoverability
 *   - citation_outreach_targets   : High-authority sites to target for backlinks
 *
 * Summary:
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
  geoRecommendations,
  promptVulnerabilityScan,
  sentimentAnalysis,
} from "./tools";

// All Newtation tools are read-only audits — they never modify external state.
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

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
    version: "1.0.0",
  });

  async init() {
    // ── brand_perception_audit ──────────────────────────────────────────
    this.server.tool(
      "brand_perception_audit",
      "Analyze how AI language models currently perceive and describe your brand. " +
        "Returns a structured audit covering tone, category placement, trust signals, " +
        "and recommended prompts you can use to test your own AI presence.",
      {
        brand_name: z.string().describe("The brand or company name to audit (e.g. 'Newtation')"),
        industry: z.string().describe("Industry or category (e.g. 'SEO agency', 'SaaS', 'e-commerce')"),
        website: z.string().optional().describe("Brand website URL (optional, used for context)"),
      },
      { title: "Brand Perception Audit", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, industry, website }) => ({
        content: [
          {
            type: "text" as const,
            text: brandPerceptionAudit({ brand_name, industry, website }),
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
      "Score how clearly AI models understand what your brand is, what it does, " +
        "and who it serves. Returns a 0-100 score with specific fixes.",
      {
        brand_name: z.string().describe("Brand name to score"),
        tagline_or_description: z
          .string()
          .optional()
          .describe("Your brand's own description of itself (from homepage or About page)"),
      },
      { title: "Entity Clarity Score", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, tagline_or_description }) => ({
        content: [
          {
            type: "text" as const,
            text: entityClarityScore({ brand_name, tagline_or_description }),
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
      "Audit existing content and score it for AI discoverability. Analyzes how well " +
        "AI can understand, cite, and reference your content. Returns grades and " +
        "optimization recommendations for each URL.",
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
      { title: "Content Audit for AI", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, content_urls, target_topics }) => ({
        content: [
          {
            type: "text" as const,
            text: contentAuditForAI({ brand_name, content_urls, target_topics }),
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
      "Get a comprehensive AI readiness score across all dimensions: perception, " +
        "entity clarity, citations, competitive position, geographic reach, and " +
        "sentiment. Returns a letter grade (A-F) with prioritized next steps.",
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
      { title: "AI Readiness Scorecard", ...READ_ONLY_ANNOTATIONS },
      async ({ brand_name, industry, website, competitors, target_locations, topics }) => ({
        content: [
          {
            type: "text" as const,
            text: aiReadinessScorecard({ brand_name, industry, website, competitors, target_locations, topics }),
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
  defaultHandler: GitHubHandler as any,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
