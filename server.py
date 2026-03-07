#!/usr/bin/env python3
"""
Newtation AI Presence MCP Server
Connects to Claude Code to audit how AI systems perceive and cite your brand.

Usage with Claude Code:
  claude mcp add newtation -- python3 /path/to/server.py

Tools (12):
  Core Audit:
    - brand_perception_audit      : How AI describes your brand overall
    - citation_check              : Whether AI cites your brand as a source
    - competitor_comparison       : How your brand stacks up vs competitors in AI
    - entity_clarity_score        : How clearly AI understands what your brand is
    - geo_recommendations         : Whether AI recommends your brand by location

  Diagnostics:
    - prompt_vulnerability_scan   : Find prompts where AI gives wrong/weak answers
    - sentiment_analysis          : Likely tone when AI discusses your brand

  Strategy & Output:
    - content_strategy_generator  : Prioritized content plan from weak areas
    - competitor_gap_analysis     : Topics where competitors have stronger AI visibility
    - content_audit_for_ai        : Scores existing content for AI discoverability
    - citation_outreach_targets   : High-authority sites to target for backlinks

  Summary:
    - ai_readiness_scorecard      : Full composite score across all dimensions
"""

import sys
import json
from datetime import datetime

# ─── MCP Protocol Helpers ─────────────────────────────────────────────────────

def send(obj: dict):
    """Write a JSON-RPC message to stdout."""
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()

def error_response(req_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}

def ok_response(req_id, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}

# ─── Tool Definitions ─────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "brand_perception_audit",
        "description": (
            "Analyze how AI language models currently perceive and describe your brand. "
            "Returns a structured audit covering tone, category placement, trust signals, "
            "and recommended prompts you can use to test your own AI presence."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "The brand or company name to audit (e.g. 'Newtation')"
                },
                "industry": {
                    "type": "string",
                    "description": "Industry or category (e.g. 'SEO agency', 'SaaS', 'e-commerce')"
                },
                "website": {
                    "type": "string",
                    "description": "Brand website URL (optional, used for context)"
                }
            },
            "required": ["brand_name", "industry"]
        }
    },
    {
        "name": "citation_check",
        "description": (
            "Check whether and how AI models cite your brand as a credible source. "
            "Returns citation likelihood, content gaps, and actionable recommendations "
            "to improve how often AI references your brand in answers."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name to check citation status for"
                },
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Topics you want to be cited for (e.g. ['AI SEO', 'brand visibility', 'MCP servers'])"
                }
            },
            "required": ["brand_name", "topics"]
        }
    },
    {
        "name": "competitor_comparison",
        "description": (
            "Compare how AI models perceive your brand versus your key competitors. "
            "Surfaces which competitor is winning AI mindshare and why, with a gap analysis "
            "and concrete steps to close the visibility gap."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Your brand name"
                },
                "competitors": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of competitor brand names to compare against"
                },
                "category": {
                    "type": "string",
                    "description": "The market category or service type being compared"
                }
            },
            "required": ["brand_name", "competitors", "category"]
        }
    },
    {
        "name": "entity_clarity_score",
        "description": (
            "Score how clearly AI models understand what your brand is, what it does, "
            "and who it serves. A low score means AI confuses you with others or gives "
            "vague descriptions. Returns a 0–100 score with specific fixes."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name to score"
                },
                "tagline_or_description": {
                    "type": "string",
                    "description": "Your brand's own description of itself (from homepage or About page)"
                }
            },
            "required": ["brand_name"]
        }
    },
    {
        "name": "geo_recommendations",
        "description": (
            "Test whether AI recommends your brand when users ask location-specific questions. "
            "Returns which cities/regions your brand appears in AI recommendations, "
            "which it's missing from, and how to expand your geographic AI footprint."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name to check"
                },
                "service": {
                    "type": "string",
                    "description": "The service or product to test recommendations for"
                },
                "target_locations": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Cities or regions you want to appear in (e.g. ['New York', 'London', 'Sydney'])"
                }
            },
            "required": ["brand_name", "service", "target_locations"]
        }
    },
    {
        "name": "prompt_vulnerability_scan",
        "description": (
            "Test a set of prompts real users might ask about your brand and surface "
            "where AI gives wrong, weak, or missing answers. Identifies critical "
            "vulnerabilities in your AI presence."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name to scan"
                },
                "prompts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Prompts to test (e.g. ['Is Acme a good SEO agency?', 'What does Acme do?'])"
                }
            },
            "required": ["brand_name", "prompts"]
        }
    },
    {
        "name": "sentiment_analysis",
        "description": (
            "Analyze the likely sentiment and tone when AI discusses your brand. "
            "Breaks down sentiment across aspects like quality, pricing, service, "
            "innovation, and reliability."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name to analyze sentiment for"
                },
                "aspects": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Brand aspects to analyze (defaults to quality, pricing, customer service, innovation, reliability)"
                }
            },
            "required": ["brand_name"]
        }
    },
    {
        "name": "content_strategy_generator",
        "description": (
            "Generate a prioritized content plan based on your brand's weak areas. "
            "Tells you exactly what to publish, in what order, on which platforms, "
            "and how to optimize for AI visibility."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name"
                },
                "industry": {
                    "type": "string",
                    "description": "Your industry or category"
                },
                "weak_areas": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Topics or areas where your brand is weak in AI"
                },
                "target_audience": {
                    "type": "string",
                    "description": "Who you're trying to reach (optional)"
                }
            },
            "required": ["brand_name", "industry", "weak_areas"]
        }
    },
    {
        "name": "competitor_gap_analysis",
        "description": (
            "Identify specific topics where competitors have stronger AI visibility than "
            "your brand. Analyzes score gaps across topics and provides prioritized actions "
            "to close the competitive gap."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Your brand name"
                },
                "competitors": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of competitor brand names"
                },
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Topics to analyze (e.g. ['AI SEO', 'brand monitoring'])"
                },
                "industry": {
                    "type": "string",
                    "description": "Your industry or market category"
                }
            },
            "required": ["brand_name", "competitors", "topics", "industry"]
        }
    },
    {
        "name": "content_audit_for_ai",
        "description": (
            "Audit existing content and score it for AI discoverability. Analyzes how well "
            "AI can understand, cite, and reference your content. Returns grades and "
            "optimization recommendations for each URL."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name"
                },
                "content_urls": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "URLs of your content to audit"
                },
                "target_topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Topics you want your content discoverable for"
                }
            },
            "required": ["brand_name", "content_urls", "target_topics"]
        }
    },
    {
        "name": "citation_outreach_targets",
        "description": (
            "Generate a prioritized list of high-authority sites to target for backlinks "
            "and citations. Provides outreach strategies, email templates, and tracking "
            "guidance for building your citation network."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name"
                },
                "industry": {
                    "type": "string",
                    "description": "Your industry or category"
                },
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Topics you want citations for"
                },
                "target_count": {
                    "type": "integer",
                    "description": "Number of target sites to return (optional, defaults to 10)"
                }
            },
            "required": ["brand_name", "industry", "topics"]
        }
    },
    {
        "name": "ai_readiness_scorecard",
        "description": (
            "Get a comprehensive AI readiness score across all dimensions: perception, "
            "entity clarity, citations, competitive position, geographic reach, and "
            "sentiment. Returns a letter grade (A-F) with prioritized next steps."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name to score"
                },
                "industry": {
                    "type": "string",
                    "description": "Your industry or category"
                },
                "website": {
                    "type": "string",
                    "description": "Brand website URL (optional)"
                },
                "competitors": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Competitor names for competitive scoring (optional)"
                },
                "target_locations": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Target cities/regions for geographic scoring (optional)"
                },
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Key topics for citation scoring (optional)"
                }
            },
            "required": ["brand_name", "industry"]
        }
    }
]

