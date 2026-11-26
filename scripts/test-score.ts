import { scoreAiAnswer } from "../src/tools";

const CASES = [
  {
    name: "Known brand (Notion)",
    brand_name: "Notion",
    url: "https://www.notion.com",
    ai_answer:
      "Notion is an all-in-one workspace application that combines notes, documents, wikis, databases, and project management into a single tool. It was founded in 2013 and is headquartered in San Francisco. Notion is known for its flexible block-based editor and is widely used by startups and teams for knowledge management. Its main competitors are Evernote, Coda, Asana, and Obsidian. Notion launched Notion AI in 2023, which adds writing assistance. I would recommend Notion for teams that want a customizable workspace, though it can have a steep learning curve and around 30 million users use it.",
  },
  {
    name: "Unknown small brand",
    brand_name: "Newtation",
    url: "https://newtation.ai",
    ai_answer:
      "I don't have reliable information about a company called Newtation. I cannot say what they do or who their competitors are without more context.",
  },
];

async function main() {
  for (const c of CASES) {
    console.log(`\n========== ${c.name} ==========`);
    console.log(await scoreAiAnswer(c));
  }
}
main();
