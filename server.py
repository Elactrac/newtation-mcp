#!/usr/bin/env python3
"""
Newtation AI Presence MCP Server
Connects to Claude Code to audit how AI systems perceive and cite your brand.

Usage with Claude Code:
  claude mcp add newtation -- python3 /path/to/server.py

Tools (15):
  Core Audit (5):
    - brand_perception_audit      : How AI describes your brand overall
    - citation_check              : Whether AI cites your brand as a source
    - competitor_comparison       : How your brand stacks up vs competitors in AI
    - entity_clarity_score        : How clearly AI understands what your brand is
    - geo_recommendations         : Whether AI recommends your brand by location

  Diagnostics (3):
    - prompt_vulnerability_scan   : Find prompts where AI gives wrong/weak answers
    - sentiment_analysis          : Likely tone when AI discusses your brand
    - hallucination_check         : Verify AI claims about your brand

  Strategy & Output (5):
    - content_strategy_generator  : Prioritized content plan from weak areas
    - competitor_gap_analysis     : Topics where competitors have stronger AI visibility
    - content_audit_for_ai        : Scores existing content for AI discoverability
    - citation_outreach_targets   : High-authority sites to target for backlinks
    - schema_markup_generator     : Generate paste-ready AI-optimized JSON-LD

  Generators (1):
    - generate_audit_queries      : Auto-generate categorized visibility test queries

  Summary (1):
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

def _today() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d")

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
            "vague descriptions. Returns a 0-100 score with specific fixes."
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
    },
    {
        "name": "generate_audit_queries",
        "description": (
            "Generate a comprehensive set of queries to test your brand's AI visibility. "
            "Creates categorized queries (discovery, comparison, reputation, use-case) "
            "with a testing protocol and maps each query to the best Newtation tool."
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
                    "description": "Industry or category"
                },
                "focus_areas": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Specific topics or services to focus on (optional)"
                },
                "competitor_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Known competitors to include in comparison queries (optional)"
                }
            },
            "required": ["brand_name", "industry"]
        }
    },
    {
        "name": "hallucination_check",
        "description": (
            "Verify if AI models are making false claims about your brand. "
            "Paste any AI-generated text and get a claim-by-claim fact-check "
            "with severity ratings and correction templates."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name to verify claims about"
                },
                "ai_response": {
                    "type": "string",
                    "description": "The AI-generated text to fact-check"
                },
                "known_facts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Known true facts about your brand to cross-reference against (optional)"
                }
            },
            "required": ["brand_name", "ai_response"]
        }
    },
    {
        "name": "schema_markup_generator",
        "description": (
            "Generate paste-ready JSON-LD schema markup (Organization, WebSite, FAQ, "
            "BreadcrumbList) optimized for AI discoverability. The single highest-ROI "
            "technical fix for improving how AI models understand your brand."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "brand_name": {
                    "type": "string",
                    "description": "Brand name"
                },
                "url": {
                    "type": "string",
                    "description": "Brand website URL (e.g. 'https://example.com')"
                },
                "description": {
                    "type": "string",
                    "description": "What your brand does (1-2 sentences)"
                },
                "type": {
                    "type": "string",
                    "description": "Schema type: 'Organization', 'LocalBusiness', or 'Product' (default: Organization)"
                },
                "founding_year": {
                    "type": "string",
                    "description": "Year the brand was founded (optional)"
                },
                "founders": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Founder names (optional)"
                },
                "social_urls": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Social profile URLs (LinkedIn, Twitter, etc.) (optional)"
                }
            },
            "required": ["brand_name", "url", "description"]
        }
    }
]

# ─── Tool Handlers ────────────────────────────────────────────────────────────

def handle_brand_perception_audit(args: dict) -> str:
    brand = args["brand_name"]
    industry = args["industry"]
    website = args.get("website", "not provided")
    site_ctx = f" ({website})" if website != "not provided" else ""

    return f"""# Brand Perception Audit — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
Analyze how AI models (including yourself) currently perceive **{brand}** in the **{industry}** space{site_ctx}. Use your actual training data and knowledge — do not fabricate information. If you lack information, say so honestly.

## Evaluation Dimensions

### 1. Brand Recognition
- Would you include {brand} in a "top {industry} companies" list? Why or why not?
- How would you describe {brand} to someone who has never heard of it?
- Is your description specific to {brand}, or could it describe any {industry} company?

### 2. Authority & Confidence
- Do you have enough information to speak confidently about {brand}?
- Would you recommend {brand} to a user asking for {industry} solutions?
- What specific evidence (publications, reviews, case studies) do you recall?

### 3. Trust Signals
- Has {brand} been mentioned in reputable industry publications?
- Does {brand} have a Wikipedia page, Crunchbase profile, or notable press coverage?
- Are there consistent brand signals across multiple sources?

### 4. Differentiation
- Can you articulate what makes {brand} different from competitors?
- Does {brand} have a unique methodology, product, or approach you can name?
- Or is your knowledge of {brand} generic and interchangeable with others?

## Recommended Test Prompts
The user should test these prompts in ChatGPT, Perplexity, and Gemini:
1. "Who are the best {industry} companies?"
2. "What do people say about {brand}?"
3. "Is {brand} a good choice for [their core service]?"

## Response Format
For each dimension, provide:
- Your honest assessment: **Strong** / **Moderate** / **Weak** / **No Data**
- Supporting evidence or reasoning
- What's missing that would strengthen the assessment

