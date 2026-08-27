---
name: fix-code
description: 'Use when fixing, debugging, or repairing a code defect in this Node.js/Express game-stats project. Reproduce the failure, identify the controlling code path, make the smallest root-cause change, and verify behavior with focused tests or checks.'
argument-hint: 'Describe the failing behavior, error, file, test, or command to fix.'
user-invocable: true
---

# Fix Code

Repair a confirmed or reproducible defect in this project while preserving unrelated behavior, public contracts, and local conventions.

## When to Use

- A test, command, endpoint, provider integration, browser interaction, or stylesheet is failing.
- The user reports incorrect behavior, an exception, a regression, or a missing edge case.
- A code path needs diagnosis and a focused corrective change.

## Scope and Guardrails

- Start from the most concrete anchor available: a failing test, error, command, file, symbol, behavior, or nearby call site.
- Step through forwarding code to the nearest implementation that directly computes, mutates, renders, waits, or controls the failing behavior.
- Preserve API routes, response shapes, authentication semantics, provider fallbacks, exports, DOM hooks, CSS class names, configuration names, and user-visible behavior unless the request changes the contract.
- Treat `public/css/style.css` as generated output. Edit SCSS sources and run `npm run build:css` when styles change.
- Keep credentials, tokens, and private data out of source, tests, logs, and coverage artifacts.
- Avoid unrelated refactors, dependency upgrades, mass formatting, generated coverage edits, commits, and branch creation.
- Do not hide errors, weaken validation or authentication, loosen tests, or change expected behavior merely to make a check pass.
- Work with existing user changes in the tree. Do not revert unrelated modifications.

## Procedure

1. Identify the smallest failing behavior and inspect its controlling implementation, imports, callers, and nearest test or usage.
2. State one falsifiable local hypothesis about the defect and one cheap check that could disprove it.
3. Run the narrowest existing reproduction or test before editing when available. Capture the relevant failure, input, and expected behavior.
4. Choose the smallest reversible edit that tests the hypothesis and fixes the root cause. Preserve existing APIs and error semantics.
5. Add or update a focused regression test when the defect is testable. Cover the failing input and the important boundary, invalid-input, or failure path involved in the contract.
6. Immediately run the cheapest focused validation after the first substantive edit:
   - `npm test` for server modules, routes, providers, authentication, data shaping, or shared JavaScript.
   - `npm run build:css` for SCSS changes.
   - A narrow Node syntax check or browser check for isolated frontend JavaScript when no test covers it.
7. If validation fails and supports the hypothesis, repair the same slice and rerun that check before expanding scope. If it disproves the hypothesis, move one nearby hop to the code that directly controls the behavior.
8. Run the full relevant suite after the focused check passes. Use `npm test` for behavior changes and `npm run coverage` when the fix adds or changes meaningful test branches.
9. Inspect the final diff for accidental contract changes, generated-file churn, debug output, secrets, and unrelated edits.
10. Report the root cause, files changed, focused and full validation commands, and any remaining limitation or untested path.

## Decision Points

### Server or Provider Behavior

Trace request inputs through routing, validation, provider calls, data shaping, and response handling. Test success, provider failure, malformed input, and fallback behavior when those paths are part of the contract. Keep network and credential-dependent tests deterministic with stubs or controlled fixtures.

### Authentication or User Data

Preserve session, token, password, authorization, and filesystem semantics. Never log secrets. Verify both authorized and rejected paths, including missing or malformed credentials where relevant.

### Browser JavaScript

Trace the event or initialization path to the DOM mutation or API call that decides the behavior. Preserve selectors, accessibility behavior, loading and error states, and user-visible response handling. Use a focused syntax or browser check when the project has no narrower automated test.

### SCSS or Visual Behavior

Edit the responsible SCSS partial or source rule, not generated CSS. Run `npm run build:css`, then verify the affected selector and responsive states. Avoid unrelated formatting or theme changes.

## Repository Commands

```text
npm test
npm run coverage
npm run build:css
```

## Completion Checklist

- [ ] The concrete failure and controlling code path were identified.
- [ ] A falsifiable hypothesis and discriminating check were defined.
- [ ] The failure was reproduced or the available evidence was recorded.
- [ ] The smallest root-cause edit was made.
- [ ] A focused regression test or behavior check covers the defect.
- [ ] Focused validation passed immediately after the edit.
- [ ] The relevant full suite or build passed.
- [ ] The final diff contains no secrets, debug output, generated churn, or unrelated changes.
- [ ] Remaining risks and validation limits were reported.
