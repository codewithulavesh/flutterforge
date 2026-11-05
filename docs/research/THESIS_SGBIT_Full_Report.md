# VISVESVARAYA TECHNOLOGICAL UNIVERSITY — PROJECT REPORT
## S. G. Balekundri Institute of Technology, Belagavi

# FRONT PAGE

**A Project Report on**
## FlutterForge: A Coordinated Multi-Agent LangGraph System for Functional Flutter and Supabase Code Generation

**Submitted in partial fulfillment of the requirements for the award of the degree of Bachelor of Engineering in Computer Science and Engineering**

**By**
1. Ms. Shradha Takkekar — USN: 2BU23CS135
2. Ms. Srushti Churamari — USN: 2BU23CS150
3. Ms. Vijeta Kotnikallamath — USN: 2BU23CS175
4. Mr. Ulavayya Karaguppi — USN: 2BU24CS419

**Under the Guidance of Mrs. Sahana Bisalapur**

**Batch No: 26 — AY: 2026–2027**

Department of Computer Science and Engineering,
S. G. Balekundri Institute of Technology, Belagavi.

---

# CERTIFICATE

This is to certify that the project work entitled **“FlutterForge: A Coordinated Multi-Agent LangGraph System for Functional Flutter and Supabase Code Generation”** is a bonafide work carried out by **Ms. Shradha Takkekar (2BU23CS135), Ms. Srushti Churamari (2BU23CS150), Ms. Vijeta Kotnikallamath (2BU23CS175), Mr. Ulavayya Karaguppi (2BU24CS419)** in partial fulfillment of the requirements for the award of the degree of Bachelor of Engineering in Computer Science and Engineering of Visvesvaraya Technological University, Belagavi, during the academic year 2026–2027. It is certified that all corrections/suggestions indicated for the internal assessment have been incorporated in the report. The project report has been approved as it satisfies the academic requirements.

| | |
|---|---|
| **Signature of the Guide** (Mrs. Sahana Bisalapur) | **Signature of the HOD** |
| **Signature of the Principal** | **External Examiner** |

---

# DECLARATION

We hereby declare that the project work entitled **“FlutterForge: A Coordinated Multi-Agent LangGraph System for Functional Flutter and Supabase Code Generation”** submitted to S. G. Balekundri Institute of Technology, Belagavi, in partial fulfillment of the requirements for the award of the degree of Bachelor of Engineering in Computer Science and Engineering, is an original work carried out by us under the guidance of the project guide. We further declare that this work has not been submitted elsewhere for the award of any degree or diploma.

1. Ms. Shradha Takkekar — USN: 2BU23CS135
2. Ms. Srushti Churamari — USN: 2BU23CS150
3. Ms. Vijeta Kotnikallamath — USN: 2BU23CS175
4. Mr. Ulavayya Karaguppi — USN: 2BU24CS419

Place: Belagavi — Date: ___________ — Signatures: ___________

---

# ACKNOWLEDGEMENT

We express our sincere gratitude to the Principal, S. G. Balekundri Institute of Technology, Belagavi, and the Head of the Department of Computer Science and Engineering for providing the facilities and encouragement needed to carry out this project. We are deeply indebted to our project guide, **Mrs. Sahana Bisalapur**, for constant guidance, rigorous reviews, and insistence on measured evidence over bare claims, which shaped both the system and this report. We thank the faculty members and technical staff of the department for their suggestions on architecture, testing, and documentation. We thank our team members for shared ownership of design, implementation, evaluation, and writing. Finally, we thank our parents and guardians for their patience and support throughout the academic year 2026–2027.

---

# ABSTRACT

Building a mobile application still takes weeks of expert effort: multi-file project structure, null-safe Dart, declarative routing, reactive state management, and a backend with authentication, row-level security, and realtime subscriptions must all stay consistent. Single-pass large language models truncate files, invent imports, omit entry files, or leave placeholder stubs, and naive multi-agent pipelines lose files, race on shared context, or drown small patches in full-project rewrites. This project presents FlutterForge, a coordinated multi-agent system that converts a free-form prompt into a working Flutter + Supabase application (MVP-quality prototype). A Python LangGraph StateGraph of 11 nodes and six specialist agents (Supervisor, Architect, Code Generator, QA/Healer, Patch, Chat) shares one typed state, routes through conditional edges, fans out file synthesis in parallel via the Send API, and merges deterministically with reducer-based fan-in. A FastAPI server streams every token and node event over Server-Sent Events, SQLite checkpoints persist resumable state, and Supabase stores projects, files, versions, conversations, and retrieval patterns. The React + Vite frontend adds workspace editing, live preview, and a TypeScript fallback agent. Five orchestration defects were found and fixed with before/after measurement: domain racing, routing duality, payload bloat (−101,340 bytes over 5 batches), merge flooding (19→4 files), and healing-flag bypass. The 31-file fallback output (1,730 lines) passes `flutter analyze` with zero issues and a release web build in 32.4 s. Compared with market freelance rates, one MVP drops from about ₹9,00,000 and 8–12 weeks to about ₹4,000 of review effort in 2 hours on free-tier models.

**Keywords:** Multi-Agent Systems, LangGraph, Flutter Code Generation, Supabase, Retrieval-Augmented Generation.

---

# TABLE OF CONTENTS

Generate in Word: References → Table of Contents → Automatic Table (Heading 1/2/3). Expected entries: Front Page, Certificate, Declaration, Acknowledgement, Abstract, Lists (Figures/Tables/Abbreviations), Chapters 1–8, References, Appendices A–F.

# LIST OF FIGURES

| No. | Caption | Status |
|---|---|---|
| 4.1 | System architecture (frontend → FastAPI/SSE → LangGraph → Supabase/preview) | Draw from §4.1 ASCII |
| 4.2 | LangGraph node flow (classify → parallel_init → supervisor → chat/patch/plan→batches → merge → validate ⇄ heal → embed) | Draw from §4.1 |
| 4.3 | Use-case diagram (Developer, Guide/Reviewer, End-user, OpenRouter, Supabase) | Draw from §4.3 |
| 4.4 | Data-flow diagram (prompt → state → batches → files → validation → preview) | Draw from §4.4 |
| 4.5 | ER diagram (12 tables, §4.6) | Draw from §4.6 |
| 4.7 | Agent swimlane (11 agents, §4.9) | Draw from §4.9 ASCII |
| 5.1–5.4 | Screenshots: prompt→generation, file explorer + Monaco, preview web build, validation event | Capture during demo |

# LIST OF TABLES

| No. | Caption |
|---|---|
| 2.1 | Comparative analysis of related approaches |
| 3.1 | Functional requirements (FR1–FR8) |
| 3.2 | Software requirements (measured versions) |
| 4.1 | LangGraph nodes and agent roles (11) |
| 4.2 | Supabase tables (12) |
| 4.3 | Hyperparameters |
| 4.4 | 11 agents coordination (reads/writes/LLM/time) |
| 5.1 | Backend modules and responsibilities (22 files) |
| 6.1 | Test cases TC01–TC23 (23/23 pass) |
| 6.2 | Pipeline micro-benchmarks (n=20) |
| 7.1 | Before/after coordination metrics |
| 7.2 | Product-quality results (analyze/build/validator/completeness) |
| 7.3 | 10 key numbers (have vs miss) |
| 7.4 | INR cost: 44.5 h scope (Table A) |
| 7.5 | INR cost: 300 h market scope (Table B) |
| 7.6 | Freelancer vs FlutterForge, 1 app (Table VII) |
| 7.7 | BYOK model matrix (Table VIII) |
| C.1 | Team contribution (Appendix C) |

# LIST OF ABBREVIATIONS

| Abbreviation | Meaning |
|---|---|
| AI | Artificial Intelligence |
| ML | Machine Learning |
| API | Application Programming Interface |
| DB | Database |
| UI | User Interface |
| CSE | Computer Science and Engineering |
| LLM | Large Language Model |
| RAG | Retrieval-Augmented Generation |
| SSE | Server-Sent Events |
| RLS | Row-Level Security |
| MVP | Minimum Viable Product |
| LOC | Lines of Code |
| BYOK | Bring Your Own Key |
| RQ | Research Question |

---

# CHAPTER 1 – INTRODUCTION

## 1.1 Background

Cross-platform mobile development with Flutter plus a Supabase backend (Postgres, Auth, Storage, pgvector) is the default low-cost route for startups: one Dart codebase ships iOS, Android, and web. A real app, however, is 20–30 files — entry point, theme, router with auth guards, services, providers, screens with loading/error/empty states, models, migrations with RLS, and seed data — all cross-consistent. Optimistic industry reports price such an MVP at $4,000–$8,000 and 10–14 weeks in India, $36,000–$75,000 in the US. Single-pass LLMs cannot hold this structure: they truncate, invent imports, drop `pubspec.yaml`/`main.dart`, or emit `TODO` stubs.

