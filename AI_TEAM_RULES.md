# QC-OMS CODEX WORKFLOW RULES

Version: 3.0 Compact

Read this file before working. These are the current active rules.

## 0. Current Operating Model

QC-OMS uses **Codex only**, split into multiple working threads.

Current active Codex threads:

1. **Spec Thread** - source of truth, business rules, UX/spec documentation.
2. **Implement Thread** - code, tests, PRs, deployment work.
3. **Review Thread** - project checks, test runs, review, risk reports, and handoff material for the other two threads.

The Review Thread is the thread responsible for checking the project when Owner asks, running verification, reviewing current state, and preparing clear reports or work packages so Spec and Implement can continue safely.

For load/performance work, read and update `docs/PERFORMANCE-FIX-LOG.md` with measured request counts, timings, fixes, and verification before handing off or merging.

For data-source or persistence work, read `docs/CURRENT-DATA-SOURCE.md` first. Current rule: sales/finance runtime data (POS checkout, quotes, sales documents, customer debt, debt collection, cashbook) uses PostgreSQL as source of truth. Do not reintroduce RAM/global-array persistence, Supabase runtime, or hybrid RAM+DB reads for these flows.

## 1. Mandatory Working Principles

Every Codex thread must follow these principles.

### Think Before Acting

- Do not assume silently or hide uncertainty.
- State consequential assumptions and tradeoffs before implementation.
- If business requirements have multiple interpretations, explain them and ask Owner.
- If uncertainty is technical, Codex chooses the simplest defensible option and records important tradeoffs.
- Push back when a simpler or safer approach better serves the requested goal.
- For trivial tasks, use judgment and avoid unnecessary ceremony.

### Simplicity First

- Implement only what was requested; add nothing speculative.
- Do not create abstractions, configuration, flexibility, or error handling without a current need.
- Prefer the smallest solution that fully satisfies the requirement.
- If the solution is substantially larger than necessary, simplify it before completion.

### Surgical Changes

- Every changed line must trace to the requested task.
- Do not refactor, reformat, rename, or clean adjacent code/documents unless required.
- Follow existing project style and work with current user changes.
- Remove only imports, variables, functions, links, or files made obsolete by the current change.
- Report unrelated problems; do not fix or delete them without scope approval.

### Goal-Driven Execution

- Define concrete success criteria before substantial work.
- For multi-step work, use a brief plan with a verification method for each step.
- For bugs, reproduce the failure when feasible, then verify the fix.
- For behavior changes, add or update focused tests when code exists and risk justifies them.
- Continue through implementation and verification; do not stop at a proposal unless Owner requested analysis only.
- Report what was verified and any remaining risk.

## 2. Authority

```text
OWNER -> CODEX THREADS
```

- **Owner** owns business decisions, operating priorities, and final acceptance.
- **Codex** is the only AI executor for the repository.
- **Codex threads** divide work by role, but no thread has authority above Owner.

No thread may override Owner business decisions.

## 3. Owner

Owner provides:

- product needs
- real operating workflows
- business rules
- priorities
- acceptance or rejection

Owner is not required to decide architecture, database design, API design, code structure, or technical correctness.

When business requirements are missing or contradictory, the active Codex thread must explain the issue and ask Owner.

## 4. Codex Threads

### Spec Thread

The Spec Thread owns:

- Source of Truth documentation
- business and UX scope
- acceptance criteria
- handoff material for implementation
- business review of important PRs or slices

The Spec Thread must:

- keep docs/spec aligned with Owner decisions
- separate in-scope and out-of-scope work
- identify business risks before implementation starts
- hand off work with branch/commit, files, acceptance checklist, and verification expectations

The Spec Thread must not:

- silently change business rules
- ask Implement to code from drafts unless the handoff clearly states which parts are approved
- bypass Owner for high-impact business decisions

### Implement Thread

The Implement Thread owns:

- code changes
- tests and verification
- PR/deploy execution
- technical feedback to Spec when specs are missing or risky

The Implement Thread must:

- follow the latest Owner decision and Source of Truth
- keep changes inside the handed-off scope
- ask Spec or Owner before changing money, debt, inventory, documents, schema, or long-lived APIs beyond the approved scope
- report verification, known gaps, and risks before asking for review or acceptance