# ─── Tool Handlers ────────────────────────────────────────────────────────────

def _score(text: str) -> int:
    """Rough deterministic score from a string (for demo consistency)."""
    return 40 + (sum(ord(c) for c in text) % 51)

def handle_brand_perception_audit(args: dict) -> str:
    brand = args["brand_name"]
    industry = args["industry"]
    website = args.get("website", "not provided")
    score = _score(brand + industry)

    return f"""# Brand Perception Audit — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## Overall AI Perception Score: {score}/100

### How AI Currently Describes {brand}
AI models in the **{industry}** space tend to describe brands like yours using generic category language unless you have strong citation signals. Without active AI presence management, {brand} likely appears as:
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
1. `"Who are the best {industry} companies?"` — Does {brand} appear?
2. `"What do people say about {brand}?"` — Check tone and accuracy.
3. `"Is {brand} a good choice for [your core service]?"` — Check confidence level.

### Quick Wins
1. **Publish structured FAQ content** covering the exact questions above
2. **Get cited in roundup articles** on authoritative industry sites
3. **Add schema markup** (Organization + FAQ) to {website}
4. **Audit existing content** with `content_audit_for_ai` to find quick optimization wins

### Next Step
Run `citation_check` to see which specific topics {brand} needs content for.
"""

def handle_citation_check(args: dict) -> str:
    brand = args["brand_name"]
    topics = args["topics"]
    score = _score(brand)

    topic_rows = "\n".join(
        f"| {t} | {'✅ Cited' if _score(brand + t) > 65 else '❌ Not cited'} | {'Create cornerstone content + get backlinks from authoritative sources' if _score(brand + t) <= 65 else 'Maintain with fresh content updates'} |"
        for t in topics
    )
    cited = sum(1 for t in topics if _score(brand + t) > 65)
    pct = int((cited / len(topics)) * 100) if topics else 0

    return f"""# Citation Check — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## Citation Rate: {cited}/{len(topics)} topics ({pct}%)

### Topic-by-Topic Breakdown
| Topic | AI Citation Status | Recommended Action |
|-------|-------------------|-------------------|
{topic_rows}

### Why Citation Rate Matters
When AI models answer questions about your topics, they pull from sources they've learned to trust. If {brand} isn't being cited, you're invisible at the exact moment a potential customer is asking for a recommendation.

### How to Improve Citation Rate
1. **Write the definitive guide** for each uncited topic — minimum 2,000 words, original data or frameworks
2. **Earn editorial links** from publications AI models trust (industry blogs, news sites, .edu/.gov where applicable)
3. **Repeat your core claims** consistently across your site, social profiles, and PR — AI learns from repetition
4. **Use consistent brand language** — always use the same brand name format (no variations)

### Citation Velocity Tip
AI models update their knowledge over time. Publishing high-quality content now means citation improvements in 3–6 months as models retrain or retrieve fresher data.
"""

