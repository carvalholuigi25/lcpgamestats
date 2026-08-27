---
name: code-optimizer
description: 'Use when optimizing, speeding up, or reducing resource usage in this Node.js/Express game-stats codebase, including server APIs, provider integrations, browser JavaScript, SCSS, data access, and tests. Requires evidence-driven profiling or a reproducible performance symptom before changing behavior.'
argument-hint: 'Describe the slow path, resource concern, target metric, or command to optimize.'
user-invocable: true
---

# Code Optimizer

Improve runtime performance, resource usage, or build efficiency while preserving the application’s observable behavior and public contracts. Optimize the smallest responsible slice, and leave a measurable record of why the change is worthwhile.

## When to Use

- A request mentions optimize, speed up, performance, latency, throughput, memory, CPU, bundle size, or slow tests.
- An endpoint, provider integration, browser interaction, SCSS build, or data-processing path has a reproducible performance problem.
- A resource limit or scaling concern needs investigation before implementation.

## Scope and Guardrails

- Preserve API routes, response shapes, authentication behavior, provider fallbacks, DOM hooks, CSS class names, configuration names, and user-visible behavior unless the user explicitly authorizes a behavior change.
- Do not optimize by removing error handling, weakening authentication, disabling rate limiting, reducing data correctness, or hiding a slow operation.
- Do not guess from style alone. Establish a baseline with a focused reproduction, benchmark, profiler, test, or diagnostic before editing when practical.
- Keep optimizations local. Avoid dependency upgrades, broad rewrites, mass formatting, generated coverage changes, and unrelated bug fixes.
- Treat `public/css/style.css` as generated output: edit SCSS sources and run the CSS build when styles are involved.
- Never expose or modify credentials in `.env*` files or commit generated secrets.
- If the requested target, workload, or acceptable tradeoff is unclear, ask for the missing metric or constraint before making a broad change. A narrow, low-risk improvement may proceed only when its benefit and behavior are directly testable.

## Procedure

1. Inspect the named slow path, its callers, imports, data flow, and the nearest tests or benchmark. Start at the code that computes, allocates, queries, renders, or waits; do not stop at a route or event listener that only forwards work.
2. State one falsifiable performance hypothesis, such as repeated provider requests, unnecessary serialization, an avoidable scan, duplicate DOM work, or an oversized build input. Name one cheap check that could disprove it.
3. Establish a focused baseline when possible. Record the command or workload, relevant input size, timing or resource signal, and correctness result. Prefer an existing benchmark or test; otherwise use a minimal reproducible measurement rather than a synthetic claim.
4. Choose the smallest change that addresses the measured bottleneck. Consider algorithmic complexity, I/O and network calls, caching and invalidation, batching, pagination, allocation volume, browser rendering work, and build output only when evidence points there.
5. Check the contract before editing. For caches, define freshness and failure behavior; for concurrency, preserve ordering and error propagation; for pagination or filtering, preserve edge cases; for browser changes, preserve event behavior and accessibility; for CSS, preserve responsive output.
6. Make one focused edit slice using existing project patterns. Keep public exports, endpoint names, provider interfaces, DOM selectors, and configuration semantics stable.
7. Add or update a focused regression test or benchmark for the bottleneck and its important edge cases. A performance test must also assert correctness; avoid brittle absolute timing thresholds unless the repository already uses them.
8. Run the cheapest relevant validation immediately after each edit:
   - `npm test` for server behavior, provider logic, data shaping, or shared JavaScript changes.
   - `npm run build:css` for SCSS changes, followed by checking only the generated output needed for the change.
   - A focused Node syntax check or browser test for a narrower frontend JavaScript change.
   - The baseline workload or benchmark again when one exists, using the same input and measurement method.
9. Compare before and after results. Keep the change only when correctness is preserved and the result is meaningfully better or removes a demonstrated resource risk. If the result is neutral or noisy, report that and avoid speculative follow-up edits.
10. Report the hypothesis, measurement method, observed result, preserved contracts, validation commands, and any remaining uncertainty. Mention optimizations deliberately left out because their tradeoffs were not justified.

## Completion Checklist

- [ ] A concrete bottleneck or resource risk was identified.
- [ ] A falsifiable hypothesis and focused check were defined.
- [ ] Baseline and post-change correctness were verified.
- [ ] The optimization is limited to the responsible code path.
- [ ] Public behavior and failure semantics remain compatible.
- [ ] Focused tests, build checks, or benchmark results were run and reported.
