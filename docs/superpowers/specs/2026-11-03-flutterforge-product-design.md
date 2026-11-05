# FlutterForge — Full Product Design

**Date:** 2026-11-03  
**Status:** Revised 2026-11-03 — 3.1 scope locked end to end; no UI changes; implementation plan next  
**Scope:** FlutterForge platform only. The TAXIFY demo app is out of scope and must not be modified.  
**Decisions locked by the user:** two-tier isolation; local previews now with a hosted seam later; full spec + design contract before code.  
**Added requirements (same request):** professional output rather than dummy apps; Supabase backend generated when required; end-to-end handling from prompt to preview; a skills library with prebuilt packs, per-project enablement, and connected skills; all nine 3.1 commitments; no UI redesign or new navigation.

---

## 1. How to read this document

This is the product and architecture contract for FlutterForge 1.0. It defines:

- what the product does at each pipeline stage,
- which artifacts are authoritative,
- where the security boundaries are,
- what "professional, not dummy" means in testable terms,
- how skills and Supabase fit into generation,
- how the work is sequenced so each phase ships something usable.

It does not restyle any approved surface. New capability is added inside the existing workspace chrome and design tokens.

---

## 2. Product thesis

FlutterForge is a desktop-first app studio that turns a product request into a complete, runnable Flutter application with a real backend when the product needs one. It runs locally, keeps the user's keys in the OS keychain, isolates generated code, verifies the result instead of assuming it, and ships the same codebase to web, macOS, and Windows.

The promise is not "code appears." The promise is:

> The app compiles, every declared screen and control works, data persists, the backend is secured with RLS, and the user can see the evidence.

That promise is what separates this from a demo generator. Every stage below exists to make the promise testable.

### 2.1 What "like Lovable and Replit" means here

Parity is defined as a concrete feature set in section 17, not a slogan. The must-have core is:

- prompt enhancement into a product spec,
- plan approval before code,
- complete app generation with real persistence,
- live, isolated preview across device sizes,
- version checkpoints and restore,
- Supabase backend generation and connection,
- GitHub export,
- one-click local publish and export,
- a skills system with prebuilt and connected skills,
- professional quality gates and a visible run report.

Collaboration, a public template marketplace, and hosted custom domains remain in scope but land in later phases (section 20). Nothing in the parity matrix is silently dropped.

---

## 3. Scope, non-goals, and invariants

### 3.1 In scope (1.0 across all phases)

- One Flutter codebase targeting web, macOS, and Windows; Android export where the local toolchain exists.
- Local-first project storage and a working guest mode.
- Full pipeline: intake, spec, design contract, plan, generation, gates, repair, preview, checkpoint, publish/export.
- Supabase backend generation when the product requires accounts, shared data, realtime, storage, or server-side secrets.
- Local persistence for apps that do not need a backend.
- Skills library, per-project enablement, imports, and MCP connectors.
- Two-tier sandbox, dedicated preview and publish origins, audit log, engine API authentication.
- Code signing, notarization, auto-update, and local crash diagnostics.
- Deterministic eval suite with golden prompts.

**No UI changes.** The nine commitments ship inside the existing screens: no new navigation, no new side-panel tabs, no restyling, no moved controls. Section 16 defines the allowed surfaces and the visual regression rule.

| Commitment | Proven by | Phase | Evidence |
|---|---|---|---|
| One Flutter codebase, web + macOS + Windows, Android export | Scenario D | 4 | Host-OS builds, signed artifacts |
| Local-first storage and guest mode | Scenario A | 1 | Offline create, relaunch, restore |
| Full pipeline (intake → publish) | Scenarios A, B, C | 0–2 | Run report with every gate |
| Supabase when required | Scenario B | 2B | Backend plan, RLS matrix, connected preview |
| Local persistence without a backend | Scenario A | 2A | Reload and relaunch persistence |
| Skills library, enablement, imports, MCP | Scenarios C, E | 2A, 3 | Skill record, conflict resolution, import scan |
| Two-tier sandbox, origins, audit, engine auth | Scenario E | 1, 3 | Denial records, isolation tests, audit chain |
| Signing, notarization, auto-update, crash diagnostics | Scenario D | 4 | Signed builds, update log, crash archive |
| Deterministic eval suite | All scenarios | 2B | Eval report with golden prompts |

### 3.2 Non-goals for 1.0

- Hosted multi-tenant previews and custom domains at launch. The seam exists from day one; the hosted implementation is a later phase.
- Container or VM isolation as the default. OS-native sandboxing plus origin isolation is the default; a VM is an optional hardened mode only if the native tier proves insufficient.
- iOS build automation. iOS builds require macOS plus Xcode and are documented, not automated.
- Real-time multiplayer editing. Sharing and comments land in the collaboration phase; CRDT multiplayer is not committed.
- A public skills marketplace with payouts. Import and a curated built-in registry ship first.

### 3.3 Invariants

1. Generated and previewed code never executes in the shell origin.
2. No secret from the vault, environment, or engine ever appears in prompts, generated files, logs, audit entries, crash reports, or exports.
3. The agent writes only inside the project workspace; symlink and path traversal escapes are denied.
4. Shell commands run without a shell, from an allowlist, with the workspace as cwd.
5. Network egress is allowlisted per sandbox tier and recorded.
6. Build scripts and dependency lifecycle hooks run only in the build tier with a scrubbed environment.
7. A sandbox downgrade requires explicit user consent and is visible in the UI and audit log.
8. Every privileged action is audited in a hash-chained log.
9. Imported skills and connectors are untrusted until approved; skills cannot execute code.
10. Update artifacts are integrity-checked before install.
11. Publish is blocked when secrets, service-role keys, or missing RLS are detected.
12. The approved FlutterForge visual design is not redesigned to add these features.
13. No new navigation, routes, or side-panel tabs are added; capability fits the existing screens and the visual regression gate passes.

---

## 4. Verified current state

This section is the baseline the design builds on. Paths are repository-relative.

| Area | Current implementation | Verified behavior |
|---|---|---|
| Engine orchestration | `server/harness/run.mjs` | Materializes files, loads/persists design brief, writes AGENTS.md and skills, snapshots, builds the task prompt, streams DSH events, normalizes package name, prunes unused Supabase scaffolding, enforces `pubspec.yaml` + `lib/main.dart` on fresh runs, blocks concurrent runs per project. |
| Prompt contract | `server/harness/prompt.mjs` | Tells the agent to write files with tools, batch writes, use Material 3, implement real features, avoid placeholders, and follow the design contract. |
| Design contract | `server/harness/design.mjs` | Sanitizes and persists `.flutterforge/design.json`; first brief wins; renders palette, type, spacing, radius, motion, voice, and implementation rules into prompts. |
| Quality gate | `server/harness/events.mjs` (`validateProject`) | Rejects missing core files, invalid YAML, package/import mismatch, stubs, hardcoded colors, placeholder copy, missing data states, and low-contrast pairs. String and pattern based. |
| Compile gate | `server/harness/analyze.mjs` | Runs bundled `dart analyze --format=json`, skips honestly when SDK/deps are absent, returns structured diagnostics. |
| Auto-repair | `src/stores/project.store.ts` | First preview build plus up to `MAX_AUTO_REPAIRS = 2` automatic repairs driven by compile logs. |
| Engine runtime | `server/harness/dsh.mjs` | Resolves DSH, ensures the `flutterforge-engine` profile, spawns `dsh headless --json`, streams NDJSON, enforces timeouts. |
| Skills | `server/harness/skills.mjs` | Four fixed skills: modern Flutter UI, architecture, desktop/web parity, optional Supabase production. Written to `.dsh/skills` and inlined into prompts. |
| Model routing | `server/routing.mjs` | Provider and model selection for frontier/economy roles, OpenRouter and DeepSeek, honest downgrade when no key. |
| Credentials | `server/credentials.mjs`, `electron/main.cjs` | BYOK status and key handling; Electron `safeStorage` vault; keys are not written to project files. |
| Preview | `server/preview.mjs` | Warm `flutter run -d web-server` on a loopback port with stdin hot reload; static build fallback; per-project sessions; stop/status. |
| Publish | `server/publish.mjs` | Materializes files, scaffolds runners, `pub get`, compile gate, web/APK/desktop builds, build report, static serving under `/publish/<key>/`. |
| Engine HTTP | `server/index.mjs` | Health, capabilities, credentials, harness SSE, analyze, snapshot, reset, terminal, preview, publish. CORS limited to local origins. **No engine API authentication.** |
| Terminal | `server/terminal.mjs` | Tokenized allowlist (`flutter`, `dart`, `ls`, `pwd`, `cat`, `git`, `help`, `clear`), no shell, cwd confined to workspace. |
| Visual QA | `electron/qa.cjs` | Hidden sandboxed BrowserWindows at mobile/tablet/desktop sizes; screenshots, pixel heuristics, Flutter semantics tree. |
| Desktop shell | `electron/main.cjs`, `electron/preload.cjs` | Context isolation, sandboxed renderer, no node integration, CSP, navigation restrictions, trusted-frame IPC checks, smoke mode. |
| Data | `src/stores/project.store.ts`, `src/stores/auth.store.ts`, `supabase/full_schema.sql` | Projects, files, conversations, versions, builds, deployments are Supabase-backed. Creating a project requires a signed-in user; there is no local project store. |
| Checkpoints | `src/stores/project.store.ts`, `src/utils/versionDiff.ts`, `src/features/workspace/VersionsView.tsx` | Supabase `project_versions`, FNV-1a hashes, LCS diffs, restore version/file. |
| Publish/export UI | `src/features/workspace/ExportView.tsx`, `src/stores/publish.store.ts` | ZIP export, web/APK/macOS/Windows local publish, build reports. No GitHub, no hosted deploy. |
| Settings | `src/features/workspace/SettingsView.tsx` | Project settings, model access, engine capabilities. No sandbox, skills, updates, or crash sections. |
| Packaging | `package.json`, README | electron-builder macOS/Windows/Linux; hardened runtime; no notarization, no `electron-updater`, no crash reporter; harness runtime and Flutter SDK are not bundled. |

### 4.1 Why output can still feel like a dummy app

1. The prompt asks for files; nothing verifies that the controls, forms, and data flows work.
2. The quality gate is text-based. A button with `onPressed: () {}` can pass if the copy looks real.
3. Supabase is a project flag, not an inferred product decision; a backend-requiring app can be generated as a local shell.
4. There is no acceptance-criteria artifact, so the agent has no testable definition of done.
5. The repair loop only reacts to compile failures, not to runtime exceptions or broken flows.
6. Skills are fixed and invisible to the user; they cannot be chosen, extended, or connected.

The design fixes each cause rather than asking the model to "be better."

---

## 5. Locked decisions and what they change