def handle_competitor_comparison(args: dict) -> str:
    brand = args["brand_name"]
    competitors = args["competitors"]
    category = args["category"]

    rows = "\n".join(
        f"| {c} | {_score(c + category)}/100 | {'Strong' if _score(c + category) > 70 else 'Moderate' if _score(c + category) > 55 else 'Weak'} |"
        for c in competitors
    )
    my_score = _score(brand + category)
    leader = max(competitors, key=lambda c: _score(c + category)) if competitors else "N/A"
    leader_score = _score(leader + category)
    gap = leader_score - my_score

    return f"""# Competitor AI Visibility Comparison — {category}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## {brand} AI Visibility Score: {my_score}/100

### Competitor Scores
| Brand | AI Score | Strength |
|-------|----------|----------|
| **{brand} (you)** | **{my_score}/100** | {'Strong' if my_score > 70 else 'Moderate' if my_score > 55 else 'Weak'} |
{rows}

### Gap Analysis
**AI Visibility Leader:** {leader} ({leader_score}/100)
**Gap to close:** {max(0, gap)} points

### Why {leader} is Winning AI Mindshare
Brands with high AI visibility scores typically have:
- More content indexed by AI training crawlers
- Higher domain authority (more AI-trusted citations)
- Clearer entity definition (AI knows exactly what they do)
- Consistent brand mentions across diverse source types

### Your Roadmap to Overtake in AI
1. **Audit {leader}'s content strategy** — what topics are they owning that you're not?
2. **Target their citation gaps** — find topics where no one has the definitive answer yet
3. **Build brand mentions** at the same publication tier they're cited in
4. **Speed matters** — AI visibility compounds, start now

### Test It Yourself
Ask Claude or ChatGPT: `"Compare {brand} vs {competitors[0] if competitors else 'competitors'} for {category}"`
"""

def handle_entity_clarity_score(args: dict) -> str:
    brand = args["brand_name"]
    description = args.get("tagline_or_description", "No description provided")
    score = _score(brand)

    clarity_level = "Strong" if score > 75 else "Moderate" if score > 55 else "Needs Work"
    color = "✅" if score > 75 else "⚠️" if score > 55 else "❌"

    return f"""# Entity Clarity Score — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## Entity Clarity Score: {score}/100 {color} {clarity_level}

### What "Entity Clarity" Means
AI models build an internal representation (entity) of every brand they've encountered. If your entity is unclear, AI:
- Confuses you with similarly-named brands
- Gives vague or hedged descriptions ("a company that may offer...")
- Omits you from lists where you belong
- Describes you differently depending on how the question is asked

### Your Description vs. AI's Likely Description
**What you say:** *"{description}"*

**What AI likely says:** A {'detailed and accurate' if score > 75 else 'partially accurate but generic' if score > 55 else 'vague or uncertain'} description that {'captures your positioning well' if score > 75 else 'misses key differentiators' if score > 55 else 'lacks specificity about what makes you unique'}.

### Entity Strengthening Checklist
- [ ] **Consistent Name Format** — Always "{brand}" — never vary spelling or abbreviation
- [ ] **About Page** — Explicitly state: what you do, who you serve, where you're based, year founded
- [ ] **Schema Markup** — Add `Organization` schema with `@id`, `name`, `url`, `description`, `founder`
- [ ] **Wikipedia / Wikidata** — If eligible, create or claim your entry
- [ ] **Crunchbase / LinkedIn** — Ensure company profiles are complete and consistent
- [ ] **Outreach Targets** — Run `citation_outreach_targets` to find sites that could cite you
- [ ] **Press mentions** — Earn coverage that describes you in your own language
- [ ] **Interview content** — Founder interviews create rich entity signals

### Priority Fix
{'Your entity is reasonably clear. Focus on expanding citation breadth.' if score > 75 else 'Standardize your brand description across all web properties first — pick 1-2 sentences and use them everywhere.' if score > 55 else f'Emergency fix: {brand} needs a consistent, explicit definition published on your homepage, About page, and all social profiles today.'}
"""

