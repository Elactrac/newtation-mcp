# Registry Submission Pack

Copy-paste-ready fields for each directory.

- **Server URL:** `https://mcp.newtation.ai/mcp` (no auth)

## 1. Claude Connectors Directory (highest priority)

This is the only listing Claude itself uses. When someone mentions AI SEO and hasn't connected a matching tool, Claude searches this directory and shows a **Connect** card. Smithery, mcp.so, Glama, the open MCP Registry and the GitHub servers list do **not** feed it.

**Who can submit:** any paid Claude plan (Pro, Max, Team, Enterprise). On Team/Enterprise, an Owner.
**Where:** [claude.ai/directory/manage](https://claude.ai/directory/manage) → **Submit new**.
**Docs:** [submission](https://claude.com/docs/connectors/building/submission) · [review criteria](https://claude.com/docs/connectors/building/review-criteria) · [plugins](https://claude.com/docs/plugins/submit)

Make two submissions from the same organization, then pair them:

### 1a. MCP connector

| Field | Value |
|-------|-------|
| Name | Newtation AI SEO |
| Server URL | `https://mcp.newtation.ai/mcp` |
| Authentication | None (all tools read public web pages only) |
| Documentation | https://github.com/Newtation/newtation-mcp#readme |
| Privacy policy | https://newtation.ai/privacy |
| Support | contact@newtation.ai |
| Icon | Newtation logo, square PNG |

**Short description:**
> AI SEO: check whether ChatGPT, Claude, Perplexity and Google AI Overviews can crawl, read and cite your website, and get paste-ready fixes.

**Detail description:**
> Newtation is an AI SEO (GEO / AEO) toolkit. Ask Claude to audit any website and it checks every layer that decides whether AI answers mention you:
>
> - **Access:** robots.txt rules for 18 AI and search crawlers (OAI-SearchBot, GPTBot, Claude-SearchBot, ClaudeBot, PerplexityBot, Googlebot, Bingbot, CCBot and more), firewall/CDN blocking, noindex, and presence in Common Crawl training data.
> - **Readability:** what AI crawlers see without JavaScript, across a sample of the whole site.
> - **Understanding:** structured data, sameAs profiles, Wikidata and Wikipedia.
> - **Quotability:** a section-by-section score of how easily AI answers can quote each page, with rewrite advice.
> - **Perception and share of voice:** what the AI believes about your brand (hallucinations flagged), and how often it recommends you versus competitors.
>
> You get a score, a ranked fix list, and paste-ready robots.txt lines, JSON-LD schema and llms.txt. There are also competitor gap analysis and on-page SEO tools. Free, no sign-in, read-only.

**Example prompts** (for the listing and for testing):
- Run an AI SEO audit on example.com
- Can GPTBot and ClaudeBot crawl my site? example.com
- What do you know about Acme? Then check yourself against acme.com
- Why does Perplexity recommend competitor.com instead of example.com?
- How often does AI recommend us for "CRM for agencies" versus HubSpot?
- Rewrite example.com/pricing so AI answers quote it

### 1b. Plugin bundle

- **Repository:** `Newtation/newtation-mcp` (must be public)
- **Plugin path:** `plugin`
- Run **Validate** in the portal and fix anything marked Blocking. Locally: `claude plugin validate ./plugin` (passes).
- After both are approved, pair the plugin with the connector listing.

The plugin's skills are what make Claude reach for Newtation on its own. Their descriptions list the trigger phrases: AI SEO, GEO, AEO, AI visibility, "why doesn't ChatGPT mention my brand", llms.txt, GPTBot and so on. To widen what triggers them, edit the `description:` line in `plugin/skills/*/SKILL.md` and raise `version` in `plugin/.claude-plugin/plugin.json`.

### Before submitting

- [ ] `mcp.newtation.ai` is live (`npm run deploy`; the zone must be in the same Cloudflare account as the Worker)
- [ ] Every tool tested through [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) and as a custom connector in Claude (the portal asks you to confirm this)
- [x] Every tool has `title` + `readOnlyHint`
- [x] No sign-in for public-data tools; errors return `isError` with an actionable message
- [x] Tool descriptions describe behavior only (no promotion, no instructions to call other software)
- [x] Privacy policy live at https://newtation.ai/privacy
- [x] Plugin has README (40+ words), LICENSE, valid manifest

## 2. Other directories (for Cursor, Windsurf, and web discoverability)

These don't affect Claude's suggestions. They do help people on other MCP clients find Newtation, and listings and roundup articles feed what future AI models learn about it.

### Common fields

| Field | Value |
|-------|-------|
| Name | Newtation |
| Display name | Newtation — AI SEO |
| Homepage | https://newtation.ai |
| Repository | https://github.com/Newtation/newtation-mcp |
| Issues | https://github.com/Newtation/newtation-mcp/issues |
| Privacy policy | https://newtation.ai/privacy |
| Support email | contact@newtation.ai |
| License | MIT |
| Auth | None (free tools) |
| Transport | Streamable HTTP |
| Categories | Marketing, SEO, Analytics |

### Taglines

- **50 char:** AI SEO: get found and cited by ChatGPT & Claude.
- **80 char:** Free AI SEO toolkit: check if ChatGPT, Claude and Perplexity can crawl and cite you.
- **160 char:** Newtation checks whether AI crawlers can reach, read and understand your site, tests what AI believes about your brand, and hands you paste-ready fixes. Free.

### Smithery (smithery.ai)

**Submit at:** https://smithery.ai/new. The manifest is [`smithery.yaml`](../smithery.yaml); point Smithery at the GitHub repo.

### mcp.so

**Submit at:** https://mcp.so/submit. Type: Remote (HTTP), Auth: none, Categories: SEO, Marketing, Analytics. Use the detail description above.

### Glama.ai

**Submit at:** https://glama.ai/mcp/servers/add. Glama scrapes GitHub, so set the repo topics: `mcp`, `mcp-server`, `claude`, `ai-seo`, `geo`, `aeo`, `llms-txt`.

### PulseMCP

**Submit at:** https://www.pulsemcp.com/submit. Same repo prep as Glama.

### modelcontextprotocol/servers PR

Fork https://github.com/modelcontextprotocol/servers, then add this to "Community Servers" (alphabetical):

```markdown
- **[Newtation](https://github.com/Newtation/newtation-mcp)** - AI SEO: check whether ChatGPT, Claude and Perplexity can crawl, read and cite a site (robots.txt for 18 AI bots, JS rendering, schema), test what AI believes about a brand, and generate robots.txt, JSON-LD and llms.txt fixes.
```

PR title: `Add Newtation MCP server (AI SEO)`
