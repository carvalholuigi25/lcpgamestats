---
name: test-coverage-instructions
description: "Testing and coverage guidelines for server.test.js. Use when writing tests, debugging test failures, measuring coverage, or verifying code quality."
applyTo: "**/*.test.js"
---

# Testing & Coverage Instructions

## Test Framework: Node.js Built-in --test

This project uses Node.js's native test runner (`node --test`). No external test framework.

### Running Tests

```bash
npm test                    # Run all tests
npm run coverage            # Run tests with c8 coverage report
```

Coverage HTML report: `coverage/lcov-report/index.html`

## Test Structure

### Basic Test Template
```javascript
import test from 'node:test';
import assert from 'node:assert';
import { myFunction } from '../lib/module.js';

test('description of what is being tested', async (t) => {
  // Arrange
  const input = { /* test data */ };
  
  // Act
  const result = await myFunction(input);
  
  // Assert
  assert.strictEqual(result.success, true);
  assert.deepStrictEqual(result.data, expectedValue);
});
```

### Nested Tests (Suites)
```javascript
test('Module feature', async (t) => {
  await t.test('should do X when given valid input', async () => {
    // test code
  });
  
  await t.test('should handle error when given invalid input', async () => {
    // test code
  });
});
```

## Mocking Strategies

### Mock Provider API Responses
```javascript
// Import the module
import * as providerModule from '../lib/epic.js';

// Mock the function
const mockGetGamesLibrary = (userId) => {
  return Promise.resolve({
    success: true,
    data: [
      { name: 'Game 1', id: 'game-1' },
      { name: 'Game 2', id: 'game-2' }
    ]
  });
};

// Use mock in test
test('getGamesLibrary returns games', async () => {
  // Temporarily replace function
  const original = providerModule.getGamesLibrary;
  providerModule.getGamesLibrary = mockGetGamesLibrary;
  
  // Run test
  // ...
  
  // Restore
  providerModule.getGamesLibrary = original;
});
```

### Mock Express Request/Response
```javascript
const mockReq = {
  user: { id: 'test-user' },
  body: { /* test data */ },
  query: { /* test query */ }
};

const mockRes = {
  json: (data) => {
    mockRes.sentData = data;
  },
  status: (code) => {
    mockRes.statusCode = code;
    return mockRes;
  },
  statusCode: 200,
  sentData: null
};
```

## Coverage Targets

- **Target**: >80% coverage on critical paths
- **Focus areas**:
  - Authentication flow (auth.js)
  - Provider integrations (epic.js, gog.js, uplay.js)
  - Error handling (all modules)
  - API endpoints (server.js routes)

### Viewing Coverage Report
```bash
npm run coverage
open coverage/lcov-report/index.html
```

Look for:
- **Red lines**: Uncovered code
- **Yellow lines**: Partially covered (e.g., only one branch of if/else)
- **Green lines**: Fully covered

## Test Patterns

### Testing Async Functions
```javascript
test('async function resolves correctly', async () => {
  const result = await asyncFunction();
  assert.strictEqual(result.success, true);
});
```

### Testing Errors
```javascript
test('throws error on invalid input', async () => {
  await assert.rejects(
    async () => {
      await functionThatThrows();
    },
    (err) => {
      return err.message.includes('Invalid');
    }
  );
});
```

### Testing Promises
```javascript
test('returns promise that resolves', () => {
  return myFunction()
    .then(result => {
      assert.strictEqual(result, expected);
    });
});
```

## Common Test Cases

### Authentication Tests
- [ ] Valid login credentials accepted
- [ ] Invalid credentials rejected
- [ ] JWT token issued on successful login
- [ ] Expired token rejected
- [ ] Token refresh works
- [ ] Logout clears session

### Provider Integration Tests
- [ ] fetchToken() exchanges code for token
- [ ] getGamesLibrary() returns games array
- [ ] Error when API is unavailable
- [ ] Rate limit headers respected
- [ ] Token expiry triggers refresh

### API Endpoint Tests
- [ ] GET /api/games returns user's games
- [ ] POST /api/feedback saves feedback
- [ ] Unauthorized requests rejected (401)
- [ ] Missing required fields return 400
- [ ] Server errors return 500

## Debugging Failed Tests

### Print Debug Info
```javascript
console.log('Result:', JSON.stringify(result, null, 2));
```

### Run Single Test
```bash
node --test --grep "test description" server.test.js
```

### Check Assertion Helpers
```javascript
assert.strictEqual(actual, expected)      // ===
assert.deepStrictEqual(obj1, obj2)        // Deep comparison
assert.ok(value)                          // Truthy
assert.throws(fn, err)                    // Throws
assert.rejects(fn, err)                   // Promise rejects
```

## Before Committing

✅ All tests pass: `npm test`
✅ Coverage >80%: `npm run coverage`
✅ No debug console.log() statements
✅ Mocks are cleaned up (restored to original)
✅ No real API calls in tests (all mocked)
✅ Descriptive test names explaining what's being tested