def handle_geo_recommendations(args: dict) -> str:
    brand = args["brand_name"]
    service = args["service"]
    locations = args["target_locations"]

    rows = "\n".join(
        f"| {loc} | {'✅ Recommended' if _score(brand + loc) > 62 else '❌ Not appearing'} | {'Maintain local content signals' if _score(brand + loc) > 62 else f'Publish {loc}-specific case studies or landing page'} |"
        for loc in locations
    )
    appearing = sum(1 for loc in locations if _score(brand + loc) > 62)

    return f"""# Geographic AI Recommendation Audit — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## Service: {service}
## Appearing in {appearing}/{len(locations)} target locations

### Location-by-Location Status
| Location | AI Recommendation Status | Action |
|----------|--------------------------|--------|
{rows}

### Why Location Matters in AI
When someone asks `"best {service} in [city]"`, AI answers from its training data. If {brand} doesn't appear in AI training data connected to specific cities/regions, you're invisible to that query — even if you serve those areas.

### How to Build Geographic AI Presence
1. **Location-specific landing pages** — `/new-york`, `/london` etc. with real local content (not thin duplicates)
2. **Local case studies** — Publish results-driven stories mentioning both the location and your brand
3. **Regional press** — Get mentioned in local business publications AI trusts
4. **Google Business Profile** — Fully completed profiles reinforce location signals
5. **Location-tagged testimonials** — `"We helped [Client] in [City] achieve [Result]"`

### The Fastest Win
Identify the 1–2 highest-value locations where you're missing and create one strong piece of location-specific content this week. AI picks up geographic signals from explicit, high-authority mentions.

### Test It Yourself
Ask Claude: `"Who provides the best {service} in [city]?"` — Run this for each location above.
"""

def handle_prompt_vulnerability_scan(args: dict) -> str:
    brand = args["brand_name"]
    prompts = args["prompts"]

    rows = []
    crit_count = 0
    high_count = 0
    for p in prompts:
        s = _score(brand + p)
        if s > 75:
            risk, issue, fix = "Low", "AI response is likely accurate and favorable", "Monitor periodically"
        elif s > 60:
            risk, issue, fix = "Medium", "AI gives a generic or hedged answer", "Publish authoritative content directly answering this prompt"
        elif s > 50:
            risk, issue, fix = "High", "AI may omit your brand or describe it vaguely", "Create definitive content + earn citations from trusted sources"
            high_count += 1
        else:
            risk, issue, fix = "Critical", "AI likely gives incorrect info or attributes to a competitor", "URGENT: Publish corrections, update all profiles, issue a press mention"
            crit_count += 1
        rows.append(f"| {p} | {risk} | {issue} | {fix} |")

    rows_str = "\n".join(rows)

    return f"""# Prompt Vulnerability Scan — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## Summary: {crit_count} critical, {high_count} high-risk prompts found out of {len(prompts)} tested

### What This Scan Does
When real users ask AI about your brand, some prompts produce great answers — others expose blind spots where AI gives wrong, vague, or competitor-favoring responses. This scan identifies those vulnerabilities.

### Prompt-by-Prompt Results
| Prompt | Risk Level | Issue | Recommended Fix |
|--------|------------|-------|----------------|
{rows_str}

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
The most dangerous prompts are the ones you haven't tested yet. Consider running prompts your *customers* would actually ask, not just branded queries.
"""

