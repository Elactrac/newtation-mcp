import { checkAiCrawlerAccess, parseRobotsTxt, robotsAllows, generateMissingSchema, simulateLlmCrawler, normalizeUrl } from "../src/tools";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok - ${msg}`);
}

// ── robots.txt parsing (offline) ──
const robots = parseRobotsTxt(`
# comment
User-agent: *
Disallow: /private
Allow: /private/ok$

User-agent: GPTBot
User-agent: CCBot
Disallow: /

User-agent: PerplexityBot
Disallow:

Sitemap: https://example.com/sitemap.xml
`);
assert(robots.groups.length === 3, "three user-agent groups");
assert(robots.sitemaps[0] === "https://example.com/sitemap.xml", "sitemap captured");
assert(robotsAllows(robots, "GPTBot", "/").allowed === false, "GPTBot blocked by its own group");
assert(robotsAllows(robots, "CCBot", "/anything").allowed === false, "CCBot shares GPTBot's group");
assert(robotsAllows(robots, "ClaudeBot", "/").allowed === true, "ClaudeBot falls back to * and is allowed at /");
assert(robotsAllows(robots, "ClaudeBot", "/private/x").allowed === false, "ClaudeBot blocked under /private");
assert(robotsAllows(robots, "ClaudeBot", "/private/ok").allowed === true, "longer Allow with $ wins");
assert(robotsAllows(robots, "ClaudeBot", "/private/ok/more").allowed === false, "$ anchors the Allow rule");
assert(robotsAllows(robots, "PerplexityBot", "/private").allowed === true, "empty Disallow allows all and ignores *");
assert(robotsAllows(parseRobotsTxt(""), "GPTBot", "/").allowed === true, "empty robots.txt allows all");

// ── URL validation ──
let threw = false;
try { normalizeUrl("localhost:3000"); } catch { threw = true; }
assert(threw, "rejects localhost");
assert(normalizeUrl("example.com/a").href === "https://example.com/a", "adds https://");

// ── schema generator ──
const schema = JSON.parse(generateMissingSchema({ brand_name: "Acme", url: "acme.com", description: "Acme makes anvils.", missing_types: ["Organization", "WebSite", "Breadcrumb"] }));
const org = schema.schema_generated["@graph"][0];
assert(org.url === "https://acme.com/" && !org.logo, "no invented logo, normalized URL");
assert(!JSON.stringify(schema).includes("SearchAction"), "no invented site search");
assert(schema.skipped_types?.[0] === "Breadcrumb", "unsupported types reported");

// ── live checks ──
async function live() {
  for (const url of ["https://www.nytimes.com", "https://stripe.com", "https://newtation.ai"]) {
    const r = JSON.parse(await checkAiCrawlerAccess({ url }));
    assert(!r.error, `crawler access runs for ${url}`);
    const blocked = r.ai_crawlers.filter((c: any) => !c.allowed).map((c: any) => c.bot);
    console.log(`   ${r.ai_crawler_access_score} | robots ${r.robots_txt.state} | blocked: ${blocked.join(", ") || "none"} | firewall: ${r.firewall_check.results.map((f: any) => `${f.bot}=${f.http_status}${f.blocked ? "(BLOCKED)" : ""}`).join(" ")} | issues: ${r.issues.length}`);
  }
  const sim = JSON.parse(await simulateLlmCrawler({ url: "https://newtation.ai" }));
  assert(sim.javascript_dependency?.risk, "simulate_llm_crawler reports JS dependency");
  console.log(`   newtation.ai JS risk: ${sim.javascript_dependency.risk} — ${sim.javascript_dependency.signals.join("; ")}`);
  const bad = JSON.parse(await checkAiCrawlerAccess({ url: "not a url" }));
  assert(typeof bad.error === "string", `bad URL returns actionable error: ${bad.error}`);
}
live().catch((e) => { console.error(e); throw e; });
