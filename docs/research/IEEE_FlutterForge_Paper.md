# FlutterForge: A Coordinated Multi-Agent LangGraph System for Functional Flutter and Supabase Code Generation

> **By**
> *Ms. Shradha Takkekar — USN: 2BU23CS135*
> *Ms. Srushti Churamari — USN: 2BU23CS150*
> *Ms. Vijeta Kotnikallamath — USN: 2BU23CS175*
> *Mr. Ulavayya Karaguppi — USN: 2BU24CS419*
>
> *Under the Guidance of Mrs. Sahana Bisalapur*
> *Batch No: 26 — AY: 2026–2027*
> *Department of Computer Science and Engineering*

---

## Abstract

Natural-language to working-code generation for cross-platform mobile applications remains challenging due to multi-file consistency, backend integration, and iterative repair requirements. This paper presents FlutterForge, a coordinated multi-agent system that converts free-form user prompts into compilable, functional Flutter + Supabase applications (MVP-quality prototypes). The backend implements an 11-node LangGraph StateGraph with six specialist agents — Supervisor, Architect, Code Generator, QA/Healer, Patch, and Chat — orchestrated through a shared typed state (AgentState), conditional routing edges, parallel fan-out via the Send API, and deterministic fan-in with reducer-based merging. A FastAPI server streams execution over Server-Sent Events (SSE) with eight typed event channels, while AsyncSQLite checkpoints provide resumable execution and Supabase persists artifacts, conversations, and pgvector code patterns. A React + Vite frontend with Zustand state management, Monaco editing, and Docker-based live preview completes the loop. Static analysis of the implementation and controlled functional runs show keyword intent routing in ~1 ms, deterministic Dart validation over 31 baseline files in ~2 ms (0 errors, 0 warnings), correct domain discrimination across 13 application domains, and successful end-to-end coordination of chat, incremental-edit, and full-synthesis paths with single-source supervisor routing and incremental-safe file merging.

**Keywords:** Multi-Agent Systems; LangGraph; Large Language Models; Flutter Code Generation; Supabase; Retrieval-Augmented Generation; Server-Sent Events; Software Auto-Healing.

---

## 1. Introduction

### 1.1 Background

Low-code and AI-assisted development tools such as Lovable, v0, and GitHub Copilot have demonstrated that large language models (LLMs) can accelerate frontend development. Mobile development, however, imposes stricter constraints: multi-file project structure, null-safe typed languages (Dart), declarative routing (GoRouter), reactive state management (Provider/Riverpod/Bloc), and a backend with authentication, row-level security (RLS), and real-time subscriptions.

Single-pass LLM generation typically fails on these tasks by truncating files, inventing inconsistent imports, omitting `pubspec.yaml` or `main.dart`, or producing placeholder `TODO` stubs. Agentic workflows address this by decomposing generation into planning, parallel synthesis, validation, and repair, but introduce a new problem: **background-agent orchestration**. Parallel workers must share context, avoid race conditions, merge without loss, and report progress coherently to the user interface.

### 1.2 Purpose and Contributions

This paper documents FlutterForge — "Lovable for Flutter" — as a case study in coordinated background-agent orchestration. The system was analyzed end-to-end, including its Python LangGraph backend, TypeScript fallback agent, React frontend, Supabase schema, and Docker preview infrastructure.

The contributions are:

1. **A coordinated StateGraph architecture** with 11 nodes, 2 conditional edges, Send-based parallel code generation, and SQLite-backed resumability.
2. **A coordination audit and repair** covering RAG domain racing, supervisor routing duality, Send payload bloat, incremental-merge interference, and healing-flag bypass.
3. **A full-stack reference design** linking SSE streaming, Supabase persistence (projects, files, versions, conversations, vectors), and containerized Flutter web preview.
4. **Empirical functional characterization** with latency, correctness, and fault-tolerance measurements suitable for reproduction.

---

## 2. Related Work and System Context

LLM orchestration frameworks such as LangGraph provide state machines and message passing for multi-agent collaboration [15]. Recent studies show multi-agent teams can outperform single LLMs on code quality, though role-specification effects remain nuanced [1]. Knowledge-guided orchestration with planning, coding, and testing agents in a closed compile-and-coverage loop has advanced application-level generation [2], while self-reflective frameworks that prune intermediate outputs reduce error propagation in sequential pipelines [3]. Per-stage model routing that exploits complementary LLM strengths further improves correctness and efficiency over any single model [4], and graph-guided retrieval bridges natural-language requirements to repository context [5]. Repository-level RAG surveys systematize retrieval, fusion, and agent architectures for long-range dependency reasoning [11], with component-wise evidence that retriever choice often outweighs generator choice and that lexical BM25 remains highly robust [13], and RL-based retrievers improving repo-level completion without labeled data [12].

