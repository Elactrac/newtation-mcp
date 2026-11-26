import { auditSite, analyzeCitability, analyzeAiAnswers, checkEntityPresence, checkTrainingDataPresence, analyzeOnpageSeo, verifyBrandFacts, scoreAiAnswer, generateLlmsTxt, hasNoindex } from "../src/tools";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
}

// ── analyze_ai_answers (offline) ──
const sov = JSON.parse(analyzeAiAnswers({
  brand_name: "Notion",
  brand_domain: "notion.com",
  competitors: ["Coda", "Confluence"],
  answers: [
    { prompt: "Best wiki tool for startups?", answer: "Here are good options:\n1. **Confluence** — mature but complex.\n2. **Notion** — flexible and popular with startups.\n3. **Slite** — simple.", cited_urls: ["https://www.g2.com/x", "https://notion.com/product"] },
    { prompt: "Best docs tool for engineering teams?", answer: "1. Confluence: the standard choice.\n2. Coda: docs plus tables.\n3. Slite: lightweight." },
    { prompt: "Notion alternatives?", answer: "Notion is a great all-in-one workspace, though it can be expensive for large teams. Coda is a strong alternative.", engine: "ChatGPT" },
  ],
}));
assert(sov.mention_rate.startsWith("67%"), `mention rate ${sov.mention_rate}`);
assert(sov.answers[0].rank === 2, "Notion ranked 2nd after Confluence in answer 1");
assert(sov.answers[0].your_site_cited === true, "own domain citation detected");
assert(sov.missed_prompts.length === 1 && sov.missed_prompts[0].mentioned_instead.includes("Confluence"), "missed prompt lists who was named instead");
assert(sov.other_brands_ai_mentions.some((o: any) => o.name === "Slite"), "auto-detects unlisted brand Slite");
assert(sov.answers[2].sentiment === "mixed", "mixed sentiment when praise and caveat co-occur");
assert(JSON.parse(analyzeAiAnswers({ brand_name: "X", answers: [] })).error, "empty answers rejected");

const first = JSON.parse(analyzeAiAnswers({
  brand_name: "Notion",
  brand_domain: "notion.com",
  competitors: ["Confluence", "Coca-Cola"],
  answers: [{ prompt: "Best team wiki?", answer: "1. **Notion** — flexible docs.\n2. **Confluence** — strong for enterprises.\n\nSources: https://www.atlassian.com/software/confluence https://www.notion.com/product" }],
}));
assert(!first.error, "hyphenated competitor name accepted");
assert(first.answers[0].rank === 1, "brand named first ranks 1st even when its domain is cited later");

// ── noindex detection (offline) ──
assert(hasNoindex("noindex, follow") && hasNoindex("none") && hasNoindex("googlebot: none"), "noindex and none are detected");
assert(!hasNoindex("index, follow, max-image-preview:none"), "max-image-preview:none is not noindex");