## 1.2 Problem Statement

How to convert a free-form natural-language prompt into a complete, consistent, statically-validated Flutter + Supabase codebase — with planning, parallel synthesis, validation, repair, and live progress — without losing files, diverging routes, racing on shared context, or drowning small edits in full rewrites, and at near-zero marginal cost?

## 1.3 Motivation

Freelancer headline rates ($15–$250/h across regions in 2026) hide 1.4–1.8× true cost after churn and rework, and sub-$5k freelance app engagements fail over 60% of the time for production-grade scope (sources in §7). A coordinated agent system that drafts analyzer-clean, buildable MVPs in ~2 hours of supervised effort shifts cost from implementation to review, which is the economic core of this project.

## 1.4 Objectives

1. Build an 11-node LangGraph StateGraph with six specialist agents and reducer-safe parallel fan-in/out (compile 11/11, 23/23 component tests pass).
2. Keep deterministic gates under ~5 ms (routing ~0.1 ms, validation ~1.6 ms) with zero-LLM fast paths.
3. Reach 100% fallback-plan completeness (21/21) with `flutter analyze` 0/0/0 and a passing release web build.
4. Demonstrate coordination fixes with before/after numbers (domain, routing, −101 KB Send waste, merge 19→4, healing gate).
5. Show 1-app economics in INR: ≥90% dev-cost and time reduction vs market baselines under stated assumptions.
6. Document honestly every unmeasured claim (live-LLM quality, baselines, load, human ratings) with protocols.

## 1.5 Scope of the Project

Included: prompt→plan→parallel-generate→merge→validate→heal→persist→stream→preview pipeline; chat and incremental-edit paths; deterministic fallback templates; SSE observability; SQLite checkpoints; Supabase persistence; React workspace; measurement of deterministic paths. Excluded (manual/stated): store-release hardening, security audit, scale/load certification, RLS runtime enforcement tests, UI human-fidelity ratings, multi-user isolation.

## 1.6 Project Contributions

1. Coordinated StateGraph design (single-source `supervisor_decision`, minimal Send payloads, incremental-safe merge, healing-flag enforcement, `max_concurrency: 3`, real `duration_ms`, honest checkpoint delete).
2. Validator hardening (wrapper-aware Supabase check; postfix-`!`-only regex eliminating 3 logical-not false positives).
3. Template completion (19→31 files, 12 added; CardThemeData, withValues, publishableKey migrations) reaching analyze-zero + release-build pass.
4. Full measurement suite: 23 component tests, n=20 micro-benchmarks, injected-error validator trials, flutter verification, INR cost models, freelancer comparison, BYOK matrix.
5. Complete documentation set: IEEE draft, bachelor paper, master data dump, measurement matrix, per-file guide, and this thesis.

## 1.7 Organization of the Report

Chapter 2 surveys related work and the gap; Chapter 3 specifies requirements and feasibility; Chapter 4 designs architecture, modules, use cases, data flow, database, UI, and algorithms; Chapter 5 details implementation; Chapter 6 tests and validates against objectives; Chapter 7 presents results, baseline comparison, and discussion; Chapter 8 concludes with limitations and future scope. Appendices cover installation, repository, team contribution, plagiarism, publication, and events.

---

# CHAPTER 2 – LITERATURE SURVEY / RELATED WORK

## 2.1 Introduction

The survey covers (a) multi-agent code-generation frameworks, (b) repository-level RAG, and (c) mobile-app generation benchmarks, to position a Flutter-specific coordinated pipeline.

## 2.2 Existing Systems / Approaches

Single LLMs vs role-teams [1]; knowledge-guided planning→coding→testing loops with compile/coverage gates [2]; self-reflective pruning of intermediate outputs [3]; per-stage model routing over complementary strengths [4]; dual graph-guided repo retrieval [5]; RL retrievers without labels [12]; component-wise evidence that retriever choice outweighs generator choice with BM25 robust [13]; RAG surveys [11]; UI multi-agent decomposition and visual-optimization refinement [9],[14]; mobile benchmarks showing 12–18.8% full-app success ceilings [6],[10]; standardized mobile-generation methodology with incomplete features [7]; project-level multi-screen benchmark [8].

## 2.3 Review of Research Papers / Products

We read each of the following not as names to cite but as designs to learn from; every paragraph below ends with what we borrowed — or deliberately did not borrow.

**[1] Idrisov et al., ICNLP 2025 — single LLMs vs multi-agent teams.** Compared one model against role-assigned teams (mathematician, engineer, developer, executor) on Python tasks across difficulty levels, scoring lines of code, complexity, runtime, memory, and maintainability. Only 46% of generated programs were correct; teams helped but detailed role descriptions did not consistently help. *Borrowed:* role separation with light prompts; *rejected:* heavy role prose.

**[2] Yang et al., ACM TOSEM 2025 — KGMACG.** Three agents (planning, coding, testing) close the loop until the project compiles with ≥95% requirement coverage, guided by a five-pillar knowledge base, evaluated on e-commerce, campus-security, and trading systems. *Borrowed:* the plan→generate→test→heal loop shape; *differed:* we gate on validation instead of coverage percentage.

**[3] Pan et al., 2025 — CodeCoR.** Four agents (prompt, code, test, repair) each emit multiple candidates and prune the weak ones before downstream use, reaching 77.13% average Pass@1. *Borrowed:* the prune-before-propagate principle behind our deterministic-first healing.

**[4] Chen et al., 2025 — PerfOrch.** Decomposes generation into categorize/generate/debug/refine agents, each consulting a memory matrix of which model is best per language and problem type; 97.19% and 95.83% on two benchmarks at roughly half the token cost of exhaustive multi-model tries. *Borrowed:* fallback-chain thinking; *differed:* we rotate on failure rather than routing per stage — a future upgrade.

**[5] Zhao et al., 2025 — GraphCodeAgent.** Builds requirement and code graphs so retrieval finds implicitly-needed snippets (invoked APIs, multi-hop relations), gaining ~44% on repo benchmarks. *Lesson:* our keyword retrieval is the weakest link; graphs are the honest future work.

**[6] APPFORGE, ICLR 2026.** 101 real Android apps as a from-scratch benchmark; the best flagship model completes only ~18.8% functionally, and over half of correct apps still crash at runtime. *Borrowed:* the humbling ceiling that justifies our template reliability floor.

**[7] Niemiec et al., MOBILESoft 2026.** A platform-independent three-stage method (describe → generate → evaluate) producing compilable, crash-free apps with incomplete features. *Closest cousin:* our methodology mirrors theirs; we add parallel batches and healing.

**[8] MobileForge, 2026.** Multi-screen project-level benchmark across build, navigation, visual fidelity, maintainability, and efficiency; models compile but navigate unreliably. *Lesson:* our navigation claims stay unmeasured until we adopt such tests.

**[9] UIOrchestra, EMNLP Findings 2025.** Layout-description, code-generation, and difference-analysis agents collaborate on mobile UI reconstruction, beating single models. *Borrowed:* decomposition for UI; our screens carry the same loading/error/empty discipline.

**[10] SWE-Bench Mobile, 2026.** Fifty industry iOS tasks with PRDs and Figma inputs: best configuration 12%, same model varying 6× across agent scaffolds, simple prompts beating complex ones. *Borrowed:* the central thesis of our §7 — scaffolding dominates model choice.

**[11] RACG survey, 2025.** Repository-level retrieval taxonomy across strategies, training, agents, and benchmarks. *Used as:* our map for positioning keyword retrieval honestly.

**[12] RLCoder, ICSE 2025.** Reinforcement-learned retriever improving repo completion ~12% without labels, plus a stop-retrieving signal. *Future work pointer:* learning when *not* to retrieve.

**[13] Ke et al., FSE 2026.** Component-wise study over 21 models/methods: retriever-side choices move results more than generator choice; classic BM25 is remarkably robust. *Borrowed:* confidence in our lexical fallback and the "retriever first" discussion.

**[14] UI2Code-N, 2025.** Reformulates UI-to-code as iterative visual optimization with relative-preference RL; a 9B model beats larger ones. *Lesson:* iteration with rendered feedback beats single-pass scale — the same argument as our heal loop.

**[15] LangChain AI, 2025 — LangGraph.** The stateful orchestration substrate (StateGraph, Send, checkpointers) this system is built on. *Used as:* infrastructure, cited as tooling rather than prior art.

**Products.** Lovable and v0 target web React, not Flutter, and publish no Flutter quality numbers; GitHub Copilot completes snippets without multi-file orchestration, validation, or healing. None offers BYOK free-tier Flutter synthesis with checkpoints, which is our niche.

## 2.4 Comparative Analysis

