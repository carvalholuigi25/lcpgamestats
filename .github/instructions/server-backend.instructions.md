---
name: server-backend-instructions
description: "Backend server code guidelines for lib/*.js and server.js. Use when writing Express routes, provider integrations, authentication logic, API endpoints, or middleware."
applyTo: "{server.js,lib/*.js}"
---

# Backend Development Instructions

## File Patterns

### server.js (Main Express App)
- **Routes**: Define all Express routes here; keep route handlers compact (<30 lines)
- **Middleware**: CORS, session, rate limiting
- **Error handlers**: Centralized error catching
- **Start sequence**: Dotenv → middleware → routes → listen

### lib/auth.js (Authentication)
- **JWT handling**: Issue, verify, refresh tokens
- **Passport strategies**: Local, Google, GOG, Epic OAuth2
- **Password management**: bcryptjs hashing with salt rounds
- **Session persistence**: Express-session config

### lib/*.js (Provider Modules: epic.js, gog.js, uplay.js)
- **OAuth flow**: Authorization → token exchange → API calls
- **Error handling**: Network failures, token expiry, rate limits
- **Data transformation**: Normalize game data to common structure
- **Caching**: Optional TTL-based caching to reduce API calls

## Conventions

### Function Naming
```javascript
// Provider OAuth: fetchTokenFromProvider()
// Library fetch: getGamesLibrary(userId)
// Validation: validateToken() or isValidToken()
// Handlers: handleGetGames() or routeGetGames()
```

### Error Structure
```javascript
throw new Error('PROVIDER_API_ERROR: Steam API returned 503');
try {
  // ...
} catch (err) {
  res.status(500).json({ success: false, error: err.message });
}
```

### Async/Await Pattern
```javascript
app.get('/api/games', async (req, res) => {
  try {
    const games = await getGamesLibrary(req.user.id);
    res.json({ success: true, data: games });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
```

### Rate Limiting Awareness
- Check remaining API calls before making requests
- Log rate limit headers from provider responses
- Implement exponential backoff for retries
- Cache results to minimize API calls

## API Response Format

All endpoints should return:
```javascript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "Human-readable error message" }
```

## Testing Expectations

- Every route handler should have a test case
- Mock provider API responses; don't make real API calls in tests
- Test auth flow (login, token refresh, logout)
- Test error scenarios (network failure, invalid token, rate limit)

## Common Tasks

### Adding a New API Route
1. Create handler in `server.js` with async/await
2. Add error handling for provider API failures
3. Return standard response format
4. Add test case to `server.test.js`
5. Document expected query params/body in comments

### Adding a New Provider
1. Create `lib/providerName.js` following existing pattern (gog.js, epic.js)
2. Implement OAuth flow (fetchToken, refreshToken, getGamesLibrary)
3. Add Passport strategy in `auth.js`
4. Create login script in `scripts/providerName-login.js`
5. Add route in `server.js` and corresponding tests

### Debugging Provider API Issues
```javascript
// Log raw responses to understand API structure
console.log('Provider response:', JSON.stringify(response.data, null, 2));

// Check rate limit headers
console.log('Remaining calls:', response.headers['x-ratelimit-remaining']);

// Validate token before use
if (!token || token.expiry < Date.now()) {
  // Token expired, refresh
}
```

## Security Checklist

- [ ] Sensitive data (API keys, tokens) in `.env` only
- [ ] Passwords hashed with bcryptjs (min 10 salt rounds)
- [ ] JWT tokens have expiration
- [ ] CORS configured appropriately
- [ ] Rate limiting enabled
- [ ] Input validation on all user-provided data
- [ ] SQL injection N/A (no SQL), but validate provider API parameters