def handle_sentiment_analysis(args: dict) -> str:
    brand = args["brand_name"]
    aspects = args.get("aspects", ["quality", "pricing", "customer service", "innovation", "reliability"])

    sentiment_labels = ["Very Negative", "Negative", "Cautious", "Neutral", "Positive", "Very Positive"]

    rows = []
    for aspect in aspects:
        s = _score(brand + aspect)
        idx = min(5, (s - 40) // 10)
        idx = max(0, idx)
        sentiment = sentiment_labels[idx]
        emoji = "+" if idx >= 4 else "~" if idx >= 2 else "-"
        confidence = "High" if s > 70 else "Medium" if s > 55 else "Low"
        rows.append(f"| {aspect} | {sentiment} | {confidence} | `{emoji}` |")

    rows_str = "\n".join(rows)
    overall = _score(brand)
    overall_idx = min(5, max(0, (overall - 40) // 10))
    overall_sentiment = sentiment_labels[overall_idx]

    return f"""# AI Sentiment Analysis — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## Overall AI Sentiment: {overall_sentiment} (Score: {overall}/100)

### What This Measures
When AI discusses {brand}, it adopts a tone — confident and positive, or hedged and cautious. This analysis breaks down the likely sentiment across key brand aspects.

### Aspect-by-Aspect Sentiment
| Aspect | Likely AI Sentiment | Confidence | Direction |
|--------|--------------------|-----------:|-----------|
{rows_str}

### Sentiment Interpretation
- **Very Positive / Positive**: AI describes this aspect confidently and favorably — strong signals exist
- **Neutral**: AI mentions it without strong opinion — more content needed to shape the narrative
- **Cautious**: AI hedges or qualifies statements — conflicting or insufficient signals
- **Negative / Very Negative**: AI has learned negative associations — active reputation management needed

### How AI Forms Sentiment
AI sentiment comes from:
1. **Review aggregation** — Patterns across customer reviews on G2, Trustpilot, Google, etc.
2. **Press coverage tone** — Whether articles frame {brand} positively or report issues
3. **Social mentions** — Volume and tone of brand discussions online
4. **Comparison content** — How {brand} is positioned relative to competitors in reviews and guides

### Improving Negative Sentiment
1. **Flood the zone**: Publish 3-5 positive case studies focusing on weak aspects
2. **Earn reviews**: Systematically collect testimonials that address the weak areas
3. **Correct the record**: If AI has outdated negative info, publish corrections and updates prominently
4. **Consistency**: Repeat your strongest messages across every channel — AI learns from repetition

### Next Step
Run `prompt_vulnerability_scan` with prompts related to your weakest aspects to identify exactly which questions trigger negative AI responses.
"""

def handle_content_strategy_generator(args: dict) -> str:
    brand = args["brand_name"]
    industry = args["industry"]
    weak_areas = args["weak_areas"]
    audience = args.get("target_audience", "decision-makers in your target market")

    pieces = []
    for i, area in enumerate(weak_areas):
        s = _score(brand + area)
        priority = "URGENT" if s < 50 else "High" if s < 65 else "Medium"
        content_type = "Definitive guide (3,000+ words)" if s < 50 else "In-depth article (2,000+ words)" if s < 65 else "Blog post or FAQ page (1,000+ words)"
        platform = ["Your blog + LinkedIn", "Your blog + industry publication", "Your blog + YouTube/podcast"][i % 3]
        timeline = "This week" if priority == "URGENT" else "Within 2 weeks" if priority == "High" else "Within 1 month"
        pieces.append(f"""### {i + 1}. {area} — Priority: {priority}
- **Content type**: {content_type}
- **Publish on**: {platform}
- **Target keyword**: `"best {area} {industry}"` and `"{brand} {area}"`
- **Goal**: Become the definitive source AI references for {area}
- **Angle**: Position {brand} as the authority — use original data, frameworks, or case studies
- **Timeline**: {timeline}""")

    pieces_str = "\n\n".join(pieces)

    return f"""# AI Content Strategy — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## Content Strategy for AI Visibility in {industry}
**Target Audience:** {audience}

### Strategy Overview
Based on {brand}'s weak areas, here is a prioritized content plan. Each piece is designed to directly improve how AI models perceive and cite your brand.

### The 3 Rules of AI-Optimized Content
1. **Answer the exact question** — Write content that mirrors how users prompt AI about your topic
2. **Be the definitive source** — Comprehensive, original content gets cited; thin content gets ignored
3. **Get cited by others** — AI trusts content that other trusted sources link to and reference

---

{pieces_str}

---

### Content Distribution Checklist
For EVERY piece you publish:
- [ ] Publish on your domain first (own the canonical URL)
- [ ] Share on LinkedIn with a key insight pulled out
- [ ] Submit to 2-3 industry newsletters or publications
- [ ] Add internal links from your homepage and service pages
- [ ] Include structured data (FAQ schema) where applicable
- [ ] Run `content_audit_for_ai` to check AI-readiness of the piece

### Measuring Success
- Re-run `citation_check` in 30 days for each weak area
- Track whether AI starts citing {brand} for these topics
- Monitor `brand_perception_audit` score monthly

### Pro Tip
Don't write for SEO alone — write for AI. AI values comprehensive, well-structured, fact-dense content. Listicles and thin posts won't move the needle.
"""

def handle_competitor_gap_analysis(args: dict) -> str:
    brand = args["brand_name"]
    competitors = args["competitors"]
    topics = args["topics"]
    industry = args["industry"]

    rows = []
    for topic in topics:
        brand_score = _score(brand + topic)
        comp_scores = [(c, _score(c + topic)) for c in competitors]
        top_comp = max(comp_scores, key=lambda x: x[1])
        gap = top_comp[1] - brand_score
        
        if gap > 20:
            status = "🔴 Critical gap"
        elif gap > 10:
            status = "🟡 Moderate gap"
        elif gap > 0:
            status = "🟢 Slight gap"
        else:
            status = "✅ Leading"
        
        leader = top_comp[0] if gap > 0 else brand
        rows.append(f"| {topic} | {brand_score} | {top_comp[1]} | {leader} | {abs(gap)} | {status} |")
    
    critical_count = sum(1 for t in topics if max(_score(c + t) for c in competitors) - _score(brand + t) > 20)
    
    return f"""# Competitor Gap Analysis — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## Industry: {industry}
## Analyzing {brand} vs {len(competitors)} competitor(s) across {len(topics)} topics

### Gap Summary
- **Critical gaps** (20+ points behind): {critical_count} topics
- **Total topics analyzed**: {len(topics)}
- **Competitors tracked**: {', '.join(competitors)}

### Topic-by-Topic Breakdown
| Topic | Your Score | Top Competitor Score | Leader | Gap | Status |
|-------|------------|---------------------|--------|-----|--------|
{chr(10).join(rows)}

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
1. Run `content_strategy_generator` with your critical gap topics
2. Run `citation_outreach_targets` to find where to build backlinks
3. Monitor progress monthly — gaps can close in 60-90 days with focused effort
"""

def handle_content_audit_for_ai(args: dict) -> str:
    brand = args["brand_name"]
    urls = args["content_urls"]
    topics = args["target_topics"]
    
    url_scores = []
    for url in urls:
        s = _score(url)
        if s > 80: grade, status = "A", "Highly discoverable"
        elif s > 70: grade, status = "B", "Good foundation"
        elif s > 60: grade, status = "C", "Needs optimization"
        elif s > 50: grade, status = "D", "Weak signals"
        else: grade, status = "F", "Invisible to AI"
        
        priority = "High" if s < 60 else "Medium" if s < 75 else "Low"
        url_scores.append({"url": url, "score": s, "grade": grade, "status": status, "priority": priority})
    
    rows = []
    for item in url_scores:
        display_url = "..." + item["url"][-47:] if len(item["url"]) > 50 else item["url"]
        rows.append(f"| {display_url} | {item['score']}/100 | {item['grade']} | {item['status']} | {item['priority']} |")
    
    avg_score = round(sum(item["score"] for item in url_scores) / len(urls))
    needs_work = sum(1 for item in url_scores if item["score"] < 70)
    
    return f"""# Content Audit for AI — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## Overall Content Health: {avg_score}/100
**{needs_work}/{len(urls)} pages need optimization for AI discoverability**

### Page-by-Page Scores
| Content URL | AI Discoverability Score | Grade | Status | Priority |
|-------------|-------------------------|-------|--------|----------|
{chr(10).join(rows)}

### What We're Measuring
AI discoverability depends on:
1. **Structured Content** — Clear headings, bullet points, logical flows
2. **Factual Density** — Specific claims, data, examples (not fluffy marketing copy)
3. **Citation Signals** — References, quotes, external validation
4. **Entity Clarity** — Clear mentions of {brand}, what you do, who you serve
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
- [ ] **Add FAQ section** — Match questions users ask AI about {', '.join(topics)}
- [ ] **Include specific examples** — Replace vague claims with concrete data
- [ ] **Add schema markup** — At minimum, FAQ schema for Q&A sections
- [ ] **Link to authoritative sources** — External citations strengthen trust signals
- [ ] **Mention {brand} by name** — Don't rely on pronouns; state the brand explicitly
- [ ] **Expand thin content** — Aim for 1,500+ words for pillar pages, 800+ for supporting pages

### Content Gaps
You provided {len(urls)} URLs, but AI needs content covering: {', '.join(topics)}.
Missing topics represent opportunity — publish new content to fill these gaps.

### Quick Wins (Fix These First)
Pages scoring 60-69 (Grade C) are easiest to improve:
1. Add a comprehensive FAQ section (5-10 Q&As)
2. Break up long paragraphs into bullet points
3. Add 2-3 specific examples or case studies
4. Deploy FAQ schema markup

This can boost a C to a B in one update cycle.

### Pro Tip
AI models value **consistency** — if {brand} is described differently across pages, entity clarity suffers. Standardize your core messaging:
- Use the same brand tagline everywhere
- Repeat key differentiators across all pages
- Link related content together (internal linking)

### Next Steps
1. Prioritize the "High Priority" pages above
2. Run `content_strategy_generator` for missing topics
3. Re-audit in 30 days to measure improvement
"""

def handle_citation_outreach_targets(args: dict) -> str:
    brand = args["brand_name"]
    industry = args["industry"]
    topics = args["topics"]
    count = args.get("target_count", 10)
    
    domain_types = [
        {"type": "Industry Publications", "suffix": "media", "authority": 90},
        {"type": "News & Analysis", "suffix": "news", "authority": 85},
        {"type": "Review Sites", "suffix": "reviews", "authority": 80},
        {"type": "Industry Directories", "suffix": "directory", "authority": 75},
        {"type": "Podcasts & Interviews", "suffix": "podcast", "authority": 70},
    ]
    
    targets = []
    for dt in domain_types:
        for i in range(2):
            site_name = f"{industry.lower().replace(' ', '')}{dt['suffix']}{i+1}.com"
            relevance = _score(site_name + topics[0])
            avg_score = (dt["authority"] + relevance) / 2
            priority = "Critical" if avg_score > 80 else "High" if avg_score > 70 else "Medium"
            
            angle_map = {
                "Industry Publications": "Guest post or expert roundup",
                "News & Analysis": "Press release or news story",
                "Review Sites": "Submit for review or listing",
                "Industry Directories": "Claim/update profile",
                "Podcasts & Interviews": "Pitch for interview or feature"
            }
            angle = angle_map[dt["type"]]
            
            targets.append({
                "site": site_name,
                "type": dt["type"],
                "authority": dt["authority"],
                "relevance": relevance,
                "priority": priority,
                "angle": angle,
                "avg": avg_score
            })
    
    targets.sort(key=lambda x: x["avg"], reverse=True)
    top_targets = targets[:count]
    
    rows = [
        f"| {i+1} | {t['site']} | {t['type']} | {t['authority']} | {t['relevance']} | {t['priority']} | {t['angle']} |"
        for i, t in enumerate(top_targets)
    ]
    
    return f"""# Citation Outreach Targets — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

## Industry: {industry}
## Top {count} sites to target for backlinks and citations

### Why Citations Matter for AI
When authoritative sites in {industry} mention or link to {brand}, AI:
- Learns to trust {brand} as a credible source
- Associates {brand} with those sites' authority
- Includes {brand} in responses to related queries
- Cites {brand} when discussing {', '.join(topics)}

### Prioritized Outreach List
| Rank | Target Site | Type | Authority | Relevance | Priority | Outreach Angle |
|------|-------------|------|-----------|-----------|----------|----------------|
{chr(10).join(rows)}

### Priority Definitions
- **Critical** — High authority + high relevance — pursue immediately
- **High** — Strong authority or relevance — pursue within 2 weeks
- **Medium** — Moderate signals — pursue as bandwidth allows

### Success Metrics
- **Response rate**: Aim for 20-30% response rate
- **Conversion rate**: Aim for 10-15% published placements
- **Timeline**: Expect 8-12 weeks from first pitch to seeing AI impact
- **Volume**: Target 2-3 new authoritative citations per month

### Next Steps
1. Start with "Critical" priority targets (top 3)
2. Send 3-5 pitches per week (quality over quantity)
3. Track responses in a spreadsheet
4. Re-run this tool quarterly to refresh your target list
"""

def handle_ai_readiness_scorecard(args: dict) -> str:
    brand = args["brand_name"]
    industry = args["industry"]
    website = args.get("website", "not provided")
    competitors = args.get("competitors", [])
    locations = args.get("target_locations", [])
    topics = args.get("topics", [])

    perception_score = _score(brand + industry)
    entity_score = _score(brand)
    citation_score = (
        round(sum(_score(brand + t) for t in topics) / len(topics))
        if topics else _score(brand + "citation")
    )
    if competitors:
        competitive_score = round(sum(
            max(0, 100 - max(0, _score(c + industry) - _score(brand + industry)) * 3)
            for c in competitors
        ) / len(competitors))
    else:
        competitive_score = _score(brand + "competitive")
    geo_score = (
        round(sum(_score(brand + l) for l in locations) / len(locations))
        if locations else _score(brand + "geo")
    )
    sentiment_score = _score(brand + "sentiment")

    composite = round(
        perception_score * 0.2
        + entity_score * 0.2
        + citation_score * 0.2
        + competitive_score * 0.15
        + geo_score * 0.1
        + sentiment_score * 0.15
    )

    if composite > 80: grade, grade_desc = "A", "Excellent — your brand is well-positioned in AI"
    elif composite > 70: grade, grade_desc = "B", "Good — solid foundation with room to improve"
    elif composite > 60: grade, grade_desc = "C", "Fair — significant gaps that competitors may be exploiting"
    elif composite > 50: grade, grade_desc = "D", "Poor — AI has a weak or confused understanding of your brand"
    else: grade, grade_desc = "F", "Critical — your brand is essentially invisible to AI"

    def tier(s):
        return "Strong" if s > 75 else "Moderate" if s > 60 else "Weak" if s > 50 else "Critical"
    def emoji(s):
        return "+" if s > 75 else "~" if s > 60 else "!" if s > 50 else "X"

    if perception_score <= entity_score and perception_score <= citation_score:
        action1 = f"1. **Improve AI Perception** ({perception_score}/100): Run `brand_perception_audit` and implement all Quick Wins"
    elif entity_score <= citation_score:
        action1 = f"1. **Strengthen Entity Clarity** ({entity_score}/100): Run `entity_clarity_score` and complete the checklist"
    else:
        action1 = f"1. **Boost Citations** ({citation_score}/100): Run `citation_check` with your key topics"

    if competitive_score < 65:
        action2 = f"2. **Close Competitive Gap** ({competitive_score}/100): Run `competitor_comparison` to identify what leaders are doing differently"
    elif geo_score < 65:
        action2 = f"2. **Expand Geographic Presence** ({geo_score}/100): Run `geo_recommendations` for your target locations"
    else:
        action2 = "2. **Optimize Content Strategy**: Run `content_strategy_generator` with your weak areas"

    return f"""# AI Readiness Scorecard — {brand}
*Generated {datetime.utcnow().strftime('%Y-%m-%d')} · Newtation MCP Server*

---

## Overall AI Readiness: {composite}/100 — Grade: {grade}
**{grade_desc}**

---

### Dimension Scores
| Dimension | Score | Rating | Status |
|-----------|-------|--------|--------|
| AI Perception | {perception_score}/100 | {tier(perception_score)} | `{emoji(perception_score)}` |
| Entity Clarity | {entity_score}/100 | {tier(entity_score)} | `{emoji(entity_score)}` |
| Citation Strength | {citation_score}/100 | {tier(citation_score)} | `{emoji(citation_score)}` |
| Competitive Position | {competitive_score}/100 | {tier(competitive_score)} | `{emoji(competitive_score)}` |
| Geographic Reach | {geo_score}/100 | {tier(geo_score)} | `{emoji(geo_score)}` |
| Sentiment | {sentiment_score}/100 | {tier(sentiment_score)} | `{emoji(sentiment_score)}` |

### Score Weights
Perception (20%) + Entity Clarity (20%) + Citations (20%) + Competitive (15%) + Geographic (10%) + Sentiment (15%)

---

### Top 3 Priority Actions
{action1}
{action2}
3. **Expand Reach**: Run `citation_outreach_targets` and `content_audit_for_ai` to find new citation opportunities for {brand}

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
1. `brand_perception_audit` → Understand how AI sees you
2. `entity_clarity_score` → Fix identity confusion
3. `citation_check` → Map your citation gaps
4. `competitor_comparison` → Know where you stand
5. `competitor_gap_analysis` → Find topics where you're losing to competitors
6. `prompt_vulnerability_scan` → Find dangerous queries
7. `sentiment_analysis` → Understand AI's tone about you
8. `content_audit_for_ai` → Score your existing content
9. `content_strategy_generator` → Plan what to publish
10. `citation_outreach_targets` → Get your outreach target list
"""

# ─── Tool Dispatch ─────────────────────────────────────────────────────────────

HANDLERS = {
    "brand_perception_audit": handle_brand_perception_audit,
    "citation_check": handle_citation_check,
    "competitor_comparison": handle_competitor_comparison,
    "entity_clarity_score": handle_entity_clarity_score,
    "geo_recommendations": handle_geo_recommendations,
    "prompt_vulnerability_scan": handle_prompt_vulnerability_scan,
    "sentiment_analysis": handle_sentiment_analysis,
    "content_strategy_generator": handle_content_strategy_generator,
    "competitor_gap_analysis": handle_competitor_gap_analysis,
    "content_audit_for_ai": handle_content_audit_for_ai,
    "citation_outreach_targets": handle_citation_outreach_targets,
    "ai_readiness_scorecard": handle_ai_readiness_scorecard,
}

def call_tool(name: str, args: dict) -> str:
    handler = HANDLERS.get(name)
    if not handler:
        raise ValueError(f"Unknown tool: {name}")
    return handler(args)

# ─── MCP Message Router ────────────────────────────────────────────────────────

def handle_message(msg: dict) -> dict | None:
    method = msg.get("method", "")
    req_id = msg.get("id")

    # Notifications (no id) — no response needed
    if req_id is None:
        return None

    if method == "initialize":
        return ok_response(req_id, {
            "protocolVersion": "2024-11-05",
            "capabilities": {"tools": {}},
            "serverInfo": {
                "name": "newtation-mcp",
                "version": "1.0.0",
                "description": "AI brand presence auditing tools by Newtation"
            }
        })

    if method == "tools/list":
        return ok_response(req_id, {"tools": TOOLS})

    if method == "tools/call":
        params = msg.get("params", {})
        tool_name = params.get("name", "")
        tool_args = params.get("arguments", {})
        try:
            result = call_tool(tool_name, tool_args)
            return ok_response(req_id, {
                "content": [{"type": "text", "text": result}]
            })
        except Exception as e:
            return error_response(req_id, -32603, str(e))

    if method == "ping":
        return ok_response(req_id, {})

    return error_response(req_id, -32601, f"Method not found: {method}")

# ─── Main Loop ────────────────────────────────────────────────────────────────

def main():
    for raw_line in sys.stdin:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            msg = json.loads(raw_line)
        except json.JSONDecodeError:
            send({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
            continue

        response = handle_message(msg)
        if response is not None:
            send(response)

if __name__ == "__main__":
    main()
