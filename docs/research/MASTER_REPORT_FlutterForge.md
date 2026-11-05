# MASTER REPORT — FlutterForge: All Metrics and Data Required for IEEE Paper

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
> Git HEAD: `cb15e68d80e4bfa57c86a6089d56303f0f6bdfb3` (`cb15e68 feat: FlutterForge AI agent + preview infra + workspace`)
> Report date (UTC): 2026-10-09. All numbers below are measured from this checkout. Runtime: Python 3.12.14, darwin/Clang 17.

---

## 1. PAPER IDENTITY (for IEEE submission)

| Field | Value |
|---|---|
| Title | FlutterForge: A Coordinated Multi-Agent LangGraph System for Functional Flutter and Supabase Code Generation |
| Authors | Shradha Takkekar (2BU23CS135), Srushti Churamari (2BU23CS150), Vijeta Kotnikallamath (2BU23CS175), Ulavayya Karaguppi (2BU24CS419) |
| Guide | Mrs. Sahana Bisalapur, Batch 26, AY 2026–2027 |
| Venue / Year / DOI / arXiv | NOT STATED (draft for IEEE) |
| Paper type | Systems + empirical |
| IEEE sections required | Title+Authors, Abstract (181 words), Keywords (8), Introduction, Methodology, Results & Discussion (Table III before/after), Conclusion, References (15 recent 2025–2026) |
| Companion file | `IEEE_FlutterForge_Paper.md` (root) — already updated with authors + recent refs + Table III |

---

## 2. PROJECT INVENTORY (exact counts)

| Area | Count (measured) |
|---|---|
| Backend graph `.py` files (`agent-backend/graph`) | 22 |
| Backend graph LOC | 3945 total |
| `main.py` / `graph.py` / `state.py` LOC | 491 / 308 / 246 |
| Frontend TS/TSX files (`src`) | 97 |
| Frontend `src/agent/*.ts` + `src/stores/*.ts` LOC | 8902 total |
| Supabase `full_schema.sql` | 571 lines, 12 `CREATE TABLE` |
| Supabase migrations | 4 files |
| Template fallback files | 19 |
| Always-core files (Batch 0) | 16 |
| LangGraph nodes | 11 (compile 11/11) |
| Conditional edges | 2 (`route_supervisor`, `route_healing`) |
| Specialist agent roles | 6 (supervisor, architect, codegen, qa/healer, patch, chat) + analyzer = 7 labels in `AGENT_ROLES` |
| SSE event types | 8 |
| REST endpoints | 7 |
| Validator codes observed | 8 (`MISSING_PUBSPEC`, `MISSING_MAIN_DART`, `MISSING_SUPABASE_INIT`, `DYNAMIC_CAST`, `FORCE_UNWRAP`, `STUB_CODE`, `MISSING_DEPS`, empty-string artifact of grep) |
| Domain keyword groups | 13 (paper text says 14 — **inconsistency, use 13**) |
| LLM fallback chain | 6 models |

### 2.1 Full file lists (verbatim)

**Backend graph (22, sorted):**
`agents/__init__.py`, `agents/supervisor.py`, `edges/__init__.py`, `edges/routing.py`, `graph.py`, `nodes/analyze_context.py`, `nodes/auto_heal_llm.py`, `nodes/chat_answer.py`, `nodes/classify_intent.py`, `nodes/embed_artifacts.py`, `nodes/generate_batch.py`, `nodes/incremental_edit.py`, `nodes/merge_files.py`, `nodes/plan_architecture.py`, `nodes/validate_code.py`, `nodes/vector_retrieval.py`, `state.py`, `tools/code_parser.py`, `tools/domain_detector.py`, `tools/flutter_templates.py`, `tools/llm_pool.py`, `tools/validator.py`

**Template files (19, sorted):**
`lib/app.dart`, `lib/core/router/app_router.dart`, `lib/core/services/supabase_service.dart`, `lib/core/theme/app_theme.dart`, `lib/core/theme/theme_controller.dart`, `lib/core/widgets/app_header.dart`, `lib/core/widgets/main_nav_scaffold.dart`, `lib/features/auth/screens/login_screen.dart`, `lib/features/auth/screens/register_screen.dart`, `lib/features/home/screens/home_screen.dart`, `lib/features/onboarding/screens/onboarding_screen.dart`, `lib/features/profile/screens/profile_screen.dart`, `lib/features/settings/screens/settings_screen.dart`, `lib/features/shared/models/item_model.dart`, `lib/features/shared/models/user_model.dart`, `lib/features/shared/providers/app_provider.dart`, `lib/main.dart`, `pubspec.yaml`, `supabase/migrations/001_initial_schema.sql`

