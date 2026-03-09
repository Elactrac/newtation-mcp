# Newtation MCP Server

> Audit how AI systems perceive, describe, and recommend your brand — directly inside Claude.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-green)](https://modelcontextprotocol.io)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://developers.cloudflare.com/workers/)

---

## Description

Newtation is an AI presence management platform that helps brands understand and improve how AI models talk about them. It connects to Claude as a remote MCP server and provides **15 read-only auditing tools** and **4 prompt workflows** — covering perception, citations, competitive positioning, sentiment, hallucination detection, schema markup generation, and more.

All tools are **read-only**. They combine two approaches:
1. **Structured analysis frameworks** the LLM fills in using its actual training-data knowledge
2. **Computed artifacts** — real query sets, JSON-LD code, and verification matrices generated algorithmically

---

## Features

- **Full AI Brand Audit** — Score your brand across 6 dimensions: perception, entity clarity, citations, competitive position, geographic reach, and sentiment
- **Competitive Intelligence** — See exactly which topics competitors are beating you on in AI responses, with gap analysis and priority actions
- **Hallucination Detection** — Paste any AI-generated text about your brand and get a claim-by-claim fact-check with severity ratings
- **Schema Markup Generator** — Generate paste-ready JSON-LD (Organization, WebSite, FAQ, BreadcrumbList) optimized for AI discoverability
- **Audit Query Generator** — Auto-generate 30+ categorized test queries mapped to the right follow-up tools
- **Citation Mapping** — Check whether AI cites your brand for specific topics, and get a prioritized outreach list of high-authority sites
- **Content Scoring** — Audit existing pages and score them for AI discoverability (A-F grades with optimization checklists)
- **Prompt Vulnerability Detection** — Test specific prompts users might ask and find where AI gives wrong, weak, or competitor-favoring answers
- **4 Prompt Workflows** — Pre-built multi-tool workflows: Full Brand Audit, Quick Health Check, Competitive Deep Dive, Fix My AI Presence

---

## Setup

### Connect from the MCP Directory (Recommended)

1. Visit the [Anthropic MCP Directory](https://claude.ai/connectors)
2. Find and connect **Newtation**
3. Complete GitHub OAuth authentication
4. Start using any of the 15 tools by asking Claude naturally

### Connect from Claude Desktop

Add to your Claude Desktop config (`Settings > Developer > Edit Config`):

```json
{
  "mcpServers": {
    "newtation": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://newtation-mcp.elactrac.workers.dev/mcp"
      ]
    }
  }
}
```

Restart Claude Desktop. You'll be prompted to sign in with GitHub.

### Connect from Claude Code (Local, no auth)

```bash
git clone https://github.com/Elactrac/newtation-mcp.git
cd newtation-mcp
claude mcp add newtation -- python3 $(pwd)/server.py
```

Verify: `claude mcp list`

---

## Authentication

This server uses **GitHub OAuth 2.0** for remote connections.

- Any GitHub account works — no special permissions required
- OAuth flow: Claude redirects to GitHub → you authorize → redirected back with a session token
- Tokens are stored in Cloudflare KV with a 7-day expiration
- **Local mode** (Claude Code via `server.py`): No authentication required

**Required OAuth Callback URLs** (for self-hosting):
- `https://claude.ai/api/mcp/auth_callback`
- `https://claude.com/api/mcp/auth_callback`
- `http://localhost:6274/oauth/callback` (Claude Code local development)

---

## Tools

15 read-only tools organized into 5 categories:

### Core Audit
| Tool | Purpose |
|------|---------|
| `brand_perception_audit` | How AI describes your brand — tone, category placement, trust signals |
| `citation_check` | Whether AI cites your brand for specific topics |
| `competitor_comparison` | Your brand vs competitors in AI mindshare |
| `entity_clarity_score` | How clearly AI understands what your brand is and does |
| `geo_recommendations` | Whether AI recommends your brand in target cities/regions |

### Diagnostics
| Tool | Purpose |
|------|---------|
| `prompt_vulnerability_scan` | Finds prompts where AI gives wrong, weak, or competitor-favoring answers |
| `sentiment_analysis` | Breaks down AI's likely tone across brand aspects (quality, pricing, service, etc.) |
| `hallucination_check` | Paste AI-generated text → get claim-by-claim fact-check with severity ratings |

### Strategy & Output
| Tool | Purpose |
|------|---------|
| `content_strategy_generator` | Prioritized content plan based on your weak areas |
| `competitor_gap_analysis` | Topic-by-topic scoring of where competitors lead in AI visibility |
| `content_audit_for_ai` | Grades existing content (A-F) for AI discoverability |
| `citation_outreach_targets` | Ranked list of high-authority sites to target for backlinks and citations |
| `schema_markup_generator` | Generates paste-ready JSON-LD (Organization, WebSite, FAQ, BreadcrumbList) |

### Generators
| Tool | Purpose |
|------|---------|
| `generate_audit_queries` | Auto-generates 30+ categorized test queries with tool mapping and testing protocol |

### Summary
| Tool | Purpose |
|------|---------|
| `ai_readiness_scorecard` | Composite score across all dimensions with letter grade (A-F) |

---

## Prompt Workflows

4 pre-built multi-tool workflows that appear in Claude's prompt selector:

| Workflow | What It Does |
|----------|-------------|
| `full_brand_audit` | Runs 5 tools in sequence → executive summary with grade and 30-day action plan |
| `quick_health_check` | 2-tool fast check → 1-paragraph summary of your AI visibility |
| `competitive_deep_dive` | 3-tool competitive analysis → who's winning AI mindshare and how to close the gap |
| `fix_my_ai_presence` | 4-tool fix sequence → schema markup code + content plan you can deploy this week |

---

## Examples

### Example 1: Full Brand Audit

**Prompt:**
> Run a complete AI readiness audit for "Acme Corp" in the SaaS project management industry. Compare against Notion, Asana, and Monday.com.

**What happens:** Claude calls `ai_readiness_scorecard` and returns a composite score across 6 dimensions with a letter grade, priority actions, and benchmark context.

**Sample result:**

| Dimension | Score | Rating |
|-----------|-------|--------|
| AI Perception | 58/100 | Weak |
| Entity Clarity | 65/100 | Moderate |
| Citation Strength | 52/100 | Weak |
| Competitive Position | 61/100 | Moderate |
| Geographic Reach | 70/100 | Moderate |
| Sentiment | 68/100 | Moderate |

**Overall: 62/100 — Grade C.** Top action: boost citation strength by publishing authoritative content for key topics.

---

### Example 2: Competitive Gap Analysis

**Prompt:**
> Where is Acme Corp losing to Notion and Asana in AI visibility? Check these topics: project management, team collaboration, workflow automation, task tracking.

**What happens:** Claude calls `competitor_gap_analysis` and returns a topic-by-topic breakdown showing which competitor leads each topic, the score gap, and whether it's critical, moderate, or slight.

**Sample result:**

| Topic | Your Score | Top Competitor | Gap | Status |
|-------|-----------|----------------|-----|--------|
| project management | 58 | Notion (82) | 24 | 🔴 Critical |
| workflow automation | 54 | Asana (79) | 25 | 🔴 Critical |
| team collaboration | 68 | Notion (75) | 7 | 🟢 Slight |
| task tracking | 71 | Monday (73) | 2 | ✅ Leading |

**Action:** Focus on the two critical-gap topics first — publish definitive guides and build citations.

---

### Example 3: Content Audit + Outreach Targets

**Prompt:**
> Audit these pages for AI discoverability:
> - https://acmecorp.com/features
> - https://acmecorp.com/blog/pm-guide
> - https://acmecorp.com/pricing
>
> Then find me 10 sites to target for backlinks in the project management space.

**What happens:** Claude calls `content_audit_for_ai` to grade each page, then `citation_outreach_targets` to generate a ranked outreach list with authority scores and pitch angles.

**Sample result:**

| Page | Grade | Status |
|------|-------|--------|
| /features | C (68) | Needs optimization |
| /blog/pm-guide | A (82) | Highly discoverable |
| /pricing | D (51) | Weak signals |

Then a ranked list of 10 outreach targets with type (publication, review site, podcast, etc.), authority score, relevance score, and recommended outreach angle for each.

---

### More Prompts to Try

```
Audit my brand "Acme Corp" in the SaaS industry
```
```
Check if Acme Corp is being cited for "project management" and "team collaboration"
```
```
What's the entity clarity score for Acme Corp?
```
```
Does AI recommend Acme Corp for project management in New York, London, and Sydney?
```
```
Test these prompts for Acme Corp: "best project management tool", "Acme Corp reviews", "alternatives to Notion"
```
```
What's the AI sentiment around Acme Corp for quality, pricing, and customer support?
```
```
Generate a content strategy for Acme Corp targeting weak areas: "workflow automation" and "API integrations"
```

---

## Privacy Policy

See our full privacy policy at: [https://newtationco.app/privacy](https://newtationco.app/privacy)

**Summary:**
- All 15 tools are **read-only** — they generate reports, never modify external data
- OAuth tokens stored in Cloudflare KV with 7-day expiration
- Tool results are generated on-demand and not persisted
- No conversation data, analytics, or tracking collected
- Third-party services: GitHub (auth), Cloudflare (hosting)

---

## Support

- **Email:** support@newtationco.app
- **Documentation:** [github.com/Elactrac/newtation-mcp](https://github.com/Elactrac/newtation-mcp)
- **Issues:** [github.com/Elactrac/newtation-mcp/issues](https://github.com/Elactrac/newtation-mcp/issues)

We respond within 48 hours.

---

## Self-Hosting

<details>
<summary>Deploy your own instance on Cloudflare Workers</summary>

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier — 100k requests/month)
- A [GitHub OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

### Step 1 — Clone & Install

```bash
git clone https://github.com/Elactrac/newtation-mcp.git
cd newtation-mcp
npm install
```

### Step 2 — Create a GitHub OAuth App

1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**:
   - **Application name:** `Newtation MCP`
   - **Homepage URL:** `https://newtation-mcp.<your-subdomain>.workers.dev`
   - **Authorization callback URL:** `https://newtation-mcp.<your-subdomain>.workers.dev/callback`
3. Note your **Client ID** and generate a **Client Secret**

### Step 3 — Set Secrets

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put COOKIE_ENCRYPTION_KEY  # use: openssl rand -hex 32
```

### Step 4 — Create KV Namespace

```bash
npx wrangler kv namespace create "OAUTH_KV"
```

Update `wrangler.jsonc` with the returned namespace ID:

```jsonc
"kv_namespaces": [
  { "binding": "OAUTH_KV", "id": "<YOUR_KV_NAMESPACE_ID>" }
]
```

### Step 5 — Deploy

```bash
npm run deploy
```

Server URL: `https://newtation-mcp.<your-subdomain>.workers.dev/mcp`

### Local Development

1. Create a second GitHub OAuth App (Homepage: `http://localhost:8788`, Callback: `http://localhost:8788/callback`)
2. `cp .dev.vars.example .dev.vars` and fill in local OAuth credentials
3. `npm start`
4. Test with MCP Inspector: `npx @modelcontextprotocol/inspector@latest` → enter `http://localhost:8788/mcp`

</details>

---

## Project Structure

```
newtation-mcp/
├── src/
│   ├── index.ts               # MCP server + OAuth (Cloudflare Workers)
│   ├── tools.ts               # 15 brand auditing tools (TypeScript)
│   ├── github-handler.ts      # GitHub OAuth flow
│   ├── utils.ts               # OAuth helpers
│   └── workers-oauth-utils.ts # CSRF, state, approval dialog
├── server.py                  # Standalone stdio server (Python, for Claude Code)
├── package.json
├── wrangler.jsonc             # Cloudflare Workers config
├── tsconfig.json
├── worker-configuration.d.ts
├── .dev.vars.example
├── LICENSE
└── README.md
```

---

## License

MIT — free to use, fork, and modify.

---

Built by [Newtation](https://newtationco.app) · AI Presence Management for Modern Brands
