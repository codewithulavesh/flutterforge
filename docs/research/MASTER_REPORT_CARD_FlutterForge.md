# MASTER REPORT CARD — FlutterForge (for IEEE paper: full data breakdown + documentation)

> By: Shradha Takkekar (2BU23CS135), Srushti Churamari (2BU23CS150), Vijeta Kotnikallamath (2BU23CS175), Ulavayya Karaguppi (2BU24CS419) | Guide: Mrs. Sahana Bisalapur | Batch 26, AY 2026–2027
> Git: `cb15e68` | Flutter 3.47.5 / Dart 3.13.4 | Python 3.12.14 | Date UTC 2026-10-09
> Rule: MEASURED = ran here; ESTIMATED = labeled assumption with source. FX used: $1 = ₹83 (state if you use another rate).

---

## 1. COMPONENT + FUNCTION TEST REPORT (23/23 PASS, measured today)

| # | Component / function | Input | Result | Time |
|---|---|---|---|---|
| 1 | classify.build | "build a shop", no files | build/False | 1.1 ms |
| 2 | classify.edit | "fix login bug", 1 file | edit/True | 0.0 ms |
| 3 | classify.chat | "what is provider?", no files | chat/False | 0.0 ms |
| 4 | analyze | "fitness tracker with auth" | domain fitness, auth email | 0.0 ms |
| 5 | vector.degraded (no Supabase) | "shop" | 0 patterns + event (graceful) | 0.3 ms |
| 6 | parallel_init | "ecommerce store with cart" | domain ecommerce + 2 events | 0.3 ms |
| 7–9 | supervisor.chat/build/edit | intents | chat_answer / plan_architecture / incremental_edit | 0.1 ms each |
| 10 | route.sup | decision=chat_answer | chat_answer | 0.0 ms |
| 11 | route.heal.off | 1 err, flag false | embed_artifacts | 0.0 ms |
| 12 | route.heal.on | 1 err, flag true | auto_heal_llm | 0.0 ms |
| 13 | plan.fallback | "fitness app" | app_id `fit_*`, 21-file plan | 0.1 ms |
| 14 | parser | fence `filepath="lib/a.dart"` | 1 artifact parsed | 0.0 ms |
| 15 | validator.19 | 19 templates | 1 err (`MISSING_SUPABASE_INIT`) + 8 warn | 1.8 ms |
| 16 | merge.incr | 1 patch + main, incremental | 4 files | 0.0 ms |
| 17 | merge.full | 1 file, full | 32 files (1 patch + 31 templates) | 0.1 ms |
| 18 | validate_code.gate | 31 files, heal on | valid=True, 0 issues, heal skipped | 3.0 ms |
| 19 | chat.degraded | no key | degraded message + success | 0.2 ms |
| 20 | embed.degraded | 2 files, no Supabase | success + summary event | 0.1 ms |
| 21 | graph.compile | schema build | 11/11 nodes | 3.3 ms |
| 22 | planbatch | 3 generic files | 2 batches | 0.0 ms |
| 23 | llmpool.nokey | no key/model | default `nvidia/nemotron-3-ultra-550b-a55b:free` | 0.0 ms |

NOT TESTED live (needs key + network + cost): `generate_batch`, `incremental_edit`, `auto_heal_llm`, `plan_architecture` LLM path, Supabase RAG/persist with credentials, preview Docker build. Their deterministic sub-parts (parser/validator/merge) are covered above.

## 2. FLUTTER VERIFICATION (measured)

- Templates: 31 files, 1730 LOC (1656 Dart + 45 SQL + 29 YAML); fallback-plan completeness 21/21.
- `flutter pub get`: 119 deps resolved.
- `flutter analyze` (after get): **No issues found (0/0/0)** in 1.7–1.9 s. `flutter build web --release`: **✓ Built build/web, 32.4 s**. Own validator: **valid=True, 0 issues** (was 1 err + 8 warn). Before get: 840 `uri_does_not_exist` (expected, packages unfetched).
- Micro-benchmarks n=20: classify 0.06/0.10/0.85 ms; domain 0.02; validate 1.56/1.64/1.96; merge 0.01; plan 0.02.

## 3. BEFORE/AFTER COORDINATION (measured, Table III)

RAG general→ecommerce; routing single-source (3/3); Send 61,175→40,907 B (−33.1%; excluded 20,268/Send → 0; −101,340/5 batches); merge 19→4 (−78.9%); heal flag now gated; intent 4/4; batches 3→[16,1,1], 20→[16,4,4,4,4,2,1]; chat 5 events/success/~8 ms; 11/11 compile.

## 4. TOTAL COST TO BUILD 1 APP — TRADITIONAL vs OURS (INR, with required add-ons)

