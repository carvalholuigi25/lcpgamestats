---
name: add-new-feature
description: 'Add a new feature to lcpgamestats. Use when implementing backend APIs, frontend components, data models, tests, or documentation updates. Follow this checklist to ensure all layers are complete.'
argument-hint: 'Feature name or description'
user-invocable: true
---

# Add New Feature

A structured checklist for implementing features in lcpgamestats, ensuring consistent coverage across backend, frontend, database, testing, and documentation.

## When to Use

- Adding a new API endpoint
- Creating a new UI component or page
- Adding game data fields or user features
- Implementing authentication/provider integration
- Any enhancement spanning multiple layers (server, client, data)

## Feature Implementation Checklist

### 1. Planning & Design
- [ ] Define feature requirements and acceptance criteria
- [ ] Identify which layers are affected (backend/frontend/database)
- [ ] Check existing patterns in [lib/](../../lib/), [public/js/](../../public/js/), and [public/css/](../../public/css/)
- [ ] Determine data model changes (if any) in [data/](../../data/)

### 2. Backend Implementation (Node.js/Express)
- [ ] Add route handler to [server.js](../../server.js) or create new endpoint
- [ ] Implement business logic in [lib/](../../lib/) (e.g., lib/auth.js, lib/utils.js)
- [ ] Add any provider integrations to [lib/](../../lib/) (e.g., lib/gog.js, lib/epic.js)
- [ ] Define/update data models in [data/](../../data/) (users.json, feedback.json, etc.)
- [ ] Add middleware or utility functions as needed in [lib/utils.js](../../lib/utils.js)

### 3. Frontend Implementation
- [ ] Create or update UI components in [public/js/](../../public/js/)
  - [ ] Add event handlers and DOM manipulation
  - [ ] Implement state management if needed
- [ ] Update HTML pages in [public/pages/](../../public/pages/) (or [index.html](../../index.html))
- [ ] Add styling in [public/css/](../../public/css/)
  - [ ] Create SCSS file in appropriate folder (components/, layout/, themes/, etc.)
  - [ ] Follow naming conventions: `_component-name.scss`
  - [ ] Use theme variables and mixins from [base/_variables.scss](../../public/css/base/_variables.scss) and [base/_theme-mixins.scss](../../public/css/base/_theme-mixins.scss)
  - [ ] Ensure compatibility with all themes (_dark.scss, _cyberpunk.scss, _glassmorphism.scss, _light.scss, etc.)
  - [ ] Import in [style.scss](../../public/css/style.scss)
- [ ] Add localization keys to [public/json/langs/](../../public/json/langs/) (en.json, de.json, etc.)

### 4. Data & Schema
- [ ] Update JSON schemas in [data/](../../data/) if needed
- [ ] Add sample data to [sample_game_data.json](../../sample_game_data.json) for testing
- [ ] Update provider mappings in [providers.json](../../providers.json) if applicable
- [ ] Create migration script in [scripts/](../../scripts/) if data structure changes

### 5. Testing
- [ ] Write unit tests in [server.test.js](../../server.test.js)
  - [ ] Test new endpoints with various inputs
  - [ ] Test error cases and edge conditions
  - [ ] Verify integration with existing code
- [ ] Integration testing with external providers (if applicable)
  - [ ] Test GOG.com API integration (see [lib/gog.js](../../lib/gog.js))
  - [ ] Test Epic Games integration (see [lib/epic.js](../../lib/epic.js))
  - [ ] Test Uplay integration (see [lib/uplay.js](../../lib/uplay.js))
  - [ ] Mock provider responses for reproducible tests
  - [ ] Test auth flows and token refresh scenarios
- [ ] Performance & Load Testing
  - [ ] Test with multiple concurrent requests
  - [ ] Measure response times for new endpoints
  - [ ] Check memory usage (especially for large datasets)
  - [ ] Verify database queries don't N+1 under load
  - [ ] Benchmark before/after if modifying hot paths
- [ ] Test UI in browser for desktop and mobile
- [ ] Run test coverage: `npm test`
- [ ] Ensure coverage remains >= 80% (check [coverage/lcov-report/](../../coverage/lcov-report/))

### 6. Configuration & Secrets
- [ ] Add environment variables if needed (document in README)
- [ ] Update [providers.json](../../providers.json) if adding new provider integrations
- [ ] Add scripts in [scripts/](../../scripts/) for admin tasks (e.g., create_admin.js pattern)

### 7. Documentation
- [ ] Update [README.md](../../README.md) with feature description
- [ ] Add API endpoint documentation (parameters, response format)
- [ ] Document new configuration options or environment variables
- [ ] Update [todo.md](../../todo.md) if this closes any items
- [ ] Add inline code comments for complex logic in [lib/](../../lib/)

### 8. Code Quality
- [ ] Run linting if configured (check package.json scripts)
- [ ] Verify no console.log or debug code left in production paths
- [ ] Ensure consistent code style with existing codebase
- [ ] Review for security concerns (input validation, XSS prevention, auth checks)

### 9. Integration Testing
- [ ] Test feature end-to-end in development environment
- [ ] Test with different user roles (admin, regular user, guest)
- [ ] Test on different browsers/devices
- [ ] Verify database changes persist correctly

### 10. Final Review
- [ ] All tests passing
- [ ] No breaking changes to existing APIs
- [ ] Code reviewed for readability
- [ ] Feature documented and ready for merge

## Project Structure Quick Reference

```
lib/              → Business logic, authentication, providers
public/js/        → Client-side JavaScript
public/css/       → Styles (SCSS organized by concern)
public/pages/     → Additional HTML pages
public/json/langs/→ Localization strings
data/             → JSON data files (users, feedback)
scripts/          → One-off admin/setup scripts
```

## Common Patterns

### Adding an API Endpoint
1. Add route in server.js: `app.get('/api/feature', handler)`
2. Implement handler logic in lib/ file
3. Return JSON response with appropriate status codes
4. Add test cases in server.test.js

### Adding a UI Component
1. Create JavaScript file in public/js/
2. Create styles in public/css/components/
3. Add HTML structure (inline or in page)
4. Test interactivity in browser

### Updating Data Model
1. Modify JSON schema in data/
2. Create migration in scripts/ if needed
3. Update sample data
4. Update any code that reads/writes this data
5. Add tests to verify schema compatibility

## Performance & Best Practices
- Minimize HTTP requests; bundle related endpoints
- Use CSS classes for styling, avoid inline styles
- Cache frequently-accessed data when appropriate
- Validate all user inputs (frontend + backend)
- Use HTTPS for external API calls (provider integrations)
- Test with real data volumes to catch N+1 query problems
