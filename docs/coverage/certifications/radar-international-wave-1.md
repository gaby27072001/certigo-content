# Vague internationale Radar (Lot 1 — 2026-10-21)

Ce document décrit le premier lot de pistes internationales issues du Radar mondial des 35 fournisseurs (`config/content-radar-sources.json`).

## 1. Pistes livrées dans le catalogue runtime (`content/public/catalog/certifications.json`)

Conformément à la règle « expand before use » (`config/backend-accepted-schemas/`), les sept certifications officielles hébergées sur `learn.microsoft.com` sont activées de bout en bout (catalogue, matrice de couverture `in-progress` couvrant 100 % des domaines, 37 paires v3 équilibrées en position et en rang de longueur, ressources runtime `track`/`domain`/`concept`) :

- `microsoft:ai-103` — **Microsoft Certified: Azure AI Apps and Agents Developer Associate** (`AI-103`, successeur actif d'`AI-102` retiré le 30 juin 2026)
- `microsoft:dp-600` — **Microsoft Certified: Fabric Analytics Engineer Associate** (`DP-600`)
- `microsoft:gh-100` — **Microsoft Certified: GitHub Administration** (`GH-100`)
- `microsoft:gh-200` — **Microsoft Certified: GitHub Actions** (`GH-200`)
- `microsoft:gh-300` — **Microsoft Certified: GitHub Copilot** (`GH-300`)
- `microsoft:gh-500` — **Microsoft Certified: GitHub Advanced Security** (`GH-500`)
- `microsoft:gh-900` — **Microsoft Certified: GitHub Foundations** (`GH-900`)
- `microsoft:m365-copilot` — **CertiGo Pro: Microsoft 365 Copilot, Cowork, Bureautique & Agents** (`MS-4004`)

## 2. Pistes internationales multi-fournisseurs du Radar (`config/content-radar-tracks.json`)

Les treize pistes phares internationales vérifiées `HTTP 200` au `2026-10-21` (`reviewDueOn: 2026-11-20`) sur leurs domaines officiels respectifs sont cataloguées et validées par `node tools/validate_catalog.mjs` et `node tools/check_content_radar.mjs` :

- `anthropic:claude-code-mcp` (`https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview`)
- `anthropic:claude-human-agent-teams` (`https://academy.claude.com/courses/building-effective-human-agent-teams`)
- `apple:apple-device-support` (`https://training.apple.com/it`)
- `comptia:security-plus-sy0-701` (`https://www.comptia.org/en-us/certifications/security/`)
- `databricks:genai-engineer-associate` (`https://www.databricks.com/learn/certification/genai-engineer-associate`)
- `github:gh-300` (`https://learn.github.com/certifications` -> pont `microsoft:gh-300`)
- `harvey:legal-ai-platform` (`https://www.harvey.ai/`)
- `hashicorp:terraform-associate-004` (`https://developer.hashicorp.com/certifications/terraform-associate`)
- `linux-foundation-cncf:cka` (`https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/`)
- `microsoft:m365-copilot` (`https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-overview` -> pont `microsoft:m365-copilot`)
- `openai:academy-ai-foundations` (`https://academy.openai.com/pages/courses`)
- `openai:chatgpt-codex-agents` (`https://openai.com/index/introducing-codex/`)
- `snowflake:snowpro-core-cof-c03` (`https://learn.snowflake.com/en/certifications/snowpro-core-c03/`)

## 3. Parcours pédagogiques complets CertiGo (`editorial/tracks/` & `content/answerKey/editorial/tracks/`)

Les quatre parcours phares d'IA générative et métier (12 unités, 32 leçons, 32 Cartes Déclic, 96 micro-slides, 12 schémas d'architecture et 64 questions/solutions séparées public/privé) sont validés par `npm run editorial:validate` :

- `editorial/tracks/m365-copilot-agents.json` — **CertiGo Pro : Microsoft 365 Copilot, Cowork, Bureautique (Word, PowerPoint, Excel, Teams/Outlook) & Agents**
- `editorial/tracks/openai-chatgpt-codex.json` — **CertiGo Pro : OpenAI (ChatGPT Enterprise, Codex, Deep Research, Responses API & Agents SDK)**
- `editorial/tracks/anthropic-claude-mcp.json` — **CertiGo Pro : Anthropic (Claude, Artifacts, Projects, Claude Code & Model Context Protocol MCP)**
- `editorial/tracks/harvey-legal-ai.json` — **CertiGo Pro : Harvey — Plateforme Legal IA (Assistant, Vault, Knowledge & Workflows Juridiques)**