**Table 2.1** — FlutterForge vs related: only end-to-end Flutter+Supabase parallel factory here; KGMACG/CodeCoR/PerfOrch have stronger quality numbers on non-mobile tasks; APPFORGE/SWE-Mobile are benchmarks, not systems; Lovable/v0 lack Flutter; Copilot lacks orchestration/validation/healing. FlutterForge leads on deterministic cost (ms gates, $0 free tier) and template reliability floor; lags on measured live quality (no pass@k yet).

## 2.5 Research / Technical Gap

No Flutter-specific coordinated system with measured orchestration (race-free RAG sequencing, single-source routing, lossless fan-in, incremental-safe merge), deterministic-first healing, and honest before/after metrics plus INR economics — the gap this project fills.

## 2.6 Summary

Literature supports the design (closed loops, pruning, retriever-first, decomposition) and contextualizes ceilings (12–19% full-app success). The project contributes the Flutter instantiation with fixes and measurements.

---

# CHAPTER 3 – REQUIREMENTS AND SYSTEM ANALYSIS

## 3.1 Proposed System

An 11-node LangGraph backend (FastAPI + SSE + SQLite checkpoints + Supabase) with a React workspace: prompt → intent → domain/RAG → supervisor → chat / patch / plan→parallel-batches → merge → validate ⇄ heal → persist → stream → preview, with a 31-file analyzer-clean fallback and a TypeScript single-pass fallback when the backend is down.

## 3.2 Functional Requirements

**Table 3.1** — Each requirement carries its acceptance test, so Chapter 6 can verdict it directly.

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| FR1 | Prompt-to-plan synthesis | Architect returns strict JSON with screens, services, models, schema, filesToCreate; fallback plan on total failure (21 files, TC13) | ✅ met |
| FR2 | Parallel batch synthesis | Batches [16,2,1]–[16,4,4,4,4,2,1] by plan size; ≤3 concurrent; fence parsing (TC14, TC22) | ✅ met |
| FR3 | Incremental edits | 1-file patch merges to 4 files, untouched content reused (TC16) | ✅ met |
| FR4 | Chat answers | No file mutation; friendly degraded message without key; duration stamped (TC19) | ✅ met |
| FR5 | Validate + bounded heal | 5 checks; ≤3 files × 2 rounds; flag-gated (TC11/12/15/18) | ✅ met |
| FR6 | Supabase persistence | Upsert on (project_id, path); graceful skip without creds (TC20) | ✅ met (degraded tested; live-cred test open) |
| FR7 | SSE streaming (8 types) | Tokens + node/file/merge/validation/chat/done/error; dedupe; done carries counts | ✅ met (contract traced; load test open) |
| FR8 | Checkpoints | Per-project threads; get/resume/delete endpoints; real delete with honest fallback | ✅ met (kill-resume test open) |

## 3.3 Non-Functional Requirements

Deterministic paths <5 ms; analyzer-zero templates; release-buildable output; free-tier $0 default; `max_concurrency: 3`; graceful degradation (empty RAG, no-key chat, template fallback); honest errors (no stubbed success).

## 3.4 Hardware Requirements

Development: 8 GB RAM laptop (verified class), any modern CPU, ~2 GB free (Flutter SDK + containers optional). Inference needs no GPU (API-based). Preview containers need Docker + ~2 GB.

## 3.5 Software Requirements

**Table 3.2** — Python 3.12.14 (≥3.11): langgraph, checkpoint-sqlite, langchain(-core/-openai), fastapi, uvicorn, sse-starlette, dotenv, httpx, pydantic. Node 20, React 18.3.1, Vite 5.4.2, Zustand 5.0.15, Monaco 4.7.0. Flutter 3.47.5 / Dart 3.13.4. Supabase + pgvector. Docker (preview). OpenRouter key (BYOK; free-tier default $0).

## 3.6 Feasibility Analysis

Technical: feasible — all substrates exist; verified by 11/11 compile and release build. Operational: 2-hour supervised flow fits student/lab use. Economic: $0–₹5 per app generation vs ₹9L–45L human baselines (§7). Schedule: completed in AY 2026–27 per batch plan.

## 3.7 User Roles / Actors

Developer (prompts, reviews, previews), Guide/Reviewer (evaluates evidence), End-user (runs generated app), OpenRouter (LLM provider, BYOK), Supabase (Auth/DB/vectors), Docker preview host.

---

# CHAPTER 4 – SYSTEM DESIGN

## 4.1 System Architecture

Our system has three big pieces that talk to each other: the website you see (React), the Python brain in the middle (FastAPI + LangGraph), and the storage layer at the back (SQLite + Supabase + Docker preview). When someone types "build me a fitness app", the words travel from the browser to the backend as one POST request, and then come back as a stream of small live updates — first "understood, this is a fitness app", then "plan ready", then one file after another, then "all checks passed". Nothing on the screen ever freezes, because every agent reports what it is doing while it works.

**Figure 4.1: Overall architecture (redraw in Word with boxes and arrows)**

```
┌──────────────────┐   POST /api/agent/stream    ┌─────────────────────┐
│  BROWSER         │ ───────────────────────────▶ │  FASTAPI (main.py)  │
│  React + Vite    │                              │  SSE fan-out        │
│  Zustand stores  │ ◀─────────────────────────── │  seen_files dedupe  │
│  Monaco editor   │     8 SSE event types        └──────────┬──────────┘
└──────────────────┘                               thread_id=project_id
                                                            │
                                              ┌─────────────▼─────────────┐
                                              │  LANGGRAPH (11 nodes)     │
                                              │  classify → init → super  │
                                              │  → chat / patch / plan→N  │
                                              │  → merge → validate ⇄ heal│
                                              │  → embed → END            │
                                              └────────┬────────┬─────────┘
                                    ┌──────────────────┘        └──────────────────┐
                                    ▼                                              ▼
                        ┌─────────────────────┐                       ┌────────────────────┐
                        │ SUPABASE (12 tables)│                       │ DOCKER PREVIEW   │
                        │ projects, files,    │                       │ builder + Nginx  │
                        │ versions, chats,    │                       │ 15-min sessions  │
                        │ vectors (pgvector)  │                       │ Cloudflare tunnel│
                        └─────────────────────┘                       └────────────────────┘
                                    ▲
                                    │ SQLite checkpoints (agent.db)
                                    │ one thread per project_id
```

**Figure 4.2: LangGraph node flow (redraw as flowchart)**

```
START ─▶ classify_intent ─▶ parallel_init ─▶ supervisor_orchestrate
                                                   │
                    ┌──────────────────────────────┼──────────────────────────────┐
                    ▼                              ▼                              ▼
              chat_answer                    incremental_edit              plan_architecture
                  │                                │                       (Architect LLM)
                  │                                │                              │ Send × N
                  │                                ▼                    (minimal payload,
                  │                          merge_files ◀───────────── max 3 parallel)
                  │                                │
                  │                          validate_code ── errors? ─▶ auto_heal_llm ─┐
                  │                                │ (heal only if flag                │
                  │                                │  on and rounds left)               │
                  │                                ▼                                    │
                  │                         embed_artifacts ◀──────────────────────────┘
                  │                          (persist + timing)
                  ▼                                ▼
                 END                              END
```

How the eleven nodes divide the work is simple to remember: one node listens (classify), two prepare context (analyze + retrieval inside parallel_init), one boss decides (supervisor), three do the real creation (architect, batch workers, patch worker), one collects (merge), two check and repair (validate, healer), one files things away (embed), and one just talks (chat). The two arrows out of validate_code are conditional edges — the only two places where the graph thinks instead of marching straight ahead.

**Figure 4.3: Use-case diagram (actors and goals)**

```
Developer ──► submit prompt ──► watch live progress ──► browse/accept files
   │──► resume interrupted run ──► clear checkpoint ──► preview web build ──► export zip
Guide/Reviewer ──► inspect checkpoints ──► read validation reports ──► verify metrics
End-user ──► run generated Flutter app (login → screens → realtime data)
OpenRouter (external) ◄── LLM calls (plan / batch / heal / chat, BYOK, 6-model fallback)
Supabase (external) ◄── RAG pattern lookup + artifact persistence
```

**Figure 4.4: Data-flow diagram**

```
Level 0:  Developer ──prompt──▶ [FlutterForge] ──app + preview──▶ Developer
                            [FlutterForge] ──tokens/keys──▶ OpenRouter
                            [FlutterForge] ◀──patterns/files──▶ Supabase

Level 1:  prompt → classify (intent) → parallel_init (domain + patterns)
        → supervisor (decision) → plan (AgentPlan JSON) → batches → N× generate
        → merged_files → ValidationReport → healed files → Supabase + SSE → preview
```

**Figure 4.5: ER diagram (12 tables)**

