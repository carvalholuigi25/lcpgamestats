---
name: test-with-coverage
description: 'Use when testing or debugging this Node.js/Express game-stats codebase and measuring test coverage. Run focused tests first, use c8 coverage to find untested behavior, add regression tests, and verify the final result.'
argument-hint: 'Describe the code path, behavior, or bug to test and any coverage target.'
user-invocable: true
---

# Test With Coverage

Test changes in this Node.js/Express project with focused behavior checks and c8 coverage evidence. Preserve existing contracts, keep tests deterministic, and use coverage to guide missing cases rather than to chase a number blindly.

## When to Use

- Add or update tests for `server.js`, `lib/`, scripts, or shared browser-side JavaScript.
- Investigate a bug, regression, untested branch, error path, provider fallback, or authentication behavior.
- Measure coverage after changing production code or strengthen tests around a risky path.

## Scope and Guardrails

- Inspect the target implementation, its callers, exports, and nearest tests before editing.
- State one falsifiable behavior hypothesis and one cheap check that could disprove it.
- Prefer focused tests that assert observable behavior, response shape, errors, side effects, and important edge cases.
- Keep tests deterministic: isolate environment variables, credentials, time, filesystem data, network calls, and generated state as needed. Never place real credentials in tests or coverage artifacts.
- Preserve public routes, exports, response formats, authentication semantics, provider fallbacks, and existing test conventions unless the request explicitly changes them.
- Do not edit generated files under `coverage/` by hand. Do not treat a higher percentage alone as proof of correctness.
- Avoid unrelated refactors, dependency upgrades, mass formatting, commits, and branch creation.

## Procedure

1. Identify the smallest behavior under test and read its implementation plus the nearest test or call site.
2. State a concrete hypothesis, such as an input boundary taking the wrong branch, an error being swallowed, or a fallback returning the wrong shape. Name one focused assertion or existing test that would disprove it.
3. Run the narrowest relevant existing test command first. For this repository, use `npm test` with Node's built-in test runner; use a test-name filter or a temporary focused test only when the project supports it without changing committed behavior.
4. Add or update the smallest regression test that fails for the suspected defect and passes for the intended behavior. Cover success, boundary, invalid-input, and failure paths when they are part of the contract.
5. Make the minimal production change only when the test demonstrates a real defect. Keep setup and cleanup local to the test and restore modified process state in `finally` blocks.
6. Run the focused test again immediately. If it fails, repair the same slice before broadening the investigation.
7. Run `npm run coverage` from the repository root. This invokes `c8 --reporter=lcov npm test` and writes the report to `coverage/`.
8. Inspect `coverage/lcov.info` or the generated HTML report for the touched file. Distinguish uncovered meaningful behavior from defensive or unreachable code; add tests for meaningful uncovered branches.
9. Run the full suite and coverage command again after the final test or production edit. Confirm both correctness and that coverage includes the intended files and branches.
10. Report the tests added or changed, commands run, coverage observations for the touched code, and any remaining uncovered behavior or environmental limitation.

## Repository Commands

```text
npm test
npm run coverage
```

Coverage output is generated under `coverage/`, including `coverage/lcov.info` and an HTML report. Keep generated coverage changes out of source edits unless the repository explicitly tracks them for the task.

## Completion Checklist

- [ ] The target behavior and nearest implementation were inspected.
- [ ] A falsifiable hypothesis and focused check were defined.
- [ ] A regression or edge-case test covers the requested behavior.
- [ ] Tests are deterministic and clean up modified state.
- [ ] The focused test passed after the edit.
- [ ] The full test suite passed.
- [ ] Coverage was generated and the touched code was inspected.
- [ ] Remaining coverage gaps and validation limits were reported.
