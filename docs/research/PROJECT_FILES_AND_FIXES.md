# Project Files, Limitations & Fixes — FlutterForge

> Covers every meaningful file (README excluded per request), what it does, limitations found, fixes applied, and verification. Git: `cb15e68`.

## 1. FILE STRUCTURE + WHAT EACH FILE DOES

### agent-backend/ (Python 3.11+, FastAPI + LangGraph)

| File | Role |
|---|---|
| `main.py` | FastAPI app + SSE streaming (`/api/agent/stream`), blocking `/run`, checkpoint get/resume/delete, `/health`; per-token + node-event fan-out with `seen_files` dedupe |
| `pyproject.toml` | Deps: langgraph, checkpoint-sqlite, langchain(-core/-openai), fastapi, uvicorn, sse-starlette, dotenv, httpx, pydantic |
| `Dockerfile` | Backend container |
| `graph/graph.py` | StateGraph wiring (11 nodes, 2 conditional edges, Send fan-out), `_plan_batches`, `parallel_init` (analyze→RAG), `fan_out_generation` (minimal payload), compile helpers |
| `graph/state.py` | `AgentState` TypedDict + 12 sub-types; reducers on patterns/batches/events/logs; `supervisor_decision`, `current_batch`, `started_at_ms`, `duration_ms` |
| `graph/agents/supervisor.py` | Supervisor node: intent→decision (`chat_answer`/`incremental_edit`/`plan_architecture`) + routing SSE event |
| `graph/edges/routing.py` | `route_supervisor` (reads single-source decision, legacy fallback), `route_healing` (respects `enable_auto_healing`, rounds cap) |
| `graph/nodes/classify_intent.py` | Regex build/edit/chat/repair scorer; sets intent, incremental, `started_at_ms`; <1 ms, no LLM |
| `graph/nodes/analyze_context.py` | Keyword domain + 11 feature flags via `domain_detector` |
| `graph/nodes/vector_retrieval.py` | Supabase `code_patterns` RAG (top 4); degrades to [] without credentials |
| `graph/nodes/plan_architecture.py` | Architect LLM JSON plan (screens/services/models/schema/filesToCreate) + 3 retries + deterministic fallback |
| `graph/nodes/generate_batch.py` | Parallel worker: streams one batch (3–4 files) from `filepath=` fences via `code_parser` |
| `graph/nodes/incremental_edit.py` | Patch worker: full-file rewrites for follow-ups with history |
| `graph/nodes/merge_files.py` | Fan-in: flatten, dedupe last-wins, critical stubs, incremental-safe backfill (only pubspec/main/app for patches) |
| `graph/nodes/validate_code.py` | 5 deterministic checks; deterministic heal on round 0 (flag-gated) |
| `graph/nodes/auto_heal_llm.py` | LLM repair ≤3 Dart files/round, loops to validate (max 2 rounds) |
| `graph/nodes/embed_artifacts.py` | Supabase upsert + summary event; sets `success`, `duration_ms` |
| `graph/nodes/chat_answer.py` | Q&A without file writes; degraded no-key path; sets `duration_ms` on all returns |
| `graph/tools/llm_pool.py` | OpenRouter `ChatOpenAI` + 6-model fallback chain + `advance()` + token clamping |
| `graph/tools/code_parser.py` | Extracts fenced blocks (primary) + `===` fallback; language by extension |
| `graph/tools/domain_detector.py` | 13-domain keyword map + feature flags |
| `graph/tools/validator.py` | Checks (`MISSING_PUBSPEC/MAIN/SUPABASE_INIT`, `DYNAMIC_CAST` err, `FORCE_UNWRAP`/`STUB_CODE` warn) + deterministic `auto_heal` |
| `graph/tools/flutter_templates.py` | 19-file analyzer-clean fallback app (Material 3, GoRouter, Provider, Supabase, RLS SQL) |

### src/ (React 18 + Vite + TS)

| File(s) | Role |
|---|---|
| `src/agent/langgraphClient.ts` | SSE client: streams 8 event types, `NODE_TO_STEP/AGENT` maps, `file_ready` accumulation, TS fallback on backend-down |
| `src/agent/index.ts` | Local single-pass `FlutterSupabaseAgent` (fallback): plan → generate → merge-with-baseline → validate → heal |
| `src/agent/planner.ts` / `schemaGenerator.ts` / `codeGenerator.ts` | Deterministic plan, SQL schema, template file synthesis |
| `src/agent/llmClient.ts` / `keyPool.ts` | OpenRouter calls + key/model rotation mirroring backend pool |
| `src/agent/validator.ts` | TS mirror of deterministic checks + auto-heal |
| `src/agent/context.ts` / `vectorStore.ts` / `seedPatterns.ts` / `chatIntent.ts` / `chatAnswer.ts` / `prompts.ts` / `types.ts` | Semantic context, Supabase vector RAG, seed patterns, chat intent/answers, system prompts, shared types |
| `src/stores/` (6) | `project` (1226 lines: files/versions), `preview`, `auth`, `terminal` (agent events), `theme`, `workspace` |
| `src/features/workspace/` | AIBuilderPanel, PreviewPanel (+GenerationProgressCards), CodeEditor (Monaco), FileExplorer, TerminalPanel, BuildOutputPanel, Git/Export/Deploy/Dependencies/Problems/Settings/Theme/Components/Views, CommandPalette, Sidebar, Toolbar |
| `src/features/dashboard/` + `src/pages/` | Landing, Login/Signup/Forgot, Dashboard, Workspace routes; Protected/Public guards |
| `src/utils/flutterTemplates.ts` | Frontend mirror of fallback templates (kept in sync: publishableKey fix applied) |
| `src/utils/` others | fileTree, exportProject (zip), appId, cn, constants |

