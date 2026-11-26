# AI SEO fix playbook

Background for explaining findings and fixes. Keep explanations short in the report.

## Crawler access

- **Search bots vs training bots.** OAI-SearchBot (ChatGPT search), Claude-SearchBot, PerplexityBot, Googlebot and Bingbot decide whether a site can appear and be cited in AI answers now. GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, meta-externalagent and CCBot decide whether future models learn from the site. Blocking a training bot doesn't remove the site from AI search.
- **"-User" bots** (ChatGPT-User, Claude-User, Perplexity-User) fetch a page when a person asks the assistant to read it. Blocking them breaks "summarize this page" requests.
- **How robots.txt groups work.** A crawler that has its own `User-agent` group ignores the `*` group entirely. Adding `User-agent: OAI-SearchBot` + `Allow: /` overrides a blanket `Disallow: /` under `*`.
- **Firewalls and CDNs.** Many CDNs offer one-click AI bot blocking (for example Cloudflare's "Block AI bots" and AI Crawl Control). These block at the network level, so robots.txt can say "allowed" while the bot still gets a 403. Check the CDN's bot settings.
- **robots.txt errors.** If robots.txt returns a 5xx error or can't be reached, crawlers treat the whole site as blocked. A 404 means "no rules".

## Readability

- Most AI crawlers fetch raw HTML and don't run JavaScript. Pages built entirely in the browser (React, Vue or Angular single-page apps without server rendering) can look empty to them.
- The fix is server-side rendering or static pre-rendering. To check, view the page source (not the browser inspector) and confirm the main text is in it.

## Understanding (entity clarity)

- **Organization schema** on the homepage states the brand name, URL, logo and description in a machine-readable way. `sameAs` links to official profiles (LinkedIn, Crunchbase, Wikipedia, Wikidata, X, YouTube) help AI connect mentions across the web to one entity.
- Use the same brand name and one-line description everywhere: site, profiles and directories.
- **FAQPage schema** belongs only on pages that visibly show those questions and answers.

## Content AI can quote

- Lead sections with a direct answer to the question the heading asks, then the detail.
- Use specific facts: numbers, dates, named customers and sources. Vague marketing copy gives AI nothing to cite.
- Use clear headings phrased like the questions people ask, short paragraphs, and lists and tables for comparisons.
- Keep key facts (pricing, founding date, headquarters, product list) on crawlable pages, so AI answers can be checked against them.

## llms.txt

- A Markdown file at `/llms.txt` that lists a site's key pages for AI agents (llmstxt.org). It's cheap to add and helps some agent tools, but most major AI engines don't use it yet. Present it as a low-priority extra.
