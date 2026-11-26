---
name: ai-content-optimization
description: Rewrite or improve web pages so AI assistants and AI search engines quote and cite them. Use when the user wants to optimize content for AI, get a page cited by ChatGPT, Perplexity or Google AI Overviews, make content more quotable or "LLM-friendly", write for AI answers or answer engines, or asks why AI cites other pages instead of theirs.
---

# Optimize content for AI citations

1. Get the page URL (and the question or topic it should be cited for, if the user has one).
2. Call `analyze_citability` on the page. If it reports no readable sections, call `simulate_llm_crawler`: the content is probably rendered by JavaScript, and fixing that comes before any rewriting.
3. Explain the score in one or two sentences, then work through the `needs_work` sections, weakest first. For each one:
   - Quote what the section opens with now.
   - Write a rewritten version that opens with a direct one-sentence answer to the heading's question, then gives specifics (numbers, prices, dates, named examples), then a list or table if there are several items.
   - Rephrase the heading as the question people ask, where that fits.
   - Keep every fact the user's page states. **Never invent statistics, customers, prices or sources.** Where a section needs a fact you don't have, leave a clearly marked placeholder such as `[ADD: average setup time in days]` and list those placeholders at the end for the user to fill in.
4. Add the page-level fixes the tool lists (author, last-updated date, FAQ section). If an FAQ is needed, draft the questions and answers from the page's own content, then call `generate_missing_schema` with type FAQPage and those `faqs` to produce the markup.
5. Finish with a short checklist of the changes and the placeholders still to fill.

Keep the brand's voice. The goal is clearer and more specific, not more keyword-stuffed.
