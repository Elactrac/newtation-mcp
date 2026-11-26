---
name: ai-seo-competitor-gap
description: Compare a website against a competitor for AI search and SEO, and find what to fix or publish to compete. Use when the user asks why ChatGPT, Perplexity, Claude or Google AI Overviews recommend or cite a competitor instead of them, wants a competitor content gap or topic gap analysis, wants to compare their site with a rival's, or asks how to beat a competitor in AI answers or search results.
---

# AI SEO competitor gap

1. Get both URLs and, if the user has one, the keyword or topic they compete on.
2. Call `compare_competitor_content` with `your_url`, `competitor_url` and `target_keyword`.
3. Call `check_ai_crawler_access` on both sites. A competitor that AI crawlers can reach will beat one they can't, whatever the content.
4. Call `check_entity_presence` for both brands. A competitor with a Wikidata item and Wikipedia article is easier for AI to recognise and recommend.
5. Report:
   - **Scorecard**: one row per dimension with who leads.
   - **Why AI may prefer them**: the two or three biggest gaps, with evidence (topics and headings they cover that the user doesn't, structured data they have, crawler access differences).
   - **What to publish or fix**, ranked by impact. Be specific: page titles to create, sections to add, schema types to ship.
   - **Where the user already wins**: topics they own that the competitor lacks, which are worth doubling down on.

Be clear that this compares public page content, crawler access and entity signals. To measure how often each brand actually appears in AI answers, follow up with the ai-share-of-voice skill.
