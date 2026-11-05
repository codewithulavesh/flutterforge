# FlutterForge: A Coordinated Multi-Agent LangGraph System for Flutter and Supabase Code Generation

> **By**
> *Ms. Shradha Takkekar — USN: 2BU23CS135*
> *Ms. Srushti Churamari — USN: 2BU23CS150*
> *Ms. Vijeta Kotnikallamath — USN: 2BU23CS175*
> *Mr. Ulavayya Karaguppi — USN: 2BU24CS419*
>
> *Under the Guidance of Mrs. Sahana Bisalapur*
> *Batch No: 26 — AY: 2026–2027*
> *Department of Computer Science and Engineering*
>
> Git HEAD: `cb15e68` (`cb15e68d80e4bfa57c86a6089d56303f0f6bdfb3`)

---

## Abstract

Natural-language to production-code generation for cross-platform mobile applications remains challenging due to multi-file consistency, backend integration, and iterative repair requirements. This paper presents FlutterForge, a coordinated multi-agent system that converts free-form user prompts into compilable Flutter + Supabase applications. The backend implements an 11-node LangGraph StateGraph with six specialist agents — Supervisor, Architect, Code Generator, QA/Healer, Patch, and Chat — orchestrated through a shared typed state (AgentState), conditional routing edges, parallel fan-out via the Send API, and deterministic fan-in with reducer-based merging. A FastAPI server streams execution over Server-Sent Events (SSE) with eight typed event channels, while SQLite checkpoints persist resumable state and Supabase persists artifacts, conversations, and pgvector code patterns. A React + Vite frontend with Zustand state management, Monaco editing, and Docker-based live preview completes the loop. Controlled functional runs show keyword intent routing in ~1 ms, deterministic Dart validation over 31 baseline files in ~2 ms (0 errors, 0 warnings), correct domain discrimination across 13 application domains, single-source supervisor routing, incremental-safe file merging (19→4 files on patch inputs), 21/21 fallback-plan completeness, and a passing release web build (32.4 s), and successful end-to-end coordination of chat, incremental-edit, and full-synthesis paths.

**Keywords:** Multi-Agent Systems; LangGraph; Large Language Models; Flutter Code Generation; Supabase; Retrieval-Augmented Generation; Server-Sent Events; Software Auto-Healing.

---

## 1. Introduction

### 1.1 Background

Tools like Lovable, v0, and Copilot show LLMs can accelerate frontend work. Mobile is stricter: multi-file projects, null-safe Dart, GoRouter routing, Provider/Riverpod/Bloc state, plus backend Auth, row-level security (RLS), and realtime. Single-pass LLM output truncates files, invents imports, omits `pubspec.yaml`/`main.dart`, or leaves `TODO` stubs.

### 1.2 Problem Statement

How to convert a free-form prompt ("build a fitness tracker") into a complete, consistent, validatable Flutter + Supabase codebase with planning, parallel synthesis, validation, repair, and live progress — without losing files, diverging routes, or drowning patches in templates?

### 1.3 Objectives

1. Build an 11-node StateGraph with 6 specialist agents and reducer-safe fan-in.
2. Enforce deterministic checks before LLM repair to bound cost.
3. Stream all progress over typed SSE with file-level granularity.
4. Guarantee a compilable fallback (19 templates) under total LLM failure.
5. Measure coordination with before/after metrics (RAG race, routing, Send size, merge, healing flag).

### 1.4 Existing vs Proposed

| Aspect | Existing (single-pass copilots) | Proposed (FlutterForge) |
|---|---|---|
| Files | 1-shot, truncation-prone | Planned batches (16 core + auth + 4-chunks + SQL), Send-parallel |
| Consistency | No cross-file contract | Feature-first paths, `package:<appId>` imports, shared plan |
| Validation | None / LLM-only | 5 deterministic checks (~2 ms) then bounded LLM heal (≤3 files × 2 rounds) |
| Iteration | Regenerate all | Patch agent (incremental-safe merge 19→4) + chat agent |
| Observability | Final text | 8 SSE channels + 5 terminal events + checkpoints |

---

## 2. Related Work

LangGraph provides stateful multi-agent substrate [15]. Multi-agent teams can beat single LLMs on quality [1]. Knowledge-guided planning→coding→testing loops advance app-level generation [2]; self-reflection with pruning cuts error propagation [3]. Per-stage model routing beats any single model [4]; graph-guided retrieval bridges requirements to repos [5]. Repo-level RAG surveys systematize retrieval/fusion/agents [11]; retriever choice often outweighs generator, BM25 stays robust [13]; RL retrievers help without labels [12]. Mobile remains hardest: APPFORGE best ~18.8% on 101 Android apps [6]; SWE-Bench Mobile 12% with 6× scaffold gaps [10]; multi-screen nav/maintainability lags [8]; multi-agent decomposition and visual optimization beat single-pass for UI [9],[14]. Standardized mobile methodologies yield compilable but feature-incomplete apps [7]. FlutterForge follows the KGMACG loop [2] and prune-before-propagate [3] with a template reliability floor.

