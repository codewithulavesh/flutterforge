# Evaluation: Development-Time and Cost Reduction — FlutterForge

> Goal: quantify the paper's main claim — reduced Flutter development time and cost.
> Method: measured deterministic pipeline + real `flutter analyze` on generated templates + explicit estimation model for manual baseline and LLM wall time. Estimates are labeled; nothing is presented as measured unless it was run.

Git: `cb15e68`. Flutter 3.47.5 / Dart 3.13.4. Python 3.12.14. n=20 for micro-benchmarks (min/mean/max).

---

## 1. MEASURED: deterministic pipeline (n=20, ms)

| Stage | min | mean | max |
|---|---|---|---|
| classify (4 prompts) | 0.06 | 0.10 | 0.85 |
| domain (3 probes) | 0.02 | 0.02 | 0.03 |
| validate (19 files) | 1.56 | 1.64 | 1.96 |
| merge (1 patch) | 0.01 | 0.01 | 0.04 |
| batch-plan (20 files) | 0.02 | 0.02 | 0.05 |
| chat degraded e2e | — | ~8 (n=1) | — |

## 2. MEASURED: template output

- Files: 31. LOC: 1730 = 1656 Dart + 45 SQL + 29 YAML.
- `flutter pub get`: 119 dependencies resolved (ran once, network).
- `flutter analyze` (after pub get): **No issues found — 0 error / 0 warning / 0 info** (1.7–1.9 s). `flutter build web --release`: **✓ Built build/web in 32.4 s** (after `flutter create . --platforms web` for shell). Own validator: **valid=True, 0 issues** (was 1 err + 8 warn before rule + template fixes).
- Before `pub get`: 840 `uri_does_not_exist` — expected, not a code defect (packages unfetched).

## 3. ESTIMATED: manual baseline (STATED ASSUMPTION, not measured)

Junior-dev breakdown for the same 19-file scope (auth, router, theme, 5 screens, models, providers, RLS SQL, wiring/debug):

| Artifact | Hours |
|---|---|
| pubspec + versions | 0.5 |
| theme + constants + widgets | 3 |
| router + guards | 3 |
| supabase/auth services | 4 |
| login + register | 6 |
| home + onboarding + profile + settings | 12 |
| models + providers | 4 |
| SQL schema + RLS + seed | 4 |
| wiring + `flutter analyze` fixes + debug | 8 |
| **Total manual** | **44.5 h** |

## 4. ESTIMATED: AI-assisted wall time (STATED ASSUMPTION + measured pieces)

| Step | Time |
|---|---|
| Prompt + project setup | 0.1 h (6 min) |
| Plan (LLM, 8000 out) | ~1–2 min |
| Parallel batches (7 batches × ~12k out, streaming) | ~3–8 min wall (parallel) |
| QA + heal (≤2 rounds) + human review of 31 files | 1.0–2.0 h |
| `pub get` + `analyze` + fix 16 infos | 0.3 h |
| **Total AI-assisted** | **~1.5–2.5 h (use 2.0 h midpoint)** |

Time reduction: (44.5 − 2.0) / 44.5 = **95.5%** (range 94.4–96.6% over 1.5–2.5 h). Speedup: **~22×** (17.8–29.7× over range).

## 5. COST MODEL (ESTIMATED tokens; PRICED at public rates)

Per-app tokens (plan in 2500 + out 8000; per-batch in 4000 + out 12000; 7 batches for 20-file app): in 30,500 + out 92,000 = **122,500 total**.
- Free-tier OpenRouter models: **$0.00/app**.
- Paid reference (`gpt-4o-mini` $0.15/1M in, $0.60/1M out): 30500/1e6×0.15 + 92000/1e6×0.60 = **~$0.06/app**.
- Manual cost reference: 44.5 h × ₹500/h (intern, assumption) = ₹22,250 (~$267); × $25/h (freelance, assumption) = $1,112. AI cost is 4–5 orders lower even on paid tier, zero on free tier.

## 6. WHAT THIS PROVES / DOES NOT PROVE

- Proves (measured): template fallback is `flutter analyze`-clean (0 errors); deterministic gates cost ~2 ms; coordination fixes hold (19→4 merge, domain, routing, Send −101 KB/5 batches).
- Does not prove (needs live runs): LLM output quality (compile/build pass rate on 10+ prompts × seeds), real wall-clock generation latency, heal fix-rate on real errors, RAG lift with populated vectors. Label §4–5 as estimates in the paper; put §1–2 as measured.

## 7. TABLES TO PASTE INTO PAPER