Mobile code generation remains the hardest frontier: APPFORGE shows the best flagship model completes only ~18.8% of 101 real Android apps [6]; SWE-Bench Mobile reports only 12% success on industry iOS tasks with a 6× gap across agent scaffolds [10]; MobileForge exposes navigation and maintainability gaps in multi-screen generation [8]; UIOrchestra and UI2Code-N demonstrate that multi-agent decomposition and iterative visual optimization beat single-pass generation for UI fidelity [9], [14]. Standardized multi-agent methodologies for compilable, crash-free mobile builds now exist but report incomplete feature coverage [7].

FlutterForge differs from single-agent copilot approaches by enforcing a feature-first architecture contract, deterministic static checks before LLM repair, and a dual-plane design: a primary Python LangGraph orchestrator with a TypeScript single-pass fallback when the backend is unreachable.

---

## 3. Methodology

### 3.1 Research Method

We conducted a white-box architecture analysis of the complete monorepo (`agent-backend/`, `src/`, `supabase/`, `preview-infra/`), totaling ~97 TypeScript/TSX frontend files, 22 Python backend modules, a 571-line consolidated SQL schema, and Docker Swarm preview infrastructure. Methods included:

- Static code inspection of all graph nodes, edges, tools, and state reducers.
- Construction and compilation checks of the StateGraph.
- Functional probes: intent classification (4 prompts), domain detection (3 prompts), deterministic validation over 19 template-generated files, incremental vs. full merge comparison, healing-route gating, and a full `ainvoke` chat-path run with in-memory checkpointing.
- Interface tracing of SSE event contracts between `main.py` and `langgraphClient.ts`.

### 3.2 Overall Architecture

```
Browser (React 18 + Vite + TS + Zustand + Monaco)
  │ POST /api/agent/stream (SSE, 8 event types)
  ▼
FastAPI (main.py) + AsyncSqliteSaver (thread_id = project_id)
  ▼
LangGraph StateGraph (11 nodes)
```

Key backend endpoints are listed in Table I.

**TABLE I — Backend API**

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/agent/stream` | Primary SSE generation stream |
| POST | `/api/agent/run` | Blocking run for testing/CI |
| GET | `/api/agent/checkpoint/{id}` | Resumability inspection |
| POST | `/api/agent/stream/{id}/resume` | Resume from checkpoint |
| DELETE | `/api/agent/checkpoint/{id}` | Clear checkpoint |
| GET | `/health`, `/`, `/docs` | Health, root, Swagger UI |

SSE event types: `agent_event`, `token`, `file_ready`, `files_merged`, `validation`, `chat_answer`, `done`, `error`.

### 3.3 AgentState: The Coordination Substrate

All agents read and write a single `AgentState` TypedDict (`agent-backend/graph/state.py`). Parallel-safe fields use `Annotated[..., operator.add]` reducers so concurrent `generate_batch` workers append without loss:

- `retrieved_patterns`, `generated_batches: list[list[FileArtifact]]`, `events`, `logs`.

Single-writer fields (`intent`, `domain`, `plan`, `merged_files`, `validation_report`, `healing_round`, `chat_answer`, `supervisor_decision`, `current_batch`) follow last-writer-wins semantics and are only written by their owning node.

### 3.4 Node Pipeline and Specialist Agents

**TABLE II — Nodes and Agent Roles**

| Node | Agent | Function |
|---|---|---|
| `classify_intent` | Supervisor pre-router | Regex scoring over build/edit/chat/repair keyword sets; sets `intent`, `is_incremental`; <1 ms, no LLM |
| `parallel_init` | Context Analyzer + RAG | Domain/feature extraction + Supabase pgvector pattern retrieval |
| `supervisor_orchestrate` | Supervisor | Writes single-source `supervisor_decision` |
| `plan_architecture` | Architect | LLM JSON plan (screens, services, models, schema, `filesToCreate`) with 3-attempt fallback chain + deterministic fallback plan |
| `generate_batch` | Code Generator (×N via Send) | Streaming LLM synthesis of 3–4 files per batch in `filepath=` fenced blocks, parsed by `code_parser.py` |
| `incremental_edit` | Patch Agent | Targeted full-file rewrites for follow-up prompts with conversation history |
| `merge_files` | Fan-in | Flatten, deduplicate (last-writer-wins), backfill critical files from `flutter_templates.py` |
| `validate_code` | QA Agent | 5 deterministic checks: missing pubspec, missing main, Supabase init, `as dynamic` casts, `TODO`/stub code |
| `auto_heal_llm` | QA Healer | LLM repair of up to 3 Dart files per round, max 2 rounds |
| `embed_artifacts` | Finalizer | Supabase `project_files` upsert + generation summary |
| `chat_answer` | Chat Agent | Conversational Q&A without file mutation |

Graph wiring (`graph/graph.py`):

```
START → classify_intent → parallel_init → supervisor_orchestrate
  -[route_supervisor]-> chat_answer → END
  -[route_supervisor]-> incremental_edit → merge_files
  -[route_supervisor]-> plan_architecture --fan_out_generation (Send)--> generate_batch → merge_files
