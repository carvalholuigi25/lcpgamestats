---
name: lcpgamestats-project
description: "LCPGameStats Node.js/Express project guidelines. Use when working on this game stats application for setup, testing, API development, authentication, provider integrations (Steam, GOG, Epic, Uplay), frontend components, SCSS styling, or project structure."
applyTo: "**"
---

# LCPGameStats Project Instructions

## Project Overview

**LCPGameStats** is a Node.js/Express web application that displays user game libraries from multiple gaming platforms (Steam, GOG, Epic Games, Uplay) with a responsive Bootstrap 5 + SCSS UI.

## Technology Stack

- **Backend**: Node.js, Express.js, Passport.js (authentication)
- **Frontend**: Vanilla JavaScript, Bootstrap 5, SCSS
- **Data**: JSON (file-based), User authentication with JWT & bcryptjs
- **Testing**: Node.js built-in test runner, c8 coverage
- **Build**: npm scripts, sass/nodemon watchers, concurrently for parallel tasks

## Project Structure

```
lib/              # Core business logic
  auth.js         # Authentication & JWT handling
  epic.js         # Epic Games provider integration
  gog.js          # GOG provider integration
  uplay.js        # Uplay provider integration
  feedback.js     # Feedback system
  utils.js        # Shared utilities
  
public/           # Frontend assets
  js/             # Vanilla JavaScript
  css/            # SCSS stylesheets
  images/         # Static images
  json/           # Client-side data (translations, etc.)
  
scripts/          # Utility scripts
  gog-login.js    # GOG OAuth flow
  epic-login.js   # Epic OAuth flow
  uplay-login.js  # Uplay OAuth flow
  create_admin.js # Admin user creation
  
data/             # Persistent data (JSON files)
  users.json      # User records
  feedback.json   # User feedback

server.js         # Main Express app & routes
server.test.js    # Test suite
```

## Setup & Environment

### Initial Setup
1. `npm install` — Install dependencies
2. `cp .env.example .env` — Create environment config
3. Get Steam API key from [https://steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
4. Find your SteamID64 using [https://steamid.io](https://steamid.io)
5. Ensure Steam profile visibility: Settings → Game details = Public

### Environment Variables
```env
STEAM_API_KEY=your_steam_web_api_key
STEAM_USER_ID=your_steamid64
API_AUTH_TOKEN=your_jwt_secret
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=30
PORT=3000
```

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Start Express server with nodemon auto-reload |
| `npm run startall` | Run server + SCSS watcher in parallel |
| `npm run build:css` | Compile SCSS to CSS once |
| `npm run watchscss` | Watch SCSS files and rebuild on change |
| `npm test` | Run test suite (Node.js built-in) |
| `npm run coverage` | Generate test coverage report (lcov) |
| `npm run login:steam` | Authenticate with Steam |
| `npm run login:gog` | Authenticate with GOG |
| `npm run login:epic` | Authenticate with Epic Games |
| `npm run login:uplay` | Authenticate with Uplay |

## Key Guidelines

### Backend (server.js, lib/*.js)
- **Express routes**: Handle authentication, API endpoints for providers
- **Provider modules**: Each (`epic.js`, `gog.js`, etc.) implements OAuth flow and library fetching
- **Authentication**: JWT-based with Passport strategies; tokens stored in `auth.js`
- **Error handling**: Use consistent error responses; catch provider API failures gracefully
- **Rate limiting**: Respect provider API rate limits; see `utils.js` for rate limit helpers
- **Testing**: All new endpoints must have corresponding tests in `server.test.js`

### Frontend (public/js/, public/css/)
- **Vanilla JavaScript**: No framework dependencies; keep it simple
- **Bootstrap 5 integration**: Use Bootstrap utilities; extend with SCSS variables
- **Responsive design**: Mobile-first approach; test on mobile breakpoints
- **SCSS organization**: 
  - `base/` — Reset, typography, theme variables
  - `components/` — Reusable UI blocks (buttons, cards, modals)
  - `layout/` — Page structure, grid, responsive breakpoints
  - `themes/` — Visual themes (dark, light, cyberpunk, etc.)
- **Translations**: JSON files in `public/json/langs/` (de, en, es, fr, pt)

### Authentication
- Uses **Passport.js** with local strategy and OAuth2 (Google, GOG, Epic)
- JWTs stored in `lib/auth.js`; passwords hashed with bcryptjs
- Session tokens in Express sessions
- Admin creation: `node scripts/create_admin.js`

### Testing & Coverage
- **Test framework**: Node.js built-in `--test` runner
- **Coverage tool**: c8 (NYC alternative)
- **Target**: Aim for >80% coverage on critical paths
- **Run**: `npm test` (quick) or `npm run coverage` (with report)
- **Report**: Coverage HTML in `coverage/lcov-report/`

### Common Patterns

**API Response Structure**:
```javascript
{ success: true, data: {...}, error: null }
{ success: false, data: null, error: "message" }
```

**Rate Limiting** (in utils.js):
```javascript
// Check provider API limits before calling
// Respect X-RateLimit-* headers in responses
```

**Provider Integration Pattern**:
1. User logs in via OAuth
2. Exchange code for token
3. Store token securely
4. Fetch game library using token
5. Cache results with TTL
6. Handle token refresh on expiry

## Code Quality

- **Linting**: Follow Node.js conventions; keep functions <50 lines
- **Async/Await**: Use async/await; avoid callback hell
- **Error handling**: Try/catch blocks with specific error types
- **Comments**: Document OAuth flows and rate limit logic; skip obvious code
- **Git workflow**: Feature branches, descriptive commit messages, keep histories clean

## When Adding Features

✅ **DO**:
- Add tests in `server.test.js` first (TDD approach)
- Update README.md if adding new setup steps
- Follow existing code style (indentation, naming)
- Handle errors from provider APIs
- Add feature to appropriate module (lib/, public/js/)

❌ **DON'T**:
- Skip tests; use `npm run coverage` to verify coverage
- Add sensitive data to source control (use `.env`)
- Break existing provider integrations
- Modify SCSS without testing responsive design
- Leave debug console logs in production code

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "API rate limited" | Check RATE_LIMIT_MAX_REQUESTS; wait or increase window |
| "No games returned" | Verify Steam profile/game details are Public |
| SCSS not compiling | Run `npm run build:css` or use watch mode |
| Tests fail | Check `.env` has STEAM_API_KEY and valid STEAM_USER_ID |
| Port 3000 in use | Change PORT in `.env` or kill process on that port |

## Resources

- **Steam API**: [https://steamcommunity.com/dev](https://steamcommunity.com/dev)
- **Express.js**: [https://expressjs.com](https://expressjs.com)
- **Passport.js**: [https://www.passportjs.org](https://www.passportjs.org)
- **Bootstrap 5**: [https://getbootstrap.com](https://getbootstrap.com)
- **SCSS Guide**: [https://sass-lang.com](https://sass-lang.com)