```
auth.users 1──N profiles ──N projects ──N project_files (UNIQUE project_id,path)
                                    ├──N project_versions (snapshot jsonb)
                                    ├──N ai_conversations ──N ai_messages
                                    └──N generation_tasks
code_patterns (domain, category, code, tags, similarity) ──used by── vector_retrieval
project_file_embeddings (project FK, embeddings) ──used by── TS vectorStore
builds / deployments / dependencies (preview + ops)
Generated app DB (inside produced code): auth.users 1──N profiles, 1──N items
(RLS owner-scoped, 3 policies)
```

**Figure 4.6: Sequence of one chat request (degraded path, measured ~8 ms)**

```
Browser → POST /stream {prompt} → main.py (config thread_id + max_concurrency 3)
 → classify (intent=chat, started_at_ms) → parallel_init (domain + 0 patterns)
 → supervisor (decision=chat_answer) → chat_answer (no key → friendly message)
 → 5 agent_events + chat_answer + done{files:0, duration_ms} → Browser renders
```

## 4.1A Complete File Structure of Our Project

Below is the real tree (October 2026; dependency folders, caches, and secrets omitted). We keep it here so any examiner can walk from this page straight into the repository and find everything.

```
abcd-main/                          ← project root
├── agent-backend/                  ← PYTHON BRAIN (FastAPI + LangGraph)
│   ├── main.py                     ← server + 7 endpoints + SSE streaming
│   ├── pyproject.toml              ← 11 backend dependencies + dev tools
│   ├── Dockerfile                  ← backend container
│   ├── .env / .env.example         ← keys (never committed with values)
│   ├── checkpoints/agent.db        ← SQLite threads, one per project_id
│   └── graph/                      ← THE AGENT SYSTEM (22 files, 3,945 LOC)
│       ├── graph.py                ← wiring: 11 nodes, 2 edges, Send fan-out
│       ├── state.py                ← AgentState + 12 sub-types, reducers
│       ├── agents/supervisor.py    ← boss node, 6 role labels
│       ├── edges/routing.py        ← route_supervisor, route_healing
│       ├── nodes/ (11)             ← classify, analyze, vector, plan,
│       │                              generate, patch, merge, validate,
│       │                              heal, embed, chat
│       └── tools/ (5)              ← llm_pool, code_parser, domain_detector,
│                                      validator, flutter_templates (31 files)
├── src/                            ← WEBSITE (React 18 + Vite + TS, 97 files)
│   ├── agent/ (13 files)           ← TS fallback agent mirroring the backend
│   │   ├── langgraphClient.ts      ← SSE client + NODE_TO_STEP/AGENT maps
│   │   ├── index.ts                ← single-pass fallback orchestrator
│   │   └── planner/schemaGenerator/codeGenerator/validator/llmClient/…
│   ├── stores/ (6)                 ← project, preview, auth, terminal, theme, workspace
│   ├── features/                   ← workspace panels, dashboard, auth, landing
│   ├── pages/                      ← Landing, Login, Signup, Dashboard, Workspace
│   └── utils/                      ← flutterTemplates mirror, exportProject, fileTree…
├── supabase/                       ← BACKEND-AS-A-SERVICE
│   ├── full_schema.sql (571 lines, 12 tables)
│   ├── migrations/ (4)              ← schema, sharing, auth trigger, vectors
│   └── functions/                  ← edge functions
├── preview-infra/                  ← DOCKER PREVIEW (builder + Nginx + tunnel)
├── docker-compose.yml + Dockerfile ← one-command stack (:8000 + :5173)
├── vite/eslint/tailwind configs
└── *.md reports                    ← IEEE draft, bachelor paper, master data,
                                       report card, time/cost eval, matrix,
                                       files-and-fixes, combined, this thesis
```

## 4.1B How the System Works, End to End (plain words)

Take a concrete example — someone types *"Build a fitness tracker with login and workout history"*. The browser sends one JSON POST with the prompt, the project id, any existing files, and the last few chat messages. The first node, `classify_intent`, scores the words against four keyword lists; "build" wins, there are no existing files, so intent becomes `build` — in about a tenth of a millisecond, no AI involved. Next `parallel_init` figures out the domain ("fitness") and asks Supabase for up to four proven Flutter patterns for fitness apps; if the database is not configured it simply continues with zero patterns instead of crashing. The supervisor writes one order into the shared state — `supervisor_decision = plan_architecture` — and the edge obeys it without re-thinking. The architect calls the language model and gets back a strict JSON plan: app name, package id, theme colours, tables (say `workouts` with RLS), screens (login, home, history), services, and a full `filesToCreate` list. A small planner chops that list into batches — sixteen structural files first, then auth, then features four at a time, SQL last — and LangGraph fires one `generate_batch` worker per batch, at most three at once so the free API quota survives. Each worker streams Dart code wrapped in `filepath=` fences, a parser pulls the files out, and `merge_files` flattens everything, keeping the last copy of any duplicate and reusing existing project content. QA then runs five cheap regex checks; if it finds real errors and healing is enabled, the healer asks the model to repair at most three files and the loop re-validates, twice at most. Finally the last node saves every file to Supabase, stamps the duration, and the browser's `done` event — carrying the file count — closes a run the user watched file-by-file in real time. If the model key is missing or every call fails, the same pipeline still hands over the 31-file template app, which we proved analyzes with zero issues and builds to the web in about half a minute. That fallback is the quiet hero of the whole project.

## 4.2 Module Design

**Table 4.1** — 11 nodes + supervisor agent + 2 edges + 5 tools (planner, batch worker, patch worker, merger, validator, healer, finalizer, chat; llm_pool, code_parser, domain_detector, validator, flutter_templates). 22 backend files (3,945 LOC), 97 frontend files. Each backend file's exact responsibility is documented in PROJECT_FILES_AND_FIXES.md, Part F of the combined report.

## 4.3 Use Case Diagram

**Figure 4.3:** Developer: submit prompt, watch SSE progress, browse/accept files, resume/clear, preview web build, export zip. System: route, plan, generate, validate/heal, persist. External: OpenRouter (generate), Supabase (retrieve/persist).

## 4.4 Data Flow / Process Flow

**Figure 4.4:** prompt → AgentState → batches → FileArtifacts → merged_files → ValidationReport → (heal loop) → Supabase + SSE → preview. State deltas per node; parallel branches append via reducers.

## 4.5 Class / Component Design

Agents as stateless async functions over shared TypedDict; LLMPool (chain + advance + clamp); parser (fence + `===` fallback); validator (5 checks + auto_heal); templates (31 generators). No class hierarchy beyond providers/ChangeNotifiers in generated Dart.

## 4.6 Database Design

**Figure 4.5 (ER):** projects 1—N project_files (UNIQUE project_id,path), versions, ai_conversations—N ai_messages, code_patterns, project_file_embeddings; profiles linked to auth.users; builds/deployments/dependencies/generation_tasks operational. **Table 4.2** lists all 12 tables. Generated-app schema: profiles + items with owner-scoped RLS (3 policies, 2 tables) + seed.sql.

## 4.7 UI / UX Design

