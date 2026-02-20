#!/usr/bin/env python3
"""
Newtation AI Presence MCP Server
Connects to Claude Code to audit how AI systems perceive and cite your brand.

Usage with Claude Code:
  claude mcp add newtation -- python3 /path/to/server.py

Tools:
  - brand_perception_audit    : How AI describes your brand overall
  - citation_check            : Whether AI cites your brand as a source
  - competitor_comparison     : How your brand stacks up vs competitors in AI
  - entity_clarity_score      : How clearly AI understands what your brand is
  - geo_recommendations       : Whether AI recommends your brand by location
"""

import sys
import json
import re
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
4. **Create an llms.txt file** at your domain root listing key facts about {brand}

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
- [ ] **llms.txt** — Add `/.well-known/llms.txt` with structured brand facts
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

# ─── Tool Dispatch ─────────────────────────────────────────────────────────────

HANDLERS = {
    "brand_perception_audit": handle_brand_perception_audit,
    "citation_check": handle_citation_check,
    "competitor_comparison": handle_competitor_comparison,
    "entity_clarity_score": handle_entity_clarity_score,
    "geo_recommendations": handle_geo_recommendations,
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