**Supabase tables (12, sorted):**
`ai_conversations`, `ai_messages`, `builds`, `code_patterns`, `dependencies`, `deployments`, `generation_tasks`, `profiles`, `project_file_embeddings`, `project_files`, `project_versions`, `projects`

**Migrations (4):**
`20260826074417_flutterforge_schema.sql`, `20260826081749_add_shared_projects.sql`, `20260826090000_fix_auth_profile_trigger.sql`, `20260829173748_vector_store.sql`

**API endpoints (7):**
`POST /api/agent/stream`, `POST /api/agent/run`, `GET /api/agent/checkpoint/{project_id}`, `POST /api/agent/stream/{project_id}/resume`, `DELETE /api/agent/checkpoint/{project_id}`, `GET /health`, `GET /`

**SSE events (8):**
`agent_event`, `token`, `file_ready`, `files_merged`, `validation`, `chat_answer`, `done`, `error`

**Nodes (11):**
`auto_heal_llm`, `chat_answer`, `classify_intent`, `embed_artifacts`, `generate_batch`, `incremental_edit`, `merge_files`, `parallel_init`, `plan_architecture`, `supervisor_orchestrate`, `validate_code`

**Domains (13):**
`chat`, `ecommerce`, `education`, `finance`, `fitness`, `food`, `healthcare`, `music`, `news`, `productivity`, `real_estate`, `social`, `travel`

**Model chain (6, verbatim `llm_pool.py`):**
`nvidia/nemotron-3-ultra-550b-a55b:free`, `poolside/laguna-s-2.1:free`, `cohere/north-mini-code:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `google/gemma-4-31b-it:free`, `nvidia/nemotron-3.5-lightning:free`

---

## 3. TECH STACK (versions measured)

| Layer | Value |
|---|---|
| Python | 3.12.14 measured (requires >=3.11) |
| Backend deps (`pyproject.toml`) | `langgraph>=0.2.28`, `langgraph-checkpoint-sqlite>=2.0.0`, `langchain>=0.3.0`, `langchain-core>=0.3.0`, `langchain-openai>=0.2.0`, `fastapi>=0.115.0`, `uvicorn[standard]>=0.30.0`, `sse-starlette>=2.1.0`, `python-dotenv>=1.0.0`, `httpx>=0.27.0`, `pydantic>=2.8.0` |
| Frontend deps (10 prod) | `@monaco-editor/react`, `@supabase/supabase-js`, `gsap`, `jszip`, `lucide-react`, `ogl`, `react` 18.3.1, `react-dom` 18.3.1, `react-router-dom`, `zustand` 5.0.15; dev 15 incl. `vite` 5.4.2, `typescript` 5.5.3 |
| DB / Auth / vectors | Supabase Postgres + Auth + Storage + pgvector (`vector` extension in schema) |
| Preview | Docker Swarm, builder + Nginx runtime, Cloudflare tunnel; README claims BullMQ concurrency 2, TTL 15m (not executed) |

---

## 4. SYSTEM ARCHITECTURE + HYPERPARAMETERS

### 4.1 Flow (verified)

```
START → classify_intent → parallel_init → supervisor_orchestrate
 ├─ chat_answer → END
 ├─ incremental_edit → merge_files → validate_code ⇄ auto_heal_llm → embed_artifacts → END
 └─ plan_architecture --Send×N--> generate_batch → merge_files → (same QA pipeline)