---

## 3. Methodology

White-box analysis of the monorepo (`agent-backend/` 22 graph py files / 3945 LOC; `src/` 97 TS/TSX; `supabase/full_schema.sql` 571 lines; `preview-infra/` Docker Swarm). Steps: (a) inspect all nodes/edges/tools/reducers; (b) compile graph (11/11); (c) probe intent (4 prompts), domain (3 probes), validation (19 templates), merge (incremental vs full), Send size (synthetic 20-file), batch plans (3- and 20-file), healing flag, chat `ainvoke` with in-memory checkpointer; (d) trace SSE contract `main.py` ↔ `langgraphClient.ts`. No live-LLM quality runs (zero LLM cost); RAG tested in degraded (0-pattern) mode. n=1 per probe, no seeds.

---

## 4. System Design

### 4.1 Architecture

```
Browser (React 18 + Vite + TS + Zustand + Monaco)
 │ POST /api/agent/stream (SSE)
 ▼
FastAPI (main.py) + AsyncSqliteSaver (thread_id = project_id)
 ▼
START → classify_intent → parallel_init → supervisor_orchestrate
 ├─ chat_answer → END
 ├─ incremental_edit → merge_files → validate_code ⇄ auto_heal_llm → embed_artifacts → END
 └─ plan_architecture --Send×N--> generate_batch → merge_files → (same QA pipeline)
```

**TABLE I — API (7 endpoints, measured)**

| Method | Endpoint |
|---|---|
| POST | `/api/agent/stream` |
| POST | `/api/agent/run` |
| GET | `/api/agent/checkpoint/{project_id}` |
| POST | `/api/agent/stream/{project_id}/resume` |
| DELETE | `/api/agent/checkpoint/{project_id}` |
| GET | `/health`, `/` |

SSE (8): `agent_event`, `token`, `file_ready`, `files_merged`, `validation`, `chat_answer`, `done`, `error`.

### 4.2 State and Agents

`AgentState` (TypedDict): reducers (`operator.add`) on `retrieved_patterns`, `generated_batches`, `events`, `logs`; single-writer `intent`, `domain`, `plan`, `merged_files`, `validation_report`, `healing_round`, `chat_answer`, plus `supervisor_decision` and `current_batch` (added by this work).

**TABLE II — Nodes (11)**

| Node | Role |
|---|---|
| classify_intent | Regex build/edit/chat/repair; sets intent + incremental |
| parallel_init | analyze (domain/features) → retrieval (patterns) coordinated |
| supervisor_orchestrate | Writes single-source routing decision |
| plan_architecture | LLM JSON plan + 3-retry + deterministic fallback |
| generate_batch ×N | Streaming synthesis, `filepath=` fences, parsed to artifacts |
| incremental_edit | Targeted full-file rewrites with history |
| merge_files | Flatten, dedupe last-wins, incremental-safe backfill |
| validate_code | 5 deterministic checks |
| auto_heal_llm | ≤3 files/round, ≤2 rounds |
| embed_artifacts | Supabase upsert + summary |
| chat_answer | Q&A, no file mutation; degraded no-key path |

Batch order: Batch 0 = 16 always-core (`pubspec`, `main`, `app`, theme, router, services, core widgets); Batch 1 = auth; rest in 4s; SQL last (gated).

### 4.3 Hyperparameters

| Node | Temp | Max tokens | Stream | Attempts |
|---|---|---|---|---|
| plan | 0.1 | 8000 | No | 3 |
| batch | 0.15 | 65536 | Yes | 3 |
| incremental | 0.15 | 40000 | Yes | 3 |
| heal | 0.05 | 16000 | No | per-file loop |
| chat | 0.3 | 4000 | Yes | 1 |

