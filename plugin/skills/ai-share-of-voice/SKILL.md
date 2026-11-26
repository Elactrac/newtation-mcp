---
name: ai-share-of-voice
description: Measure how often AI assistants mention or recommend a brand compared with its competitors. Use when the user asks whether ChatGPT, Claude, Perplexity or Gemini recommends them, how they rank in AI answers, their AI share of voice, whether they show up when people ask AI for the best product in their category, which competitors AI recommends instead, or which websites AI cites in their category.
---

# AI share of voice

You are one of the assistants being measured, so the method matters: write the questions first, answer them honestly from your own knowledge, and only then analyze.

1. Get the brand name, its website, what it sells (the category), and its main competitors. Ask for anything missing; competitors are optional.
2. Write 8 realistic questions a buyer would ask an AI assistant in that category. Don't name the brand. Mix "best X for Y", problem-led ("how do I…") and one or two comparison questions.
3. **Before calling any tool or searching**, answer each question the way you'd answer a real user, naming specific products where you normally would. Don't favour or avoid the brand because of the test.
4. Call `analyze_ai_answers` with the brand, its domain, the competitors, and each question with your answer (engine "Claude").
5. Report:
   - **Headline**: mentioned in X of 8 answers, average position.
   - **Share of voice table**: brand, competitors, and other brands the AI named often.
   - **Where you're missing**: each question the brand didn't appear in, and who did.
   - **What to do**: the tool's actions made specific to the category. For each missed question, name the page to publish or improve.
6. Offer to add answers from other assistants: the user can ask ChatGPT, Perplexity or Gemini the same 8 questions and paste the answers (with source links if shown). Re-run `analyze_ai_answers` with all answers and an `engine` label for each, and compare engines.

Be clear about limits: AI answers vary between runs and engines, so this is a snapshot, not a ranking. Running the same questions monthly shows the trend.