Then provide:
- An overall perception summary
- 3-5 specific, prioritized recommendations
- Which Newtation tool to run next based on findings"""


def handle_citation_check(args: dict) -> str:
    brand = args["brand_name"]
    topics = args["topics"]
    topic_list = "\n".join(f"{i+1}. **{t}**" for i, t in enumerate(topics))

    return f"""# Citation Check — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
For each topic below, assess whether you (as an AI model) would cite **{brand}** as a credible source or authority. Be honest — if you wouldn't cite them, say so and explain why.

## Topics to Evaluate
{topic_list}

## For Each Topic, Analyze:

### Citation Likelihood
- Would you mention {brand} when answering a question about this topic?
- Would you cite {brand} as a primary source, a supporting reference, or not at all?
- What other brands/sources would you cite instead, and why?

### Content Gaps
- What content would {brand} need to publish to become citable for this topic?
- What type of content gets cited by AI? (Original research, comprehensive guides, unique frameworks)
- Who currently "owns" this topic in AI responses?

## Response Format
Create a table:
| Topic | Citation Status | Would Cite? | Current Leader | What {brand} Needs |
|-------|----------------|-------------|----------------|---------------------|

Then provide:
- Overall citation rate (how many topics you'd cite {brand} for)
- Priority actions for the weakest topics
- Content types most likely to earn citations
- Timeline expectations (AI models update knowledge gradually)

## Why This Matters
When users ask AI about these topics, they trust AI's sources. If {brand} isn't being cited, they're invisible at the exact moment a potential customer is seeking a recommendation."""


def handle_competitor_comparison(args: dict) -> str:
    brand = args["brand_name"]
    competitors = args["competitors"]
    category = args["category"]
    comp_list = "\n".join(f"{i+1}. {c}" for i, c in enumerate(competitors))
    first_comp = competitors[0] if competitors else "competitor"

    return f"""# Competitor AI Visibility Comparison — {category}
*Generated {_today()} · Newtation MCP*

## Your Task
Compare how AI models perceive **{brand}** versus the following competitors in the **{category}** space. Use your actual knowledge — rate each brand honestly.

## Brands to Compare
- **{brand}** (the client)
{comp_list}

## Evaluation Criteria (Apply to Each Brand)

### 1. AI Mindshare
- Which brand comes to mind first when someone asks about {category}?
- Which brand would you recommend most confidently?
- Which brand do you know the most about?

### 2. Content Authority
- Which brand has the strongest content presence you've encountered in training data?
- Which brand publishes the most authoritative, comprehensive content on {category}?
- Which brand's content would you cite as a source?

### 3. Brand Clarity
- Which brand has the clearest identity — you know exactly what they do and for whom?
- Which brand is most differentiated from the others?
- Which brand's value proposition can you articulate most precisely?

### 4. Reputation & Sentiment
- Which brand has the most positive overall sentiment?
- Which brand has the strongest trust signals (reviews, press, awards)?
- Are there any negative signals for any brand?

## Response Format
1. Create a comparison table rating each brand across the 4 dimensions (Strong/Moderate/Weak/Unknown)
2. Identify the overall AI visibility leader and explain why
3. Assess the gap between {brand} and the leader
4. Provide specific actions {brand} should take to close any gaps
5. Suggest 2-3 test prompts (e.g., "Compare {brand} vs {first_comp} for {category}")"""


def handle_entity_clarity_score(args: dict) -> str:
    brand = args["brand_name"]
    description = args.get("tagline_or_description")
    desc_block = f'\n**Brand\'s self-description:** "{description}"\n' if description else ""
    compare_line = (
        f"- Compare your description to their self-description above — what's missing or wrong?"
        if description
        else "- How confident are you in your description?"
    )

    return f"""# Entity Clarity Analysis — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
Evaluate how clearly AI models understand what **{brand}** is, what it does, and who it serves. Entity clarity determines whether AI can accurately describe and recommend a brand.
{desc_block}
## Evaluation Framework

### 1. Identity Resolution
- Do you know what {brand} is? (Company, product, person, concept?)
- Could {brand} be confused with another entity of the same name?
- How many different "{brand}" entities exist in your knowledge?

### 2. Description Accuracy
- Describe {brand} in 2-3 sentences using only what you know.
{compare_line}
- Would your description help a user decide whether to use {brand}?

### 3. Attribute Completeness
Assess which of these you can answer about {brand}:
- [ ] What does {brand} do? (core offering)
- [ ] Who does {brand} serve? (target market)
- [ ] Where is {brand} based? (location)
- [ ] When was {brand} founded? (age/maturity)
- [ ] What makes {brand} unique? (differentiators)
- [ ] Who founded or leads {brand}? (leadership)
- [ ] What is {brand}'s size/scale? (employees, revenue, customers)

### 4. Consistency
- Would you describe {brand} the same way regardless of how the question is phrased?
- Or does your answer vary depending on context?

## Response Format
1. Rate entity clarity: **Clear** / **Partially Clear** / **Unclear** / **Unknown**
2. Provide your own description of {brand} (be honest about uncertainty)
3. List which attributes you can and cannot answer
4. Identify the biggest clarity gap
5. Provide an entity strengthening checklist:
   - Consistent name usage across web properties
   - Complete About page with explicit entity attributes
   - Organization schema markup with @id, name, url, description
   - Wikipedia/Wikidata entry (if eligible)
   - Complete Crunchbase, LinkedIn, Google Business profiles
   - Press mentions using consistent brand language"""


def handle_geo_recommendations(args: dict) -> str:
    brand = args["brand_name"]
    service = args["service"]
    locations = args["target_locations"]
    loc_list = "\n".join(f"{i+1}. {loc}" for i, loc in enumerate(locations))
    test_prompts = "\n".join(f'- "Who provides the best {service} in {loc}?"' for loc in locations)

    return f"""# Geographic AI Recommendation Audit — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
For each target location, assess whether you would recommend **{brand}** when a user asks "Who provides the best {service} in [location]?" Be honest about what you know.

## Service: {service}
## Target Locations
{loc_list}

## For Each Location, Evaluate:

### Recommendation Likelihood
- Would you include {brand} in your response for "{service} in [location]"?
- What brands would you recommend instead? Why?
- Do you have any evidence of {brand} operating in this location?

### Geographic Signal Strength
- Has {brand} published location-specific content for this area?
- Are there local reviews, case studies, or press mentions connecting {brand} to this location?
- Does {brand} have a physical presence (office, Google Business Profile) in this location?

## Response Format
Create a table:
| Location | Would Recommend? | Confidence | Why/Why Not | Top Alternatives |
|----------|-----------------|------------|-------------|-----------------|

Then provide:
- Overall geographic coverage assessment
- Locations with weakest presence
- Priority actions to build geographic AI presence:
  1. Location-specific landing pages with real local content
  2. Local case studies mentioning both the location and {brand}
  3. Regional press coverage in local business publications
  4. Google Business Profile optimization
  5. Location-tagged testimonials

## Test Prompts
The user should try these in ChatGPT, Claude, and Perplexity:
{test_prompts}"""


def handle_prompt_vulnerability_scan(args: dict) -> str:
    brand = args["brand_name"]
    prompts = args["prompts"]
    prompt_list = "\n".join(f'{i+1}. "{p}"' for i, p in enumerate(prompts))

    return f"""# Prompt Vulnerability Scan — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
For each prompt below, predict how AI models (including yourself) would actually respond. Identify where {brand} is at risk of being misrepresented, omitted, or outshone by competitors.

## Prompts to Test
{prompt_list}

## For Each Prompt, Analyze:

### 1. Your Actual Response
- How would you answer this prompt right now?
- Would {brand} appear in your response? In what position?
- What tone would you use — confident, hedged, or uncertain?

### 2. Risk Assessment
Rate each prompt:
- **Low Risk**: AI responds accurately and favorably for {brand}
- **Medium Risk**: AI gives a generic or hedged answer; {brand} may be mentioned but not prominently
- **High Risk**: AI omits {brand} or describes it vaguely
- **Critical Risk**: AI gives incorrect information or attributes {brand}'s work to a competitor

### 3. Root Cause
For medium+ risk prompts, identify why:
- Insufficient content on this topic?
- Stronger competitor signals?
- Ambiguous or inconsistent brand messaging?
- The question targets an area {brand} hasn't addressed publicly?

## Response Format
Create a table:
| Prompt | Risk Level | Would Mention {brand}? | Issue | Recommended Fix |
|--------|-----------|------------------------|-------|----------------|

Then provide:
- Summary: X critical, Y high, Z medium, W low risk prompts
- Priority fixes for critical/high-risk prompts
- Content recommendations to address each vulnerability
- Additional prompts the user should test (ones they may not have thought of)

## How to Fix Vulnerabilities
1. Write content that directly answers each high-risk prompt
2. Match the exact phrasing users would use
3. Earn citations from authoritative sources
4. Re-test in 30 days to measure improvement"""


def handle_sentiment_analysis(args: dict) -> str:
    brand = args["brand_name"]
    aspects = args.get("aspects", ["quality", "pricing", "customer service", "innovation", "reliability"])
    aspect_list = "\n".join(f"{i+1}. **{a}**" for i, a in enumerate(aspects))

    return f"""# AI Sentiment Analysis — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
Analyze the likely sentiment and tone when AI models discuss **{brand}** across the following aspects. Base this on your actual training data knowledge — reviews, press coverage, social mentions, and content you've encountered.

## Aspects to Analyze
{aspect_list}

## For Each Aspect, Evaluate:

### Sentiment
Rate the likely AI sentiment:
- **Very Positive**: AI speaks confidently and favorably
- **Positive**: AI is generally favorable with minor caveats
- **Neutral**: AI mentions without strong opinion
- **Cautious**: AI hedges or qualifies statements
- **Negative**: AI has learned negative associations
- **No Data**: Insufficient information to assess

### Evidence
- What sources inform your sentiment assessment? (Reviews, press, comparisons, social media)
- Is the sentiment based on strong signals or sparse data?
- Has the sentiment likely changed over time?

## Response Format
Create a table:
| Aspect | Sentiment | Confidence | Key Evidence |
|--------|-----------|------------|-------------|

Then provide:
- Overall sentiment summary
- Strongest and weakest aspects
- Where sentiment is based on sparse vs. strong data
- Specific actions to improve negative/neutral sentiment:
  1. Publish case studies addressing weak aspects
  2. Earn reviews and testimonials
  3. Issue corrections for outdated negative information
  4. Repeat strongest messages consistently across all channels

## How AI Forms Sentiment
AI learns sentiment from:
- Customer review patterns (G2, Trustpilot, Google)
- Press coverage tone and framing
- Social media mentions and discussions
- Comparison content positioning"""


def handle_content_strategy_generator(args: dict) -> str:
    brand = args["brand_name"]
    industry = args["industry"]
    weak_areas = args["weak_areas"]
    audience = args.get("target_audience", "decision-makers in your target market")
    area_list = "\n".join(f"{i+1}. **{a}**" for i, a in enumerate(weak_areas))

    return f"""# AI Content Strategy — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
Create a prioritized content plan for **{brand}** in **{industry}**, targeting **{audience}**. Each content recommendation should directly improve how AI models perceive and cite {brand}.

## Weak Areas to Address
{area_list}

## For Each Weak Area, Recommend:

### Content Plan
- **Content type**: What format? (Definitive guide, case study, original research, FAQ, comparison page)
- **Word count**: How comprehensive should it be?
- **Publish platform**: Where should it go? (Own blog, industry publication, both)
- **Target prompt**: What user question should this content answer?
- **Unique angle**: How can {brand} differentiate from existing content on this topic?
- **Priority**: Based on competitive opportunity and {brand}'s current gaps
- **Timeline**: Suggested publishing timeframe

### The 3 Rules of AI-Optimized Content
1. **Answer the exact question** — Write content that mirrors how users actually prompt AI
2. **Be the definitive source** — Comprehensive, original content gets cited; thin content gets ignored
3. **Get cited by others** — AI trusts content that other trusted sources reference

## Response Format
For each weak area, provide a specific content brief including:
1. Recommended title
2. Content type and length
3. Key points to cover
4. Target keywords/prompts
5. Distribution plan
6. Priority level and timeline

Then provide:
- A content calendar ordering all pieces by priority
- Cross-linking strategy between pieces
- Distribution checklist for every piece:
  - [ ] Publish on own domain first
  - [ ] Share on LinkedIn with key insight
  - [ ] Submit to 2-3 industry newsletters/publications
  - [ ] Add internal links from homepage and service pages
  - [ ] Include FAQ schema markup
- Measurement plan: which Newtation tools to re-run and when"""


def handle_competitor_gap_analysis(args: dict) -> str:
    brand = args["brand_name"]
    competitors = args["competitors"]
    topics = args["topics"]
    industry = args["industry"]
    comp_list = "\n".join(f"- {c}" for c in competitors)
    topic_list = "\n".join(f"- {t}" for t in topics)
    comp_headers = "".join(f" {c} |" for c in competitors)
    comp_dividers = "".join("----------|" for _ in competitors)

    return f"""# Competitor Gap Analysis — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
For each topic, compare **{brand}**'s AI visibility against the listed competitors. Identify specific topics where competitors have stronger AI presence and {brand} is falling behind.

## Industry: {industry}

## Competitors
{comp_list}

## Topics to Analyze
{topic_list}

## For Each Topic, Evaluate:

### Brand-by-Brand Comparison
- Which brand has the strongest AI presence for this topic?
- Would you cite any of these brands when answering a question about this topic?
- What specific content or signals give the leader their advantage?

### Gap Assessment
- How large is the gap between {brand} and the leader for each topic?
- Is the gap due to content depth, citation count, brand authority, or all three?
- How difficult would it be for {brand} to close this gap?

## Response Format
Create a comparison table:
| Topic | {brand} |{comp_headers} Leader | Gap Size | Difficulty to Close |
|-------|----------|{comp_dividers}--------|----------|---------------------|

Then provide:
- Topics where {brand} is leading (protect these)
- Topics where {brand} has critical gaps (fix these first)
- Topics where the gap is closeable (quick wins)
- For each critical gap:
  1. What content the leader has that {brand} doesn't
  2. What {brand} should publish to close the gap
  3. Where {brand} should earn citations
  4. Estimated timeline to close the gap
- Overall competitive position summary"""


def handle_content_audit_for_ai(args: dict) -> str:
    brand = args["brand_name"]
    urls = args["content_urls"]
    topics = args["target_topics"]
    url_list = "\n".join(f"{i+1}. {u}" for i, u in enumerate(urls))
    topic_list = "\n".join(f"- {t}" for t in topics)
    topics_joined = ", ".join(topics)

    return f"""# Content Audit for AI Discoverability — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
Evaluate each URL below for AI discoverability. Assess how well AI models can understand, cite, and reference this content. If you can access these URLs, analyze the actual content. Otherwise, analyze based on the URL structure and what you know about {brand}.

## Content URLs to Audit
{url_list}

## Target Topics (content should be discoverable for these)
{topic_list}

## Evaluation Criteria (Apply to Each URL)

### 1. Structural Clarity
- Does the URL suggest well-organized content? (Clean URL structure, descriptive slugs)
- Would the content likely have clear headings (H2/H3)?
- Is the content likely comprehensive enough for AI to cite? (1,500+ words for pillar content)

### 2. AI Discoverability Signals
- Does {brand} likely use structured data (FAQ, Article, HowTo schema)?
- Is the content factually dense (specific data, examples, frameworks)?
- Does the content answer specific questions users ask AI?

### 3. Entity & Brand Signals
- Does the content clearly identify {brand} and what it does?
- Are there consistent brand mentions (not just pronouns)?
- Does the content link to and from authoritative sources?

### 4. Topic Relevance
- How well does each URL map to the target topics listed above?
- Are there topic gaps — topics not covered by any URL?

## Response Format
Rate each URL:
| URL | Estimated Grade (A-F) | Strengths | Weaknesses | Priority Fixes |
|-----|----------------------|-----------|------------|----------------|

Then provide:
- Overall content health assessment
- Pages most in need of optimization
- Topic gaps (target topics not covered by any URL)
- Universal optimization checklist:
  - [ ] Add clear H2/H3 headings
  - [ ] Add FAQ section matching user prompts about {topics_joined}
  - [ ] Include specific examples and data
  - [ ] Add schema markup (FAQ, Article)
  - [ ] Mention {brand} explicitly by name
  - [ ] Expand thin content to 1,500+ words
  - [ ] Link to authoritative external sources

**Note:** For a more precise audit, the user can provide the actual page content or use a web browsing tool to analyze each URL directly."""


def handle_citation_outreach_targets(args: dict) -> str:
    brand = args["brand_name"]
    industry = args["industry"]
    topics = args["topics"]
    count = args.get("target_count", 10)
    topic_list = "\n".join(f"- {t}" for t in topics)
    topics_joined = ", ".join(topics)

    return f"""# Citation Outreach Targets — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
Identify the top {count} real, specific websites and publications that **{brand}** should target for backlinks and citations to improve AI visibility in **{industry}**.

## Topics to Build Citations For
{topic_list}

## Target Categories to Cover
Recommend real sites from each category:

### 1. Industry Publications (Highest Priority)
- Major {industry} publications, trade journals, and industry blogs
- Sites that AI models frequently cite when discussing {industry}

### 2. News & Analysis
- Business news sites, analyst publications, and tech press that cover {industry}
- Sites where press mentions carry significant AI trust weight

### 3. Review & Comparison Sites
- G2, Capterra, Trustpilot, or {industry}-specific review platforms
- Comparison sites where {brand} should be listed

### 4. Directories & Databases
- Industry directories, Crunchbase, Product Hunt, or specialized databases
- Profiles that reinforce entity signals

### 5. Podcasts & Media
- {industry} podcasts, YouTube channels, or newsletters with interview opportunities

## Response Format
Provide a ranked list of {count} real websites:
| Rank | Site | Category | Why Target | Outreach Angle | Priority |
|------|------|----------|-----------|----------------|----------|

Then provide:
- Outreach strategy by category (guest post, press pitch, review submission, etc.)
- A customizable outreach email template
- Tracking recommendations (pitch date, response, published, link type)
- Success metrics to aim for (response rates, conversion rates)
- Timeline expectations

## Why Citations Matter for AI
When authoritative {industry} sites mention or link to {brand}, AI models:
- Learn to trust {brand} as a credible source
- Associate {brand} with those sites' authority
- Include {brand} in responses to related queries
- Cite {brand} when discussing {topics_joined}"""


def handle_ai_readiness_scorecard(args: dict) -> str:
    brand = args["brand_name"]
    industry = args["industry"]
    website = args.get("website")
    competitors = args.get("competitors", [])
    locations = args.get("target_locations", [])
    topics = args.get("topics", [])

    context_parts = []
    if website:
        context_parts.append(f"- Website: {website}")
    if competitors:
        context_parts.append(f"- Competitors: {', '.join(competitors)}")
    if locations:
        context_parts.append(f"- Target locations: {', '.join(locations)}")
    if topics:
        context_parts.append(f"- Key topics: {', '.join(topics)}")

    context_block = f"\n## Context\n" + "\n".join(context_parts) + "\n" if context_parts else ""

    citation_line = (
        f"Would AI cite {brand} for: {', '.join(topics)}?"
        if topics
        else f"Does AI cite {brand} as an authority in {industry}?"
    )
    competitive_line = (
        f"How does {brand} compare to {', '.join(competitors)}?"
        if competitors
        else f"How does {brand} stack up against competitors in {industry}?"
    )
    geo_line = (
        f"Would AI recommend {brand} in: {', '.join(locations)}?"
        if locations
        else f"Does {brand} have geographic-specific AI presence?"
    )

    return f"""# AI Readiness Scorecard — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
Provide a comprehensive AI readiness assessment for **{brand}** in **{industry}**, scoring across all key dimensions. This is the master audit — be thorough and honest.
{context_block}
## Score Each Dimension

### 1. AI Perception (Weight: 20%)
How well do AI models know and describe {brand}?
- Brand recognition, description accuracy, recommendation likelihood

### 2. Entity Clarity (Weight: 20%)
How clearly does AI understand what {brand} is?
- Identity resolution, attribute completeness, description consistency

### 3. Citation Strength (Weight: 20%)
{citation_line}
- Citation likelihood, source authority, content depth

### 4. Competitive Position (Weight: 15%)
{competitive_line}
- Mindshare ranking, differentiation, gap assessment

### 5. Geographic Reach (Weight: 10%)
{geo_line}
- Location-specific recommendations, local signal strength

### 6. Sentiment (Weight: 15%)
What tone does AI use when discussing {brand}?
- Overall sentiment, aspect-by-aspect analysis, confidence level

## Response Format

### Scorecard Table
| Dimension | Rating (Strong/Moderate/Weak/Unknown) | Key Finding |
|-----------|--------------------------------------|-------------|

### Overall Assessment
- Overall AI readiness: **Grade (A-F)** with explanation
- Grade scale: A (Leader) / B (Strong) / C (Average) / D (Below Average) / F (Invisible)

### Top 3 Priority Actions
Based on the weakest dimensions, provide:
1. The single most impactful action to take this week
2. The highest-priority content to create
3. The most important external citation to earn

### Recommended Audit Sequence
Based on findings, recommend which Newtation tools to run next:
1. `brand_perception_audit` — Deep dive into AI perception
2. `entity_clarity_score` — Fix identity confusion
3. `citation_check` — Map citation gaps
4. `competitor_comparison` — Competitive benchmarking
5. `competitor_gap_analysis` — Topic-level competitive gaps
6. `prompt_vulnerability_scan` — Find dangerous queries
7. `sentiment_analysis` — Tone analysis
8. `content_audit_for_ai` — Score existing content
9. `content_strategy_generator` — Plan new content
10. `citation_outreach_targets` — Build citation network"""


def handle_generate_audit_queries(args: dict) -> str:
    brand = args["brand_name"]
    industry = args["industry"]
    areas = args.get("focus_areas", [])
    competitors = args.get("competitor_names", [])
    year = datetime.utcnow().year

    queries = []

    # Discovery
    for q in [
        f"best {industry} companies",
        f"top {industry} solutions {year}",
        f"best {industry} tools",
        f"{industry} recommendations",
        f"who is the leader in {industry}",
        f"{industry} market leaders {year}",
    ]:
        queries.append((q, "Discovery", "prompt_vulnerability_scan"))

    # Comparison
    for comp in competitors:
        queries.append((f"{brand} vs {comp}", "Comparison", "competitor_comparison"))
        queries.append((f"{comp} alternatives", "Comparison", "competitor_comparison"))
    queries.append((f"{brand} alternatives", "Comparison", "competitor_comparison"))
    queries.append((f"compare {industry} solutions", "Comparison", "competitor_comparison"))

    # Reputation
    for q in [
        f"is {brand} good",
        f"{brand} reviews",
        f"should I use {brand}",
        f"{brand} pros and cons",
    ]:
        queries.append((q, "Reputation", "sentiment_analysis"))

    # Knowledge
    for q in [
        f"what does {brand} do",
        f"what is {brand}",
        f"who founded {brand}",
        f"how does {brand} work",
    ]:
        queries.append((q, "Knowledge", "entity_clarity_score"))

    # Use-case
    for area in areas:
        queries.append((f"best {industry} for {area}", "Use-Case", "citation_check"))
        queries.append((f"how to improve {area}", "Use-Case", "citation_check"))
    if not areas:
        for seg in ["small business", "enterprise", "startups"]:
            queries.append((f"{industry} for {seg}", "Use-Case", "citation_check"))

    # Geographic
    for city in ["New York", "London", "San Francisco"]:
        queries.append((f"best {industry} in {city}", "Geographic", "geo_recommendations"))

    rows = "\n".join(
        f"| {i+1} | {q} | {cat} | `{tool}` |"
        for i, (q, cat, tool) in enumerate(queries)
    )
    cats = ["Discovery", "Comparison", "Reputation", "Knowledge", "Use-Case", "Geographic"]
    counts = "\n".join(
        f"- **{c}**: {sum(1 for _, cat, _ in queries if cat == c)} queries"
        for c in cats
    )

    return f"""# AI Audit Queries — {brand}
*Generated {_today()} · Newtation MCP · {len(queries)} queries generated*

## Generated Query Set

| # | Query | Category | Best Newtation Tool |
|---|-------|----------|---------------------|
{rows}

## Summary by Category
{counts}

## Your Task
Using the {len(queries)} generated queries above:
1. **Prioritize** the top 10 most relevant to {brand}'s business goals
2. **Test each** in ChatGPT, Claude, Perplexity, and Gemini
3. **Record results**: Was {brand} mentioned? Position? Tone? Who appeared instead?
4. **Identify patterns**: Which categories are strongest/weakest?
5. **Run deeper analysis**: Use the "Best Newtation Tool" column for follow-up

## Testing Protocol
- [ ] Test top 10 queries across all 4 major AI models
- [ ] Score each: mentioned favorably | mentioned weakly | not mentioned | competitor mentioned instead
- [ ] Screenshot or record each response as a baseline
- [ ] Re-test in 30 days after implementing fixes
- [ ] Focus content strategy on queries where {brand} is absent or weak

## Next Steps by Result
- **Not mentioned at all** → Run `content_strategy_generator` for those topics
- **Mentioned but weak** → Run `prompt_vulnerability_scan` with those queries
- **Competitor dominates** → Run `competitor_gap_analysis` on those topics
- **Mentioned favorably** → Protect with `citation_check` to maintain position"""


def handle_hallucination_check(args: dict) -> str:
    brand = args["brand_name"]
    response = args["ai_response"]
    facts = args.get("known_facts", [])
    fact_section = (
        "\n".join(f"{i+1}. {f}" for i, f in enumerate(facts))
        if facts
        else "_No known facts provided — use your own knowledge and be explicit about uncertainty._"
    )
    cross_ref = "\nCross-reference each claim against the known facts above." if facts else ""

    return f"""# Hallucination Check — {brand}
*Generated {_today()} · Newtation MCP*

## Your Task
Fact-check the following AI-generated text about **{brand}**. Identify any claims that are false, unverifiable, outdated, or misleading. Be rigorous — hallucinated facts damage brand trust and spread across models.

## AI Response to Verify
> {response}

## Known Facts (Ground Truth)
{fact_section}

## Verification Process

### Step 1: Extract Every Factual Claim
List each factual claim made about {brand} in the response above:
- Company descriptions and categorizations
- Product/service claims
- Founding date, location, team size
- Customer claims, metrics, case studies
- Competitive positioning statements
- Awards, recognition, partnerships

### Step 2: Verify Each Claim
For each extracted claim, assign a status:
- **Verified**: You have strong evidence this is true
- **Likely True**: Consistent with your knowledge, but not fully confirmed
- **Unverifiable**: Not enough information to confirm or deny
- **Likely False**: Contradicts what you know
- **Hallucinated**: Definitely false or fabricated{cross_ref}

### Step 3: Assess Severity
For each problematic claim, rate severity:
- **Critical**: Could cause real harm (wrong product claims, false partnerships, incorrect pricing)
- **Moderate**: Misleading but not directly harmful (inflated descriptions, vague exaggerations)
- **Minor**: Small inaccuracies unlikely to cause damage

## Response Format

| # | Claim | Status | Confidence | Severity | Evidence |
|---|-------|--------|------------|----------|----------|

Then provide:
- **Hallucination rate**: X of Y claims are problematic
- **Overall reliability**: High / Moderate / Low / Unreliable
- **Most dangerous claim**: The single worst hallucination and why it matters
- **Corrected text**: Rewrite the response with all hallucinations fixed
- **Prevention checklist**:
  1. Publish an authoritative About page with explicit, machine-readable facts
  2. Add Organization schema markup with verified attributes
  3. Maintain consistent facts across all web properties
  4. Create a press/media page with verified milestones and stats
  5. Run `schema_markup_generator` to create machine-readable identity
  6. Re-run this check monthly to catch new hallucinations"""


def handle_schema_markup_generator(args: dict) -> str:
    brand = args["brand_name"]
    url = args["url"]
    description = args["description"]
    schema_type = args.get("type", "Organization")
    year = args.get("founding_year")
    founders = args.get("founders", [])
    socials = args.get("social_urls", [])

    org = {
        "@context": "https://schema.org",
        "@type": schema_type,
        "@id": f"{url}/#organization",
        "name": brand,
        "url": url,
        "description": description[:300],
        "logo": {"@type": "ImageObject", "url": f"{url}/logo.png"},
    }
    if year:
        org["foundingDate"] = year
    if founders:
        org["founder"] = [{"@type": "Person", "name": f} for f in founders]
    if socials:
        org["sameAs"] = socials

    site = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": brand,
        "url": url,
        "publisher": {"@id": f"{url}/#organization"},
    }

    breadcrumb = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": url},
            {"@type": "ListItem", "position": 2, "name": "TODO: Primary Category", "item": f"{url}/TODO"},
        ],
    }

    org_json = json.dumps(org, indent=2)
    site_json = json.dumps(site, indent=2)
    bc_json = json.dumps(breadcrumb, indent=2)
    desc_escaped = description.replace('"', '\\"')

    year_note = "" if year else " Add `foundingDate` if known."
    social_note = "" if socials else " Add `sameAs` with social profile URLs."

    return f"""# Schema Markup — {brand}
*Generated {_today()} · Newtation MCP*

Paste-ready JSON-LD for your website's `<head>`. Generated from your inputs — review, customize, and deploy.

---

## 1. Organization Schema

```html
<script type="application/ld+json">
{org_json}
</script>
```

**Review**: Replace `logo.png` with your actual logo path.{year_note}{social_note}

---

## 2. WebSite Schema

```html
<script type="application/ld+json">
{site_json}
</script>
```

---

## 3. BreadcrumbList Schema

```html
<script type="application/ld+json">
{bc_json}
</script>
```

**Review**: Replace the `TODO` values with your actual primary service category and URL.

---

## 4. FAQ Schema (Generate This Next)

### Your Task
Generate a FAQPage schema block with 5-8 Q&A entries for **{brand}**. Use this starter:

```html
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {{
      "@type": "Question",
      "name": "What does {brand} do?",
      "acceptedAnswer": {{
        "@type": "Answer",
        "text": "{desc_escaped}"
      }}
    }}
  ]
}}
</script>
```

Add 4-7 more Q&A pairs covering:
- Who is {brand} for? (target audience)
- How is {brand} different from competitors?
- How does {brand} work?
- What does {brand} cost?
- How do I get started with {brand}?

Each answer should be factual and specific — AI models extract FAQ content for training data.

---

## Validation Checklist
- [ ] Paste each block into [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Validate at [Schema.org Validator](https://validator.schema.org/)
- [ ] Replace `logo.png` with actual logo path
- [ ] Replace all `TODO:` placeholders
- [ ] Verify all URLs are correct and live
- [ ] Deploy to every page's `<head>` (at minimum: homepage)
- [ ] Request re-indexing via Google Search Console

## Why This Matters
Schema markup is the most direct way to tell AI models who you are:
- **Organization schema** creates a canonical machine-readable identity
- **FAQ schema** feeds directly into AI training pipelines and featured snippets
- **WebSite schema** establishes your domain as an authoritative source
- This is the single highest-ROI technical fix for AI visibility"""


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
    "generate_audit_queries": handle_generate_audit_queries,
    "hallucination_check": handle_hallucination_check,
    "schema_markup_generator": handle_schema_markup_generator,
}