The Implement Thread must not:

- self-open new product scope
- hide failing tests or partial verification
- merge or deploy work that still has unresolved Must Fix issues

### Review Thread

The Review Thread owns:

- project health checks when Owner requests
- lint/typecheck/build/test runs
- code review and risk review
- drift detection between docs, code, and tests
- preparing clear reports, findings, and handoff notes for Spec and Implement

The Review Thread must:

- inspect current files before judging project state
- run appropriate verification commands and report exact pass/fail results
- distinguish confirmed issues from likely issues
- explain problems in language Owner can understand when requested
- prepare actionable next steps for Spec and Implement
- record assigned review findings in `docs/REVIEW-ISSUES.md` and re-check them after the responsible thread reports a fix

The Review Thread must not:

- implement feature changes unless Owner explicitly asks it to
- change business rules
- treat old docs or cached assumptions as current truth when live files say otherwise
- mark work complete without verification evidence

## 5. Source of Truth Priority

When chat, docs, plans, and code differ, use this order:

1. Latest Owner decision in chat.
2. Source of Truth docs/spec committed on the relevant branch or `main`.
3. Current code.
4. Git history for old plan/spec trace only when needed.

If code differs from Owner decision or Source of Truth, treat it as implementation drift until Spec or Owner resolves it.

## 6. Thread Communication

Allowed communication pattern:

```text
Owner <-> Codex Threads
Spec <-> Implement
Review <-> Spec / Implement / Owner
```

Thread-to-thread work must be a closed loop. If one thread receives a handoff, review request, blocker question, or review issue from another thread, the receiving thread must report back directly to the sending thread when the work is done, blocked, or intentionally deferred.

Owner should not need to remind threads to report back. The thread that accepts work owns the return report.

For important handoffs, include:

- task or slice
- branch/PR/commit
- files or Source of Truth followed
- in scope
- out of scope
- verification run
- known gaps
- risks
- questions or Owner decisions needed
- current owner
- next owner
- next action

Required return-report formats:

```text
[Spec -> Implement]
[Implement -> Spec]
[Review -> Spec]
[Spec -> Review]
[Review -> Implement]
[Implement -> Review]
```

Use the specific pair that matches who sent the work and who must verify or continue it. If more than one thread is affected, send the report to each affected thread.

Every important report must make ownership explicit:

```text
Status:
- ...

Current owner:
- Spec / Implement / Review / Owner

Next owner:
- Spec / Implement / Review / Owner

Next action:
- ...

Owner decision needed:
- Yes / No
```

For active slices and PRs, Spec maintains `docs/PROJECT-COORDINATION.md` with the same owner/next-action state. Review flags stale work when Owner must ask who is holding the next action.

## 7. Decision Rules

- Business conflict -> Owner decides.
- Technical conflict -> Implement decides, unless it changes business behavior.
- Source of Truth conflict -> Spec decides, unless Owner input is needed.
- Live repository conflict -> Review audits and reports; Implement fixes if approved.
- Execution conflict -> the active Codex thread reports the blocker with options and a recommendation.

No thread may invent a business rule to fill a missing decision.

## 8. Reporting

For important work, every thread reports:

- Task
- Decision
- Files
- Verification
- Risk
- Need Owner Decision
- Current owner
- Next owner
- Next action

The Review Thread should also report:

- checks run
- pass/fail results
- likely owner-readable impact
- recommended next action for Spec or Implement
- review issue IDs from `docs/REVIEW-ISSUES.md` when a finding is assigned to another thread

When Review assigns an issue to Spec or Implement, the responsible thread must report back directly to Review before Review can close the issue. Review must not depend on Owner to relay status.

## 9. Commit And Push

Only Codex may commit or push, but the active thread must respect the current role and scope.

Before commit or push, confirm:

- changed files were reviewed
- unrelated changes are excluded
- temporary files are absent
- unresolved business decisions were not silently implemented
- required verification has been run and reported

## 10. Core Principle

Owner owns business.

Codex is the only AI executor.

Spec defines the work, Implement builds it, and Review checks the project and prepares clean handoffs.
