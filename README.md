# Newtation AI Presence MCP Server

> Monitor how AI systems perceive, describe, and cite your brand — directly inside **Claude Code**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.8+](https://img.shields.io/badge/Python-3.8%2B-blue)](https://python.org)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-green)](https://modelcontextprotocol.io)

---

## What It Does

This MCP server gives Claude 5 brand intelligence tools to audit your AI presence:

| Tool | What it answers |
|------|----------------|
| `brand_perception_audit` | How does AI describe my brand right now? |
| `citation_check` | Is AI citing my brand as a source? |
| `competitor_comparison` | Who's winning AI mindshare in my category? |
| `entity_clarity_score` | How clearly does AI understand what I do? |
| `geo_recommendations` | Does AI recommend me in my target cities? |

---

## Requirements

- Python 3.8 or higher (no other dependencies — stdlib only)
- [Claude Code](https://claude.ai/code) CLI installed

---

## Install in 2 Steps

### Step 1 — Clone this repo

```bash
git clone https://github.com/Elactrac/newtation-mcp.git
cd newtation-mcp
```

### Step 2 — Add to Claude Code

```bash
claude mcp add newtation -- python3 $(pwd)/server.py
```

That's it. Restart Claude Code and the tools are available.

---

## Usage

Once installed, just ask Claude naturally:

```
Audit my brand "Acme Corp" in the SaaS industry
```

```
Check if Acme Corp is being cited for topics like "project management" and "team collaboration"
```

```
Compare Acme Corp vs Notion and Asana for productivity software
```

```
What's the entity clarity score for Acme Corp? Our tagline is "The easiest way to manage projects"
```

```
Does Acme Corp appear in AI recommendations for project management in New York, London, and Sydney?
```

---

## Verify Installation

Run this to confirm the server is registered:

```bash
claude mcp list
```

You should see `newtation` in the list.

---

## Update

```bash
cd newtation-mcp
git pull
```

No restart needed — Claude Code reloads MCP servers automatically.

---

## Remove

```bash
claude mcp remove newtation
```

---

## License

MIT — free to use, fork, and modify.

---

Built by [Newtation](https://newtationco.app) · AI Presence Management for Modern Brands
