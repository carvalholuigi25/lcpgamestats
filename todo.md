# LCPGameStats - Todo List

## Current focus

### General

- [ ] Add integration of retroachievements.org into backend and expose achievements in frontend
- [ ] Refactor server and frontend logic into separate modules for maintainability
- [ ] Add JSON/XML export support for test coverage data and improve coverage report layout
- [ ] Add review score ratings and metadata enrichment in game details
- [ ] Build administration dashboard with user roles and subpages

### Maintenence

- [ ] Check & fix all issues of whole project

## Completed

### Core features

- [x] Pagination for frontend and backend game listing
- [x] Search/filter support in backend and frontend
- [x] Game detail modal with achievements section
- [x] API rate limits (stubbed)
- [x] API authentication support (stubbed)
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

### UX and polish

- [x] Responsive grid/list UI
- [x] Player profile header and stats bar
- [x] Loading, error, and empty states
- [x] Frontend export buttons for JSON and XML
- [x] Top 5 playtime chart for current library data

## Future roadmap

- [ ] Add SQLite database and real-time CRUD persistence
- [ ] Add user accounts and role-based access control
- [ ] Add editing of user profile information
- [ ] Add review score aggregation and rating breakdowns
- [ ] Add coverage report export automation and visual reports
- [ ] Add admin panel with subpages for governance and reporting
- [ ] Add analytics charts for playtime trends and provider breakdowns
- [ ] Add support for more game providers / import sources

## Notes

- Non-Steam providers currently use sample data and a `guest` fallback profile.
- `/api/games?format=xml` returns the current library page as XML.
- Export buttons use the currently selected provider/filter/page state.

## Credits

Created by [Luis Carvalho](mailto:luiscarvalho239@gmail.com) - All rights are reserved to LCP - ©2026
>