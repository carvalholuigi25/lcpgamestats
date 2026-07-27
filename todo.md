# LCPGameStats - Todo List

## Future roadmap

### Accounts & admin

- [ ] Add frontend UI for editing user profile information (backend `PUT /api/auth/me` already supports it, no form exists yet)
- [ ] Add a way to grant/manage the admin role from within the app (currently only possible via the `scripts/create_admin.js` CLI script)
- [ ] Build administration dashboard with user roles and subpages (today there's only a backend `GET /api/admin/users` endpoint, no UI)
- [ ] Add admin panel with subpages for governance and reporting
- [ ] Add SQLite database and real-time CRUD persistence (user data is still a `data/users.json` file store; `lib/auth.js` tries `better-sqlite3` but falls back since it isn't installed; game/library data has no persistence layer at all)

### Game details & engagement

- [ ] Add review score ratings and metadata enrichment in game details
- [ ] Add review score aggregation and rating breakdowns
- [ ] Add a group by for achievement status and date unlocked in modal of game details
- [ ] Add a counter of views and reactions (like, dislike) for game details
- [ ] Add analytics charts for playtime trends and provider breakdowns

### Engineering

- [ ] Finish splitting `server.js` (still ~1125 lines) into focused modules, continuing from the already-extracted `lib/auth.js` / `lib/utils.js`
- [ ] Add JSON/XML export support for test coverage data and improve coverage report layout
- [ ] Extend accessibility to dynamically-rendered content (achievement list, game cards currently have almost no aria attributes, unlike the static markup)
- [ ] Check and fix if there's any unresponsive elements in frontend
- [ ] Improve & fix the readme — it's stale (missing auth, Epic/GOG/Uplay providers, video/HLS, themes, localization, background images, the now-real rate limiting/API auth, and the `lib/` module split) and has malformed markdown fences around lines 24-58

### Maintenance

- [ ] Check & fix all issues of whole project

## Completed

### Core features

- [x] Implement user authentication: login, registration, session management, Google OAuth (backend routes + frontend modals)
- [x] Add integration of retroachievements.org into backend and expose achievements in frontend
- [x] Pagination for frontend and backend game listing
- [x] Search/filter support in backend and frontend
- [x] Game detail modal with achievements section
- [x] Real API authentication (bearer token / session, previously stubbed)
- [x] Real API rate limiting (sliding window, previously stubbed)
- [x] Multi-provider support: Steam, Epic Games, GOG, Uplay
- [x] Provider switcher in frontend
- [x] Language switcher
- [x] Theme switcher
- [x] Broken image handling
- [x] Fixed theme, language, and provider selection logic
- [x] Corrected most-played game calculation
- [x] Corrected sample provider username display
- [x] Export game data to JSON and XML
- [x] Added charts for game stats
- [x] Add embedded video player to the game modal with HLS support and trailer data integration
- [x] Add function and button to toggle to show / hide video in game details
- [x] Fixed game headers & achievements icons

### UX and polish

- [x] Responsive grid/list UI
- [x] Player profile header and stats bar
- [x] Loading, error, and empty states
- [x] Frontend export buttons for JSON and XML
- [x] Top 5 playtime chart for current library data
- [x] LocalStorage persistence for user settings (theme, language, provider, sort, search, page size, pagination)
- [x] Add a couple of cool themes (like liquid glass, glassmorphism) to frontend
- [x] Add a Neomorphism (soft UI) theme, and refactor glassmorphism/liquid to share a common SCSS mixin
- [x] Add custom background image support
- [x] Enhance localization and background settings
- [x] Complete translation coverage across all 5 languages for the remaining hardcoded UI strings
- [x] Add a toggle to hide/show the language name next to the flag in the language switcher
- [x] Add a responsive digital clock to the header
- [x] Add feedback page (with backend `/api/feedback` endpoint, stored to `data/feedback.json`)
- [x] Add about page

### Engineering (done so far)

- [x] Extract auth and video/URL helpers into `lib/` modules on the backend
- [x] Split frontend logic into `app.js` / `functions.js` / `utils.js`
- [x] Add more unit tests (auth, video handling)

## Notes

- Non-Steam providers currently use sample data and a `guest` fallback profile.
- `/api/games?format=xml` returns the current library page as XML.
- Export buttons use the currently selected provider/filter/page state.
- Admin user creation is CLI-only today: `node scripts/create_admin.js` (env vars `ADMIN_USER`/`ADMIN_PASS`/`ADMIN_DISPLAY`).
- User accounts are stored in `data/users.json`, not a real database yet.

## Credits

Created by [Luis Carvalho](mailto:luiscarvalho239@gmail.com) - All rights are reserved to LCP - ©2026