### supabase/ + preview-infra/ + root

| File(s) | Role |
|---|---|
| `supabase/full_schema.sql` (571 lines, 12 tables) | projects, project_files (UNIQUE project_id,path), versions, ai_conversations/messages, code_patterns, embeddings, profiles, builds, deployments, dependencies, generation_tasks |
| `supabase/migrations/` (4) | Base schema, shared projects, auth trigger fix, vector store |
| `preview-infra/` | Docker Swarm Flutter-web builder + Nginx runtime + Cloudflare tunnel; 15m TTL (README; not executed here) |
| `docker-compose.yml` / `Dockerfile` / `vite.config.ts` / `package.json` | One-command stack (backend :8000 + frontend :5173); 10 prod + 15 dev JS deps |

## 2. LIMITATIONS FOUND → FIX APPLIED → VERIFIED

| # | Limitation (before) | Fix (file) | After (measured) |
|---|---|---|---|
| 1 | Templates: 16 `flutter analyze` issues (2 err CardTheme + 14 info withOpacity; 1 anonKey counted in infos) | `flutter_templates.py`: withOpacity→withValues; `CardTheme(`→`CardThemeData(` (×2); `anonKey:`→`publishableKey:` (+ stub in `merge_files.py`, mirror in `flutterTemplates.ts`) | **No issues found** (0/0/0, 1.7–1.9 s, fresh pub get) |
| 2 | RAG domain race (always `general`) | `graph.py parallel_init`: analyze→RAG sequential | `ecommerce` correct (3/3 probes) |
| 3 | Supervisor duality (decision discarded) | `state.py` + `supervisor.py` + `routing.py`: persisted `supervisor_decision`, single-source read | 3/3 routes deterministic |
| 4 | Send bloat (full state × N) | `graph.py fan_out_generation`: minimal payload | 61,175→40,907 B; −101,340/5 batches |
| 5 | Merge flood (patch→19 files) | `merge_files.py`: incremental-safe (3 critical only) | 19→4 files |
| 6 | Healing bypass (flag ignored) | `routing.py` + `validate_code.py`: flag-gated | off→embed, on→heal |
| 7 | Unbounded fan-out (429 risk) | `main.py`: `MAX_PARALLEL_BATCHES=3` via `max_concurrency` on stream/run/resume | Config present; load test still open |
| 8 | `duration_ms` never set (0 on chat) | `state.py` + `classify_intent.py` (`started_at_ms`) + `embed_artifacts.py` + `chat_answer.py` (all returns) | Chat run: `duration_ms=1`, success, 5 events |
| 9 | Delete checkpoint stub (always True) | `main.py`: real `adelete_thread` attempt, honest False + note when unsupported | Code path verified by compile; live-DB test open |
| 10 | Done event empty `{}` | `main.py`: done now carries `{files, duration_ms}` (frontend-compatible) | Backward compatible (frontend ignores extras) |
| 11 | README stale (chain 6th model, "concurrent", "production-ready") | `README.md`: chain→`nemotron-3.5-lightning`, parallel→coordinated wording, functional scope note | Grep-clean for stale strings |
| 12 | Overclaim "production-grade" (papers) | All 6 report/paper files reframed to functional MVP prototypes | Zero hits across paper files |
| 13 | Completeness 9/21 (12 fallback files absent) | `flutter_templates.py`: 12 new generators + registered (constants, context_ext, auth_service, app_colors, validators, custom_button, empty_state, error_view, loading_overlay, shimmer_card, auth_provider, seed.sql) | 21/21 = 100% (measured) |
| 14 | Own validator red on own templates (1 err + 8 warn) | `validator.py`: accept `SupabaseService.initialize`; postfix-`!` regex (leading `!flag` no longer flagged). Templates: 5 genuine bangs removed (subtitle, _error, 3× _client promotion) | valid=True, 0 issues (measured) |
| 15 | 16 analyzer infos + 0 builds proven | withOpacity→withValues; CardTheme→CardThemeData; anonKey→publishableKey (+stub + TS mirror) | **No issues found; release build ✓ 32.4 s** |

## 3. STILL OPEN (honest backlog for paper §Limitations)

Live-LLM quality (compile/build pass × seeds), RAG with populated vectors, concurrency load test, kill-resume test, TS-vs-graph parity numbers, token/cost log per run, key hygiene (keys still travel in Send payloads by design — workers need them; noted, not fixed), multi-user isolation, preview e2e run.

## 4. VERIFICATION LOG (this session)

- Component suite: 23/23 PASS (re-run clean after edits; only `planbatch.3`=2 noted — input-dependent, correct).
- Chat e2e: `duration_ms=1`, 5 events, success (was None before fix).
- `py_compile` main.py + merge_files.py: OK.
- Flutter: /tmp/ff_eval→16 issues (2 err+14 info) → /tmp/ff_eval4→0 issues after all template fixes (fresh `pub get` each). /tmp/ff_eval6 (31 files): **No issues found; `flutter build web --release` ✓ Built build/web, 32.4 s**.
- Grep: papers zero `production-grade/ready`; README chain/parallel/scope synced.