### 5.1 Two-tier isolation

- **Tier A, agent jail:** the coding agent reads the SDK, writes only the workspace, gets a scrubbed environment, and reaches only allowlisted model endpoints.
- **Tier B, build tier:** Flutter, pub, Gradle, Xcode, and CocoaPods run with the extra access those tools require, still without the user's home directory, keychain, vault, or engine token.
- **Preview and publish origins:** isolated loopback origins with their own Electron session partitions. No bridge, no engine API, no shell cookies.

One strict profile cannot host both the agent and Xcode/Gradle. Weakening one profile for both would remove the value of the boundary.

### 5.2 Local now, hosted later

- Local preview and publish are the default and work offline.
- A `PreviewProvider` interface isolates the UI from the transport.
- Hosted previews and custom domains plug into the same interface later without changing the workspace UI.

### 5.3 Full spec + design contract

- The prompt is enhanced into a validated `ProductSpec` with screens, states, data, acceptance criteria, design direction, and risks.
- The design contract is derived from the spec, not from a single sentence.
- A deterministic `BuildPlan` maps the spec to files, dependencies, backend artifacts, and skills.
- The user approves the spec and plan before generation (with an opt-out preference).
- Repairs do not require plan approval; they produce a diff and a run report.

### 5.4 Added requirements from the latest request

- **Professional apps:** a testable professional bar (section 15), completeness audit, runtime interaction flows, and golden evals.
- **Supabase when required:** a deterministic backend planner, migration and RLS generation, verification, connection modes, and secrets handling (section 9).
- **Skills:** a library of prebuilt packs, per-project enablement, auto-recommendation, imports from folder/ZIP/Git, and MCP connectors (section 8).
- **End to end:** every stage has an owner, artifact, gate, failure mode, and user-visible evidence.

---

## 6. Target architecture: the Forge Loop

```
User request
   |
   v
S0 Intake guard ................ secret scan, size limits, policy, project lock
   |
   v
S1 Spec (frontier, fallback deterministic) .... ProductSpec
   |
   v
S1b Spec review (user) ......... edit, regenerate, approve
   |
   v
S2 Design contract ............. tokens + voice, .flutterforge/design.json
   |
   v
S3 Plan (deterministic) ........ file map, deps, backend, skills, verification
   |
   v
S3b Plan review (user) ......... approve, adjust, skip-plan preference
   |
   v
S4 Sandboxed generation (Tier A, DSH tool loop)
   |
   v
G1 Structure + backend contract
   |
   v
G2 Analyzer (dart analyze)
   |
   v
G3 Completeness audit
   |
   v
S5 Sandboxed build (Tier B) -> isolated preview origin
   |
   v
G4 Runtime + acceptance flows + visual QA
   |
   +--> failure --> Repair loop (<= 3, checkpointed) --> re-run G1..G4
   |
   v
S6 Checkpoint + Run Report
   |
   v
S7 Publish / Export (gated) or Handoff
```

The loop is server-authoritative. The renderer displays state and collects approvals; it never decides whether a gate passed.

### 6.1 Stage ownership

| Stage | Owner module | Input | Output | Failure behavior |
|---|---|---|---|---|
| S0 Intake | `server/pipeline/intake.mjs` | prompt, project, settings | sanitized request, policy decision | Reject with a specific reason; no model call. |
| S1 Spec | `server/pipeline/spec.mjs` + routing | sanitized request, history, project | `ProductSpec` | One schema repair retry, then deterministic draft labeled as such. |
| S2 Design | `server/pipeline/designStage.mjs` + `server/harness/design.mjs` | `ProductSpec`, existing brief | design contract | Deterministic palette/type fallback; first brief wins. |
| S3 Plan | `server/pipeline/plan.mjs` | `ProductSpec`, design, toolchain, skills | `BuildPlan` | Deterministic failure with missing capability. |
| S4 Generate | `server/harness/run.mjs` | plan, spec, prompt, skills | files, events | One retry on empty output; hard failure afterward. |
| Gates | `server/pipeline/quality/*` | workspace, spec, plan | gate results | Blocking gates stop the loop and trigger repair. |
| Repair | `server/pipeline/repair.mjs` | failing evidence, checkpoint | patched workspace | Stop after 3 attempts with a run report. |
| Preview | `server/preview.mjs` + `server/origins.mjs` | files, defines | preview URL, state | Warm-runner failure falls back to static build; report both. |
| Publish | `server/publish.mjs` | workspace, target, secrets | artifact, report | Gate failure blocks; build failure reports toolchain cause. |

---

## 7. Stage contracts

### 7.1 S0 Intake guard

Checks before any model call:

- Project lock: one active run per project (`ACTIVE_PROJECTS` already exists).
- Prompt size cap and history trimming; oversize requests are summarized with the user's consent.
- Secret detection: API-key-like strings, private keys, `.env` content, service-role JWTs. The intake warns and offers to redact. Redacted text is what reaches the model.
- Policy check: requests to disable security, exfiltrate data, or run destructive commands are refused with a reason.
- Capability check: Flutter SDK, DSH runtime, disk space, toolchain presence. Missing capabilities are surfaced before the user approves a plan.

### 7.2 S1 ProductSpec

The spec is the definition of done. It is JSON, versioned, validated, and rendered into both the agent prompt and a human-readable review panel.

```ts
interface ProductSpec {
  version: 1;
  source: 'model' | 'draft' | 'edited';
  app: {
    name: string;
    packageName: string;
    oneLiner: string;
    audience: string;
    platforms: Array<'web' | 'macos' | 'windows' | 'android'>;
    locale: string;
  };
  problem: string;
  outcomes: Array<{ id: string; statement: string; successSignal: string }>;
  screens: Array<{
    id: string;
    title: string;
    purpose: string;
    route: string;
    primaryAction: string;
    sections: string[];
    states: { loading: string; empty: string; error: string; content: string };
    dataRefs: string[];
    accepts: Array<{ field: string; type: string; required: boolean; validation?: string }>;
    emits: string[];
  }>;
  navigation: {
    type: 'tabs' | 'drawer' | 'rail' | 'stack';
    items: Array<{ label: string; screenId: string; icon: string }>;
  };
  data: {
    mode: 'none' | 'local' | 'supabase';
    reason: string;
    models: Array<{
      name: string;
      fields: Array<{ name: string; type: string; required: boolean; default?: string; unique?: boolean; ref?: string }>;
      ownerField?: string;
      indexes: string[];
      access: { read: 'owner' | 'shared' | 'public'; write: 'owner' | 'shared' | 'none' };
    }>;
    realtime: string[];
    storage: Array<{ bucket: string; public: boolean; maxSizeMb: number; mime: string[] }>;
  };
  auth: {
    required: boolean;
    methods: Array<'email_password' | 'magic_link' | 'oauth_google'>;
    roles: string[];
  } | null;
  integrations: Array<{ id: string; purpose: string; secretHandling: string }>;
  acceptance: Array<{
    id: string;
    given: string;
    when: string;
    then: string;
    verifiedBy: 'flow' | 'visual' | 'static' | 'manual';
  }>;
  flows: Array<{
    id: string;
    name: string;
    steps: Array<
      | { action: 'tap'; target: { text?: string; semanticsLabel?: string; key?: string } }
      | { action: 'enter'; target: { field: string }; value: string }
      | { action: 'expect'; target: { text?: string; key?: string; state?: string } }
      | { action: 'reload' }
    >;
  }>;
  design: { direction: string; tones: string[]; mustAvoid: string[]; brandRefs: string[] };
  nonGoals: string[];
  assumptions: string[];
  risks: Array<{ statement: string; mitigation: string }>;
  demoData: { allowed: boolean; reason: string };
}
```

Validation rules:

- Unique screen, flow, acceptance, and model IDs; every route unique.
- Every `dataRefs`, `screenId`, navigation target, and flow target resolves.
- Every primary action has at least one acceptance criterion or flow covering it.
- `data.mode = 'supabase'` requires `auth` or shared data or realtime or storage or an integration that needs a server secret.
- `data.mode = 'local'` forbids Supabase artifacts.
- `demoData.allowed` must be explicit; demo data in a production spec fails validation.
- Limits: 20 screens, 20 models, 30 acceptance criteria, 10 flows. Larger requests are decomposed with the user.
- Every string is stripped of control characters and backticks before rendering.

Generation strategy:

1. Call the frontier route with a schema-constrained prompt and the project's prior spec/history.
2. Validate. On failure, retry once with the validation errors.
3. If the model is unavailable or still invalid, build a deterministic draft from a domain template library (CRUD, dashboard, chat, booking, notes, commerce, etc.). Mark it `source: 'draft'` and require review.
4. Never silently ship an unapproved spec.

Review UI:

- A `SpecReviewPanel` in the existing builder panel with sections: App, Screens, Data, Auth, Acceptance, Design, Risks.
- Inline editing of text fields and list items; add/remove screens and criteria.
- "Regenerate section" for a single section, preserving the rest.
- Primary action: "Approve spec and continue." Secondary: "Save draft."
- The spec is persisted at `.flutterforge/spec.json` and `spec.md` (summary for humans and for the agent).
- If the project already has an approved spec, edits create a new revision with a diff; the old revision remains in version history.

### 7.3 S2 Design contract

- The spec's `design` section plus the existing design module produce the contract.
- Deterministic token generation is the default: a seeded palette generator selects a coherent light/dark palette and type pairing from a curated set, constrained by `mustAvoid` and `brandRefs`.
- An LLM may propose a direction, but it cannot change the token schema; invalid values fall back.
- The contract persists at `.flutterforge/design.json`; the first approved contract wins for the project.
- A spec revision can propose a design revision; the user must approve it, and the old contract is checkpointed.
- Implementation rules stay as they are: `AppTokens`, no hardcoded colors, all states, real content, no generic AI styling.

### 7.4 S3 BuildPlan

The plan is deterministic. It is the compiler from spec to work, and it is cheap to regenerate.

```ts
interface BuildPlan {
  version: 1;
  specHash: string;
  designHash: string;
  files: Array<{ path: string; purpose: string; action: 'create' | 'edit' | 'delete' }>;
  phases: Array<{ id: string; label: string; files: string[]; gateAfter: string }>;
  dependencies: Array<{ package: string; constraint: string; why: string; verifiedVersion: string }>;
  backend: {
    mode: 'none' | 'local' | 'supabase';
    migrations: string[];
    applyMode: 'cli' | 'management-api' | 'manual-sql';
    edgeFunctions: string[];
  };
  skills: string[];
  verification: Array<{ type: 'static' | 'flow' | 'visual' | 'manual'; target: string; expected: string }>;
  risks: string[];
}
```

Rules:

- Every screen produces `lib/features/<feature>/screens/<screen>_screen.dart`, its state/provider, and its model/service when it owns data.
- `lib/app.dart` owns theming; `lib/core/router/app_router.dart` owns routes.
- Dependencies resolve through a version registry. Unknown packages are rejected or replaced; the plan never emits a version the registry cannot verify against pub.
- State management is chosen once per project (provider, riverpod, or bloc); only the matching skill pack can be enabled.
- The plan lists backend artifacts and the chosen apply mode.
- The plan predicts verification coverage for the acceptance criteria so the user sees what will be proven.

Plan review UI:

- A compact approval card: phases, file count, dependencies with reasons, backend mode, skills, and "what will be verified."
- Primary: "Approve and build." Secondary: "Edit plan" and "Regenerate."
- A Settings preference "Skip plan review" is off by default. Even when skipped, the plan is generated, persisted, and shown in the run report.

### 7.5 S4 Generation

- DSH remains the coding agent. The orchestrator adds the approved spec, plan, design contract, backend contract, and selected skills to the prompt.
- The task prompt changes from "build an app" to "implement this spec and plan; satisfy these acceptance criteria."
- Tool calls are policy-checked before execution (section 10.3).
- The agent's working directory is the project workspace. Absolute paths are rejected.
- Initial generation still avoids shell commands; on repair turns, the agent may run analyzer commands through the policy engine.
- Every write is atomic: temp file plus rename. A cancelled run never leaves a half-written file.
- Empty output, fenced-code fallback, package normalization, and Supabase pruning are retained.

### 7.6 Quality gates

Gates run in order. A blocking failure stops the loop and produces repair evidence.

| Gate | Blocks | Checks | Evidence |
|---|---|---|---|
| G0 Spec | Yes | Schema valid; approved revision; criteria resolve | spec hash, approval record |
| G1 Plan | Yes | Plan valid; files match spec; deps resolved; skills compatible | plan hash, dependency report |
| G2 Structure | Yes | `pubspec.yaml`, `lib/main.dart`, `lib/app.dart`, router, every import resolves, no absolute paths | file map, unresolved import list |
| G3 Analyzer | Yes | `dart analyze` has no errors; warnings within budget | structured diagnostics |
| G4 Backend | Yes | Mode matches spec; migrations parse; every table has RLS or an explicit justified disable; no service-role key; auth states; storage policies | table/policy matrix |
| G5 Completeness | Yes for critical, advisory for polish | Dead controls, placeholders, stubs, unreachable screens, fake data, missing states, unused deps, missing validation, unlabeled icon buttons, print statements, hardcoded colors | findings with file/line |
| G6 Preview build | Yes | Flutter web build succeeds (the preview target) | build log, artifact hashes |
| G6b Publish target build | Only at publish | The requested export target builds on its host OS | target build log, artifact hash |
| G7 Runtime | Yes | Preview loads; no uncaught exceptions; no RenderFlex overflow; console error budget | console log, error signatures |
| G8 Acceptance flows | Yes when `verifiedBy = flow` | Generated flows execute and assert; unverified flows are labeled | flow report, screenshots |
| G9 Visual | Advisory except critical | Contrast, touch targets, overflow, responsive breakpoints, overflow at 393/768/1440, dark mode if required | screenshots, heuristics |
| G10 Checkpoint | Always | Snapshot stored; run report written; audit sealed | checkpoint id, report |

Critical G5 findings that always block:

- A primary action with an empty or missing handler.
- A declared screen that is unreachable.
- Production placeholder copy or fake data.
- A data screen with no loading/empty/error state.
- A required form field with no validation.
- A hardcoded secret or service-role key.
- An icon-only control with no semantic label.
- A Supabase table exposed without RLS.

Advisory findings are shown but do not block; the user can request a polish pass.

### 7.7 Repair loop

```
failure evidence
   |
   v
classify (compile | build | runtime | visual | completeness | backend | acceptance)
   |
   v
checkpoint workspace
   |
   v
signature = hash(error code + normalized message + file + gate)
   |
   +-- same signature seen twice with no workspace progress --> switch strategy
   |
   v
attempt 1: targeted root-cause fix (frontier)
attempt 2: alternative approach, smaller diff (frontier)
attempt 3: restore last good checkpoint, minimal patch (frontier)
   |
   v
re-run G2..G9 for the preview target (G6b only when publishing)
   |
   +-- pass --> checkpoint + report
   +-- fail --> attempt next or stop
```

Rules:

- Maximum 3 attempts per run, configurable in Settings (1–5).
- Each attempt stores a checkpoint and a patch hash. Repeating an identical patch is a failure.
- The repair prompt includes: failing gate, normalized errors, screenshots, flow steps, the design contract, and the relevant files. It explicitly forbids weakening security (disabling RLS, removing auth, exposing service keys) to make a gate pass.
- G4 security findings are re-checked after every repair. If a repair removes RLS, the run stops and the user is asked to decide.
- Stop conditions: attempt limit, repeated signature after changes, no file progress, user cancellation, or a policy denial that requires user input.
- The run report states which attempt succeeded and links the diff.
- Repair turns may run `dart analyze` through the policy engine; initial generation may not.

### 7.8 Run report and checkpoint

Every run writes `.flutterforge/runs/<runId>.json` and mirrors it to the local store:

```ts
interface RunReport {
  runId: string;
  projectId: string;
  specRevision: string;
  planHash: string;
  startedAt: string;
  finishedAt: string;
  outcome: 'passed' | 'repaired' | 'failed' | 'cancelled';
  stages: Array<{ id: string; status: string; durationMs: number; model?: string; route?: string }>;
  gates: Array<{ id: string; status: 'pass' | 'fail' | 'warn' | 'skipped'; findings: number }>;
  repairs: Array<{ attempt: number; signature: string; files: string[]; result: string }>;
  filesChanged: Array<{ path: string; action: string }>;
  skills: Array<{ id: string; version: string; reason: string }>;
  backend: { mode: string; migrations: string[]; rls: string; verification: string };
  sandbox: { tier: string; denials: Array<{ action: string; reason: string; ts: string }> };
  evidence: Array<{ kind: 'screenshot' | 'log' | 'flow' | 'diagnostic'; path: string }>;
  unverified: string[];
  tokens: { input: number; output: number; estimatedCostUsd: number };
}
```

The checkpoint stores a content-addressed snapshot of the workspace and the spec/plan/design revisions that produced it. "Restore this run" restores all four, not just files.

---

## 8. Skills and connectors

### 8.1 Concepts

- **Skill pack:** an instruction-only bundle (`SKILL.md` plus optional text references). It shapes how the agent works. It cannot execute code.
- **Connector:** an MCP server (remote HTTPS or local command) that gives the agent tools. It executes outside the model and is treated as untrusted infrastructure.
- **Library:** built-in and verified packs available to every project.
- **Project selection:** the packs enabled for one project, stored in `.flutterforge/skills.json`.
- **Connection:** adding a user-level skill pack or connector that can be reused across projects.

### 8.2 Built-in packs (prebuilt, choosable)

Core (always recommended; user may disable):

- `modern-flutter-ui` — current Material 3, tokens, states, responsive layout.
- `flutter-architecture` — feature-first structure, routing, state ownership.
- `desktop-web-parity` — desktop/web behavior, no mobile-only assumptions.
- `flutter-testing` — widget tests for primary flows, testable seams.
- `flutter-accessibility` — semantics, contrast, focus, text scaling.
- `flutter-performance` — list virtualization, image caching, rebuild discipline.
- `flutter-error-handling` — boundaries, typed failures, user-facing recovery.

State management (choose at most one):

- `state-provider`, `state-riverpod`, `state-bloc`.

Backend:

- `supabase-production` — client, RLS, migrations, storage, realtime rules.
- `supabase-auth` — email/password, magic link, OAuth, session expiry.
- `supabase-realtime` — subscriptions, cleanup, conflict handling.
- `supabase-storage` — buckets, policies, upload validation.
- `supabase-edge-functions` — server-side secrets, AI/payment proxies.

Product patterns:

- `crud-admin`, `dashboard-analytics`, `onboarding-auth`, `forms-validation`,
  `payments-stripe`, `notifications`, `offline-sync`, `search-filter`,
  `calendar-scheduling`, `chat-realtime`, `maps-location`, `media-upload`,
  `pdf-export`, `i18n`, `charts`, `ai-assistant`, `import-export`.

Design complements (never override the design contract):

- `design-editorial`, `design-minimal`, `design-playful`, `design-density`.

Each pack declares:

```yaml
name: supabase-auth
version: 1.0.0
description: Production auth flows with expiration and unauthenticated states.
category: backend
tags: [auth, supabase, session]
platforms: [web, macos, windows]
requires:
  packages: [supabase_flutter]
  backend: supabase
conflicts: []
priority: 80
```

### 8.3 Selection and precedence

- Recommendation is deterministic: spec tags, `data.mode`, auth, storage, realtime, integrations, platform, and state management map to packs. The plan records the reason for each.
- Default maximum enabled packs: 10; maximum auto-recommended: 6.
- Precedence for duplicate IDs: project custom > user library > built-in. A project custom pack with the same ID replaces the lower layer.
- Conflicts are explicit (`state-provider` vs `state-riverpod`). The UI blocks approval until the conflict is resolved.
- Token budget: inline up to 18,000 characters of skill guidance. Packs beyond the budget are listed with `whenToUse` and loaded through the `skill` tool. The prompt tells the agent which packs are deferred.
- Every enabled pack is recorded in the run report with its version and reason.

### 8.4 Connecting skills

Three import paths:

1. **Folder or ZIP** — user selects a directory or archive containing `SKILL.md`. Limited to 256 KB, UTF-8 text, no binaries, no scripts.
2. **Git repository** — HTTPS URL plus optional ref and optional access token for private repositories. Only `SKILL.md` and text references are fetched; the commit SHA is pinned and stored. The token lives in the vault and is never written to the skill or the project. Re-fetching requires user action.
3. **Connector (MCP)** — remote HTTPS endpoint or local command.

Validation and security:

- Frontmatter is required and schema-checked.
- Content is scanned for prompt-injection patterns (`ignore previous instructions`, credential paths, `curl`/`wget` exfiltration, base64 blobs, `rm -rf`, requests to read home directories). Findings are shown; the pack is not enabled by default.
- Trust levels: `builtin` (shipped), `verified` (signed registry entry with pinned hash), `local` (user-imported), `workspace` (a skill found in a cloned project outside the FlutterForge-managed `.dsh/skills` set, disabled by default).
- Skill text is treated as guidance, not authority. The system contract and policy engine outrank it.
- Skills never execute code. Any pack that needs code must use a connector.
- Imports are audited with source, hash, and trust level.

Connector rules:

- Remote connectors require HTTPS. OAuth or bearer tokens live in the vault, never in prompts or project files.
- Local connector commands require explicit approval, a hash-pinned executable, and run under Tier A.
- Per-tool allowlist; destructive tools require confirmation; output size and time limits.
- Connector tool calls appear in the run report and audit log.
- A connector cannot access the engine API or the vault.

### 8.5 Skills UI

A new **Skills** panel in the workspace, using existing panel chrome:

- **Library** tab: search, categories, preview, versions, "Recommended for this project" with reasons.
- **Enabled** tab: toggles, conflict warnings, token budget meter, per-pack file reference.
- **Connected** tab: imported packs and MCP connectors, trust badges, source, last verified, remove.
- **Import** action: folder, ZIP, Git URL.
- **Add connector** action: remote URL or local command, capability review, approve.

The create-project flow gains a skills step that shows recommendations after the spec is approved. The user can accept all, pick, or skip.

### 8.6 Skill and connector failure handling

- Missing required package or backend: blocked at plan time with a specific message.
- Conflicting packs: blocked with a one-click resolution.
- Imported pack with dangerous instructions: warning plus disabled default.
- Connector offline or unauthorized: retry, then continue generation without the connector and mark affected criteria unverified.
- Connector returns malformed output: reject, audit, continue.
- Skill text over budget: defer, do not truncate silently.

---

## 9. Supabase backend generation

### 9.1 Detection

The backend is inferred, then confirmed by the user:

| Signal | Backend decision |
|---|---|
| Accounts, sign-in, roles, profiles | Supabase + auth |
| Shared or multi-device data, cloud sync | Supabase |
| Realtime collaboration or live updates | Supabase + realtime |
| File uploads or media | Supabase + storage |
| Server-side secrets (AI keys, payments, email) | Supabase + edge functions |
| Single-user, device-local data | Local persistence |
| Static or calculator-style app | None |

The user can override the inferred mode in the spec review. The override and reason are recorded.

### 9.2 Connection modes

1. **Connect existing project** — URL + anon key are required; a personal access token or database password is optional and used only to apply migrations.
2. **Management API** — later phase. Requires a Supabase OAuth connection or personal access token; creates a project, applies migrations, and writes keys to the vault.
3. **Manual SQL** — always available. Generates migrations and a single `apply.sql`, with step-by-step instructions. The app remains unconfigured until the user connects.

Credentials:

- URL and anon key are project configuration, injected at build time with `--dart-define`.
- The service-role key and personal access token are secrets. They live in the OS vault, are read only by the engine for a specific operation, and are never written to the workspace, logs, prompts, audit entries, or exported ZIP.
- The generated app never contains a service-role key.

### 9.3 Generated artifacts

```
supabase/
  migrations/
    20261103000000_init.sql
    20261103000100_rls.sql
    20261103000200_storage.sql
  seed.sql                    (only when demoData.allowed)
  functions/
    <name>/index.ts           (only when integrations need server secrets)
lib/core/backend/
  supabase_client.dart
  auth_service.dart
  <model>_repository.dart
  storage_service.dart
  realtime_service.dart
```

Migration rules:

- Idempotent: `create table if not exists`, `drop policy if exists`.
- `uuid` primary keys, `auth.users` references, `created_at`/`updated_at`, update trigger.
- RLS enabled on every table in the exposed schema.
- Explicit policies for select/insert/update/delete, scoped to `auth.uid()` or a declared shared rule.
- No `using (true)` on writes unless the spec declares public write access with a reason.
- Indexes on foreign keys and declared filters.
- Realtime publication only for declared tables.
- Storage buckets with MIME and size limits and per-bucket policies.
- Edge functions read secrets from the Supabase environment; the Flutter client calls the function with the anon key.

### 9.4 Verification

- Migration SQL parses; statement ordering is valid.
- Every table has RLS enabled and at least one policy per declared operation.
- No service-role key or personal access token in workspace files.
- Auth screens handle signed-out, signed-in, expired, and unauthenticated states.
- Repositories select only declared columns and map `PostgrestException` to user-facing errors.
- Storage uploads validate type and size client-side and rely on bucket policy server-side.
- Realtime subscriptions are cancelled on dispose.
- If a connection plus a personal access token or database password is available, apply migrations and verify table and policy presence through the Supabase CLI or Management API. Without those credentials, verification is structural only (SQL inspection and RLS coverage), and the run report says so explicitly.
- Integration flows that need credentials are marked unverified when credentials are absent. They are never faked.

### 9.5 Backend UI

A **Backend** panel in the workspace:

- Mode and connection status.
- Migrations generated, applied, and pending.
- RLS coverage per table with a pass/fail badge.
- Edge functions and their secrets status (values masked).
- "Apply migrations," "Copy SQL," and "Reconnect" actions.
- A clear blocking state when a Supabase app is not connected: preview can show UI, but data flows are labeled unverified and publish is blocked for backend targets.

---

## 10. Sandbox and security architecture

### 10.1 Tier A — agent jail

Applies to DSH, local connectors, and any tool the agent invokes.

| Resource | Policy |
|---|---|
| Filesystem read | Workspace, Flutter SDK read-only, Node runtime, system libraries, agent profile. No home directory beyond the isolated profile. |
| Filesystem write | Workspace and an isolated temp directory only. Atomic writes. |
| Network | Only the LLM provider endpoints through the egress proxy. No engine API, no arbitrary internet. |
| Environment | Scrubbed: no vault keys, no provider keys beyond the active model key, no engine token, minimal `PATH`, isolated `HOME`, `DSH_HOME`, `TMPDIR`, `XDG_*`. |
| Process | No shell; Node child processes only through the policy engine; process count and CPU/memory limits. |
| Secrets | Model key injected per process; never readable as a file. |

macOS implementation: `sandbox-exec` with a generated SBPL profile (deny default) plus the egress proxy. macOS may remove this API; the capability gate (10.8) accounts for that.

Linux implementation: `bubblewrap` with a read-only system view, workspace bind, isolated `/tmp`, and `--unshare-net` plus an in-namespace loopback bridge to the egress proxy.

Windows implementation: restricted token plus AppContainer with no network capabilities except a loopback proxy, plus a Job Object for resource limits. If AppContainer is unavailable, Tier A degrades to a restricted token plus filesystem ACLs and requires explicit consent.

### 10.2 Tier B — build tier

Applies to `flutter pub get`, `flutter build`, `flutter run`, Gradle, Xcode, CocoaPods, and platform tooling.

| Resource | Policy |
|---|---|
| Filesystem read | Workspace, Flutter SDK, pub cache, Android SDK, Xcode, Gradle caches, system libraries. No user home, Documents, Desktop, keychain, browser data, or vault. |
| Filesystem write | Workspace, build output, pub cache, Gradle/CocoaPods caches, isolated temp. |
| Network | `pub.dev`, `storage.googleapis.com`, `github.com` where required, Gradle/Maven/CocoaPods endpoints, plus the app's declared backend host. Through the egress proxy. |
| Environment | Scrubbed of provider keys, vault contents, engine token, and unrelated user variables. |
| Process | Build commands through the policy engine; resource limits; process-tree cancellation. |

Dependency lifecycle hooks and native build scripts run here, not in Tier A. A malicious `pubspec` dependency is still untrusted code; the build tier is the boundary.

### 10.3 Command policy

Declarative policy with tests:

```json
{
  "allow": [
    { "bin": "flutter", "args": ["analyze|pub get|build web|build apk|build macos|build windows|run"] },
    { "bin": "dart", "args": ["analyze|format|run test"] },
    { "bin": "git", "args": ["status|diff|log|show"], "readOnly": true },
    { "bin": "ls|pwd|cat|head|tail", "readOnly": true }
  ],
  "deny": [
    "rm", "rmdir", "mv", "chmod", "chown", "sudo", "su", "kill", "pkill",
    "curl", "wget", "nc", "ssh", "scp", "rsync",
    "npm", "npx", "pip", "brew", "apt", "winget",
    "git push", "git remote", "git clean", "git reset --hard",
    "flutter pub publish", "dart pub publish"
  ],
  "pathRules": {
    "cwd": "workspace",
    "denyRead": ["$HOME", "~/.ssh", "~/.aws", "~/.config", "$VAULT"],
    "denyWrite": ["/", "$HOME", "$DATA_DIR/audit", "$DATA_DIR/skills"]
  }
}
```

Rules:

- No shell. Commands are tokenized and spawned directly.
- Paths are resolved before execution; symlink realpaths are checked against the workspace.
- Any out-of-policy command is denied, audited, and reported to the agent, which must choose another approach or ask the user.
- Destructive actions require explicit user approval, recorded with the command and reason.
- `git push` is never allowed from the agent; publishing to GitHub is a user action through the app.

### 10.4 Egress proxy

A local HTTP CONNECT proxy with per-tier allowlists:

- Agent tier: model provider hosts plus the endpoints of explicitly enabled remote connectors; the active key is injected into the request, not the environment.
- Build tier: package registries, toolchain hosts, and the app's declared backend host.
- Preview/publish tier: no engine access; browser requests follow the app's CSP and allowlist.

The proxy records destination host, port, bytes, and decision. It denies IP literals, link-local addresses, and loopback destinations other than the proxy.

### 10.5 Audit log

- JSONL per month under the app data directory: `audit/YYYY-MM.jsonl`.
- Hash-chained: each entry stores `prevHash` and `hash`.
- Event types: intake, spec, design, plan, approval, tool call, command decision, network decision, file write, gate result, repair, preview state, publish, update, crash, sandbox capability change, skill/connector import.
- Fields: timestamp, run ID, project ID, actor, type, subject, decision, reason, redacted detail.
- Redaction: secrets, tokens, keychain paths, and prompt text (store a hash and a short excerpt).
- Retention: 90 days default, configurable 7–365. Rotation by month; size cap with oldest-first pruning.
- Viewer: Settings → Audit log, with filters and export.

### 10.6 Engine API authentication

The loopback engine currently trusts any local caller. Fix:

- A per-launch 32-byte token is generated by the engine and passed to the Electron renderer through the preload bridge.
- Every `/api/*` request must present `X-FF-Engine-Token`; static health may remain tokenless.
- The token is never written to the workspace, logs, or audit details. It is not exposed to preview or publish origins.
- Requests must have a loopback `Host` header; mutating requests reject `Origin: null` and unknown origins.
- CORS remains an allowlist.
- In development, the Vite proxy adds the token server-side so the browser never holds it.
- The renderer fetch wrapper is the single place that adds the header.

### 10.7 Preview and publish origins