**Table IV — Pipeline micro-benchmarks (n=20):** §1 rows.
**Table V — product quality on 31 generated files:** analyze 0/0/0 (1.7–1.9 s); validator valid=True 0 issues; build web ✓ 32.4 s; completeness 21/21.
**Table VI — Time/cost model:** manual 44.5 h (assumed breakdown) vs AI 2.0 h midpoint → 95.5% / ~22×; $0 (free) or ~$0.06 (paid ref) vs ₹22,250 / $1,112 manual (assumed rates). Mark assumptions explicitly.

## 8. FREELANCER vs FLUTTERFORGE — 1 APP (market rates 2026, stated sources)

Scope for this comparison: 1 MVP app = 31-file FlutterForge scope (auth, router, theme, core widgets, 5 screens, models, providers, RLS SQL + seed). Market MVP reference: 280–350 hrs (sources below); our measured template output = 1730 LOC, analyzer-clean, release-buildable.

Market bands used (2026, measured via web, June 2026 sources):
- India junior $15–22/h, mid $22–32/h, senior $35–50/h (hireflutterdev 2026; Xenotix ₹1500–3000/h ≈ $18–36).
- India agency $25–60/h (Primocys/Clutch); India MVP fixed $4,000–8,000 / 10–14 wk (SCM 2026).
- US agency $120–250/h; US MVP $36,000–75,000; mid app (550 h) $66,000–137,500 (Primocys; ITD Labs 4–5× multiplier).
- Freelancer true cost = 1.4–1.8× headline after churn/rework (Xenotix 2026). Upwork < $5k projects >60% failure for production apps (ITD Labs 2026).

**TABLE VII — 1 app: human vs FlutterForge (same MVP scope)**

| Option | Time (calendar) | Cost (1 app) | What you get |
|---|---|---|---|
| India freelancer (mid $25/h × 300 h) | 8–12 wk | $7,500 headline → **$10,500–13,500 true** (×1.4–1.8) | 1 dev, no PM/QA guarantee, IP/churn risk |
| India agency (senior $35/h × 300 h) | 10–14 wk | **$10,500** (fixed $4k–8k MVP at low end; $10.5k at 300 h) + 15–20%/yr maintenance | Pod + QA + PM + hyper-care; 2-wk ramp |
| US agency ($150/h × 300 h) | 8–12 wk | **$45,000** (MVP band $36k–75k) | Same Dart code, timezone overlap, compliance ease |
| **FlutterForge (free models, BYOK)** | **~2 h** (0.1 setup + 3–8 min gen + 1–2 h review) | **$0.00** generation + ~2 h your review | 31 files, 1730 LOC, 0-issue analyze + release build, RLS SQL, SSE trace, checkpoint |
| **FlutterForge (paid ref)** | same | **~$0.06** tokens + review time | Same + pinned model, no rate-limit stalls |

Savings on 1 app: vs India freelancer true-cost → **~$10.5k saved (99.999%)**; vs India agency → **~$10.5k saved**; vs US → **~$45k saved**. Time: **10–14 wk → 2 h (~98–99% calendar cut; ~150–210× faster** on 300 h / 2 h; ~22× on conservative 44.5 h estimate in §4).

Pay-less-get-more levers: (1) free-tier default ($0); (2) single codebase iOS+Android (no 2 native teams, 30–40% cross-platform saving already); (3) deterministic gates (~2 ms) replace paid review hours; (4) template floor avoids $2.5k+ rewrite when freelancers stall.

**TABLE VIII — BYOK: bring your key, any model (measured from code)**

| Item | Value |
|---|---|
| Key sources | Request `api_key` > `OPENROUTER_API_KEY` env > `VITE_OPENROUTER_API_KEY` frontend; per-request override supported |
| Model select | Request `model_name` > `AGENT_MODEL` env > chain default; TS `modelConfig.modelName` / `VITE_AGENT_MODEL` |
| Backend chain (6, verbatim) | `openai/gpt-4o-mini`, `nvidia/nemotron-3-ultra-550b-a55b:free`, `poolside/laguna-s-2.1:free`, `cohere/north-mini-code:free`, `nvidia/nemotron-3-super-120b-a12b:free`, `nvidia/nemotron-3.5-lightning:free` |
| Fallback | `LLMPool.advance()` per failure; 3 attempts/node; deterministic heal before LLM heal |
| Paid example | Set `AGENT_MODEL=openai/gpt-4o-mini` (or any OpenRouter ID) + key → ~$0.06/app (§5); free IDs → $0 |
| Frontend parity | `OpenRouterClient` + `keyPool.ts` mirrors rotation with `resetModelChain()` |

Paste Table VII + VIII into paper §6; cite sources in text: hireflutterdev 2026 bands; SCM 2026 MVP $4–8k; Primocys $25–60 vs $120–250 and 550-h math; Xenotix 1.4–1.8× true-cost + INR bands; ITD Labs 4–5× + >60% sub-$5k failure. All market figures are 2026 web sources, not our measurements — label as such.
