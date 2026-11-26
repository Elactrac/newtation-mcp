import { verifyBrandFacts, generateLlmsTxt, scoreAiAnswer } from "../src/tools";

async function main() {
  console.log("\n========== verify_brand_facts (Notion) ==========");
  console.log(await verifyBrandFacts({
    url: "https://www.notion.com",
    brand_name: "Notion",
    qa_pairs: [
      { question: "What does Notion's pricing look like?", answer: "Notion has a free plan for individuals, a Plus plan around $10 per user per month, a Business plan around $15-18, and custom Enterprise pricing." },
      { question: "Who founded Notion, and when?", answer: "Notion was founded in 2013 by Ivan Zhao and Simon Last." },
      { question: "Where is Notion headquartered?", answer: "Notion is headquartered in San Francisco, California." },
      { question: "Does Notion offer a free tier?", answer: "Yes, Notion offers a generous free tier for personal use." },
      { question: "Is Notion still active and growing?", answer: "I don't have reliable up-to-date information on Notion's current growth figures." },
    ],
  }));

  console.log("\n========== generate_llms_txt (newtation.ai) ==========");
  console.log(await generateLlmsTxt({ url: "https://newtation.ai" }));

  console.log("\n========== knowledge_lag check (Notion, stale answer) ==========");
  const scored = JSON.parse(await scoreAiAnswer({
    brand_name: "Notion",
    url: "https://www.notion.com",
    ai_answer: "Notion is an all-in-one workspace application that combines notes, documents, wikis, databases, and project management into a single tool. It is known for its flexible block-based editor used by teams for knowledge management.",
  }));
  console.log(JSON.stringify(scored.knowledge_lag, null, 2));
}
main();