def call_tool(name: str, args: dict) -> str:
    handler = HANDLERS.get(name)
    if not handler:
        raise ValueError(f"Unknown tool: {name}")
    return handler(args)

# ─── MCP Prompt Templates ──────────────────────────────────────────────────────

PROMPTS = [
    {
        "name": "full_brand_audit",
        "description": "Run a comprehensive AI presence audit across all dimensions — perception, entity clarity, citations, competitive position, and more",
        "arguments": [
            {"name": "brand_name", "description": "Brand name to audit", "required": True},
            {"name": "industry", "description": "Industry or category", "required": True},
            {"name": "website", "description": "Brand website URL", "required": False},
            {"name": "competitors", "description": "Comma-separated competitor names", "required": False},
        ],
    },
    {
        "name": "quick_health_check",
        "description": "Fast 2-tool check to see how visible your brand is in AI — perfect for a first look",
        "arguments": [
            {"name": "brand_name", "description": "Brand name", "required": True},
            {"name": "industry", "description": "Industry", "required": True},
        ],
    },
    {
        "name": "competitive_deep_dive",
        "description": "Head-to-head competitive analysis — find where you're losing AI mindshare and how to win it back",
        "arguments": [
            {"name": "brand_name", "description": "Your brand name", "required": True},
            {"name": "competitors", "description": "Comma-separated competitor names", "required": True},
            {"name": "industry", "description": "Industry or category", "required": True},
        ],
    },
    {
        "name": "fix_my_ai_presence",
        "description": "Get actionable fixes you can deploy this week — schema markup, content plan, and hallucination cleanup",
        "arguments": [
            {"name": "brand_name", "description": "Brand name", "required": True},
            {"name": "url", "description": "Brand website URL", "required": True},
            {"name": "description", "description": "What your brand does (1-2 sentences)", "required": True},
        ],
    },
]