```

Reducers (`operator.add`): `retrieved_patterns`, `generated_batches`, `events`, `logs`. Single-writer: `intent`, `domain`, `plan`, `merged_files`, `validation_report`, `healing_round`, `chat_answer`, `supervisor_decision` (added in fix), `current_batch` (added in fix).

### 4.2 Hyperparameters (verbatim)

| Node | Temp | max_tokens | Streaming | Attempts |
|---|---|---|---|---|
| plan_architecture | 0.1 | 8000 | No | 3 |
| generate_batch | 0.15 | 65536 | Yes | 3 |
| incremental_edit | 0.15 | 40000 | Yes | 3 |
| auto_heal_llm | 0.05 | 16000 | No | 1 per file (loop by edge) |
| chat_answer | 0.3 | 4000 | Yes | 1 (+degraded no-key path) |

Other: `max_healing_rounds=2` (request default; TS clamps 1–3); batch chunk `4`; heal `≤3 files/round`; RAG top-k `4` (code truncated 600 chars in prompt); history last `6` msgs (400–800 chars); healer file slice `8000` chars; `_ALWAYS_CORE` = 16 files.

---

## 5. EXPERIMENTS PROTOCOL (what was actually run)

No training. No live-LLM quality runs (no key used for generation paths). All probes use in-memory checkpointer or pure functions at zero LLM cost:

1. Graph compile check (`_build_graph_schema`, 11/11)
2. Intent: 4 prompts with/without existing files
3. Domain: 3 prompts over 13-domain detector
4. Validation: 19 template files via `validate()`
5. Merge: 1-patch + 1-existing (incremental True vs False)
6. Send size: synthetic 20-file project (`content 2000 chars/file`, history 6×500, events 15×200, logs 15×100) — before (full state + batch) vs after (minimal payload)
7. Batch planning: 3-file and 20-file plans
8. Healing route: same error report with flag True/False
9. Chat e2e `ainvoke` with empty key (degraded path)

Runs: n=1 per probe. Seeds: NOT STATED. Hardware: NOT STATED.

---

## 6. RESULTS — MASTER BEFORE/AFTER TABLE (exact measured)

| # | Metric (probe) | BEFORE (uncoordinated) | AFTER (coordinated) | Delta / effect |
|---|---|---|---|---|
| 1 | RAG domain (`shop with cart`) | `general` (gather race; `state.domain` unread) | `ecommerce` | 0% → 100% on 3 probes |
| 2 | Supervisor routing | no persisted field; edge re-derives from intent | `supervisor_decision` persisted; verified `chat→chat_answer`, `build→plan_architecture`, `edit→incremental_edit` | deterministic; legacy fallback kept |
| 3 | Send bytes (synthetic 20-file; latest run) | 61,175 (full state) | 40,907 (minimal) | −20,268/Send (−33.1%); excluded fields (`conversation_history`+`generated_batches`+`events`+`logs`) = 20,268/Send → 0; waste over 5 batches = 101,340 bytes. NOTE: earlier run with slightly different synthetic plan gave 45,165→41,633 (−7.8%); methodology identical, bulk is `existing_files` which is still (correctly) sent |
| 4 | Incremental merge (1 patch + `lib/main.dart` existing) | 19 files (full template flood) | 4 files (`home_screen`, `pubspec.yaml`, `lib/main.dart`, `lib/app.dart`) | −15 files (−78.9%); patch precision restored; existing content reused |
| 5 | Healing flag (1 error, round 0) | `false` → `auto_heal_llm` (ignored) | `false` → `embed_artifacts`; `true` → `auto_heal_llm` | correct gating in edge + validator |
| 6 | Intent 4 prompts | `build a shop→build/False`; `fix login bug→edit/True`; `what is provider?→chat/False`; `add dark mode→edit/True` | same | 1.0 ms total (latest; prior run 0.6 ms — machine variance) |
| 7 | Validation 19 templates | `1 error(s), 8 warning(s).` | same | 1.8 ms latest (prior 2.2 ms); error=`MISSING_SUPABASE_INIT`; 8 warnings (`FORCE_UNWRAP`/`STUB_CODE` family) |
| 8 | Batch plan | 3 files → 3 batches `[16,1,1]`; 20 files → 7 batches `[16,4,4,4,4,2,1]` | same (planner unchanged) | parallelism scales with plan |
| 9 | Chat e2e no-key | routes, no decision trace | `intent=chat`, `decision=chat_answer`, 5 events, `success=True`, ~8 ms | graceful degradation |
| 10 | Compile | 11/11 | 11/11 | no regression |

---

## 7. WHAT TO PUT WHERE IN IEEE PAPER

- **Abstract:** keep 181-word version; update "14 domains" → "13 domains" before submission (flagged inconsistency).
- **§3 Methodology:** use §4 above (flow, reducers, Table II roles, batch order, LLMPool, persistence/streaming/frontend bullets).
- **§4.1:** 5 defects narrative (already in paper).
- **§4.2:** replace with Table III = rows 1–10 above. Cite synthetic Send methodology explicitly to explain 45k vs 61k variance across runs.
- **§4.3 Discussion:** cite APPFORGE 18.81% [6], SWE-Mobile 12% + 6× gap [10], CodeCoR prune [3], BM25 robustness [13], KGMACG loop [2].
- **References:** 15 recent (2025–2026) already in paper — do not revert to 2023–2024 set.

---

## 8. COMPARISONS (cited only, not run)

APPFORGE best GPT-5 18.81% functional (101 Android apps) [6]; SWE-Bench Mobile best 12% task success, 28.1% test-pass, 6× agent gap (Opus 4.5: 12% Cursor vs 2% OpenCode) [10]; CodeCoR 77.13% avg Pass@1 vs MapCoder 72.8% [3]; PerfOrch 97.19% HumanEval-X / 95.83% EffiBench-X [4]; GraphCodeAgent +43.81% GPT-4o DevEval [5]; RLCoder +12.2% EM [12]. All different tasks/languages — context only, not apples-to-apples.

---

## 9. LIMITATIONS / THREATS / REPRODUCIBILITY

- Stated: no live-LLM benchmark; heal >3/round untested; resume needs kill-test; unbounded Send → 429; stub resume/delete; `duration_ms`/`error` unset.
- Inferred: n=1, no seeds/variance/stats; empty-RAG only; keys in checkpoints/logs; Supabase/preview unexecuted; substring domain collisions; no cost accounting.
- Repro checklist: code ❌ public URL; data ❌; seeds ❌; hardware ❌; hyperparams ✅; baselines ⚠️; stats ❌; error bars ❌.
- Ethics: bias NOT STATED; privacy concern (code+keys in payloads/checkpoints/Supabase, no retention policy); misuse (insecure RLS/auth defaults) NOT STATED; mitigations partial (validator, RLS templates, degraded refusal).

---

## 10. COMPUTE & COST

GPU-hours NOT STATED (API inference). $ NOT STATED. Carbon NOT STATED. Worst-case inference per full build: N batches × 65,536 tokens × up to 3 attempts + plan (8000×3) + heal (16000×files×rounds) — metered via OpenRouter (inference, not measured).

---

## 11. REFERENCES (15, for paper — 2025–2026)

[1] Idrisov et al., ICNLP 2025 — single vs multi-agent code gen.
[2] Yang et al., ACM TOSEM 2025, doi:10.1145/3842390 — KGMACG.
[3] Pan et al., arXiv:2501.07811 — CodeCoR.
[4] Chen et al., arXiv:2510.01379 — PerfOrch.
[5] Zhao et al., arXiv:2504.10046 — GraphCodeAgent.
[6] Lai et al., ICLR 2026 — APPFORGE.
[7] Niemiec et al., MOBILESoft 2026 — mobile LLM methodology.
[8] arXiv:2607.28645 — MobileForge.
[9] EMNLP Findings 2025 — UIOrchestra.
[10] arXiv:2602.09540 — SWE-Bench Mobile.
[11] arXiv:2510.04905 — RACG survey.
[12] ICSE 2025 — RLCoder.
[13] Ke et al., FSE 2026 — Not All RAGs.
[14] arXiv:2511.08195 — UI2Code-N.
[15] LangChain AI, LangGraph, 2025, https://github.com/langchain-ai/langgraph

---

## 12. REPRO COMMANDS (verbatim)

```bash
# backend probes (from repo root)
agent-backend/.venv/bin/python -c "import sys; sys.path.insert(0,'agent-backend'); ..."
# template count
# validation / classify / merge / send / plan / nodes / healing — see §6 for exact snippets
git log --oneline -3
git rev-parse HEAD
```

*End of master report. Fix the "14→13 domains" line in the IEEE paper before submission; keep Send methodology note to preempt reviewer questions on byte variance.*