async function live() {
  const kw = JSON.parse(await analyzeOnpageSeo({ url: "https://en.wikipedia.org/wiki/C%2B%2B", target_keyword: "C++" }));
  assert(!kw.error && kw.content.keyword_density.count > 0 && kw.title.keyword_present, `keyword with regex characters: "C++" found ${kw.content?.keyword_density.count} times`);

  const facts = JSON.parse(await verifyBrandFacts({
    url: "https://stripe.com",
    brand_name: "Stripe",
    qa_pairs: [
      { question: "Who founded Stripe, and when?", answer: "Stripe was founded in 2010 by brothers Patrick Collison and John Collison." },
      { question: "What does Stripe pricing look like?", answer: "I am not certain of current rates, but standard online card processing in the US has been 2.9% + 30 cents per successful charge." },
      { question: "Does Stripe have an office on Mars?", answer: "I don't have any information about that." },
    ],
  }));
  assert(!facts.error && !/^HIGH/.test(facts.hallucination_risk), `unconfirmed-but-true facts aren't called high hallucination risk: ${facts.hallucination_risk}`);
  assert(facts.results[1].status !== "AI ADMITS IT DOESN'T KNOW", `hedged answer with specifics is fact-checked: ${facts.results[1].status}`);
  assert(facts.results[2].status === "AI ADMITS IT DOESN'T KNOW", "answer with no specifics counts as a knowledge gap");
  assert(/extra_pages/.test(facts.next_step ?? ""), "unconfirmed claims prompt for the pages that state them");

  const founders = { question: "Who founded Stripe, and when?", answer: "Stripe was founded in 2010 by brothers Patrick Collison and John Collison." };
  const before = JSON.parse(await verifyBrandFacts({ url: "https://stripe.com", brand_name: "Stripe", qa_pairs: [founders] }));
  const after = JSON.parse(await verifyBrandFacts({ url: "https://stripe.com", brand_name: "Stripe", qa_pairs: [founders], extra_pages: ["https://stripe.com/newsroom/information"] }));
  assert(after.ground_truth_sources.length > before.ground_truth_sources.length, `extra_pages are added to the ground truth (${after.ground_truth_sources.length} pages)`);
  assert(after.results[0].claims_verified_on_your_site.length > before.results[0].claims_verified_on_your_site.length,
    `extra pages confirm more claims: ${before.results[0].claims_verified_on_your_site.join(", ") || "none"} -> ${after.results[0].claims_verified_on_your_site.join(", ")}`);

  const late = JSON.parse(await scoreAiAnswer({ url: "https://stripe.com", brand_name: "Stripe", ai_answer: "Stripe is a financial infrastructure company offering payment processing APIs, billing and fraud tools for online businesses. I'm not certain about its current pricing." }));
  assert(late.ai_recognition === "Recognized", "a late hedge doesn't mark the brand as unrecognized");
  assert(!late.topics.ai_is_missing.some((t: string) => /^[\d\s]+$/.test(t)), "number runs aren't reported as missing topics");
  const blank = JSON.parse(await scoreAiAnswer({ url: "https://stripe.com", brand_name: "Stripe", ai_answer: "I don't have reliable information about Stripe." }));
  assert(/^NOT RECOGNIZED/.test(blank.ai_recognition), "an answer that opens with not knowing is unrecognized");

  const llms = JSON.parse(await generateLlmsTxt({ url: "https://about.gitlab.com" }));
  assert(!llms.error && llms.llms_txt.includes("## Optional"), "llms.txt key pages are chosen by path, not hostname");
  const llms2 = JSON.parse(await generateLlmsTxt({ url: "https://newtation.ai" }));
  assert(!llms2.error && !/\[(\w+)\1\]/.test(llms2.llms_txt), "llms.txt link labels skip aria-hidden duplicate text");

  const pdf = JSON.parse(await analyzeCitability({ url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" }));
  assert(/not a web page/.test(pdf.error ?? ""), `non-HTML URL rejected: ${pdf.error}`);

  const audit = JSON.parse(await auditSite({ url: "https://www.anthropic.com", max_pages: 8 }));
  assert(!audit.error && audit.pages_checked >= 3, `audit_site: ${audit.ai_readiness_score}, ${audit.pages_checked} pages from ${audit.page_source}`);
  console.log("   issues:", audit.issues.map((i: any) => `${i.issue} (${i.pages})`).join(" | ") || "none");

  const cit = JSON.parse(await analyzeCitability({ url: "https://en.wikipedia.org/wiki/Search_engine_optimization" }));
  assert(!cit.error, `citability wikipedia SEO article: ${cit.citability_score}, ${cit.page_signals.sections} sections`);
  const cit2 = JSON.parse(await analyzeCitability({ url: "https://newtation.ai" }));
  assert(!cit2.error, `citability newtation.ai: ${cit2.citability_score} — ${cit2.verdict}`);

  const ent = JSON.parse(await checkEntityPresence({ brand_name: "Stripe", url: "https://stripe.com" }));
  assert(ent.wikidata.status === "found", `entity Stripe: ${ent.entity_score}, ${ent.wikidata.item}, wikipedia ${ent.wikidata.wikipedia}`);
  const ent2 = JSON.parse(await checkEntityPresence({ brand_name: "Newtation", url: "https://newtation.ai" }));
  assert(!ent2.error, `entity Newtation: ${ent2.entity_score}, wikidata ${ent2.wikidata.status}, profiles ${ent2.on_site.profiles_linked.join(",") || "none"}`);

  // Common Crawl's public index is often overloaded; an outage there is reported, not failed.
  for (const url of ["https://stripe.com", "https://newtation.ai"]) {
    const cc = JSON.parse(await checkTrainingDataPresence({ url }));
    assert(!cc.error && typeof cc.robots_txt_allows_ccbot === "boolean", `training data ${url}: ${cc.verdict}${cc.crawl ? ` (${cc.crawl})` : ""}`);
  }
}
live().catch((e) => { console.error(e); throw e; });