| Surface | Origin | Access |
|---|---|---|
| Shell / engine | `http://127.0.0.1:17878` packaged, Vite dev origin in development | Renderer with preload bridge; token-protected API |
| Preview | `http://127.0.0.1:179xx` | Generated app only; no engine API; own session partition; no preload |
| Publish | `http://127.0.0.1:180xx` | Published artifact only; own session partition; no preload |
| Warm runner | Flutter's own loopback origin | Generated app only; no engine API |

Rules:

- Preview and publish servers serve static files only. They never proxy `/api`.
- The iframe is cross-origin to the shell, so it cannot read shell DOM, storage, or `flutterforgeDesktop`, even with `allow-same-origin`.
- Iframe attributes: `allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals`; never `allow-top-navigation`.
- Preview CSP: `default-src 'self'`; images/fonts from declared hosts; `connect-src` limited to the app's declared backend and asset hosts; `frame-ancestors` restricted to the shell origin.
- Electron preview session: no preload, permissions denied, navigation restricted to the preview origin, downloads restricted, external links opened in the user's browser after confirmation.
- Requests from a preview session to the engine origin, `file://`, `devtools://`, or link-local addresses are blocked.
- The preview cannot use the shell's service workers or cookies; each project gets its own persistent partition only if the app needs storage. Otherwise an in-memory partition is used.

### 10.8 Capability gate

At startup and before each run, the engine reports:

- OS sandbox available (macOS SBPL, Linux bwrap, Windows AppContainer/restricted token).
- Egress proxy available.
- Toolchains present (Flutter, Dart, Android, Xcode, Windows runner).
- Disk space, CPU, memory.

If a boundary is unavailable:

- The UI shows a "Reduced isolation" badge with the specific gap.
- The user must explicitly consent to run generated code with reduced isolation.
- The consent and the gap are audited.
- The app never silently downgrades.
- Release builds refuse to run agent code when filesystem confinement or engine token enforcement is missing.

### 10.9 Threat model

| Threat | Vector | Mitigation |
|---|---|---|
| T1 Prompt injection in user text | Request asks the agent to ignore rules | Policy engine outranks prompt; sandbox; audit; no secrets in environment |
| T2 Malicious generated code | Generated Dart or JS tries to read secrets or call the engine | Tier A, preview origin isolation, engine token, egress proxy |
| T3 Malicious dependency | Pub package runs a build hook or reads files | Build tier with scrubbed env and restricted filesystem; egress allowlist |
| T4 Preview XSS reaches shell | Generated JS calls `parent` or shell APIs | Dedicated origin, no preload, cross-origin iframe, session partition, CSP |
| T5 Agent exfiltration | Agent reads keys or user files and posts them | Isolated HOME, denyRead home, proxy allowlist, secret redaction, audit |
| T6 Path traversal / symlink escape | Writes outside workspace | `safeRelativePath`, realpath checks, workspace-only bind |
| T7 Command injection | Shell metacharacters in commands | No shell, tokenized allowlist, path resolution |
| T8 Skill supply chain | Imported SKILL.md instructs exfiltration | Trust levels, injection scan, sandbox, no code execution |
| T9 Connector abuse | MCP server has dangerous tools | Per-tool allowlist, approval, Tier A, audit, output limits |
| T10 Update tampering | Malicious update artifact | HTTPS, signed metadata, sha512, code signature verification |
| T11 Crash dump leaks | Minidump contains secrets | No automatic upload; metadata-only by default; explicit consent for dumps; redaction |
| T12 Local data theft | Other local users read project data | Data dir 0700; secrets only in OS keychain |
| T13 Port hijack / local API abuse | Another local app calls the engine | Engine token, Host check, no wildcard CORS, no preview access |
| T14 DNS rebinding / CSRF | Web page targets loopback | Token, Host/Origin checks, no credentials in URLs |

Security invariants in section 3.3 each map to at least one automated test in section 15.4.

---

## 11. Preview system

### 11.1 Interface

```ts
interface PreviewProvider {
  start(projectId: string, files: ProjectFile[], options: PreviewOptions): Promise<PreviewSession>;
  reload(projectId: string, mode: 'hot' | 'restart'): Promise<void>;
  stop(projectId: string): Promise<void>;
  status(projectId: string): PreviewStatus;
  url(sessionId: string): string;
}
```

The local implementation uses the existing warm runner and static build. A hosted implementation later returns a signed remote URL and the same status events.

### 11.2 Session states

`none → preparing → building → ready → updating → stale → error → stopped`

- `preparing`: dependency and toolchain checks.
- `building`: Flutter build or warm runner startup; streamed logs.
- `ready`: URL available; runtime error capture active.
- `updating`: hot reload in progress; if it fails, escalate to restart.
- `stale`: files changed but not reloaded; show "3 edits behind."
- `error`: last build or runtime failure with a retry action.
- `stopped`: user stopped or the run ended.

### 11.3 Reload policy

- Dart-only edits: hot reload.
- `pubspec.yaml`, dependency, asset, or platform changes: full restart/rebuild.
- Router/theme changes: restart.
- Three consecutive hot-reload failures: automatic full rebuild.
- Preview is never reloaded while the user is typing in a form in the preview; show a "reload pending" affordance.

### 11.4 Runtime error capture

- The QA preview session captures `console-message` events, uncaught exceptions, and RenderFlex overflow messages.
- A run-scoped collector maps each error to a signature and feeds the repair loop.
- The UI shows an error count badge and a "Fix these" action that prefills the composer with the evidence.
- Runtime capture never blocks the user's manual preview; it runs in a hidden QA window.

### 11.5 Device sizes and native preview

- Web preview sizes: mobile 393×852, tablet 1024×1366, desktop 1440×900. The existing consolidated toolbar keeps these controls.
- Native preview (later phase): `flutter run -d macos|windows` in a separate window; Android emulator if installed; iOS simulator on macOS. Each native preview runs in the build tier and is labeled with its toolchain requirements.
- The preview panel states which target is being shown and whether it is web or native.

### 11.6 Visual QA

- Reuses `electron/qa.cjs` with a dedicated partition per project.
- Emulates reduced motion before capture to stabilize screenshots.
- Captures each screen state where reachable, at three sizes.
- Heuristics: overflow, contrast, touch target size, clipped text, missing semantics.
- Baseline diff per project after the first approved run; tolerance for anti-aliasing and font loading; failures are advisory unless they break overflow or contrast.
- "Fix this" builds a prompt with the finding, screenshot reference, semantics node, and file hints.

### 11.7 Preview failure modes

| Failure | Behavior |
|---|---|
| Warm runner exits | Capture stderr; fall back to static build; show both causes. |
| Build timeout | Cancel process tree; report the last 40 log lines; offer retry with a higher timeout. |
| Port unavailable | Try the next port in the range; after 10 failures, report the range exhaustion. |
| Hot reload fails | Restart once; if it fails again, full rebuild. |
| Preview loads blank | Treat as G7 failure; capture console and screenshot; repair. |
| Flutter SDK missing | Block with managed-download guidance; no fake preview. |
| QA window fails | Mark visual QA unavailable; do not block the run; state it in the report. |
| Backend not configured | Show the app's unconfigured state; mark backend flows unverified; block backend publish. |

---

## 12. Publish, export, GitHub, and hosting

### 12.1 Targets

- Local web publish (static, isolated origin).
- ZIP export.
- APK (when Android toolchain is present).
- macOS `.app` (on macOS).
- Windows runner (on Windows).
- GitHub repository export (new).
- Hosted web deploy (later phase; provider adapter).
- PWA manifest and service worker checks for the web target.

### 12.2 Publish gates

Publish runs G2–G9 plus G6b for the target. It is blocked by:

- compile or build failure,
- missing RLS or a service-role key in the generated app,
- secrets in files or environment,
- dead primary actions or missing screens,
- backend unconfigured for a Supabase project,
- failed acceptance flows that are marked `verifiedBy: flow`.

The user can override advisory findings; an override is audited and shown in the publish report.

### 12.3 Build report

The existing report is extended with:

- target, toolchain versions, artifact path, size, sha256,
- gates and overrides,
- environment summary (no secrets),
- signing status for exported desktop artifacts,
- reproducibility notes.

### 12.4 GitHub export and import

Export:

- OAuth Device Flow, minimal `repo` scope. Token in the vault.
- Create or select a repository, push the workspace with a `.gitignore` that excludes `.flutterforge`, `.dsh`, build output, and local data.
- Generate a README with run/build instructions and the spec summary.
- Optional pull request mode for incremental updates.
- Never push secrets; the publish gate scans first.

Import (later phase):

- Clone a public or authorized private repository into a workspace.
- Reverse-engineer a draft spec from the code for review.
- Run the same gates before enabling edits.

### 12.5 Hosted hosting seam

- `HostingProvider` interface with `deploy`, `status`, `logs`, `rollback`, `customDomain`.
- Local publish is the default implementation.
- Hosted providers (Netlify, Vercel, Cloudflare Pages, or FlutterForge hosting) are adapters added later.
- Custom domains and TLS are part of the hosted phase, not local.
- Deployments use the same gated artifact as local publish; no separate build path.

---

## 13. Local-first data and sync

### 13.1 Why it is required

The current product cannot create a project without Supabase auth and cannot work offline. A desktop studio must work offline, and the spec/plan/skills/audit/run data need a durable local home.

### 13.2 Local store

No native modules; file-backed with content-addressed blobs to keep packaging simple.

```
<dataDir>/
  settings.json
  projects/<uuid>/project.json
  projects/<uuid>/files.json
  blobs/<sha256>
  versions/<uuid>/<versionId>.json
  runs/<runId>.json
  audit/YYYY-MM.jsonl
  skills/<packId>/{SKILL.md,manifest.json}
  connectors/<connectorId>.json
  crashes/<crashId>/{meta.json,logs/}
```

Rules:

- Atomic writes: temp file, fsync, rename.
- Blobs are immutable and deduplicated by SHA-256.
- Project documents carry schema versions and a migration function.
- Data dir permissions `0700`.
- Backups: export a project archive; automatic daily snapshot of metadata only.
- Retention: 100 versions per project or 90 days, whichever is larger; audit 90 days default; runs 180 days.
- No secrets in the store. Keys live in the OS vault.

### 13.3 Guest mode

- Creating and editing projects works without an account.
- Signing in attaches local projects to the account through an explicit "link this project" action.
- No silent upload.

### 13.4 Sync

- Local is authoritative during a run.
- When signed in, an outbox syncs projects, files, messages, versions, and run metadata to Supabase.
- Entity IDs are UUIDs generated locally.
- Conflict policy: last-write-wins per entity with `updatedAt`; file conflicts keep both versions and surface a restore choice.
- Sync failures never block local editing; the outbox retries with backoff.
- Sharing uses Supabase shared projects; local-only projects are never shared by accident.

### 13.5 Checkpoints