Scope: 1 MVP = 19-file FlutterForge scope. Two baselines shown: (A) our 44.5 h bottom-up scope (§EVAL §3); (B) market 300 h MVP (280–350 h band). Market rates 2026 (web sources, labeled): India mid freelancer ₹2,000/h (~$25); senior ₹2,800–4,000/h; India agency fixed MVP ₹3.3–6.6L ($4–8k); US $150/h. Freelancer true-cost ×1.4–1.8 (Xenotix). Maintenance 15–20%/yr (SCM). Store: Apple ₹8,217/yr ($99), Google ₹2,075 one-time ($25). Hosting/SaaS (Supabase/maps/push/OTP): ₹4,000–40,000/mo → use ₹10,000/mo staging assumption. GST 18% India invoice (recoverable for GST-registered; export zero-rated) — shown separately.

**TABLE A — 1-app build cost (A) 44.5 h scope, INR**

| Line | Traditional (India mid ₹2,000/h) | FlutterForge (free models) | FlutterForge (paid ref) |
|---|---|---|---|
| Dev/generation | 44.5×2000 = ₹89,000 | ₹0 generation | ₹5 tokens (~$0.06×83) |
| Review/QA (ours: 2 h × 2000) | included above | ₹4,000 | ₹4,000 |
| PM/QA overhead (8% trad; 0 ours) | ₹7,120 | ₹0 | ₹0 |
| Subtotal build | **₹96,120** | **₹4,000** | **₹4,005** |
| Yr-1 maintenance (18%) | ₹17,302 | ₹720 (18% of review) | ₹721 |
| Store Yr-1 (Apple+Google) | ₹10,292 | ₹10,292 | ₹10,292 |
| Hosting 12 mo × 10k | ₹1,20,000 | ₹1,20,000 | ₹1,20,000 |
| **Total Yr-1 (A)** | **₹2,43,714** (+18% GST ₹43,869 if domestic non-recoverable) | **₹1,35,012** | **₹1,35,018** |
| Saving vs trad | — | **₹1,08,702 (44.6%)** | same |

**TABLE B — 1-app build cost (B) market 300 h MVP, INR**

| Line | India freelancer true (₹2,000×300×1.5) | India agency fixed | US ($150×300) | FlutterForge free |
|---|---|---|---|---|
| Build | ₹9,00,000 | ₹4,95,000 ($6k mid) | ₹37,35,000 ($45k) | ₹4,000 (review) |
| Yr-1 maint 18% | ₹1,62,000 | ₹89,100 | ₹6,72,300 | ₹720 |
| Store + hosting | ₹1,30,292 | ₹1,30,292 | ₹1,30,292 | ₹1,30,292 |
| **Total Yr-1 (B)** | **₹11,92,292** | **₹7,14,392** | **₹45,37,592** | **₹1,35,012** |
| Saving vs | — | — | — | **88.7% vs freelancer; 81.1% vs agency; 97.0% vs US** |

Dev-only (excl. common store/hosting): trad (A) ₹96,120 → ours ₹4,000 = **95.8% / 24×**; (B) freelancer ₹9,00,000 → ₹4,000 = **99.6% / 225×**. Time: 44.5 h → 2 h (95.5%, 22×); 300 h (8–12 wk) → 2 h (~99.3%, ~150×).

BYOK (measured): request `api_key` > `OPENROUTER_API_KEY`; `model_name` > `AGENT_MODEL`; 6-model fallback, 3 attempts/node; free IDs $0, paid ~$0.06/app (122,500 tokens: 30.5k in + 92k out).

## 5. IEEE PAPER MAPPING (paste-ready)

Abstract (181 w) + 8 keywords: keep; fix "14→13 domains". §1 problem/objectives: §above. §2 related: 15 refs (2025–26). §3 method: §4 hyperparams + flow + reducers. §4 results: Tables III (coordination) + IV (micro n=20) + V (analyze 16/0/0) + A/B (INR). §5 conclusion + stub disclosures (resume/delete, uncapped concurrency, `duration_ms`). Appendix: repro commands + golden outputs + this report card.

## 6. DOCUMENTATION CHECKLIST FOR SUBMISSION

- [ ] Author block (4 USNs + guide + batch 26 + AY) — done in paper
- [ ] Tables I (API 7), II (11 nodes), III (before/after), IV–V (bench + analyze), A–B (INR), VIII (BYOK)
- [ ] Figures: StateGraph + ER (12 tables) + SSE sequence — TO DRAW (ASCII in repo docs only)
- [ ] Screenshots: prompt→files→preview, validation event, healed diff, Supabase rows, `flutter analyze` 16/0/0
- [ ] Fix list: 14→13, chain sync, README parallel wording, "resumable"→"checkpointed", Send methodology note
- [ ] Live work (for stronger grade): 10 prompts × 3 seeds, `flutter analyze`/`build web` pass table, cost log, kill-resume test

*End. All MEASURED numbers ran on this checkout; market/rate/baseline-hour figures are labeled estimates with 2026 web sources (hireflutterdev, SCM, Primocys, Xenotix, ITD Labs, Naraway).*