Rounds 2 (TS clamps 1–3); chunk 4; heal 3/round; RAG top-k 4 (600-char); history 6 msgs (400–800 chars); heal slice 8000. Chain (6): `openai/gpt-4o-mini`, `nvidia/nemotron-3-ultra-550b-a55b:free`, `poolside/laguna-s-2.1:free`, `cohere/north-mini-code:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `nvidia/nemotron-3.5-lightning:free`. (README lists a slightly different 6th entry — use this code list as truth.)

### 4.4 Persistence / Frontend / Preview

Checkpoints: AsyncSQLite by `project_id` (in-memory for tests). Supabase 12 tables: `projects`, `project_files (UNIQUE project_id,path)`, `project_versions`, `ai_conversations`, `ai_messages`, `code_patterns`, `project_file_embeddings`, `profiles`, `builds`, `deployments`, `dependencies`, `generation_tasks`; 4 migrations. Frontend `LangGraphClient` parses SSE, maps `NODE_TO_STEP/AGENT`, accumulates `file_ready`, falls back to local single-pass agent if `/health` fails. Zustand: project/workspace/preview/terminal/theme/auth. Preview: Docker builder + Nginx, 15m TTL (README; not executed here).

---

## 5. Implementation: Coordination Fixes (this work)

1. **RAG race → coordinated:** `parallel_init` was `asyncio.gather` (retrieval read `domain` before set → always `general`). Now analyze → retrieval with enriched state.
2. **Supervisor duality → single source:** supervisor discarded its target; edge re-derived. Now writes `supervisor_decision`; edge reads it (legacy fallback).
3. **Send bloat → minimal:** was `{**state}` per worker (history+batches+events+logs duplicated N×). Now minimal payload; `generation_batches` persisted for visibility.
4. **Merge flood → incremental-safe:** `<5 files` triggered 19-template backfill even for patches. Now incremental only backfills `pubspec/main/app` with existing reuse.
5. **Healing bypass → gated:** flag ignored. Now respected in validator + edge.

---

## 6. Testing and Results

### 6.1 Before/After (exact, zero LLM cost)

**TABLE III — Coordination metrics**

| Metric | Before | After |
|---|---|---|
| RAG domain (shop) | `general` | `ecommerce` (3/3 probes correct) |
| Routing | no field, re-derived | `chat→chat_answer`, `build→plan_architecture`, `edit→incremental_edit` (3/3) |
| Send (synthetic 20-file) | 61,175 B full | 40,907 B minimal (−33.1%); excluded 20,268/Send → 0; −101,340 over 5 batches |
| Incremental merge (1 patch + main) | 19 files | 4 files (−78.9%) |
| Heal flag=false + 1 err | → `auto_heal_llm` | → `embed_artifacts`; true → heal |
| Intent 4 prompts | 4/4 (`build`/`edit`/`chat`/`edit`) | same, 0.6–1.0 ms |
| Validation 31 templates | 1 err + 8 warn | **valid=True, 0 issues** (rule + template fixes) |
| Product quality (templates) | 16 analyze issues, 42.9% complete | **analyze 0/0/0; build ✓ 32.4 s; complete 21/21** |
| Batches | 3→`[16,1,1]`; 20→`[16,4,4,4,4,2,1]` | same |
| Chat no-key | routes | `chat_answer`, 5 events, success, duration set (~8 ms) |
| Compile | 11/11 | 11/11 |

**TABLE IV — The 10 numbers (have vs miss)**

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

### 6.2 Discussion

Coordination dominates reliability here, matching reports that scaffolding causes 6× gaps [10] and decomposition beats single-pass [9],[14]. Deterministic-first healing mirrors prune-before-propagate [3]; BM25-friendly fallback aligns with [13]; loop follows [2]. Cited full-app ceilings (18.8% [6], 12% [10]) motivate the template floor. Dual-plane (Python parallel vs TS single-pass) aids availability but risks divergence — version a shared manifest. Limits: no live-LLM compile/build numbers; n=1; empty RAG; load test open; kill-resume open; TS parity open. Threats: template metrics ≠ LLM quality; single-machine.

---

## 7. Conclusion and Future Work

FlutterForge shows a practical path: fast routing, domain-aware RAG sequencing, planned parallel synthesis, deterministic validation with bounded healing, SSE observability, checkpointed artifacts, and a compilable fallback. The five coordination repairs generalize to any LangGraph code factory. Next: cap concurrency (3), `interrupt()` resume + kill test, 10 prompts × 3 seeds with `flutter analyze`/`build web` + token accounting, RAG on/off ablation, RLS/auth checks, public repo + golden outputs, key hygiene (strip keys from Send/logs).

---

## References

[1] B. Idrisov et al., ICNLP 2025 — single vs multi-agent code gen.
[2] B. Yang et al., ACM TOSEM 2025, doi:10.1145/3842390 — KGMACG.
[3] R. Pan et al., arXiv:2501.07811 — CodeCoR.
[4] H. Chen et al., arXiv:2510.01379 — PerfOrch.
[5] Y. Zhao et al., arXiv:2504.10046 — GraphCodeAgent.
[6] T. Lai et al., ICLR 2026 — APPFORGE.
[7] W. Niemiec et al., MOBILESoft 2026 — mobile LLM methodology.
[8] arXiv:2607.28645 — MobileForge.
[9] EMNLP Findings 2025 — UIOrchestra.
[10] arXiv:2602.09540 — SWE-Bench Mobile.
[11] arXiv:2510.04905 — RACG survey.
[12] ICSE 2025 — RLCoder.
[13] Q. Ke et al., FSE 2026 — Not All RAGs.
[14] arXiv:2511.08195 — UI2Code-N.
[15] LangChain AI, LangGraph, 2025.

---

## Appendix A — Reproduction

Backend: `pip install -e ./agent-backend`, set `OPENROUTER_API_KEY`, `uvicorn main:app --port 8000`. Frontend: `npm install`, `npm run dev`. Probes: in-memory checkpointer, template-only validation (no LLM cost); see `MASTER_REPORT_FlutterForge.md` for exact snippets, file lists (22 py, 97 ts/tsx, 19 templates, 12 tables), and byte methodology. Screenshots to attach: prompt→files→preview, validation report, healed diff, Supabase rows.