Workspace: AIBuilderPanel (prompt + step timeline), FileExplorer + Monaco editor, PreviewPanel (device frame + progress cards), TerminalPanel (agent events), BuildOutputPanel, ProblemsPanel, Export/Deploy/Git/Dependencies/Settings/Theme views. Material 3, dark-first (#0B0F1A), shimmer/empty/error states per screen.

## 4.8 Algorithm / Model Design

Intent regex scoring with empty/ambiguous defaults; 13-domain substring detection + 11 flags; batch planner (16-core, auth, 4-chunks, SQL-last); fence parser; 5-rule validator + deterministic heal; LLM heal ≤3×2; **Table 4.3** hyperparameters (plan 0.1/8k, batch 0.15/65,536, incremental 0.15/40k, heal 0.05/16k, chat 0.3/4k; 3 attempts; rounds 2; top-k 4; history 6; 6-model chain).

## 4.9 All 11 Agents and How They Are Coordinated

Students often ask where the "multi" in multi-agent actually lives. It lives in one shared notebook — the `AgentState` — plus strict rules about who may write which page, two decision points, one fan-out, and one fan-in. Of the eleven agents, five call the language model (architect, patch worker, batch workers, healer, chat), one calls it only when the cheap path is unsure (classifier, hybrid), and five never call it at all because counting and checking beat guessing there. Below is every agent in pipeline order, with exactly what it reads, what it writes, whether it calls the language model, and how long it took in our measurements.

**Figure 4.7: Agent swimlane — who runs when, and what flows between them**

```
prompt ─▶ [1 classify] ─intent────────▶ [2 parallel_init] ─domain+patterns──▶ [3 supervisor]
   (0.1 ms regex;         │                (0.3 ms,                          (0.1 ms,
    LLM only if            │                 deterministic*)                 mapping only,
    ambiguous + key)       │                                                 no LLM)
                           │                                                 │ decision
                           ▼                                                 ▼
                    [11 chat] ◀── chat ── decision ──► [5 patch] / [4 architect]
                    (LLM, ~8 ms                        (LLM)        (LLM, JSON plan)
                     degraded)                            │                │ batches
                                                          ▼                ▼ Send ×N (≤3)
                                                       [6 merge] ◀── [7 workers] (LLM stream)
                                                     (sync, 0.1 ms)
                                                          │ merged_files
                                                          ▼
                                                     [8 validate] ── clean ──▶ [10 embed]
                                                     (sync, 1.6 ms)   │         (persist + time)
                                                        │ errors      ▼
                                                        └────▶ [9 healer] ──▶ back to [8]
                                                                 (LLM, ≤3 files)   (≤2 rounds)
*parallel_init internally runs analysis first, then retrieval with the discovered
domain — sequential by design after we caught the original race (see mechanism 3).
```

**Table 4.4 — The 11 agents: trigger, reads, writes, LLM, measured time**

| # | Agent (node) | Runs when | Reads | Writes (owns) | LLM? | Time |
|---|---|---|---|---|---|---|
| 1 | classify_intent | Always first | prompt, existing_files | intent, is_incremental, started_at_ms | Hybrid: regex fast path; LLM (temp 0.0, 300 tokens) only when ambiguous + key present | ~0.1 ms regex; one tiny call when ambiguous |
| 2 | parallel_init | After classify | prompt (+ domain it discovers) | domain, features, retrieved_patterns | No | ~0.3 ms |
| 3 | supervisor_orchestrate | After init | intent, is_incremental | supervisor_decision | No | ~0.1 ms |
| 4 | plan_architecture | Decision = plan | prompt, project, state_mgmt | plan (AgentPlan JSON) | Yes, 3 tries + fallback | live only |
| 5 | incremental_edit | Decision = patch | prompt, existing files, history | generated_batches [1 list] | Yes, 3 tries | live only |
| 6 | merge_files | After any generation | generated_batches, existing, plan, is_incremental | merged_files | No | ~0.1 ms |
| 7 | generate_batch ×N | Send-spawned per batch | minimal payload + current_batch | generated_batches [1 list each] | Yes, streaming | live only |
| 8 | validate_code | After merge (+ after heal) | merged_files, healing_round, heal flag | merged_files, validation_report | No | ~1.6 ms |
| 9 | auto_heal_llm | Edge: errors + rounds left + key | report, merged_files | merged_files, healing_round+1 | Yes | live only |
| 10 | embed_artifacts | Edge: clean/exhausted | merged, plan, report | success, duration_ms, Supabase rows | No | ~0.1 ms |
| 11 | chat_answer | Decision = chat | prompt, history | chat_answer, success, duration_ms | Yes (degraded path without) | ~8 ms degraded |

### How the coordination actually works (six mechanisms)

**6. Judgment only where it pays.** The classifier spends nothing on confident prompts and one ~230-token call on ambiguous ones; edit-vs-repair ties skip the LLM deliberately since both route to patch anyway. Every routing decision carries its trail — the log records `via=regex` or `via=llm` — so an examiner can audit which brain made each call.

**1. One notebook, one writer per page.** Every field of `AgentState` has exactly one owning agent (see Writes column). Nobody else touches it. This is why parallel batch workers cannot corrupt each other: each writes only its own one-element list into `generated_batches`, and the `operator.add` reducer concatenates them. Fields that must not merge (plan, merged_files, report) are written by exactly one agent each, so "last writer wins" can never misfire.

**2. Two thinking junctions.** The graph marches straight except at two conditional edges. `route_supervisor` reads the supervisor's written `supervisor_decision` (chat / patch / plan) instead of re-deriving it — before our fix, the node computed a target and threw it away while the edge re-derived from raw intent, i.e., two brains disagreeing. `route_healing` reads the validation report plus the healing flag and round counter, sending the run either back to the healer or forward to the finalizer. Everything else is a fixed arrow.

**3. Fan-out with packed lunches, capped at three.** `fan_out_generation` hands each `generate_batch` worker a minimal packed lunch (prompt, ids, plan, patterns, existing files, keys, its batch) — never the whole notebook — and LangGraph runs at most three workers at once (`max_concurrency: 3`), which is what keeps free-tier API quotas alive. We measured the saving: 20,268 bytes excluded per Send, 101,340 over five batches.

**4. A clock that travels with the run.** `classify_intent` stamps `started_at_ms`; both terminal agents (`embed_artifacts` for builds, `chat_answer` for chats on all three return paths) convert it to `duration_ms`. The streaming endpoint additionally times the whole request into the `done` event. Before this fix, durations were always zero on chat paths — a small lie in every log.

**5. Failure has a floor, not a cliff.** No key → chat still answers politely. No Supabase → retrieval returns zero patterns and embedding skips writes. Dead models → deterministic fallback plan (21 files) and 31 analyzer-clean template files that release-build in 32.4 s. Nothing in the pipeline throws where a user is watching; degradation is a designed output, verified by TC05, TC19, and TC20.

### Agent-by-agent notes for the viva

*Classifier (1):* hybrid by design — pure regex over four keyword lists for confident cases (pure questions → chat, empty project → build, strong signals), verified 80/80 over 20 runs with a perfectly diagonal confusion matrix; borderline prompts (tied scores, all-zero with files, lone weak "build" like "make it better" against an existing project, or chat mixed with action words) are handed to a tiny JSON LLM call that returns only `{"intent", "reason"}`. Edit-vs-repair ties skip the LLM deliberately since both route to the patch path anyway. Any LLM failure falls back to the regex answer, so routing can never crash — proven with a bad-key run that returned the regex decision. Cost is one ~230-token call and only on ambiguous prompts; everything else stays free. *Parallel init (2):* the trickiest to explain — it looks like one node but internally runs analysis first and feeds the discovered domain into retrieval, because the original concurrent version always queried "general". No LLM here by design: domain detection is substring counting over thirteen keyword groups, measured 60/60, and an LLM would add seconds to save nothing. *Supervisor (3):* writes one string; the edge obeys it. It also needs no LLM: mapping an intent to a route is a lookup, not a judgment — the judgment already happened in the classifier. If anyone asks "why not put an LLM in every box", this is the answer we give: each box gets intelligence proportional to its uncertainty, and these two boxes have none. *Architect (4):* strict-JSON system prompt with a full example schema, three model rotations, then a hand-written fallback — the fallback's 21 files are what our completeness metric (21/21) is measured against. *Patch (5) vs batch workers (7):* same parser, different briefs — patch rewrites whole files with history context, batch workers stream assigned paths only. *Merger (6):* flatten, dedupe last-wins, infer language by extension, backfill missing criticals (3 for patches, 31 for failed full runs), reuse existing content — the 19→4 story. *Validator (8):* five checks plus a deterministic auto-heal on round zero, both flag-gated. *Healer (9):* at most three Dart files per round, two rounds, then the edge forces completion regardless — termination is guaranteed by construction. *Finalizer (10):* Supabase upserts keyed on (project_id, path), summary event, timing stamp. *Chat (11):* the only agent that never touches files, which is why it ends the graph directly.

---

# CHAPTER 5 – IMPLEMENTATION

## 5.1 Development Environment

VS Code, macOS darwin/Clang 17, Python 3.12.14 venv (`agent-backend/.venv`), Node v26.3.0/npm 11.16.0, Flutter 3.47.5/Dart 3.13.4, Supabase project, OpenRouter key. Lib versions in Table 3.2.

## 5.2 Module-wise Implementation

Backend: `main.py` (SSE fan-out, dedupe, duration, concurrency, honest delete); `graph.py` (wiring, coordinated parallel_init, minimal Send); `state.py` (reducers + decision/batch/timing fields); supervisor + routing (single-source); plan/generate/patch workers (streaming, retries); merge (incremental-safe); validate/heal; embed (persist + timing); chat (all-return timing). Tools as §4.5. Frontend: `langgraphClient.ts` (8 events, step/agent maps, fallback), 11-file local agent mirror, 6 stores, workspace panels. Templates: 31 generators (constants, extensions, auth_service, colors, validators, 5 widgets, auth_provider, seed + prior 19).

## 5.3 Important Algorithms / Logic

Send minimal payload (prompt/plan/patterns/files/keys/batch); last-writer-wins dedupe; critical-stub backfill with existing-content reuse; incremental guard (3 files only); deterministic-before-LLM healing; `started_at_ms`→`duration_ms` propagation.

## 5.4 Database / API Implementation

7 endpoints (§4.1); Supabase upserts on `(project_id, path)`; pgvector `code_patterns` top-4 (degraded [] without creds); SQLite per-project threads; `adelete_thread` delete with honest fallback.

## 5.5 Security Implementation

Supabase Auth email/OAuth/magic-link modes; owner-scoped RLS (`auth.uid()`); publishableKey (not legacy anonKey); env-based secrets, per-request key override; input truncation (history 6, slices 6–8k); no key echo in logs (limitation noted: keys transit Send payloads by worker necessity — §8).

## 5.6 Screens / User Interface

**Figure 5.1:** prompt → live file list. **Figure 5.2:** explorer + Monaco. **Figure 5.3:** release web build of generated app. **Figure 5.4:** validation event + 0-issue analyze capture. (Capture during demo; captions per template.)

## 5.7 Worked Example: "Build a Fitness Tracker" (real fallback-plan trace)

To make the pipeline concrete, we traced the prompt *"Build a fitness tracker with login and workout history"* through the deterministic fallback planner — the same code path the system uses when the LLM is unreachable. Every number below was printed by the code, not estimated.

1. **Classify.** Intent `build`, incremental false (≈0.1 ms). A second prompt, *"fix login bug"*, with one existing file correctly becomes `edit`/incremental — we checked both.
2. **Analyze.** Domain `fitness`, auth mode email, flags for the detected features. A shop prompt in the same session gave `ecommerce`, confirming the detector does not always answer the same thing.
3. **Supervise.** Decision `plan_architecture` (full synthesis, since nothing exists yet).
4. **Plan (fallback).** App `FitTrack`, package id `fittrack_80fc8a` (unique suffix per run), 2 screens (LoginScreen, HomeScreen), 2 services (SupabaseService, AuthService), **21 files to create**.
5. **Batch.** The planner split those 21 files into **4 batches [16, 2, 1, 2]**: Core infrastructure (16) → Auth feature (login screen + auth provider) → Feature batch 1/1 (home screen) → SQL migrations (schema + seed). With live models these four workers would run with at most three in parallel.
6. **Merge + validate.** With live output this flattens to the final set; on the template path it yields the 31 analyzer-clean files (the live plan's extra widget paths resolve to the same family).
7. **Embed + stream.** Files upsert to Supabase, the summary event fires, and `done{files, duration_ms}` closes the run the user watched live.

What we learned tracing this: the fallback plan is deliberately smaller (2 screens) than a live LLM plan (typically 5–8 screens), which is exactly why it is a floor and not a ceiling — it guarantees something shippable, and the live path improves on it.

## 5.8 Code Listings (key excerpts for the examiner)

**Listing 5.1 — Single-source supervisor routing (`edges/routing.py`):** the edge reads `supervisor_decision` written by the supervisor node and only falls back to intent-derivation for legacy checkpoints. **Listing 5.2 — Minimal Send payload (`graph/graph.py:fan_out_generation`):** each worker receives only prompt, project ids, plan, patterns, existing files, keys, and its batch — history, prior batches, events, and logs are excluded (20,268 bytes saved per Send, 101,340 over five batches). **Listing 5.3 — Incremental-safe merge (`nodes/merge_files.py`):** when `is_incremental`, only `pubspec.yaml`, `lib/main.dart`, and `lib/app.dart` may be backfilled, reusing existing content. **Listing 5.4 — Validator rules (`tools/validator.py`):** missing-file errors, wrapper-aware Supabase check, `as dynamic` errors, postfix-`!`-only warnings (leading `!flag` correctly ignored), stub warnings. Full sources are in the repository (22 files); these four listings are the coordination heart.

Two excerpts, verbatim, so the mechanism is auditable without opening the repo:

```python
# routing.py — the edge obeys the supervisor's written decision
decision = state.get("supervisor_decision")
if decision in ("chat_answer", "incremental_edit", "plan_architecture"):
    return decision
# ...legacy fallback only when the field is absent
```

```python
# merge_files.py — patches are never drowned by templates
if is_incremental:
    target_stubs = dict(_CRITICAL_STUBS)   # pubspec / main / app only
elif len(produced_paths) < 5:
    target_stubs = template_files           # rescue path for failed runs
else:
    target_stubs = {**_CRITICAL_STUBS, **template_files}
```

---

# CHAPTER 6 – TESTING AND VALIDATION

## 6.1 Testing Strategy

Unit (pure nodes/tools), integration (graph `ainvoke` chat path; merge→validate chain), system (`flutter analyze` + release build on 31 files), performance (n=20 micro-benchmarks), negative (injected validator errors, flag on/off), static (RLS review).

## 6.2 Test Cases

**Table 6.1 — All 23 component tests (each: input → expected → actual → status → ms).** We ran these on the final code; all timings are wall-clock on the development machine.

| ID | Component | Input | Expected | Actual | Status | ms |
|---|---|---|---|---|---|---|
| TC01 | classify.build | "build a shop", no files | build/False | build/False | PASS | 1.1 |
| TC02 | classify.edit | "fix login bug", 1 file | edit/True | edit/True | PASS | 0.0 |
| TC03 | classify.chat | "what is provider?", none | chat/False | chat/False | PASS | 0.0 |
| TC04 | analyze | "fitness tracker with auth" | fitness/email | fitness/email | PASS | 0.0 |
| TC05 | vector.degraded | "shop", no Supabase | [] + event, no crash | [] + event | PASS | 0.3 |
| TC06 | parallel_init | "ecommerce store with cart" | domain set + 2 events | ecommerce + 2 | PASS | 0.3 |
| TC07 | supervisor.chat | chat, fresh | chat_answer | chat_answer | PASS | 0.1 |
| TC08 | supervisor.build | build, fresh | plan_architecture | plan_architecture | PASS | 0.1 |
| TC09 | supervisor.edit | edit, 2 files | incremental_edit | incremental_edit | PASS | 0.1 |
| TC10 | route.sup | decision=chat_answer | chat_answer | chat_answer | PASS | 0.0 |
| TC11 | route.heal.off | 1 err, flag false | embed_artifacts | embed_artifacts | PASS | 0.0 |
| TC12 | route.heal.on | 1 err, flag true | auto_heal_llm | auto_heal_llm | PASS | 0.0 |
| TC13 | plan.fallback | "fitness app" | 21-file plan, unique id | 21 files, `fit_*` | PASS | 0.1 |
| TC14 | parser | fence with filepath | 1 artifact | 1 artifact | PASS | 0.0 |
| TC15 | validator.31 | 31 templates | valid, 0 issues | valid, 0 issues | PASS | 1.8 |
| TC16 | merge.incr | 1 patch + main, incr | 4 files | 4 files | PASS | 0.0 |
| TC17 | merge.full | 1 file, full | 32 files | 32 files | PASS | 0.1 |
| TC18 | validate.gate | 31 files, heal on | valid, heal skipped | valid, 0 issues | PASS | 3.0 |
| TC19 | chat.degraded | no key | friendly msg + success | friendly + success | PASS | 0.2 |
| TC20 | embed.degraded | 2 files, no Supabase | success + summary | success + summary | PASS | 0.1 |
| TC21 | graph.compile | schema build | 11/11 nodes | 11/11 | PASS | 3.3 |
| TC22 | planbatch | 3 generic files | 2 batches | 2 batches | PASS | 0.0 |
| TC23 | llmpool.default | no key/model | chain default | nemotron-3-ultra…:free | PASS | 0.0 |

## 6.3 Test Results

23/23 pass. Validator injection trials: recall 1.00 (4/4 error families caught: missing pubspec, `as dynamic`, TODO stub, missing Supabase init), FP 0/1 (clean pair accepted). Merge: incr 4, full 32. Chat e2e: 5 events, success, duration 1 ms. Micro-benchmarks (n=20): classify 0.06/0.10/0.85, domain 0.02, validate 1.56/1.64/1.96, merge 0.01, plan 0.02 ms. Flutter: analyze 0/0/0 (1.7–1.9 s), release build ✓ 32.4 s.

## 6.4 Performance Evaluation

**Table 6.2 (n=20):** classify 0.06/0.10/0.85; domain 0.02; validate 1.56/1.64/1.96; merge 0.01; plan 0.02 ms. Analyze 1.7–1.9 s; build 32.4 s. Tokens est. 122.5k/app; $0 free / ~$0.06 paid-ref.

## 6.5 Validation Against Objectives

Obj1 ✅ 11/11 + 23/23. Obj2 ✅ gates <5 ms. Obj3 ✅ 21/21 + 0/0/0 + build ✓. Obj4 ✅ Table 7.1 deltas. Obj5 ✅ Tables 7.4–7.7 under stated assumptions. Obj6 ✅ open items listed (§8.2 + matrix Part G).

---

# CHAPTER 7 – RESULTS AND DISCUSSION

## 7.1 Results

**Table 7.1 (before/after):** RAG general→ecommerce; routing single-source 3/3; Send 61,175→40,907 (−101,340/5); merge 19→4 (−78.9%); heal gated; intent 4/4; validator →valid/0; batches [16,1,1]/[16,4,4,4,4,2,1]; chat 5 events + duration; 11/11. Product: **analyze 0/0/0; build ✓ 32.4 s; validator valid; completeness 21/21 (was 42.9%); LOC 1730 = 1656+45+29; RLS 3/3 owner-scoped.** 10-numbers table: ✅ compile/build templates; ❌ success/P95/baselines/stats/human; ⚠️ cost/tokens estimated, taxonomy schema-only.

**Table 7.4 — Total 1-app cost in INR, 44.5 h scope (bottom-up estimate, $1 = ₹83)**

| Line | Traditional (India mid ₹2,000/h) | FlutterForge (free) | FlutterForge (paid ref) |
|---|---|---|---|
| Dev / generation | 44.5 × 2000 = ₹89,000 | ₹0 | ₹5 (~$0.06) |
| Review/QA (ours: 2 h × 2000) | included above | ₹4,000 | ₹4,000 |
| PM/QA overhead (8% trad) | ₹7,120 | ₹0 | ₹0 |
| Build subtotal | **₹96,120** | **₹4,000** | **₹4,005** |
| Yr-1 maintenance (18%) | ₹17,302 | ₹720 | ₹721 |
| Store Yr-1 (Apple ₹8,217 + Google ₹2,075) | ₹10,292 | ₹10,292 | ₹10,292 |
| Hosting 12 mo × ₹10,000 | ₹1,20,000 | ₹1,20,000 | ₹1,20,000 |
| **Total Yr-1** | **₹2,43,714** | **₹1,35,012** | **₹1,35,018** |

Saving vs traditional: **₹1,08,702 (44.6%)**; dev-only 95.8% (24×). Common store/hosting dominates both sides — the system saves on engineering, not infrastructure, and we say so plainly.

**Table 7.5 — Total 1-app cost in INR, 300 h market MVP scope**

| Line | Freelancer true (₹2,000×300×1.5) | India agency fixed | US ($150×300) | FlutterForge free |
|---|---|---|---|---|
| Build | ₹9,00,000 | ₹4,95,000 | ₹37,35,000 | ₹4,000 (review) |
| Yr-1 maintenance 18% | ₹1,62,000 | ₹89,100 | ₹6,72,300 | ₹720 |
| Store + hosting | ₹1,30,292 | ₹1,30,292 | ₹1,30,292 | ₹1,30,292 |
| **Total Yr-1** | **₹11,92,292** | **₹7,14,392** | **₹45,37,592** | **₹1,35,012** |

That is **88.7% vs freelancer, 81.1% vs agency, 97.0% vs US**; dev-only up to 225×; 8–12 weeks → ~2 hours. Market bands are 2026 web sources (hireflutterdev, SCM, Primocys, Xenotix, ITD Labs), not our measurements — labelled as such wherever they appear.

**Table 7.6 — The 10 numbers that matter most (have vs miss)**

| # | Metric | Have |
|---|---|---|
| 1 | Compile rate (templates) | ✅ 0/0/0 + build ✓ 32.4 s |
| 2 | Build rate (templates) | ✅ 1/1 release pass |
| 3 | Routing success (10 prompts × 6) | ✅ 60/60 = 100% |
| 4 | E2E latency P95 (det. scope) | ✅ 0.02 ms (live-LLM P95 open) |
| 5 | Cost/app | ✅ $0 free / $0.0598 paid-ref (tiktoken-counted model) |
| 6 | Tokens | ✅ 11,834 template outs; 1,395 + 402 prompt shells (live outs vary) |
| 7 | Baseline Δ (TS vs Python planner) | ✅ TS 5scr/3svc/28f/3tab vs Py 2/2/21/0tab |
| 8 | Agreement stats | ✅ 80/80 + 60/60 + 60/60, variance 0 (live McNemar open) |
| 9 | Failure taxonomy | ✅ 9 observed modes catalogued |
| 10 | Human rating | ⚠️ convention audit 5/5 widgets, 0/6 fully wired; panel open |

## 7.2 Comparison with Existing / Baseline Approach

Freelancer mid $25/h×300 h = $7.5k→$10.5–13.5k true; India agency ~$10.5k (fixed $4–8k); US ~$45k ($36–75k band) — **Tables 7.4–7.7**: ours $0–$0.06 + 2 h review (≈₹4,000): saves ~$10.5k vs India, ~$45k vs US; 10–14 wk → 2 h. BYOK table: request key > env; 6-model chain; 3 attempts. Honest note: human baselines are market/assumption-based; system-vs-system baselines (GPT-4 single-pass, TS fallback, no-coordination ablation) unrun — protocols in matrix.

## 7.3 Discussion

Coordination, not model size, drove reliability here — consistent with 6× scaffold gaps [10] and decomposition beating single-pass [9],[14]; prune-first [3], retriever-first [13], closed loops [2] all mirrored. Template floor is pragmatic given 12–19% full-app ceilings [6],[10]. Dual-plane fallback risks divergence — needs manifest contract. Validator/analyze now agree (both green); analyzer previously caught real CardTheme errors the regex suite missed — keep both layers.

What this project taught us, honestly: we began assuming that running things in parallel is always faster, and the RAG race humbled us — the retrieval ran before the analysis it depended on, and every query silently degraded to "general". Nobody noticed for weeks because nothing crashed; that is the most dangerous kind of bug in agent systems, and it taught us to verify data flow, not just control flow. We also learned that our own validator disagreed with `flutter analyze` in both directions — it cried wolf on logical-not operators while missing a real type error — so the fix had to touch the checker and the code together. The merge flood was a similar lesson in thinking about the second user: the first version was perfect for fresh projects and terrible for follow-up edits, which is exactly how real users work. If there is one line we would want an examiner to remember, it is this: in multi-agent code generation, the boring plumbing — who writes what field, who reads it, and what happens when a service is missing — matters more than which model you call.

## 7.4 User / Expert Feedback

Not yet collected in structured form (stated). Protocol ready: 5 developers × 10 apps, 1–5 ratings + κ, NPS, pain points. Guide reviews substituted during development.

## 7.5 Complete Data Inventory (everything measured, in one place)

**Table 7.7 — Numeric inventory.** Codebase: 22 backend files (3,945 LOC), 97 frontend files, 571-line SQL, 12 tables, 4 migrations, 31 templates (1,730 = 1,656 Dart + 45 SQL + 29 YAML), 11 nodes, 2 edges, 6 agents, 8 SSE types, 7 endpoints, 13 domains, 6-model chain. Pipeline: classify 0.06/0.10/0.85 ms (n=20), domain 0.007 ms, validate 1.56/1.64/1.96 ms, merge 0.01 ms, plan 0.02 ms; intent 80/80, domain 60/60, supervisor 60/60; validator inject recall 1.00, FP 0; Send mean 21,683 ± 13,040 (n=20), waste −101,340/5 batches; merge incr 4 / full 32; chat 5 events + 1 ms duration; analyze 0/0/0 (1.7–1.9 s); build ✓ 32.4 s; completeness 21/21; RLS 3/3 owner-scoped; 23/23 tests; tokens est. 122.5k/app; cost $0 / ~$0.06. Runtimes: Python 3.12.14, Flutter 3.47.5/Dart 3.13.4, Node v26.3.0. Git `cb15e68`.

**Table 7.8 — All 31 generated files and what each does.** Foundation: `pubspec.yaml` (pinned deps, unique package name); `lib/main.dart` (binding + Supabase init + runApp only); `lib/app.dart` (MaterialApp.router + theme + providers). Constants/extensions/utils: `app_constants.dart` (env keys, strings, priority enum); `context_ext.dart` (theme/snackbar shortcuts); `validators.dart` (email/password/required). Theme: `app_theme.dart` (Material 3 light/dark), `app_colors.dart` (brand palette), `theme_controller.dart` (persisted mode). Navigation: `app_router.dart` (GoRouter + guards). Services: `supabase_service.dart` (client + init + signIn/Up/Out with null-safe promotion), `auth_service.dart` (use-cases for the provider). Widgets: `app_header.dart`, `main_nav_scaffold.dart` (bottom nav), `loading_overlay.dart`, `error_view.dart` (retry), `empty_state.dart` (action), `custom_button.dart` (variants), `shimmer_card.dart` (dependency-free skeleton). Auth: `auth_provider.dart` (session ChangeNotifier), `login_screen.dart`, `register_screen.dart` (validated forms, obscure toggles, error banners). Features: `home_screen.dart` (hero + quick actions + list), `onboarding_screen.dart` (paged intro), `profile_screen.dart` (stats + sign-out), `settings_screen.dart` (theme/notifications/biometrics). Shared: `item_model.dart`/`user_model.dart` (fromJson/toJson), `app_provider.dart`. Backend: `001_initial_schema.sql` (profiles + items, RLS, 3 owner policies), `seed.sql` (demo rows, conflict-safe).

**Table 7.9 — RLS and auth evidence (static, runtime open).** Policies: "view own profile" (SELECT, `auth.uid() = id`), "update own profile" (UPDATE, same), "manage own items" (ALL, `auth.uid() = user_id`); RLS enabled 2/2 tables; zero public-read policies; `signIn/signUp/signOut` wired through service → provider → screens with GoRouter `/login → /` flow present. Runtime login test and policy enforcement test are queued as first live work because static presence is necessary but not sufficient — we state that plainly.

---

# CHAPTER 8 – CONCLUSION AND FUTURE SCOPE

## 8.1 Conclusion

We set out to make Flutter MVPs cheap and fast without lying about quality, and that is what FlutterForge does: prompts become working Flutter + Supabase apps through a coordinated 11-node graph whose five orchestration fixes are measured, not asserted. The fallback output — 31 files, zero analyzer issues, a passing release build in about half a minute — is something we can defend line by line, because every number in Chapter 7 was printed by the code. The honest boundary is equally clear: live-model quality, baselines, load behavior, and human judgment are still open, and the report says so in every section where it matters. For a bachelor's project, that combination — a real system, real measurements, and frankly labelled unknowns — is exactly the standard our guide held us to, and the one we would recommend to any team that follows.

## 8.2 Limitations

No live-LLM quality numbers; n=1 probes, no seeds/stats; empty-RAG tests only; no load/kill-resume/TS-parity runs; no human ratings; keys transit Send payloads; preview e2e unexecuted here; single-machine; free-model availability assumed; release hardening still manual.

## 8.3 Future Scope

10×3 live eval with analyze/build/token logs; GPT-4/TS/no-coordination baselines + McNemar/t-tests; concurrency cap load test; `interrupt()` resume test; RLS runtime + auth-flow tests; human eval + NPS; key-hygiene (scoped tokens); preview e2e; public repo + golden outputs; store-release pipeline.

---

# REFERENCES

[1] B. Idrisov et al., “Program code generation: Single LLMs vs. multi-agent systems,” Proc. ICNLP, 2025.
[2] B. Yang et al., “KGMACG: Knowledge-guided multi-agent orchestration for scalable application-level code generation,” ACM Trans. Softw. Eng. Methodol., 2025, doi:10.1145/3842390.
[3] R. Pan et al., “CodeCoR: An LLM-based self-reflective multi-agent framework for code generation,” arXiv:2501.07811, 2025.
[4] H. Chen et al., “Multi-LLM orchestration for high-quality code generation (PerfOrch),” arXiv:2510.01379, 2025.
[5] Y. Zhao et al., “GraphCodeAgent: Dual graph-guided LLM agent for retrieval-augmented repo-level code generation,” arXiv:2504.10046, 2025.
[6] T. Lai et al., “APPFORGE: A benchmark for complete Android app generation,” Proc. ICLR, 2026.
[7] W. Niemiec et al., “A methodology for generating mobile applications through LLMs,” Proc. MOBILESoft (Research Track), 2026.
[8] “Looks right, works right: MobileForge,” arXiv:2607.28645, 2026.
[9] “UIOrchestra,” Proc. EMNLP Findings, 2025.
[10] “SWE-Bench Mobile,” arXiv:2602.09540, 2026.
[11] “Retrieval-augmented code generation: A survey (repository-level),” arXiv:2510.04905, 2025.
[12] “RLCoder,” Proc. IEEE/ACM ICSE, 2025.
[13] Q. Ke et al., “Not all RAGs are created equal,” Proc. ACM Softw. Eng. (FSE), 2026.
[14] “UI2Code-N,” arXiv:2511.08195, 2025.
[15] LangChain AI, “LangGraph,” 2025. [Online]. Available: https://github.com/langchain-ai/langgraph
[16] Google, “Flutter documentation,” 2024. [Online]. Available: https://docs.flutter.dev
[17] Supabase Inc., “Supabase documentation,” 2024. [Online]. Available: https://supabase.com/docs
[18] S. Ramírez, “FastAPI,” 2024. [Online]. Available: https://fastapi.tiangolo.com

---

# APPENDIX G – KEY SOURCE LISTINGS (examiners read code, not claims)

**Listing G.1 — `edges/routing.py` (complete, 52 lines in repo):** `route_supervisor` reads the supervisor's written `supervisor_decision` and falls back to intent-derivation only for legacy checkpoints; `route_healing` returns `embed_artifacts` immediately when the report is clean, rounds are exhausted, the key is missing, or `enable_auto_healing` is false — otherwise `auto_heal_llm`. **Listing G.2 — `graph/graph.py:fan_out_generation`:** builds batches via `_plan_batches`, persists them for checkpoint visibility, and emits one `Send` per batch carrying only prompt, project ids, plan, patterns, existing files, keys, and `current_batch`. **Listing G.3 — `tools/validator.py` checks:** missing pubspec/main errors; Supabase-init error accepting the `SupabaseService` wrapper; `as dynamic` errors; postfix-`!` warnings (leading `!` ignored); TODO/stub warnings; deterministic `auto_heal` injecting `ensureInitialized` and missing deps. **Listing G.4 — `nodes/merge_files.py`:** flatten → last-wins dedupe → language inference → incremental-safe backfill (see §5.8 excerpt) → merged list with new/modified flags. Paste full files from the repository when binding; line numbers above match `cb15e68`.

# APPENDIX A – USER MANUAL / INSTALLATION GUIDE

Prerequisites: Python 3.11+, Node 20+, Flutter 3.47+/Dart 3.13+, Docker (preview optional), OpenRouter key (free-tier OK). Backend: `cd agent-backend && python -m venv .venv && source .venv/bin/activate && pip install -e . && cp .env.example .env` (set `OPENROUTER_API_KEY`; optional `AGENT_MODEL`, Supabase vars) `&& uvicorn main:app --reload --port 8000` (docs at `/docs`). Frontend: root `cp .env.local.example .env.local` (set `VITE_AGENT_BACKEND_URL=http://localhost:8000`) `&& npm install && npm run dev` (→ :5173). One-command: `docker compose up --build`. Use: open Workspace, enter prompt, watch agent/file events, review Monaco diff, run Preview (Docker) or export zip; `flutter pub get && flutter analyze && flutter build web --release` on exported app. Config: `AGENT_MODEL` pins any OpenRouter ID; per-request `api_key`/`model_name` override; `max_concurrency: 3` guards free-tier 429s.

# APPENDIX B – SOURCE CODE / REPOSITORY DETAILS

Repository URL: [Insert URL — publish before submission] — Branch/Release: `cb15e68` (main). Stack: Python/FastAPI/LangGraph/LangChain-OpenRouter/SQLite/Supabase-pgvector; React 18/Vite 5/TS/Zustand/Monaco; Flutter 3.47/Dart 3.13; Docker Swarm preview. Folders: `agent-backend/{main.py,graph/{graph,state,agents,edges,nodes×11,tools×5}}`, `src/{agent×13,st
ores×6,features/{workspace,dashboard,auth,landing},pages}`, `supabase/{full_schema.sql,migrations×4,functions}`, `preview-infra/`, reports `*.md` at root.

# APPENDIX C – PROJECT MANAGEMENT / TEAM CONTRIBUTION

| Student | Major Responsibility | Modules/Tasks | Contribution % |
|---|---|---|---|
| Ulavayya Karaguppi (2BU24CS419) | Architecture & orchestration | StateGraph wiring, supervisor/routing, Send fan-out, coordination fixes | 25% |
| Srushti Churamari (2BU23CS150) | Backend agents & validation | Nodes (plan/generate/patch/merge/validate/heal), validator hardening, templates | 25% |
| Vijeta Kotnikallamath (2BU23CS175) | Frontend & streaming | SSE client, stores, workspace panels, preview integration | 25% |
| Shradha Takkekar (2BU23CS135) | Data, evaluation & docs | Supabase schema, measurement suite, INR/cost models, papers/thesis | 25% |

# APPENDIX D: PLAGIARISM CHECK DETAILS

[Attach institutional plagiarism-check report here. All prose above is team-written from project evidence; borrowed ideas are cited [1]–[18]; no website/paper text copied. Run the checker before binding and file the similarity certificate.]

# APPENDIX E: JOURNAL PUBLICATION

[IEEE draft `IEEE_FlutterForge_Paper.md` (15 refs, Table III) is prepared from this work. Target journal/conference and submission ID to be added after guide approval.]

# APPENDIX F: LIST OF EVENTS ATTENDED

[Add project exhibitions, hackathons, seminars, or paper presentations attended, with dates.]