- A checkpoint is a manifest of blob hashes plus the spec, plan, design, skills, and run metadata.
- Checkpoints are created before generation, after each repair, and after a passing run.
- Restore supports the whole run, a single file, or a previous spec/plan revision.
- Checkpoint operations are audited.

---

## 14. Desktop shipping

### 14.1 macOS

- Developer ID Application certificate, hardened runtime, notarization with `notarytool` (App Store Connect API key or keychain profile in CI), and stapling.
- Entitlements: JIT for Electron; no App Sandbox (the product runs compilers and SDKs). Distribution is outside the Mac App Store and this is documented.
- Gatekeeper assessment on a clean machine in CI.
- Release artifacts: DMG and ZIP for arm64 and x64.

### 14.2 Windows

- Authenticode signing (EV certificate or Azure Trusted Signing through a custom sign hook).
- NSIS installer signed; uninstaller signed.
- SmartScreen reputation tracked; release notes warn about first-run prompts until reputation builds.
- Long-path and Unicode workspace handling tested.

### 14.3 Linux

- AppImage, optional GPG signature.
- Update through the same update channel as macOS/Windows.

### 14.4 Auto-update

- `electron-updater` with an HTTPS feed (GitHub Releases or a generic feed).
- Integrity: HTTPS, sha512 from update metadata, and a signed manifest verified by the app.
- Channels: stable and beta. Staged rollout percentage.
- Check on launch and every 6 hours; download in the background.
- Never restart while a generation, build, publish, or unsaved editor buffer exists.
- Rollback: if the app crashes three times within five minutes after an update, offer safe mode and a revert to the previous version.
- Offline: show "up to date as of <time>" and retry later.
- Update events are audited.

### 14.5 Crash reporting

- Electron `crashReporter` with `uploadToServer: false` by default.
- Main-process uncaught exceptions, renderer ErrorBoundary, engine process exits, and preview runner crashes are recorded locally with version, OS, run ID, last stage, and redacted logs.
- "Export diagnostics" creates a ZIP with logs and metadata; the user can inspect it before sharing.
- Optional upload requires explicit consent per report; minidumps are opt-in with a warning because they may contain memory contents.
- Crash-loop detection triggers safe mode (disable hardware acceleration, skip restoring the last preview, offer diagnostics).
- No automatic telemetry is sent from crash reports.

### 14.6 Release gates

- Signed and notarized builds on clean macOS and Windows machines.
- Smoke test: launch, engine health, create a local project, generate a small app, preview, publish, quit.
- Update test: previous version updates, restarts, and retains local projects.
- Crash test: forced renderer crash produces a local report without secrets.

---

## 15. Professional-app definition and evals

### 15.1 The professional bar

An app is "professional" when all of the following are true:

1. Every declared screen is reachable and has one clear primary action.
2. Every primary action works and changes state, navigates, or persists data.
3. Forms validate inline, disable while submitting, and show success and failure.
4. Lists support search/filter/sort where the spec declares them; large lists virtualize.
5. Data persists across a preview reload or app restart.
6. Loading, empty, error, and content states exist for every data screen.
7. Layout is responsive at 393, 768, 1024, and 1440 without overflow.
8. Keyboard and focus behavior works on desktop; dialogs close on Escape.
9. Accessibility: labels, contrast, text scaling, no unlabeled icon-only controls.
10. Dark mode is coherent and contrast-tested when declared.
11. No placeholder copy, fake analytics, lorem ipsum, or demo data unless declared.
12. Backend security: RLS on every table, no service-role key in the client, auth states handled.
13. Error boundaries and user-facing recovery exist.
14. At least one automated test covers the primary flow when feasible.
15. The app exports or publishes with the same result that was previewed.

### 15.2 Static completeness audit

Runs on the Dart source and the spec:

- Empty handlers: `onPressed: () {}`, `onTap: () {}`, `onChanged: null` where interaction is required.
- `onPressed: null` allowed only for a declared disabled state.
- `TODO`, `FIXME`, `UnimplementedError`, `throw UnimplementedError`.
- Placeholder strings and numbered sample items.
- Demo data arrays when `demoData.allowed` is false.
- Screens not referenced by the router.
- Models without a repository/service.
- Required fields without validators.
- Icon buttons without semantics labels.
- Hardcoded colors outside the theme.
- `print` in production paths.
- Unused dependencies and unused imports.
- Missing error boundaries.
- Missing data states.
- Network calls in widgets.
- Backend files without corresponding models and policies.

### 15.3 Runtime acceptance flows

- Flows come from the spec (`flows`), derived from acceptance criteria.
- The runner loads the preview in the isolated QA window, waits for the Flutter view, and executes taps, text entry, expectations, and reloads through the semantics tree.
- Flutter semantics are enabled for the preview; if a target cannot be resolved, the flow is marked `unverified` with the step and a screenshot. It is never reported as passed.
- Persistence: for local apps, reload and assert the saved item still exists.
- Supabase flows that require credentials run only when a test account or connection is configured; otherwise they are unverified and stated.
- Overflow and uncaught exceptions fail G7 regardless of flows.
- Coverage: every `verifiedBy: flow` criterion must have at least one passing flow, or the run is marked `repaired`/`failed` accordingly.

### 15.4 Security tests

Each invariant has an automated test:

- Workspace escape: absolute path, `..`, symlink to home.
- Command injection: `flutter analyze; rm -rf`, shell metacharacters, newline injection.
- Env leak: vault key and engine token absent from agent env, files, logs, audit.
- Preview isolation: preview JS cannot read shell DOM, `localStorage` of the shell, or the bridge; cannot call `/api`.
- Engine auth: missing/incorrect token rejected; preview origin rejected.
- Egress: non-allowlisted host denied and audited.
- Build tier: no home-directory read; pub cache writable; hook cannot read the vault.
- Skill import: dangerous instructions detected; workspace skill disabled by default.
- Update: tampered artifact rejected.
- Publish: service-role key and secrets block.
- RLS: a table without policies fails G4.

### 15.5 Golden eval suite

Fifteen prompts across domains, each with a spec, expected screens, acceptance flows, and a backend mode:

1. Personal task manager (local persistence).
2. Team issue tracker (Supabase auth + shared data).
3. Notes app with tags and search (local).
4. Habit tracker with charts (local).
5. Expense splitter (Supabase auth + shared groups).
6. CRM lite (Supabase auth + RLS + storage).
7. Booking calendar (Supabase + realtime).
8. Recipe manager with import/export (local + file I/O).
9. Course dashboard (Supabase + roles).
10. Chat workspace (Supabase realtime).
11. Inventory admin (Supabase + CSV import/export).
12. Personal finance dashboard (local + charts).
13. Event check-in (Supabase + QR).
14. AI writing assistant (Supabase edge function proxy).
15. Offline-first field survey (local + sync when available).

Metrics per prompt:

- spec valid and approved,
- G2/G3/G6 pass,
- G5 critical findings = 0,
- G7 runtime clean,
- acceptance flow pass rate,
- visual critical findings = 0,
- backend verification pass (when applicable),
- time to first preview,
- repair attempts.

Targets:

- first-pass compile ≥ 90%,
- flow pass ≥ 80%,
- critical completeness findings = 0 on 90% of runs,
- backend verification pass ≥ 95% when applicable,
- zero security test regressions.

The suite runs headless in CI with a pinned Flutter SDK. Model-dependent runs are nightly; deterministic gates run on every commit with recorded fixtures.

### 15.6 End-to-end acceptance scenarios

The nine 3.1 commitments are proven by five scripted journeys. Each journey names the existing UI surface used and the evidence produced. If a journey fails, the commitment is not shipped.

**Scenario A — Offline local app, guest mode**

1. Launch the desktop app with no account and no network.
2. Create a project from the existing dashboard; the project is stored locally.
3. Enter "notes app with tags, search, pinning, and dark mode."
4. Review the spec in the existing builder panel, approve it, review the plan, and build.
5. Generation runs in Tier A; gates pass; preview opens on its own origin.
6. Acceptance flows create, edit, search, and pin a note; reload the preview and confirm persistence.
7. Publish locally and export a ZIP.
8. Quit, relaunch offline, reopen the project, and restore the previous checkpoint.

Evidence: local project record, spec/plan hashes, gate results, flow report, preview URL and origin, publish report, checkpoint restore record. Proves local-first storage, guest mode, local persistence, full pipeline, isolated preview, and publish.

**Scenario B — Supabase app with RLS and auth**

1. Enter "team issue tracker with accounts, shared projects, comments, and attachments."
2. The backend planner infers Supabase, auth, storage, and RLS; the spec shows the decision and the user confirms it.
3. Connect an existing Supabase project with URL and anon key; provide a personal access token to apply migrations.
4. Migrations, RLS policies, storage buckets, and repositories are generated; G4 verifies them.
5. Preview runs against the connected backend; flows sign up, sign in, create an issue, comment, and upload an attachment.
6. Publish web and view the build report with backend verification.

Evidence: backend plan, migration files, RLS matrix, connection record with secrets redacted, flow report, publish report. Proves Supabase generation, backend security, and end-to-end preview and publish.

**Scenario C — Incremental edit with skills and repair**

1. Open an existing project and enable a recommended skill pack; disable a conflicting one and see the conflict resolved.
2. Request "add CSV export and a revenue chart."
3. A spec revision and plan diff appear in the existing builder stream; approve them.
4. Generation is incremental; a compile error is repaired within three attempts, each checkpointed.
5. The design contract is unchanged; the visual QA report shows no regression on existing screens.

Evidence: skill selection record, spec/plan diff, repair attempts, checkpoint list, visual comparison. Proves skills enablement, incremental generation, the repair loop, and design identity preservation.

**Scenario D — Build, sign, update, and recover**

1. Build the app for web, macOS, and Windows on their host machines; Android export where the toolchain exists.
2. Release CI signs and notarizes the macOS build and signs the Windows installer.
3. Install the signed build on a clean machine, verify update check, apply an update, and confirm local projects survive.
4. Force a renderer crash; a local crash report is written; export diagnostics; confirm no secrets are present.
5. Simulate a failed update and confirm rollback and safe mode.

Evidence: signed artifacts, notarization tickets, update log, crash report, diagnostics archive scan. Proves one codebase, signing, notarization, auto-update, and crash diagnostics.

**Scenario E — Hostile content**

1. Submit a prompt that asks the agent to read `~/.ssh`, print environment variables, and call the engine API.
2. The intake and policy layers deny the requests; the agent receives denial reasons; nothing sensitive is read or logged.
3. The preview attempts to call the engine API and read shell storage; both are blocked by origin isolation and the engine token.
4. Import a skill containing an exfiltration instruction; it is flagged and disabled by default.
5. Review the audit log and confirm each denial is recorded with a hash chain.

