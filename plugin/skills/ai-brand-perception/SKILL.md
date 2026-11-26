---
name: ai-brand-perception
description: Test what an AI assistant believes about a brand and catch hallucinations by grading its answers against the brand's real website. Use when the user asks what ChatGPT, Claude, Gemini or AI in general thinks, knows or says about their brand, company or product; whether AI describes them accurately or is out of date; whether AI makes up facts about them (pricing, founders, location, features); or which competitors AI associates them with.
---

# AI brand perception test

You are the AI being tested. The test only works if you answer from your own knowledge **before** looking anything up.

1. Get the brand name and its website. If either is missing, ask.
2. **Before calling any tool or searching**, write your honest answer from memory:
   - Perception: one paragraph on what the brand is, what it does, what it's known for, its main competitors, and whether you'd recommend it.
   - Facts: one to three sentences each on its pricing, founders and founding year, headquarters, free tier or trial, main products, and whether it's still active.
   - If you don't know the brand, say so plainly. That is an important result, not a failure.
3. Grade yourself with the Newtation tools:
   - `score_ai_answer` with your perception paragraph verbatim.
   - `verify_brand_facts` with each fact question and your answer verbatim. It reads the homepage, /about and /pricing. If it flags claims those pages don't confirm, ask the user which pages state them (company, team, contact, press or FAQ pages) and run it again with those URLs in `extra_pages`.
4. Report:
   - **What AI believes**: quote your from-memory answer.
   - **AI knowledge score** and hallucination risk from the tools.
   - **What AI gets right, what it's missing, and claims the site can't back up.** Remember that "not confirmed by the site" may still be true. Tell the user to check each one, then either publish it (if true) or correct it publicly (if false).
   - **Fixes**: the tools' recommended actions, in plain language.

Make clear this tested one AI model once. Other assistants may know more or less, and answers change with each model release.

If the brand isn't recognized at all, suggest running the ai-visibility-audit skill next: crawler access and structured data are usually the first things to fix.
