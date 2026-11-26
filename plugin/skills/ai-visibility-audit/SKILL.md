---
name: ai-visibility-audit
description: Audit how visible a website is to AI search and AI assistants, and produce the fixes. Use when the user mentions AI SEO, GEO (generative engine optimization), AEO (answer engine optimization), LLM SEO, LLMO or AI visibility; asks why ChatGPT, Claude, Perplexity, Gemini, Copilot or Google AI Overviews don't show, mention, recommend or cite their site; asks whether AI crawlers such as GPTBot, ClaudeBot or PerplexityBot can access their site; or wants an llms.txt file, an AI-friendly robots.txt, or schema markup so AI understands their site.
---

# AI visibility audit

Use the Newtation connector's tools. If they aren't available, tell the user the Newtation connector needs to be connected for live checks, then give general guidance from `references/fix-playbook.md`.

## Run the audit

1. Get the URL. If the user named a brand but no site, ask for the site.
2. Call these (independent ones together where you can):
   - `check_ai_crawler_access` on the site: robots.txt rules for 18 AI and search bots, firewall/CDN blocking, noindex, llms.txt
   - `audit_site` on the site: samples up to 20 pages from the sitemap and finds site-wide issues
   - `analyze_citability` and `simulate_llm_crawler` on the homepage and the most important page `audit_site` found (pricing, product or a key guide)
   - `check_entity_presence` with the brand name and site: structured data, sameAs profiles, Wikidata and Wikipedia
   - `check_training_data_presence` on the site: whether it's in Common Crawl (this one can take 30 seconds)
3. Generate fixes for what's missing:
   - Organization or WebSite schema missing: call `generate_missing_schema`. Ask for the logo URL and official profile links if you don't have them, or leave them in the tool's `to_complete` list.
   - No llms.txt: call `generate_llms_txt`.

## Write the report

Write for a marketer, in plain language, in this order:

1. **AI Visibility Score (0-100)**, weighted Access 30, Readability 20, Understanding 25, Quotability 25, with a one-line table row per area.
2. **Fix first**: the 3-5 highest-impact problems, most important first. For each: what's wrong, the evidence from the tool, why it matters for AI answers, and the fix, with paste-ready code from the tools (robots.txt lines, JSON-LD, llms.txt).
3. **Send this to your developer**: a short checklist they can forward as-is.
4. **What's already working**: two or three strengths.

Rank problems by impact:

1. Critical: robots.txt unreachable or returning 5xx, noindex, Googlebot or Bingbot blocked.
2. High: AI search bots blocked (OAI-SearchBot, Claude-SearchBot, PerplexityBot and the "-User" bots), firewall blocking AI crawlers, high JavaScript-dependency risk.
3. Medium: missing Organization schema, no Wikidata item, absent from Common Crawl, citability under 45, thin pages, nosnippet.
4. Low: blocked training bots (a business choice, so present both sides), no llms.txt, no sitemap line.

Don't overstate llms.txt. It's cheap to add, but most AI engines don't use it yet. Explain the difference between search bots (decide whether you can be cited today) and training bots (decide what future models learn) whenever either is blocked.

For background on each fix, read `references/fix-playbook.md`.

Next steps to offer: what AI believes about the brand (ai-brand-perception skill), how often AI recommends it versus competitors (ai-share-of-voice skill), and rewriting weak pages so AI quotes them (ai-content-optimization skill).