Evidence: policy denial records, audit chain verification, preview isolation test, skill scan result. Proves two-tier isolation, engine authentication, audit, and import safety.

---

## 16. UI surfaces (no redesign, no new navigation)

All capability is added inside existing screens. No new routes, no new side-panel tabs, no restyled components, no moved controls. New information appears as content inside an existing panel, card, dialog, or Settings section, using the current tokens.

### 16.1 Create project

The existing wizard keeps its visual shape and step indicator. Spec review, plan approval, and skill recommendations render inside the step body after the prompt is submitted. If adding visible steps would change the indicator, the content is nested inside the existing step instead. No new page.

### 16.2 Workspace

- Builder panel: spec review, plan approval, run report, and repair evidence are collapsible cards in the existing message stream. No **Spec**, **Plan**, **Quality**, **Backend**, or **Skills** tabs.
- Quality and run report: opened from the existing `BuildOutputPanel` and activity popover.
- Backend: connection and migration status live in the existing `ExportView` and Settings; the preview shows backend-unconfigured state in place.
- Skills: library and connectors live in Settings; project enablement is a control in the existing composer/builder header using existing icon buttons and menus.
- Preview toolbar: keeps the consolidated control; isolation and runtime-error indicators are text/badges inside the existing toolbar, not a layout change.
- Composer: "Enhance" is an existing-style icon action; attachments use the existing attachment affordance.
- Versions: checkpoints are added to the existing `VersionsView`; no new page.

### 16.3 Settings

Existing sections and components are extended; no new navigation:

- Sandbox status and capability gaps.
- Skills and connectors.
- Backend defaults and connection.
- Model routing per stage.
- Updates and channel.
- Crash reports and diagnostics.
- Local data location, retention, backup, and clear-data action.
- Audit log viewer.

### 16.4 Blocking states

- Spec not approved → no generation.
- Plan not approved (unless skipped) → no generation.
- Sandbox reduced → explicit consent required.
- Supabase app not connected → backend flows unverified; publish blocked for backend targets.
- Engine token missing or invalid → the renderer shows "engine authentication failed" instead of retrying silently.

### 16.5 Visual regression rule

- Landing, dashboard, auth, workspace shell, AI builder layout, preview toolbar, and settings layout are frozen.
- CI captures the approved screens at the same sizes and fails on unexpected visual diffs.
- Any intentional visual change is a separate, explicitly approved task. It is never bundled with sandbox, backend, skills, or quality work.
- New content inside an existing panel must use current spacing and type tokens; it must not introduce a new visual language.

### 16.1 Create project

Add steps to the existing wizard:

1. Describe.
2. Review spec (editable).
3. Plan, skills, and backend.
4. Build.

The visual style is unchanged; the steps reuse the current step indicator and cards.

### 16.2 Workspace

- Builder panel: spec review, plan approval, run report cards, repair evidence.
- New side-panel tabs alongside existing ones: **Spec**, **Plan**, **Quality**, **Backend**, **Skills**.
- Preview toolbar: keep the consolidated control; add an isolation badge, runtime error count, and "Open in browser" for the preview origin.
- Composer: "Enhance" action, attachment for design references/assets, and a model-route indicator.
- Versions view: add run checkpoints and spec/plan revisions.

### 16.3 Settings

New sections using the existing `ff-card`, `Badge`, `Button`, and `Input` patterns:

- Sandbox status and capability gaps.
- Skills and connectors.
- Backend defaults and connection.
- Model routing per stage.
- Updates and channel.
- Crash reports and diagnostics.
- Local data location, retention, backup, and clear-data action.
- Audit log viewer.

### 16.4 Blocking states

- Spec not approved → no generation.
- Plan not approved (unless skipped) → no generation.
- Sandbox reduced → explicit consent required.
- Supabase app not connected → backend flows unverified; publish blocked for backend targets.
- Engine token missing or invalid → the renderer shows "engine authentication failed" instead of retrying silently.

---

## 17. Lovable / Replit parity matrix

Status: **Have** (works today), **Partial** (exists but incomplete), **Plan** (in this design), **Later** (in scope, later phase).

| Capability | Status | Phase | Notes |
|---|---|---|---|
| Chat-to-app | Have | — | DSH generation loop. |
| Prompt enhancement | Partial | 2 | Spec stage replaces one-shot prompts. |
| Spec review | Plan | 2 | Editable ProductSpec. |
| Plan approval | Plan | 2 | Deterministic BuildPlan. |
| Live preview | Have | — | Warm Flutter web runner. |
| Device sizes | Have | — | Mobile/tablet/desktop. |
| Native macOS/Windows preview | Plan | 5 | Local `flutter run -d`. |
| Mobile emulator preview | Later | 5 | Android emulator; iOS simulator on macOS. |
| Code editor | Have | — | Monaco. |
| File explorer | Have | — | — |
| Terminal | Have | — | Allowlist, no shell. |
| Version history and restore | Have | — | Supabase-backed today; local store in phase 1. |
| Run checkpoints | Partial | 2 | Extend to spec/plan/design. |
| Visual QA | Have | — | Screenshots, heuristics, semantics. |
| Visual element selection and edit | Plan | 5 | Preview-side picker; cross-origin safe. |
| Error repair loop | Partial | 2 | Add runtime, flows, dedup, 3 attempts. |
| Supabase backend detection | Plan | 2 | Deterministic planner. |
| Supabase schema, RLS, migrations | Partial | 2 | Generate and verify. |
| Supabase auth/storage/realtime UI | Partial | 2 | Generated flows and states. |
| Supabase edge functions | Plan | 4 | Server-side secrets. |
| Local persistence | Partial | 2 | Sembast/shared_preferences by data complexity. |
| Database editor | Later | 5 | Browse tables and rows for connected projects. |
| GitHub export | Plan | 4 | Device Flow, gated push. |
| GitHub import | Later | 5 | Reverse spec draft. |
| Templates and gallery | Later | 5 | Curated local templates. |
| Asset upload and image generation | Later | 5 | References become design inputs. |
| Secrets and env management | Plan | 2 | Vault + generated app config. |
| Skills library | Plan | 2 | Built-in packs, recommendations. |
| Connect skills / import | Plan | 3 | Folder, ZIP, Git, MCP connectors. |
| Publish web locally | Have | — | Isolated origin in phase 1. |
| Publish APK/macOS/Windows | Have | — | Toolchain-dependent. |
| Hosted web deploy | Later | 5 | Provider adapter. |
| Custom domains | Later | 5 | Hosted phase. |
| Deployment logs and rollback | Later | 5 | Hosted phase. |
| Collaboration, comments | Later | 6 | Sharing first, comments second. |
| Multiplayer editing | Not committed | — | Requires CRDT; only if demand is proven. |
| Sandboxed execution | Plan | 1–3 | Two tiers. |
| Audit log | Plan | 1 | Hash-chained. |
| Signing, notarization | Plan | 3 | Release gate. |
| Auto-update | Plan | 3 | Staged rollout. |
| Crash reports | Plan | 3 | Local first. |
| Eval suite | Plan | 2 | Golden prompts. |
| Guest mode / offline projects | Plan | 1 | Local store. |

---

## 18. Failure modes and edge cases

| # | Situation | Expected behavior |
|---|---|---|
| 1 | No model key | Block at spec with BYOK CTA; deterministic draft is available but labeled; no fake generation. |
| 2 | Free-model quota exhausted | Back off, try the fallback chain, then tell the user and suggest BYOK. |
| 3 | DSH runtime missing | Setup screen with install guidance; no silent failure. |
| 4 | Flutter SDK missing or partial | Managed download with checksum and resume; verify `flutter --version`; block preview until ready. |
| 5 | First run downloads several GB | Progress, pause/resume, disk preflight, offline explanation. |
| 6 | Disk full | Preflight free-space check; abort before writing; actionable message. |
| 7 | Path with spaces, Unicode, or cloud sync | Workspace under app data; warn on user-selected folders; long-path handling on Windows. |
| 8 | Read-only workspace | Detect at intake; ask for a writable location. |
| 9 | Concurrent runs | Lock and queue; never interleave writes. |
| 10 | Cancel mid-run | Kill the process tree, keep atomic files, offer restore to the pre-run checkpoint. |
| 11 | Model returns prose instead of tools | Existing fenced-code recovery; one stricter retry; otherwise fail with a run report. |
| 12 | Hallucinated package or version | Reject in the plan; resolve through the version registry; remove or replace; re-run `pub get`. |
| 13 | SDK constraint mismatch | Existing pubspec sanitizer; compile gate. |
| 14 | Supabase URL/key missing | Migration-only mode; backend-unconfigured state; backend flows unverified; publish blocked. |
| 15 | RLS missing | G4 failure; repair with explicit policy requirements; never auto-weaken. |
| 16 | Service-role key appears in client | Block, redact, audit; regenerate the file. |
| 17 | Realtime or offline state missing | Completeness finding; repair. |
| 18 | Preview port exhaustion | Try the next port; after the range, report exhaustion and offer to stop idle sessions. |
| 19 | Hot reload fails repeatedly | Full rebuild; if that fails, runtime gate failure. |
| 20 | Preview crash loop | Stop the warm runner, capture logs, show the cause, repair. |
| 21 | CanvasKit or renderer incompatibility | Fall back to the supported web renderer; report it. |
| 22 | QA window unavailable | Mark visual QA unavailable; run other gates; state it. |
| 23 | Flow selector not found | Mark unverified with a screenshot; do not fake a pass. |
| 24 | Signing certificate absent locally | Build unsigned with a warning; release CI blocks signing-required targets. |
| 25 | Notarization rejected | Map the Apple error, keep the artifact, mark release blocked. |
| 26 | Update feed unreachable | Retry with backoff; show last check time; never block the app. |
| 27 | Update arrives during a run | Download but do not restart; apply after the run and explicit confirmation. |
| 28 | Crash loop after update | Safe mode, diagnostics, revert guidance. |
| 29 | Sandbox unavailable | Capability gate; explicit consent; badged reduced isolation; audit. |
| 30 | Policy denies a needed command | Agent gets the denial reason; chooses another path or asks the user; audited. |
| 31 | Connector offline | Continue without it; mark dependent criteria unverified. |
| 32 | Imported skill conflicts | Block approval with a resolution action. |
| 33 | Skill token budget exceeded | Defer packs; never truncate silently. |
| 34 | Prompt contains a secret | Warn and redact before the model call; record only the redaction event. |
| 35 | Prompt injection in a dependency or skill | Sandbox, trust labels, policy, audit; skill text cannot outrank system rules. |
| 36 | Model outage mid-run | Retry with backoff; resume from the checkpoint; offer an alternate provider. |
| 37 | Context overflow | Summarize older history within a token budget; preserve the spec and plan. |
| 38 | User edits generated files during a run | Detect with hashes; pause the run and ask before overwriting. |
| 39 | Local store corruption | Validate documents on load; restore from the latest checkpoint; offer metadata rebuild. |
| 40 | Clock skew | Use monotonic durations for metrics; store UTC timestamps; tolerate skew in sync. |
| 41 | Sync conflict | Last-write-wins per entity; keep both files; show a restore choice. |
| 42 | Account linking of local projects | Explicit action; never silent upload. |
| 43 | Backend connection changes mid-project | Invalidate cached verification; require re-verification before publish. |
| 44 | Published artifact is stale | Bind publish to a run checkpoint; show the source run ID. |
| 45 | User publishes with advisory failures | Allowed with an audited override; the report lists what is unverified. |