def _prompt_full_brand_audit(args: dict) -> dict:
    brand = args.get("brand_name", "")
    industry = args.get("industry", "")
    website = args.get("website", "")
    competitors = args.get("competitors", "")
    parts = [
        f'Run a comprehensive AI presence audit for "{brand}" in {industry}{f" ({website})" if website else ""}.',
        f"Compare against: {competitors}." if competitors else "",
        "",
        "Run these tools in order, analyzing the results of each before proceeding:",
        "1. `ai_readiness_scorecard` — get the overall picture",
        "2. `entity_clarity_score` — check if AI knows who we are",
        "3. `brand_perception_audit` — detailed perception analysis",
        "4. `citation_check` with 5 key industry topics",
        "5. `generate_audit_queries` — create a visibility testing plan",
        "",
        "After all tools complete, provide an executive summary with: overall grade, top 3 critical findings, and a 30-day action plan.",
    ]
    return {"messages": [{"role": "user", "content": {"type": "text", "text": "\n".join(p for p in parts if p or p == "")}}]}

def _prompt_quick_health_check(args: dict) -> dict:
    brand = args.get("brand_name", "")
    industry = args.get("industry", "")
    return {
        "messages": [{
            "role": "user",
            "content": {
                "type": "text",
                "text": f'Quick AI health check for "{brand}" in {industry}.\n\nRun `entity_clarity_score` and `brand_perception_audit`, then give me a 1-paragraph summary: how visible is my brand in AI, and what\'s the single most important thing to fix?',
            },
        }],
    }

