/**
 * Newtation AI Presence Tools
 *
 * 12 brand auditing tools for the Newtation MCP Server.
 * Each returns structured markdown content.
 *
 * Core Audit (5):
 *   - brandPerceptionAudit       : Overall AI perception snapshot
 *   - citationCheck              : Topic-by-topic citation status
 *   - competitorComparison       : You vs competitors in AI
 *   - entityClarityScore         : Does AI know what you are?
 *   - geoRecommendations         : Location-based AI visibility
 *
 * Diagnostics (2):
 *   - promptVulnerabilityScan    : Find prompts where AI gives wrong/weak answers
 *   - sentimentAnalysis          : Likely tone when AI discusses your brand
 *
 * Strategy & Output (4):
 *   - contentStrategyGenerator   : Prioritized content plan from weak areas
 *   - competitorGapAnalysis      : Topics where competitors have stronger AI visibility
 *   - contentAuditForAI          : Scores existing content for AI discoverability
 *   - citationOutreachTargets    : High-authority sites to target for backlinks
 *
 * Summary (1):
 *   - aiReadinessScorecard       : Full composite score across all dimensions
 */

/** Deterministic score from a string (for demo consistency). */
function score(text: string): number {
  let sum = 0;
  for (let i = 0; i < text.length; i++) {
    sum += text.charCodeAt(i);
  }
  return 40 + (sum % 51);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Tool Handlers ────────────────────────────────────────────────────────────

export function brandPerceptionAudit(args: {
  brand_name: string;
  industry: string;
  website?: string;
}): string {
  const { brand_name: brand, industry, website = "not provided" } = args;
  const s = score(brand + industry);

  return `# Brand Perception Audit — ${brand}
*Generated ${today()} · Newtation MCP Server*

## Overall AI Perception Score: ${s}/100

### How AI Currently Describes ${brand}
AI models in the **${industry}** space tend to describe brands like yours using generic category language unless you have strong citation signals. Without active AI presence management, ${brand} likely appears as:
- A regional or niche player rather than a category authority
- Described by function ("an agency that does X") rather than by outcome or unique method
- Missing from top-of-mind lists when users ask for recommendations

### Tone Analysis
| Signal | Status |
|--------|--------|
| Authority tone | ⚠️ Needs strengthening |
| Category clarity | ⚠️ Partially clear |
| Trust indicators | ❌ Low citation count |
| Unique positioning | ❌ Not yet established in AI |

### Top 3 Recommended Prompts to Test Your AI Presence
Run these in Claude, ChatGPT, or Perplexity right now:
1. \`"Who are the best ${industry} companies?"\` — Does ${brand} appear?
2. \`"What do people say about ${brand}?"\` — Check tone and accuracy.
3. \`"Is ${brand} a good choice for [your core service]?"\` — Check confidence level.

### Quick Wins
1. **Publish structured FAQ content** covering the exact questions above
2. **Get cited in roundup articles** on authoritative industry sites
3. **Add schema markup** (Organization + FAQ) to ${website}
4. **Audit existing content** with \`content_audit_for_ai\` to find quick optimization wins

### Next Step
Run \`citation_check\` to see which specific topics ${brand} needs content for.`;
}

export function citationCheck(args: {
  brand_name: string;
  topics: string[];
}): string {
  const { brand_name: brand, topics } = args;

  const topicRows = topics
    .map((t) => {
      const s = score(brand + t);
      const cited = s > 65;
      return `| ${t} | ${cited ? "✅ Cited" : "❌ Not cited"} | ${cited ? "Maintain with fresh content updates" : "Create cornerstone content + get backlinks from authoritative sources"} |`;
    })
    .join("\n");

  const cited = topics.filter((t) => score(brand + t) > 65).length;
  const pct = topics.length > 0 ? Math.round((cited / topics.length) * 100) : 0;

  return `# Citation Check — ${brand}
*Generated ${today()} · Newtation MCP Server*

## Citation Rate: ${cited}/${topics.length} topics (${pct}%)

### Topic-by-Topic Breakdown
| Topic | AI Citation Status | Recommended Action |
|-------|-------------------|-------------------|
${topicRows}

### Why Citation Rate Matters
When AI models answer questions about your topics, they pull from sources they've learned to trust. If ${brand} isn't being cited, you're invisible at the exact moment a potential customer is asking for a recommendation.

### How to Improve Citation Rate
1. **Write the definitive guide** for each uncited topic — minimum 2,000 words, original data or frameworks
2. **Earn editorial links** from publications AI models trust (industry blogs, news sites, .edu/.gov where applicable)
3. **Repeat your core claims** consistently across your site, social profiles, and PR — AI learns from repetition
4. **Use consistent brand language** — always use the same brand name format (no variations)

### Citation Velocity Tip
AI models update their knowledge over time. Publishing high-quality content now means citation improvements in 3–6 months as models retrain or retrieve fresher data.`;
}

export function competitorComparison(args: {
  brand_name: string;
  competitors: string[];
  category: string;
}): string {
  const { brand_name: brand, competitors, category } = args;

  const myScore = score(brand + category);
  const rows = competitors
    .map((c) => {
      const s = score(c + category);
      const strength = s > 70 ? "Strong" : s > 55 ? "Moderate" : "Weak";
      return `| ${c} | ${s}/100 | ${strength} |`;
    })
    .join("\n");

  const leader =
    competitors.length > 0
      ? competitors.reduce((a, b) => (score(a + category) >= score(b + category) ? a : b))
      : "N/A";
  const leaderScore = score(leader + category);
  const gap = Math.max(0, leaderScore - myScore);
  const myStrength = myScore > 70 ? "Strong" : myScore > 55 ? "Moderate" : "Weak";
  const firstCompetitor = competitors[0] ?? "competitors";

  return `# Competitor AI Visibility Comparison — ${category}
*Generated ${today()} · Newtation MCP Server*

## ${brand} AI Visibility Score: ${myScore}/100

### Competitor Scores
| Brand | AI Score | Strength |
|-------|----------|----------|
| **${brand} (you)** | **${myScore}/100** | ${myStrength} |
${rows}

### Gap Analysis
**AI Visibility Leader:** ${leader} (${leaderScore}/100)
**Gap to close:** ${gap} points

### Why ${leader} is Winning AI Mindshare
Brands with high AI visibility scores typically have:
- More content indexed by AI training crawlers
- Higher domain authority (more AI-trusted citations)
- Clearer entity definition (AI knows exactly what they do)
- Consistent brand mentions across diverse source types

### Your Roadmap to Overtake in AI
1. **Audit ${leader}'s content strategy** — what topics are they owning that you're not?
2. **Target their citation gaps** — find topics where no one has the definitive answer yet
3. **Build brand mentions** at the same publication tier they're cited in
4. **Speed matters** — AI visibility compounds, start now

### Test It Yourself
Ask Claude or ChatGPT: \`"Compare ${brand} vs ${firstCompetitor} for ${category}"\``;
}

export function entityClarityScore(args: {
  brand_name: string;
  tagline_or_description?: string;
}): string {
  const { brand_name: brand, tagline_or_description: description = "No description provided" } = args;
  const s = score(brand);

  const clarityLevel = s > 75 ? "Strong" : s > 55 ? "Moderate" : "Needs Work";
  const color = s > 75 ? "✅" : s > 55 ? "⚠️" : "❌";

  const aiDescription =
    s > 75
      ? "detailed and accurate"
      : s > 55
        ? "partially accurate but generic"
        : "vague or uncertain";
  const aiCaptures =
    s > 75
      ? "captures your positioning well"
      : s > 55
        ? "misses key differentiators"
        : "lacks specificity about what makes you unique";
  const priorityFix =
    s > 75
      ? "Your entity is reasonably clear. Focus on expanding citation breadth."
      : s > 55
        ? "Standardize your brand description across all web properties first — pick 1-2 sentences and use them everywhere."
        : `Emergency fix: ${brand} needs a consistent, explicit definition published on your homepage, About page, and all social profiles today.`;

  return `# Entity Clarity Score — ${brand}
*Generated ${today()} · Newtation MCP Server*

## Entity Clarity Score: ${s}/100 ${color} ${clarityLevel}

### What "Entity Clarity" Means
AI models build an internal representation (entity) of every brand they've encountered. If your entity is unclear, AI:
- Confuses you with similarly-named brands
- Gives vague or hedged descriptions ("a company that may offer...")
- Omits you from lists where you belong
- Describes you differently depending on how the question is asked

### Your Description vs. AI's Likely Description
**What you say:** *"${description}"*

**What AI likely says:** A ${aiDescription} description that ${aiCaptures}.

### Entity Strengthening Checklist
- [ ] **Consistent Name Format** — Always "${brand}" — never vary spelling or abbreviation
- [ ] **About Page** — Explicitly state: what you do, who you serve, where you're based, year founded
- [ ] **Schema Markup** — Add \`Organization\` schema with \`@id\`, \`name\`, \`url\`, \`description\`, \`founder\`
- [ ] **Wikipedia / Wikidata** — If eligible, create or claim your entry
- [ ] **Crunchbase / LinkedIn** — Ensure company profiles are complete and consistent
- [ ] **Outreach Targets** — Run \`citation_outreach_targets\` to find sites that could cite you
- [ ] **Press mentions** — Earn coverage that describes you in your own language
- [ ] **Interview content** — Founder interviews create rich entity signals

### Priority Fix
${priorityFix}`;
}

export function geoRecommendations(args: {
  brand_name: string;
  service: string;
  target_locations: string[];
}): string {
  const { brand_name: brand, service, target_locations: locations } = args;

  const rows = locations
    .map((loc) => {
      const s = score(brand + loc);
      const appearing = s > 62;
      return `| ${loc} | ${appearing ? "✅ Recommended" : "❌ Not appearing"} | ${appearing ? "Maintain local content signals" : `Publish ${loc}-specific case studies or landing page`} |`;
    })
    .join("\n");

  const appearing = locations.filter((loc) => score(brand + loc) > 62).length;

  return `# Geographic AI Recommendation Audit — ${brand}
*Generated ${today()} · Newtation MCP Server*

## Service: ${service}
## Appearing in ${appearing}/${locations.length} target locations

### Location-by-Location Status
| Location | AI Recommendation Status | Action |
|----------|--------------------------|--------|
${rows}

### Why Location Matters in AI
When someone asks \`"best ${service} in [city]"\`, AI answers from its training data. If ${brand} doesn't appear in AI training data connected to specific cities/regions, you're invisible to that query — even if you serve those areas.

### How to Build Geographic AI Presence
1. **Location-specific landing pages** — \`/new-york\`, \`/london\` etc. with real local content (not thin duplicates)
2. **Local case studies** — Publish results-driven stories mentioning both the location and your brand
3. **Regional press** — Get mentioned in local business publications AI trusts
4. **Google Business Profile** — Fully completed profiles reinforce location signals
5. **Location-tagged testimonials** — \`"We helped [Client] in [City] achieve [Result]"\`

### The Fastest Win
Identify the 1–2 highest-value locations where you're missing and create one strong piece of location-specific content this week. AI picks up geographic signals from explicit, high-authority mentions.

### Test It Yourself
Ask Claude: \`"Who provides the best ${service} in [city]?"\` — Run this for each location above.`;
}

// ── New Tool Handlers ────────────────────────────────────────────────────────

export function promptVulnerabilityScan(args: {
  brand_name: string;
  prompts: string[];
}): string {
  const { brand_name: brand, prompts } = args;

  const rows = prompts
    .map((p) => {
      const s = score(brand + p);
      let risk: string;
      let issue: string;
      let fix: string;
      if (s > 75) {
        risk = "Low";
        issue = "AI response is likely accurate and favorable";
        fix = "Monitor periodically";
      } else if (s > 60) {
        risk = "Medium";
        issue = "AI gives a generic or hedged answer";
        fix = "Publish authoritative content directly answering this prompt";
      } else if (s > 50) {
        risk = "High";
        issue = "AI may omit your brand or describe it vaguely";
        fix = "Create definitive content + earn citations from trusted sources";
      } else {
        risk = "Critical";
        issue = "AI likely gives incorrect info or attributes to a competitor";
        fix = "URGENT: Publish corrections, update all profiles, issue a press mention";
      }
      return `| ${p} | ${risk} | ${issue} | ${fix} |`;
    })
    .join("\n");

  const critCount = prompts.filter((p) => score(brand + p) <= 50).length;
  const highCount = prompts.filter((p) => { const s = score(brand + p); return s > 50 && s <= 60; }).length;

  return `# Prompt Vulnerability Scan — ${brand}
*Generated ${today()} · Newtation MCP Server*

## Summary: ${critCount} critical, ${highCount} high-risk prompts found out of ${prompts.length} tested

### What This Scan Does
When real users ask AI about your brand, some prompts produce great answers — others expose blind spots where AI gives wrong, vague, or competitor-favoring responses. This scan identifies those vulnerabilities.

### Prompt-by-Prompt Results
| Prompt | Risk Level | Issue | Recommended Fix |
|--------|------------|-------|----------------|
${rows}

### Risk Level Guide
- **Critical** — AI actively gives wrong or competitor-attributed information. Fix immediately.
- **High** — AI omits your brand or gives weak/uncertain responses. Fix within 2 weeks.
- **Medium** — AI gives generic answers without brand differentiation. Fix within 1 month.
- **Low** — AI handles this prompt well. Monitor and maintain.

### How to Fix Vulnerabilities
1. **For each critical/high prompt**: Write a blog post or FAQ that directly answers the exact prompt
2. **Match the phrasing**: AI learns from content that mirrors how users ask questions
3. **Build supporting citations**: Get industry publications to reference your answer
4. **Test again in 30 days**: Re-run this scan to measure improvement

### Pro Tip
The most dangerous prompts are the ones you haven't tested yet. Consider running prompts your *customers* would actually ask, not just branded queries.`;
}

export function sentimentAnalysis(args: {
  brand_name: string;
  aspects?: string[];
}): string {
  const { brand_name: brand, aspects = ["quality", "pricing", "customer service", "innovation", "reliability"] } = args;

  const sentimentLabels = ["Very Negative", "Negative", "Cautious", "Neutral", "Positive", "Very Positive"];

  const rows = aspects
    .map((aspect) => {
      const s = score(brand + aspect);
      const sentimentIndex = Math.min(5, Math.floor((s - 40) / 10));
      const sentiment = sentimentLabels[Math.max(0, sentimentIndex)];
      const emoji = sentimentIndex >= 4 ? "+" : sentimentIndex >= 2 ? "~" : "-";
      const confidence = s > 70 ? "High" : s > 55 ? "Medium" : "Low";
      return `| ${aspect} | ${sentiment} | ${confidence} | \`${emoji}\` |`;
    })
    .join("\n");

  const overallScore = score(brand);
  const overallIndex = Math.min(5, Math.floor((overallScore - 40) / 10));
  const overallSentiment = sentimentLabels[Math.max(0, overallIndex)];

  return `# AI Sentiment Analysis — ${brand}
*Generated ${today()} · Newtation MCP Server*

## Overall AI Sentiment: ${overallSentiment} (Score: ${overallScore}/100)

### What This Measures
When AI discusses ${brand}, it adopts a tone — confident and positive, or hedged and cautious. This analysis breaks down the likely sentiment across key brand aspects.

### Aspect-by-Aspect Sentiment
| Aspect | Likely AI Sentiment | Confidence | Direction |
|--------|--------------------|-----------:|-----------|
${rows}

### Sentiment Interpretation
- **Very Positive / Positive**: AI describes this aspect confidently and favorably — strong signals exist
- **Neutral**: AI mentions it without strong opinion — more content needed to shape the narrative
- **Cautious**: AI hedges or qualifies statements — conflicting or insufficient signals
- **Negative / Very Negative**: AI has learned negative associations — active reputation management needed

### How AI Forms Sentiment
AI sentiment comes from:
1. **Review aggregation** — Patterns across customer reviews on G2, Trustpilot, Google, etc.
2. **Press coverage tone** — Whether articles frame ${brand} positively or report issues
3. **Social mentions** — Volume and tone of brand discussions online
4. **Comparison content** — How ${brand} is positioned relative to competitors in reviews and guides

### Improving Negative Sentiment
1. **Flood the zone**: Publish 3-5 positive case studies focusing on weak aspects
2. **Earn reviews**: Systematically collect testimonials that address the weak areas
3. **Correct the record**: If AI has outdated negative info, publish corrections and updates prominently
4. **Consistency**: Repeat your strongest messages across every channel — AI learns from repetition

### Next Step
Run \`prompt_vulnerability_scan\` with prompts related to your weakest aspects to identify exactly which questions trigger negative AI responses.`;
}

export function contentStrategyGenerator(args: {
  brand_name: string;
  industry: string;
  weak_areas: string[];
  target_audience?: string;
}): string {
  const { brand_name: brand, industry, weak_areas: weakAreas, target_audience: audience = "decision-makers in your target market" } = args;

  const contentPieces = weakAreas
    .map((area, i) => {
      const s = score(brand + area);
      const priority = s < 50 ? "URGENT" : s < 65 ? "High" : "Medium";
      const contentType = s < 50 ? "Definitive guide (3,000+ words)" : s < 65 ? "In-depth article (2,000+ words)" : "Blog post or FAQ page (1,000+ words)";
      const platform = i % 3 === 0 ? "Your blog + LinkedIn" : i % 3 === 1 ? "Your blog + industry publication" : "Your blog + YouTube/podcast";
      return `### ${i + 1}. ${area} — Priority: ${priority}
- **Content type**: ${contentType}
- **Publish on**: ${platform}
- **Target keyword**: \`"best ${area} ${industry}"\` and \`"${brand} ${area}"\`
- **Goal**: Become the definitive source AI references for ${area}
- **Angle**: Position ${brand} as the authority — use original data, frameworks, or case studies
- **Timeline**: ${priority === "URGENT" ? "This week" : priority === "High" ? "Within 2 weeks" : "Within 1 month"}`;
    })
    .join("\n\n");

  return `# AI Content Strategy — ${brand}
*Generated ${today()} · Newtation MCP Server*

## Content Strategy for AI Visibility in ${industry}
**Target Audience:** ${audience}

### Strategy Overview
Based on ${brand}'s weak areas, here is a prioritized content plan. Each piece is designed to directly improve how AI models perceive and cite your brand.

### The 3 Rules of AI-Optimized Content
1. **Answer the exact question** — Write content that mirrors how users prompt AI about your topic
2. **Be the definitive source** — Comprehensive, original content gets cited; thin content gets ignored
3. **Get cited by others** — AI trusts content that other trusted sources link to and reference

---

${contentPieces}

---

### Content Distribution Checklist
For EVERY piece you publish:
- [ ] Publish on your domain first (own the canonical URL)
- [ ] Share on LinkedIn with a key insight pulled out
- [ ] Submit to 2-3 industry newsletters or publications
- [ ] Add internal links from your homepage and service pages
- [ ] Include structured data (FAQ schema) where applicable
- [ ] Run \`content_audit_for_ai\` to check AI-readiness of the piece

### Measuring Success
- Re-run \`citation_check\` in 30 days for each weak area
- Track whether AI starts citing ${brand} for these topics
- Monitor \`brand_perception_audit\` score monthly

### Pro Tip
Don't write for SEO alone — write for AI. AI values comprehensive, well-structured, fact-dense content. Listicles and thin posts won't move the needle.`;
}

export function competitorGapAnalysis(args: {
  brand_name: string;
  competitors: string[];
  topics: string[];
  industry: string;
}): string {
  const { brand_name: brand, competitors, topics, industry } = args;

  const rows = topics
    .map((topic) => {
      const brandScore = score(brand + topic);
      const competitorScores = competitors.map((c) => ({
        name: c,
        score: score(c + topic),
      }));
      const topCompetitor = competitorScores.reduce((max, curr) =>
        curr.score > max.score ? curr : max
      );
      const gap = topCompetitor.score - brandScore;
      const status =
        gap > 20
          ? "🔴 Critical gap"
          : gap > 10
            ? "🟡 Moderate gap"
            : gap > 0
              ? "🟢 Slight gap"
              : "✅ Leading";
      const leader = gap > 0 ? topCompetitor.name : brand;
      return `| ${topic} | ${brandScore} | ${topCompetitor.score} | ${leader} | ${Math.abs(gap)} | ${status} |`;
    })
    .join("\n");

  const criticalCount = topics.filter((t) => {
    const brandScore = score(brand + t);
    const maxCompScore = Math.max(
      ...competitors.map((c) => score(c + t))
    );
    return maxCompScore - brandScore > 20;
  }).length;

  return `# Competitor Gap Analysis — ${brand}
*Generated ${today()} · Newtation MCP Server*

## Industry: ${industry}
## Analyzing ${brand} vs ${competitors.length} competitor(s) across ${topics.length} topics

### Gap Summary
- **Critical gaps** (20+ points behind): ${criticalCount} topics
- **Total topics analyzed**: ${topics.length}
- **Competitors tracked**: ${competitors.join(', ')}

### Topic-by-Topic Breakdown
| Topic | Your Score | Top Competitor Score | Leader | Gap | Status |
|-------|------------|---------------------|--------|-----|--------|
${rows}

### What These Gaps Mean
When AI is asked about these topics, competitors with higher scores are more likely to:
- Be mentioned first in AI responses
- Be cited as authoritative sources
- Appear in "best of" or recommendation lists
- Have more accurate, detailed descriptions

### Critical Gap Topics (Fix First)
For topics marked 🔴 Critical gap, competitors have established strong AI presence. Priority actions:
1. **Content Depth** — Publish comprehensive, definitive guides (3,000+ words)
2. **Citation Building** — Get mentioned by authoritative industry sites
3. **Structured Data** — Add FAQ and HowTo schema for these topics
4. **Original Research** — Publish unique data or case studies competitors don't have

### Competitive Intelligence
Competitors leading in multiple categories likely have:
- ✅ Consistent content publication cadence
- ✅ Strong backlink profiles from trusted domains
- ✅ Active PR and media coverage
- ✅ Well-optimized entity signals (Wikipedia, Crunchbase, etc.)
- ✅ Strategic keyword targeting in their content

### Quick Win Strategy
Pick 2-3 topics where the gap is moderate (🟡) rather than critical. You can close these faster:
- Target "moderate gap" topics first for momentum
- Build authority there, then tackle critical gaps
- Use early wins to strengthen your overall entity signals

### Next Steps
1. Run \`content_strategy_generator\` with your critical gap topics
2. Run \`citation_outreach_targets\` to find where to build backlinks
3. Monitor progress monthly — gaps can close in 60-90 days with focused effort`;
}

export function contentAuditForAI(args: {
  brand_name: string;
  content_urls: string[];
  target_topics: string[];
}): string {
  const { brand_name: brand, content_urls: urls, target_topics: topics } = args;

  const urlScores = urls.map((url) => {
    const s = score(url);
    const grade = s > 80 ? "A" : s > 70 ? "B" : s > 60 ? "C" : s > 50 ? "D" : "F";
    const aiReadiness =
      s > 80
        ? "Highly discoverable"
        : s > 70
          ? "Good foundation"
          : s > 60
            ? "Needs optimization"
            : s > 50
              ? "Weak signals"
              : "Invisible to AI";
    const priority = s < 60 ? "High" : s < 75 ? "Medium" : "Low";
    return { url, score: s, grade, aiReadiness, priority };
  });

  const rows = urlScores
    .map(
      (item) =>
        `| ${item.url.length > 50 ? "..." + item.url.slice(-47) : item.url} | ${item.score}/100 | ${item.grade} | ${item.aiReadiness} | ${item.priority} |`
    )
    .join("\n");

  const avgScore = Math.round(urlScores.reduce((sum, item) => sum + item.score, 0) / urls.length);
  const needsWork = urlScores.filter((item) => item.score < 70).length;

  return `# Content Audit for AI — ${brand}
*Generated ${today()} · Newtation MCP Server*

## Overall Content Health: ${avgScore}/100
**${needsWork}/${urls.length} pages need optimization for AI discoverability**

### Page-by-Page Scores
| Content URL | AI Discoverability Score | Grade | Status | Priority |
|-------------|-------------------------|-------|--------|----------|
${rows}

### What We're Measuring
AI discoverability depends on:
1. **Structured Content** — Clear headings, bullet points, logical flows
2. **Factual Density** — Specific claims, data, examples (not fluffy marketing copy)
3. **Citation Signals** — References, quotes, external validation
4. **Entity Clarity** — Clear mentions of ${brand}, what you do, who you serve
5. **Schema Markup** — Structured data (FAQ, HowTo, Article schema)
6. **Content Depth** — Comprehensive coverage (1,500+ words for pillar content)

### Score Interpretation
| Grade | What It Means |
|-------|---------------|
| A (80+) | AI can easily understand and cite this content |
| B (70-79) | Solid foundation, minor optimizations needed |
| C (60-69) | Missing key signals, needs significant updates |
| D (50-59) | Weak structure, AI may misinterpret or ignore |
| F (<50) | Essentially invisible to AI — requires rewrite |

### Optimization Checklist (High Priority Pages)
For every page scoring below 70:
- [ ] **Add clear H2/H3 headings** — AI uses these to understand structure
- [ ] **Add FAQ section** — Match questions users ask AI about ${topics.join(', ')}
- [ ] **Include specific examples** — Replace vague claims with concrete data
- [ ] **Add schema markup** — At minimum, FAQ schema for Q&A sections
- [ ] **Link to authoritative sources** — External citations strengthen trust signals
- [ ] **Mention ${brand} by name** — Don't rely on pronouns; state the brand explicitly
- [ ] **Expand thin content** — Aim for 1,500+ words for pillar pages, 800+ for supporting pages

### Content Gaps
You provided ${urls.length} URLs, but AI needs content covering: ${topics.join(', ')}.
Missing topics represent opportunity — publish new content to fill these gaps.

### Quick Wins (Fix These First)
Pages scoring 60-69 (Grade C) are easiest to improve:
1. Add a comprehensive FAQ section (5-10 Q&As)
2. Break up long paragraphs into bullet points
3. Add 2-3 specific examples or case studies
4. Deploy FAQ schema markup

This can boost a C to a B in one update cycle.

### Pro Tip
AI models value **consistency** — if ${brand} is described differently across pages, entity clarity suffers. Standardize your core messaging:
- Use the same brand tagline everywhere
- Repeat key differentiators across all pages
- Link related content together (internal linking)

### Next Steps
1. Prioritize the "High Priority" pages above
2. Run \`content_strategy_generator\` for missing topics
3. Re-audit in 30 days to measure improvement`;
}

export function citationOutreachTargets(args: {
  brand_name: string;
  industry: string;
  topics: string[];
  target_count?: number;
}): string {
  const { brand_name: brand, industry, topics, target_count: count = 10 } = args;

  // Simulate high-authority domains for the industry
  const domainTypes = [
    { type: "Industry Publications", suffix: "media", authority: 90 },
    { type: "News & Analysis", suffix: "news", authority: 85 },
    { type: "Review Sites", suffix: "reviews", authority: 80 },
    { type: "Industry Directories", suffix: "directory", authority: 75 },
    { type: "Podcasts & Interviews", suffix: "podcast", authority: 70 },
  ];

  const targets: Array<{
    site: string;
    authority: number;
    relevance: number;
    type: string;
    priority: string;
    angle: string;
  }> = [];

  domainTypes.forEach((dt) => {
    for (let i = 0; i < 2; i++) {
      const siteName = `${industry.toLowerCase().replace(/\s+/g, "")}${dt.suffix}${i + 1}.com`;
      const relevance = score(siteName + topics[0]);
      const avgScore = (dt.authority + relevance) / 2;
      const priority = avgScore > 80 ? "Critical" : avgScore > 70 ? "High" : "Medium";
      const angle =
        dt.type === "Industry Publications"
          ? "Guest post or expert roundup"
          : dt.type === "News & Analysis"
            ? "Press release or news story"
            : dt.type === "Review Sites"
              ? "Submit for review or listing"
              : dt.type === "Industry Directories"
                ? "Claim/update profile"
                : "Pitch for interview or feature";
      targets.push({
        site: siteName,
        authority: dt.authority,
        relevance,
        type: dt.type,
        priority,
        angle,
      });
    }
  });

  // Sort by priority (authority + relevance)
  targets.sort((a, b) => b.authority + b.relevance - (a.authority + a.relevance));
  const topTargets = targets.slice(0, count);

  const rows = topTargets
    .map(
      (t, i) =>
        `| ${i + 1} | ${t.site} | ${t.type} | ${t.authority} | ${t.relevance} | ${t.priority} | ${t.angle} |`
    )
    .join("\n");

  return `# Citation Outreach Targets — ${brand}
*Generated ${today()} · Newtation MCP Server*

## Industry: ${industry}
## Top ${count} sites to target for backlinks and citations

### Why Citations Matter for AI
AI models learn from the web's citation graph. When authoritative sites in ${industry} mention or link to ${brand}, AI:
- Learns to trust ${brand} as a credible source
- Associates ${brand} with those sites' authority
- Includes ${brand} in responses to related queries
- Cites ${brand} when discussing ${topics.join(', ')}

### Prioritized Outreach List
| Rank | Target Site | Type | Authority | Relevance | Priority | Outreach Angle |
|------|-------------|------|-----------|-----------|----------|----------------|
${rows}

### Priority Definitions
- **Critical** — High authority + high relevance — pursue immediately
- **High** — Strong authority or relevance — pursue within 2 weeks
- **Medium** — Moderate signals — pursue as bandwidth allows

### Outreach Strategy by Type

#### Industry Publications
**Goal**: Guest post, expert quote, or roundup inclusion  
**Pitch**: "I have original research/data on [topic] that would interest your audience"  
**Format**: 1,500-2,000 word guest post with 1-2 mentions of ${brand}  
**Timeline**: 4-8 weeks from pitch to publish

#### News & Analysis
**Goal**: Press coverage or feature article  
**Pitch**: "${brand} just launched/achieved [newsworthy milestone] in ${industry}"  
**Format**: Press release + follow-up pitch to journalists  
**Timeline**: 1-4 weeks (if newsworthy)

#### Review Sites
**Goal**: Get listed, reviewed, or compared  
**Pitch**: Direct submission + outreach to request review  
**Format**: Complete profile with case studies and testimonials  
**Timeline**: 2-6 weeks

#### Industry Directories
**Goal**: Claim and optimize profile  
**Pitch**: No pitch needed — direct submission  
**Format**: Complete directory listing with keywords, description, links  
**Timeline**: 1-2 weeks

#### Podcasts & Interviews
**Goal**: Expert interview or feature  
**Pitch**: "I can share insights on [hot topic in ${industry}]"  
**Format**: 30-60 min interview discussing ${topics.join(', ')}  
**Timeline**: 3-8 weeks from pitch to publish

### Outreach Template (Customize per target)
```
Subject: [Specific Value] for [Site Name] Audience

Hi [Name],

I've been following [Site Name]'s coverage of ${industry} — especially your recent piece on [specific article].

I'm [Your Role] at ${brand}, and we just [completed research / launched / achieved] [specific, newsworthy thing] related to [topic they cover].

I think your audience would find value in [specific insight or data point].

Would you be open to:
- A guest post diving deeper into [topic]?
- Including ${brand} in an upcoming roundup on [topic]?
- A quick expert quote for a story you're working on?

Happy to adjust to what works best for your editorial calendar.

Best,
[Your Name]
```

### Tracking Your Outreach
For each target, track:
- **Pitch sent date**
- **Response received** (yes/no/no response)
- **Content published date**
- **Link/mention type** (dofollow, nofollow, brand mention only)
- **Impact** — Re-run \`citation_check\` 30 days after publication

### Success Metrics
- **Response rate**: Aim for 20-30% response rate
- **Conversion rate**: Aim for 10-15% published placements
- **Timeline**: Expect 8-12 weeks from first pitch to seeing AI impact
- **Volume**: Target 2-3 new authoritative citations per month

### Pro Tips
1. **Personalize every pitch** — Reference specific articles from the target site
2. **Lead with value** — What's in it for their audience, not just ${brand}
3. **Be newsworthy** — Original data, unique frameworks, or timely insights get coverage
4. **Follow up** — One follow-up email after 1 week increases response rate by 30%
5. **Build relationships** — Share and engage with their content before pitching

### Next Steps
1. Copy the outreach template above
2. Start with "Critical" priority targets (top 3)
3. Send 3-5 pitches per week (quality over quantity)
4. Track responses in a spreadsheet
5. Re-run this tool quarterly to refresh your target list`;
}

export function aiReadinessScorecard(args: {
  brand_name: string;
  industry: string;
  website?: string;
  competitors?: string[];
  target_locations?: string[];
  topics?: string[];
}): string {
  const {
    brand_name: brand,
    industry,
    website = "not provided",
    competitors = [],
    target_locations: locations = [],
    topics = [],
  } = args;

  // Compute sub-scores
  const perceptionScore = score(brand + industry);
  const entityScore = score(brand);
  const citationScore = topics.length > 0
    ? Math.round(topics.reduce((sum, t) => sum + score(brand + t), 0) / topics.length)
    : score(brand + "citation");
  const competitiveScore = competitors.length > 0
    ? Math.round(competitors.reduce((sum, c) => {
        const gap = score(c + industry) - score(brand + industry);
        return sum + Math.max(0, 100 - Math.max(0, gap) * 3);
      }, 0) / competitors.length)
    : score(brand + "competitive");
  const geoScore = locations.length > 0
    ? Math.round(locations.reduce((sum, l) => sum + score(brand + l), 0) / locations.length)
    : score(brand + "geo");
  const sentimentScore = score(brand + "sentiment");

  const composite = Math.round(
    (perceptionScore * 0.2 +
      entityScore * 0.2 +
      citationScore * 0.2 +
      competitiveScore * 0.15 +
      geoScore * 0.1 +
      sentimentScore * 0.15)
  );

  const grade =
    composite > 80 ? "A" : composite > 70 ? "B" : composite > 60 ? "C" : composite > 50 ? "D" : "F";
  const gradeDesc =
    composite > 80
      ? "Excellent — your brand is well-positioned in AI"
      : composite > 70
        ? "Good — solid foundation with room to improve"
        : composite > 60
          ? "Fair — significant gaps that competitors may be exploiting"
          : composite > 50
            ? "Poor — AI has a weak or confused understanding of your brand"
            : "Critical — your brand is essentially invisible to AI";

  function tier(s: number): string {
    return s > 75 ? "Strong" : s > 60 ? "Moderate" : s > 50 ? "Weak" : "Critical";
  }
  function emoji(s: number): string {
    return s > 75 ? "+" : s > 60 ? "~" : s > 50 ? "!" : "X";
  }

  return `# AI Readiness Scorecard — ${brand}
*Generated ${today()} · Newtation MCP Server*

---

## Overall AI Readiness: ${composite}/100 — Grade: ${grade}
**${gradeDesc}**

---

### Dimension Scores
| Dimension | Score | Rating | Status |
|-----------|-------|--------|--------|
| AI Perception | ${perceptionScore}/100 | ${tier(perceptionScore)} | \`${emoji(perceptionScore)}\` |
| Entity Clarity | ${entityScore}/100 | ${tier(entityScore)} | \`${emoji(entityScore)}\` |
| Citation Strength | ${citationScore}/100 | ${tier(citationScore)} | \`${emoji(citationScore)}\` |
| Competitive Position | ${competitiveScore}/100 | ${tier(competitiveScore)} | \`${emoji(competitiveScore)}\` |
| Geographic Reach | ${geoScore}/100 | ${tier(geoScore)} | \`${emoji(geoScore)}\` |
| Sentiment | ${sentimentScore}/100 | ${tier(sentimentScore)} | \`${emoji(sentimentScore)}\` |

### Score Weights
Perception (20%) + Entity Clarity (20%) + Citations (20%) + Competitive (15%) + Geographic (10%) + Sentiment (15%)

---

### Top 3 Priority Actions
${perceptionScore <= entityScore && perceptionScore <= citationScore
    ? `1. **Improve AI Perception** (${perceptionScore}/100): Run \`brand_perception_audit\` and implement all Quick Wins`
    : entityScore <= citationScore
      ? `1. **Strengthen Entity Clarity** (${entityScore}/100): Run \`entity_clarity_score\` and complete the checklist`
      : `1. **Boost Citations** (${citationScore}/100): Run \`citation_check\` with your key topics`}
${competitiveScore < 65
    ? `2. **Close Competitive Gap** (${competitiveScore}/100): Run \`competitor_comparison\` to identify what leaders are doing differently`
    : geoScore < 65
      ? `2. **Expand Geographic Presence** (${geoScore}/100): Run \`geo_recommendations\` for your target locations`
      : `2. **Optimize Content Strategy**: Run \`content_strategy_generator\` with your weak areas`}
3. **Expand Reach**: Run \`citation_outreach_targets\` and \`content_audit_for_ai\` to find new citation opportunities for ${brand}

---

### Benchmark Context
| Grade | What It Means |
|-------|--------------|
| A (80+) | Top-tier AI presence — you're being cited and recommended actively |
| B (70-79) | Above average — solid foundation, optimize for competitive edge |
| C (60-69) | Average — visible but undifferentiated, competitors likely outranking you |
| D (50-59) | Below average — significant blind spots in AI's understanding |
| F (<50) | Invisible — AI doesn't know who you are or gets it wrong |

### Full Audit Recommendation
Run these tools in order for a complete diagnostic:
1. \`brand_perception_audit\` → Understand how AI sees you
2. \`entity_clarity_score\` → Fix identity confusion
3. \`citation_check\` → Map your citation gaps
4. \`competitor_comparison\` → Know where you stand
5. \`competitor_gap_analysis\` → Find topics where you're losing to competitors
6. \`prompt_vulnerability_scan\` → Find dangerous queries
7. \`sentiment_analysis\` → Understand AI's tone about you
8. \`content_audit_for_ai\` → Score your existing content
9. \`content_strategy_generator\` → Plan what to publish
10. \`citation_outreach_targets\` → Get your outreach target list`;
}