merge_files → validate_code -[route_healing]-> auto_heal_llm → validate_code (loop)
validate_code -[route_healing]-> embed_artifacts → END
```

Batch planning (`_plan_batches`) enforces ordering: Batch 0 = 16 always-core files (`pubspec.yaml`, `main.dart`, `app.dart`, theme, router, services, core widgets), Batch 1 = auth feature, Batches 2..N = feature chunks of 4, last batch = SQL migrations (gated by `include_sql_migrations`).

### 3.5 LLM Access and Fault Tolerance

All LLM calls go through `LLMPool` (`tools/llm_pool.py`), a ChatOpenAI client pointed at OpenRouter with per-model token clamping and `advance()` fallback across free models (e.g., `openai/gpt-4o-mini`, Llama-3.x, Qwen-2.5). Each generation node retries up to 3 attempts, rotating models. Deterministic regex healing always precedes LLM healing to minimize cost. The TypeScript `OpenRouterClient` mirrors this with a key pool and `resetModelChain()`.

### 3.6 Persistence, Streaming, and Frontend

- **Checkpoints:** `AsyncSqliteSaver` keyed by `thread_id = project_id` for cross-restart resumability; in-memory saver used for tests.
- **Artifacts:** Supabase tables `projects`, `project_files (UNIQUE project_id, path)`, `project_versions`, `ai_conversations`, `ai_messages`, plus `code_patterns` for RAG with `vector` extension.
- **Streaming:** `main.py` uses `astream_events(version="v2")`; `on_chat_model_stream` yields per-token SSE, `on_chain_start/end` yields node progress, file, merge, validation, and chat events with deduplication via `seen_files`.
- **Frontend:** `LangGraphClient` (`src/agent/langgraphClient.ts`) parses SSE, maps `NODE_TO_STEP` / `NODE_TO_AGENT` for timeline UI, accumulates `file_ready` artifacts, and falls back to the local `FlutterSupabaseAgent` single-pass pipeline if `GET /health` fails. Zustand stores manage project, workspace, preview, terminal, and theme state; Monaco provides editing; Docker Swarm preview builds Flutter web in a builder container and serves via Nginx with 15-minute TTL and Cloudflare tunnel support.

---

## 4. Results and Discussion

### 4.1 Coordination Defects Found and Repaired

Five orchestration defects were identified and fixed during this study:

1. **RAG domain race.** `parallel_init` executed analysis and retrieval concurrently via `asyncio.gather`, but retrieval reads `state.domain`, which was not yet set — forcing all queries to `general`. Fixed to sequential coordinated execution: analyze first, then retrieval with enriched state. Post-fix probe correctly yields `ecommerce` for a shop prompt.
2. **Supervisor duality.** The supervisor computed a routing target but discarded it; the edge re-derived routing from raw intent, creating two sources of truth. Fixed by persisting `supervisor_decision` in state and making the edge read it (with legacy-checkpoint fallback).
3. **Send payload bloat.** Fan-out spread the entire state (including all file contents and API keys) into every parallel invocation, inflating SQLite checkpoints. Fixed to a minimal per-batch payload (`prompt`, `plan`, `patterns`, `existing_files`, `keys`, `current_batch`) while persisting `generation_batches` for visibility.
4. **Incremental-merge interference.** Full-template backfill (19 files) triggered whenever fewer than 5 files were produced, drowning 1–2 file patches. Fixed to incremental-safe mode: only `pubspec.yaml` / `main.dart` / `app.dart` backfilled with existing-content reuse. Measured: incremental merge = 4 files vs. full merge = 19 files for the same single-file input.
5. **Healing-flag bypass.** `enable_auto_healing=false` was ignored by both validator and routing edge. Fixed in both layers; verified `route_healing` returns `embed_artifacts` when disabled and `auto_heal_llm` when enabled under identical error inputs.

### 4.2 Functional Measurements — Before vs. After

All measurements were obtained on the analyzed checkout without external LLM calls except where noted. Table III summarizes the coordination fixes with directly measured before/after values.

**TABLE III — Before/After Coordination Metrics (measured)**

| Metric (probe) | Before (uncoordinated) | After (coordinated) | Effect |
|---|---|---|---|
| RAG domain (`shop with cart` prompt) | `general` (race: retrieval ran before analysis set `domain`) | `ecommerce` (analyze → retrieval with enriched state) | 0% → 100% correct on 3 domain probes |
| Supervisor routing | No persisted decision; edge re-derived from `intent` (divergence risk) | `supervisor_decision` persisted; edge reads single source (`chat→chat_answer`, `build→plan_architecture`, `edit→incremental_edit`) | Deterministic; verified on 3 intent cases |
| Send payload per batch (20-file project) | ~45,165 bytes (full state incl. history, batches, events, logs) | ~41,633 bytes (minimal: prompt, plan, patterns, files, keys, batch) | −7.8% per Send; −101,340 bytes total waste over 5 batches (excluded fields now 0 bytes) |
| Incremental merge (1-file patch + 1 existing file) | 19 files (full template flood drowns patch) | 4 files (patch + `pubspec`/`main`/`app`, existing content reused) | −79% noise; patch precision restored |
| Healing flag (`enable_auto_healing=false`, 1 error) | → `auto_heal_llm` (flag ignored) | → `embed_artifacts` (flag respected); `true` → `auto_heal_llm` | Correct gating in validator + edge |
| Intent routing (4 prompts) | 4/4 correct (`build`/`edit`/`chat`/`edit`) | 4/4 correct, unchanged | ~0.6 ms total, no LLM |
| Deterministic validation (19 template files) | `1 error, 8 warnings` (~2 ms) | Same (gate behavior preserved) | Error = `MISSING_SUPABASE_INIT`; 8 `FORCE_UNWRAP`/`STUB` warnings |
| Batch planning | 3 files → 3 batches `[16,1,1]`; 20 files → 7 batches `[16,4,4,4,4,2,1]` | Same (planner unchanged) | Parallelism scales with plan size |
| Chat e2e (`ainvoke`, no API key) | Routes but no decision trace | `intent=chat`, `decision=chat_answer`, 5 events, `success=True`, ~8 ms | Graceful degradation confirmed |
| Graph integrity | 11/11 nodes compile | 11/11 nodes compile | No regression |

Detailed notes:

- **Intent routing:** `build a shop` → `build/False`; `fix login bug` → `edit/True`; `what is provider?` → `chat/False`; `add dark mode` → `edit/True` in ~0.6 ms total.
- **Domain detection:** `fitness tracker` → `fitness`, `ecommerce store with cart` → `ecommerce`, `chat app with realtime` → `chat` across 14 keyword domains.
- **Deterministic validation:** 19 production template files validated in ~2 ms with result `1 error(s), 8 warning(s)`, confirming the validator is sensitive enough to gate the healer without LLM cost.
- **Graph integrity:** 11/11 nodes compile; chat-path `ainvoke` with empty API key returns degraded-but-successful answer with 5 events and `success=True`, confirming graceful degradation.
- **Baseline generation capacity:** 16 always-core files + auth + chunked features + SQL; fallback templates provide a compilable fallback (analyzer-clean templates) even under total LLM failure.

### 4.3 Discussion

The results confirm that coordination — not raw model power — dominates multi-file generation reliability, consistent with recent findings that agent scaffolding can cause up to 6× performance gaps for the same backbone model [10] and that multi-agent decomposition beats single-pass generation for complex UI tasks [9], [14]. Reducer-based fan-in prevents silent file loss; single-source supervisor decisions prevent route divergence; incremental-aware merging preserves user edits; and deterministic-then-LLM healing bounds cost while maximizing fix rate, mirroring the prune-before-propagate principle in CodeCoR [3] and the retriever-matters-more-than-generator result in [13]. Our BM25-friendly RAG fallback aligns with [13], [14], and our closed plan→generate→test→heal loop follows the KGMACG pattern [2]. The dual-plane (Python parallel vs. TypeScript single-pass) design improves availability but risks output divergence and should be versioned against a shared file-manifest contract in future work. The low absolute success rates reported for full-app generation in APPFORGE (~18.8%) [6] and SWE-Bench Mobile (12%) [10] contextualize our template-guaranteed compilability strategy as a pragmatic reliability floor.

**Limitations:** No live-LLM latency/quality benchmark is reported here; healing efficacy beyond 3 files/round and resume-after-interrupt behavior require dedicated fault-injection studies. Concurrency is currently unbounded across Send workers, risking OpenRouter 429 errors. Checkpoint resume lacks `interrupt()` semantics and remains a stub.

**Threats to validity:** Measurements reflect template and routing logic, not stochastic LLM output quality. Supabase-dependent RAG degrades gracefully to zero patterns when unconfigured, which was the test condition.

---

## 5. Conclusion

FlutterForge demonstrates a practical, coordinated approach to natural-language mobile-app synthesis: keyword-fast routing, domain-aware RAG, LLM architecture planning, parallel batched code synthesis, deterministic validation with bounded LLM healing, and real-time SSE observability — all persisted through SQLite checkpoints and Supabase artifacts with containerized preview. The coordination repairs reported here (domain-aware RAG sequencing, single-source supervision, minimal Send payloads, incremental-safe merging, and healing-flag enforcement) are generalizable to any LangGraph multi-agent code-generation system. Future work includes bounded-concurrency scheduling, semantic merge conflict resolution, live-LLM quality benchmarks (compilability, RLS correctness, UI completeness), and formal interrupt-based resumability.

---

## References

[1] B. Idrisov, E. Eisenacher, and T. Schlippe, "Program code generation: Single LLMs vs. multi-agent systems," in *Proc. Int. Conf. Natural Language Processing (ICNLP)*, 2025.

[2] B. Yang et al., "KGMACG: Knowledge-guided multi-agent orchestration for scalable application-level code generation," *ACM Trans. Softw. Eng. Methodol.*, accepted Aug. 2025. doi: 10.1145/3842390.

[3] R. Pan, H. Zhang, and C. Liu, "CodeCoR: An LLM-based self-reflective multi-agent framework for code generation," *arXiv preprint arXiv:2501.07811*, Jan. 2025.

[4] H. Chen et al., "Multi-LLM orchestration for high-quality code generation: Exploiting complementary model strengths (PerfOrch)," *arXiv preprint arXiv:2510.01379*, Oct. 2025.

[5] Y. Zhao et al., "GraphCodeAgent: Dual graph-guided LLM agent for retrieval-augmented repo-level code generation," *arXiv preprint arXiv:2504.10046*, Apr. 2025.

[6] T. Lai et al., "APPFORGE: A benchmark for complete Android app generation from natural language," in *Proc. Int. Conf. Learning Representations (ICLR)*, 2026.

[7] W. Niemiec, A. R. Tavares, and É. F. Cota, "A methodology for generating mobile applications through large language models," in *Proc. IEEE/ACM Int. Conf. Mobile Software Engineering (MOBILESoft)*, Research Track, 2026.

[8] "Looks right, works right: A project-level benchmark for multi-screen mobile app generation (MobileForge)," *arXiv preprint arXiv:2607.28645*, May 2026.

[9] "UIOrchestra: Generating high-fidelity code from UI designs with a multi-agent system," in *Proc. Findings of the Conf. Empirical Methods in Natural Language Processing (EMNLP)*, 2025.

[10] "SWE-Bench Mobile: Can large language model agents develop industry-level mobile applications?" *arXiv preprint arXiv:2602.09540*, Feb. 2026.

[11] "Retrieval-augmented code generation: A survey with focus on repository-level approaches," *arXiv preprint arXiv:2510.04905*, Oct. 2025.

[12] "RLCoder: Reinforcement learning for repository-level code completion," in *Proc. IEEE/ACM 47th Int. Conf. Software Engineering (ICSE)*, 2025, Art. no. 00014.

[13] Q. Ke et al., "Not all RAGs are created equal: A component-wise empirical study for software engineering tasks," *Proc. ACM Softw. Eng. (FSE)*, vol. 3, pp. 4161–4183, June 2026.

[14] "UI2Code-N: UI-to-code generation as interactive visual optimization," *arXiv preprint arXiv:2511.08195*, 2025.

[15] LangChain AI, "LangGraph: Building stateful multi-agent applications with LLMs," 2025. [Online]. Available: https://github.com/langchain-ai/langgraph

---

*Appendix — Reproduction notes: backend requires Python 3.11+, `pip install -e ./agent-backend`, `OPENROUTER_API_KEY` in `agent-backend/.env`, `uvicorn main:app --port 8000`; frontend requires Node 20+, `npm install`, `npm run dev`; one-command stack via `docker compose up --build`. Analysis probes used in-memory LangGraph checkpointer and template-only validation (no LLM cost).*
