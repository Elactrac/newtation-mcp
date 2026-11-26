import { compareCompetitorContent } from "../src/tools";

function fail(msg: string): never {
  throw new Error(msg);
}

async function main() {
  const raw = await compareCompetitorContent({
    your_url: "https://www.notion.com",
    competitor_url: "https://coda.io",
    target_keyword: "workspace",
  });
  const result = JSON.parse(raw);

  if (result.error) fail(`compare failed: ${result.error}`);

  const required = [
    "evidence_disclaimer",
    "sites",
    "scorecard",
    "semantic_gaps",
    "keyword_battle",
    "heading_and_topic_gaps",
    "schema_gap",
    "recommended_actions",
  ];
  const missing = required.filter((k) => !(k in result));
  if (missing.length) fail(`missing keys: ${missing.join(", ")}`);

  const scoreDims = [
    "content_depth",
    "topic_coverage",
    "keyword_targeting",
    "schema_richness",
    "technical_readiness",
    "ai_crawlability",
    "speed",
    "content_similarity",
  ];
  const missingDims = scoreDims.filter((k) => !(k in result.scorecard));
  if (missingDims.length) fail(`missing scorecard dims: ${missingDims.join(", ")}`);

  if (!result.keyword_battle?.target_keyword) fail("keyword_battle missing target_keyword");

  if (!Array.isArray(result.recommended_actions) || result.recommended_actions.length === 0) {
    fail("recommended_actions empty");
  }

  console.log("PASS: compare_competitor_content scorecard shape OK");
  console.log(JSON.stringify({
    you_pages: result.sites.you.pages_fetched.map((p: { role: string; status: number | string }) => `${p.role}:${p.status}`),
    competitor_pages: result.sites.competitor.pages_fetched.map((p: { role: string; status: number | string }) => `${p.role}:${p.status}`),
    scorecard_edges: Object.fromEntries(
      Object.entries(result.scorecard)
        .filter(([, v]) => v && typeof v === "object" && "edge" in (v as object))
        .map(([k, v]) => [k, (v as { edge: string }).edge]),
    ),
    keyword_edge: result.keyword_battle.edge,
    actions: result.recommended_actions.length,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  throw e;
});
