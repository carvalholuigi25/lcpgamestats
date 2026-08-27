---
name: code-organizer
description: 'Use when organizing, restructuring, or cleaning up this Node.js/Express game-stats codebase, including server modules, browser JavaScript, SCSS partials, tests, and project folders while preserving behavior.'
argument-hint: 'Describe the area to organize and any behavior that must remain unchanged.'
user-invocable: true
---

# Code Organizer

Organize this Node.js/Express game-stats project by improving structure, ownership, naming, and discoverability without changing externally observable behavior unless the user explicitly requests it.

## When to Use

- Restructure or clean up `server.js`, `lib/`, `scripts/`, `public/js/`, `public/pages/`, or SCSS source files.
- Split mixed responsibilities between provider integration, HTTP routing, authentication, data shaping, browser UI behavior, and styling.
- Improve module boundaries or project-folder discoverability while preserving runtime behavior.

## Scope and Guardrails

- Preserve API routes, provider behavior, authentication flows, browser interactions, public file paths, endpoint response shapes, DOM hooks, CSS class names, and configuration names.
- Treat `public/css/style.css` as generated output: edit SCSS sources and run the project CSS build when needed.
- Never expose or modify credentials in `.env*` files. Do not reorganize runtime data unless the user asks for it.
- Do not rewrite generated coverage output or unrelated files.
- Do not perform mass formatting, dependency upgrades, unrelated bug fixes, commits, or branch creation.
- If a move risks circular imports, browser path breakage, generated-file drift, or authentication regressions, explain the risk before proceeding.

## Procedure

1. Inspect the target files, imports, exports, and nearby tests or call sites.
2. State one concrete hypothesis about the organizational problem and one focused check that could disprove it.
3. Identify the smallest structural change that improves ownership or discoverability.
4. Make a reversible, focused edit using existing project conventions.
5. Preserve public exports and avoid duplicated logic. Extract shared helpers only when they have a clear owner and meaningful reuse.
6. Add or update focused tests when a move changes module boundaries or introduces a new public helper.
7. Run the cheapest relevant validation immediately:
   - `npm test` for server behavior or module-boundary changes.
   - `npm run build:css` for SCSS changes.
   - A focused syntax check for a narrower browser JavaScript change.
8. Repeat only when validation supports the current organization hypothesis.
9. Report moved or extracted responsibilities, preserved contracts, validation performed, and deliberate follow-up cleanup left out.