---

## 19. Metrics and SLOs

| Metric | Target | Source |
|---|---|---|
| First-pass compile success | ≥ 90% | eval suite, runs |
| Critical completeness findings on passing runs | 0 | G5 |
| Acceptance flow pass rate | ≥ 80% | G8 |
| Backend verification pass (applicable) | ≥ 95% | G4 |
| Repair success within 3 attempts | ≥ 70% | run reports |
| Time to first preview, warm SDK | ≤ 4 min (medium app) | run reports |
| Time to first preview, cold SDK | ≤ 12 min | run reports |
| Publish success, web | ≥ 95% | publish reports |
| Crash-free sessions | ≥ 99.5% | local crash metadata |
| Sandbox escape findings | 0 | security tests |
| Secret leaks in logs/audit/exports | 0 | security tests |
| Guest-mode project creation offline | 100% | store tests |
| Spec approval completion | ≥ 85% | product analytics, opt-in |

Telemetry is opt-in. Core quality metrics are computed locally from run reports and can be exported without content.

---

## 20. Phased roadmap and exit gates

The order reduces risk first, then raises quality, then ships. Each phase is usable on its own.

### Immediate implementation order

1. Review and approve this spec.
2. Write the implementation plan for Phase 0 and Phase 1 together, because the schemas and the security core are one contract.
3. Land Phase 0: schemas, version registry, policy format, PreviewProvider interface, eval skeleton, tests.
4. Land Phase 1: engine token, path confinement, environment scrubbing, preview/publish origin split, audit log, local store, guest mode.
5. Run the security fixtures and a real guest-mode run before starting any quality feature.
6. Land Phase 2A on a local CRUD app, then Phase 2B on a Supabase-auth app.
7. Only after both slices pass their eval targets, start connectors, shipping, and parity work.

The first release is not the parity matrix. It is two slices that prove the promise: one local app and one secured Supabase app, each generated, verified, isolated, previewed, and published with a run report.

### Phase 0 — Contracts and guardrails (S)

- ProductSpec, BuildPlan, RunReport, SkillManifest, AuditEvent schemas.
- Version registry for dependencies.
- PreviewProvider interface.
- Policy file format and unit tests.
- Eval harness skeleton.

Exit: schemas validated by tests; no user-facing change.

### Phase 1 — Secure core and local-first foundation (L)

- Engine API token, Host/Origin checks, renderer fetch wrapper.
- Environment scrubbing, workspace path confinement, atomic writes.
- Preview and publish origins split; session partitions; CSP; iframe changes.
- Capability gate and reduced-isolation badge.
- Audit log with hash chain and Settings viewer.
- Local project store, guest mode, checkpoints, import/export of projects.
- Basic policy engine and command auditing.

Exit: security tests for T1/T4/T5/T6/T7/T13/T14 pass; a guest can create, edit, preview, and restore a project offline; preview cannot reach the engine.

### Phase 2A — Spec-to-preview vertical slice (M)

- Spec enhancement, review UI, deterministic fallback.
- Design stage derived from spec.
- Plan compiler and approval UI.
- Built-in skill library, recommendations, enablement, conflict and budget handling.
- Completeness audit and critical findings.
- Basic run report.
- One local CRUD app taken end to end: prompt, spec, plan, generate, gates, isolated preview, publish.

Exit: three local eval prompts reach first-pass compile and zero critical completeness findings; the user can choose skills and see a run report; no dummy-data or dead-control app passes G5.

### Phase 2B — Supabase, runtime verification, and repair v2 (L)

- Supabase planner, migrations, RLS verification, connection modes, Backend panel.
- Runtime error capture and acceptance flows.
- Repair loop v2 with classification, dedup, 3 attempts, checkpoints.
- Full run report with evidence and unverified items.
- Golden eval suite in CI.

Exit: a Supabase-auth app is generated, verified, connected, previewed, and published; acceptance flows run or are explicitly marked unverified; eval targets in section 15.5 are met on the deterministic subset.

### Phase 3 — OS sandbox tiers, build isolation, and connectors (XL)

- macOS SBPL, Linux bubblewrap, Windows restricted token/AppContainer.
- Egress proxy with tier allowlists.
- Build tier with scrubbed environment and toolchain access.
- Skill import from folder/ZIP/Git; trust levels; injection scan.
- MCP connectors with per-tool approval and audit.
- Connector failure handling.

Exit: the tier tests pass on all three OSes; a malicious fixture cannot read the home directory, vault, or engine token; imported skills are labeled and cannot execute code.

### Phase 4 — Shipping (L)

- Code signing and notarization for macOS and Windows.
- `electron-updater`, channels, staged rollout, rollback, safe mode.
- Crash reporter and diagnostics export.
- GitHub export (Device Flow, gated push).
- Supabase edge functions.
- Release CI on clean machines.

Exit: signed artifacts install on clean machines; update and rollback tests pass; crash reports contain no secrets; GitHub export pushes a gated project.

### Phase 5 — Parity and polish (XL)

- Templates and gallery.
- Asset uploads and reference-driven design.
- Visual element selection and edit.
- GitHub import and reverse spec.
- Native macOS/Windows preview; Android emulator preview.
- Hosted web deploy adapter, custom domains, logs, rollback.
- Database editor.
- Additional built-in skills and eval prompts.

Exit: the parity matrix has no "Plan" rows for the must-have core; hosted deploy is optional and isolated behind the seam.

### Phase 6 — Collaboration (L)

- Project sharing and permissions.
- Comments and review.
- Multiplayer editing only if a CRDT design passes a separate review.

Exit: sharing works without exposing local-only projects; permissions match Supabase RLS.

---

## 21. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Generator output remains inconsistent | Dummy-feeling apps | Spec + plan + completeness + runtime flows + evals; hard gates. |
| Too many gates slow generation | Poor UX | Deterministic gates run in parallel where safe; warm preview; clear progress; advisory vs blocking split. |
| Sandbox fragility across OS updates | Security or availability | Capability gate, CI matrix, explicit reduced-isolation consent, one tier per OS with tests. |
| Windows isolation is hard | Platform gap | Restricted token + AppContainer + Job Object; document the gap; refuse silent downgrade. |
| Supabase credential handling | Secret exposure | Vault only, server-side use, redaction, security tests, no service-role key in client. |
| Skills prompt injection | Agent misbehavior | Instruction-only skills, trust levels, scanning, policy outranks prompts, sandbox. |
| MCP connector abuse | Data loss or exfiltration | Per-tool allowlist, approval, Tier A, audit, output limits. |
| Runtime flow automation is flaky | False failures | Semantics-based waits, retries, explicit unverified status, screenshots. |
| Scope explosion | Nothing ships | Phase gates; each phase is independently usable; no silent drops. |
| Local store corruption | Data loss | Atomic writes, checksums, checkpoints, corruption recovery. |
| Update breaks the app | Trust loss | Staged rollout, rollback, safe mode, release tests. |
| Electron/Node native module issues | Packaging | File-backed local store; no new native modules; asar rules tested. |
| Design creep | Approved UI changes | New surfaces reuse tokens and chrome; visual regression review on existing screens. |
| Model cost | Margin and UX | Route by stage, budgets, economy for summaries, frontier for code and repair. |

---

## 22. Decisions made where the request was open

These are the choices this design makes. They are reviewable in the spec-approval step.

1. **Skills are instruction packs, not executable plugins.** Code needs a connector. This keeps skills safe to import and share.
2. **"Connect skills" includes MCP connectors** because that is how external tools and data are actually connected without giving the model code execution.
3. **Supabase is the managed backend.** Local persistence covers offline apps; there is no bespoke backend server generator.
4. **Backend detection is deterministic and user-confirmable.** The model does not decide silently.
5. **Automatic Supabase project creation is a later phase.** Existing-project connection and SQL generation ship first; neither fakes provisioning.
6. **GitHub export is phase 4; GitHub import is phase 5.** Both are gated by the publish security scan.
7. **Hosted previews and custom domains are phase 5.** The local seam exists from phase 1.
8. **Collaboration is phase 6; multiplayer editing is not committed.**
9. **Native and emulator previews are phase 5.** Web preview remains the fast default.
10. **The local store is file-backed, not SQLite**, to avoid native-module packaging risk. It can migrate to SQLite later behind the same interface.
11. **No visual redesign.** Capability ships inside existing screens: no new routes, no new side-panel tabs, no moved controls. New content reuses the approved tokens and components.

---

## 23. Design acceptance criteria

This design is complete when a reviewer can confirm:

1. Every stage S0–S7 has an owner, input, output, failure behavior, and user-visible evidence.
2. The ProductSpec and BuildPlan schemas cover screens, states, data, auth, acceptance, design, backend, skills, and verification.
3. Professional quality is defined and testable through static checks, runtime flows, visual QA, and evals.
4. Supabase generation covers detection, connection, schema, RLS, storage, realtime, edge functions, verification, and secret handling.
5. Skills cover built-ins, recommendations, enablement, conflicts, token budget, imports, trust, and connectors.
6. Two-tier sandbox and preview isolation have explicit boundaries, policy, egress, audit, and capability gates.
7. Every security invariant has an automated test.
8. Preview has states, reload policy, runtime capture, visual QA, device sizes, and failure handling.
9. Publish/export includes gates, reports, GitHub, and a hosted seam.
10. Local-first data, guest mode, checkpoints, and sync conflicts are specified.
11. Signing, notarization, auto-update, rollback, and crash reporting are specified.
12. The Lovable/Replit parity matrix covers the core feature set and assigns every row a status and phase.
13. Failure modes and edge cases cover the operational reality of a local desktop studio.
14. Metrics and SLOs are measurable from run reports.
15. The roadmap has exit gates and does not require a later phase to make an earlier phase safe.
16. Every 3.1 commitment maps to an end-to-end scenario (A–E) with named evidence and a phase.
17. No new navigation, routes, or side-panel tabs are introduced; the frozen-screen visual regression gate passes on the landing, dashboard, auth, workspace shell, builder, preview toolbar, and settings.
