# Newtation MCP — AI SEO for Claude

> Find out whether ChatGPT, Claude, Perplexity, Gemini and Google AI Overviews can find, read and cite your website, and get the fixes.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Streamable_HTTP-green)](https://modelcontextprotocol.io)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://developers.cloudflare.com/workers/)

Newtation is a remote MCP server for **AI SEO**, also called GEO (generative engine optimization) or AEO (answer engine optimization). Its 17 free tools check every layer that decides whether AI answers mention you:

1. **Access:** can AI crawlers reach the site? It checks robots.txt for 18 AI bots, firewall/CDN blocking, noindex, and whether the site is in Common Crawl training data.
2. **Readability:** can they read it without running JavaScript, across the whole site?
3. **Understanding:** do structured data, Wikidata and Wikipedia tell AI who you are?
4. **Quotability:** does each section give AI a direct, specific, sourced answer it can cite?
5. **Perception and share of voice:** what does AI believe about your brand, does it make things up, and how often does it recommend you versus competitors?

Then it hands you paste-ready fixes: robots.txt lines, JSON-LD schema and llms.txt.

No sign-in, no API keys, free. Every tool reads public web pages only and changes nothing.

## Quick start

**Server URL:** `https://mcp.newtation.ai/mcp`

**Claude (claude.ai and Claude Desktop):** Settings → Connectors → **Add custom connector** → paste the server URL.

**Claude Code:**

```bash
claude mcp add --transport http newtation https://mcp.newtation.ai/mcp
```

**Cursor, Windsurf and other MCP clients:**

```json
{
  "mcpServers": {
    "newtation": { "url": "https://mcp.newtation.ai/mcp" }
  }
}
```

For clients that only support local servers, use `npx mcp-remote https://mcp.newtation.ai/mcp`.

The **Claude plugin** in [`plugin/`](plugin) adds skills that teach Claude when and how to run these audits, so asking "why doesn't ChatGPT mention my brand?" kicks off the right workflow.

## Try it

```
Run an AI SEO audit on example.com
```
```
Can GPTBot, ClaudeBot and PerplexityBot crawl stripe.com?
```
```
What do you know about Notion? Then check yourself against notion.com.
```
```
How often does AI recommend us (acme.com) for "CRM for small agencies" versus HubSpot and Pipedrive?
```
```
Rewrite our pricing page (acme.com/pricing) so AI answers quote it.
```
```
Why would Perplexity recommend competitor.com over example.com for "project management"?
```

Or pick a prompt from your client's prompt menu: **`ai_visibility_audit`**, **`ai_share_of_voice_test`**, `live_ai_perception_test`, `hallucination_stress_test`, `run_seo_action_plan`.

## Tools

All tools are free, need no sign-in, and only read public data.


| Tool | What it does |
|------|-------------|
| `check_ai_crawler_access` | robots.txt verdict for 18 AI and search bots (OAI-SearchBot, GPTBot, Claude-SearchBot, ClaudeBot, PerplexityBot, Googlebot, Google-Extended, Bingbot, CCBot…), live firewall/CDN test, noindex/nosnippet, llms.txt, access score and paste-ready robots.txt |
| `audit_site` | Samples up to 20 pages from the sitemap across the site's sections: errors, noindex, AI-bot blocks, JavaScript-only pages, thin pages, missing schema/titles/H1s, sitemap freshness, site score |
| `analyze_citability` | Section-by-section quotability score (direct answer first, facts and numbers, sources, length, lists, question headings, fluff), best passages, weakest sections with rewrite advice, author/date/FAQ signals |
| `check_entity_presence` | Organization schema and sameAs profiles, brand-name consistency, Wikidata item (matched by official website), key Wikidata facts, English Wikipedia article |
| `check_training_data_presence` | Whether the site is in the latest Common Crawl (widely used AI training data): pages captured, homepage, crawl errors, CCBot access |
| `analyze_ai_answers` | AI share of voice from answers by this or any assistant: mention rate, position vs competitors, other brands named, cited domains, sentiment, questions where you're missing |
| `simulate_llm_crawler` | The page as AI crawlers see it (no JavaScript), token estimate, JavaScript-dependency risk |
| `extract_and_validate_schema` | Every JSON-LD block on the page: types found, valid vs broken |
| `generate_missing_schema` | Paste-ready Organization / WebSite / FAQPage JSON-LD linked by `@id`; never invents logos or profile links |
| `generate_llms_txt` | Ready-to-upload llms.txt built from the site's real links |
| `analyze_onpage_seo` | Title, meta, H1/H2, word count, readability, keyword placement, top phrases |
| `check_technical_fundamentals` | robots meta, canonical, viewport, `<html lang>`, Open Graph / Twitter cards |
| `analyze_internal_links` | Internal/external links and top anchor texts |
| `measure_page_response` | Time to first byte, fetch time, HTML size |
| `compare_competitor_content` | Multi-page head-to-head: content, topics, keyword, schema, technical, AI crawlability, speed, plus gaps and actions |
| `score_ai_answer` | Grades the AI's own description of a brand against the live site (coverage, fact-check, knowledge lag) |
| `verify_brand_facts` | Fact-checks the AI's answers to risky prospect questions (pricing, founders, HQ…) against the site |

**Prompt workflows:** `ai_visibility_audit`, `ai_share_of_voice_test`, `live_ai_perception_test`, `hallucination_stress_test`, `run_seo_action_plan`

## Why it's free

The perception, hallucination and share-of-voice tests run on the AI you're already talking to. Claude answers from memory, then a deterministic grader checks those answers against your live site and your competitors. You can paste in answers from ChatGPT, Perplexity or Gemini to compare engines. Entity and training-data checks use the free public Wikidata and Common Crawl APIs. Nothing calls a paid API, so there's nothing to meter.

## Self-hosting

<details>
<summary>Deploy your own instance on Cloudflare Workers</summary>

### Requirements

- Node.js 18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is fine)

### Deploy

```bash
git clone https://github.com/Newtation/newtation-mcp.git
cd newtation-mcp
npm install
npm run deploy
```

Change or remove the `routes` entry (`mcp.newtation.ai`) in `wrangler.jsonc`: a custom domain only deploys if its zone is in your Cloudflare account.

### Local dev

```bash
npm run dev
npm test     # offline checks + live checks against real sites
# Test with: npx @modelcontextprotocol/inspector
# → http://localhost:8788/mcp
```

</details>

## Project structure

```
newtation-mcp/
├── src/
│   ├── index.ts               MCP server (Durable Object), tool and prompt registration
│   └── tools.ts               Tool implementations
├── plugin/                    Claude plugin: AI SEO skills + connector reference
├── scripts/                   Smoke tests (bundle with esbuild, run with node)
├── wrangler.jsonc             Cloudflare Workers config
├── smithery.yaml              Smithery registry manifest
└── worker-configuration.d.ts  Runtime types
```

## Privacy & terms

- **Privacy policy:** https://newtation.ai/privacy
- All tools are **read-only**. They fetch the public URLs you ask about (plus that site's robots.txt, sitemap and llms.txt) and look brands up in the public Wikidata and Common Crawl indexes
- No account is needed and no record is kept of who called a tool
- No conversation content is logged or persisted

## Support

- **Email:** contact@newtation.ai (48-hour response)
- **Issues:** https://github.com/Newtation/newtation-mcp/issues
- **Docs:** https://github.com/Newtation/newtation-mcp

## License

MIT — free to use, fork, and modify.

---

Built by [Newtation](https://newtation.ai) — AI presence management for modern brands.