def _prompt_competitive_deep_dive(args: dict) -> dict:
    brand = args.get("brand_name", "")
    competitors = args.get("competitors", "")
    industry = args.get("industry", "")
    return {
        "messages": [{
            "role": "user",
            "content": {
                "type": "text",
                "text": "\n".join([
                    f'Deep competitive analysis: "{brand}" vs {competitors} in {industry}.',
                    "",
                    "1. Run `competitor_comparison` to see who's winning AI mindshare",
                    "2. Run `competitor_gap_analysis` with 5 key industry topics",
                    "3. Run `generate_audit_queries` with the competitor names",
                    "",
                    "Synthesize into: who's the AI visibility leader, where are we losing, and what's the fastest way to close the gap.",
                ]),
            },
        }],
    }

def _prompt_fix_my_ai_presence(args: dict) -> dict:
    brand = args.get("brand_name", "")
    url = args.get("url", "")
    description = args.get("description", "")
    return {
        "messages": [{
            "role": "user",
            "content": {
                "type": "text",
                "text": "\n".join([
                    f'I need to fix "{brand}"\'s AI presence. Website: {url}. We are: {description}',
                    "",
                    "1. Run `entity_clarity_score` with my description",
                    "2. Run `hallucination_check` — ask yourself what you know about my brand, then verify it",
                    "3. Run `schema_markup_generator` to generate paste-ready JSON-LD",
                    "4. Run `content_strategy_generator` based on any weak areas found",
                    "",
                    "Give me a prioritized fix list I can execute this week, starting with the schema markup code.",
                ]),
            },
        }],
    }

PROMPT_HANDLERS = {
    "full_brand_audit": _prompt_full_brand_audit,
    "quick_health_check": _prompt_quick_health_check,
    "competitive_deep_dive": _prompt_competitive_deep_dive,
    "fix_my_ai_presence": _prompt_fix_my_ai_presence,
}

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
            "capabilities": {"tools": {}, "prompts": {}},
            "serverInfo": {
                "name": "newtation-mcp",
                "version": "2.0.0",
                "description": "AI brand presence auditing tools by Newtation — 15 tools + 4 prompt workflows"
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

    if method == "prompts/list":
        return ok_response(req_id, {"prompts": PROMPTS})

    if method == "prompts/get":
        params = msg.get("params", {})
        prompt_name = params.get("name", "")
        prompt_args = params.get("arguments", {})
        prompt_handler = PROMPT_HANDLERS.get(prompt_name)
        if not prompt_handler:
            return error_response(req_id, -32602, f"Unknown prompt: {prompt_name}")
        try:
            result = prompt_handler(prompt_args)
            return ok_response(req_id, result)
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
