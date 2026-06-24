# LCPGameStats

Displays the current user's steam and other providers from games library using the web api, with a Bootstrap 5 + SCSS responsive UI.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Get a Steam Web API key**
   - Visit [https://steamcommunity.com/dev/apikey](steam web api)
   - Log in and register a domain (e.g. `localhost`)

3. **Find your SteamID64**
   - Use [https://steamid.io](steam id) to convert your profile URL/vanity name to a SteamID64

4. **Configure environment variables**

   ```bash
   cp .env.example .env

   ```text
   Edit `.env`:

   ```text
   STEAM_API_KEY=your_api_key_here
   STEAM_USER_ID=your_steamid64_here
   API_AUTH_TOKEN=your_secure_token_here
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX_REQUESTS=30
   PORT=3000
   ```

5. **Make sure your Steam profile/game details are public**
   - Steam Privacy Settings → "Game details" must be set to Public, or the API returns no games.

6. **Compile SCSS** (already compiled to `public/css/style.css`, re-run after edits)

   ```bash
   npm run build:css

   ```text
   For live rebuilding during development:

   ```bash
   npx sass --watch public/css/style.scss public/css/style.css
   ```

7. **Run the server**

   ```bash
   npm start
   ```

   ```text
   Open http://localhost:3000

## Features

- Player profile header (avatar, name, profile link)
- Stats bar: total games, total hours, recently played count, most played game
- Search by game name (debounced)
- Sort by playtime (asc/desc), name (A-Z/Z-A), or recently played
- Grid / List view toggle
- Click any game card for a detail modal with Steam Store link
- Fully responsive (mobile, tablet, desktop) with Steam-themed dark UI

## API Endpoints

| Endpoint | Description |
| -------- | ----------- |
| `GET /api/player` | Returns player summary (name, avatar, etc.) |
| `GET /api/games` | Returns owned games sorted by playtime |
| `GET /api/games?format=xml` | Returns the same game library response in XML format |
| `GET /api/achievements` | Returns achievement status for a given game (`appid` required) |

> Note: API routes support bearer token authentication when `API_AUTH_TOKEN` is configured. If the token is blank or left as the default placeholder, auth is skipped. A basic rate limiter is also available for API requests.
>
> To enable RetroAchievements integration, configure `RETROACHIEVEMENTS_USER` and `RETROACHIEVEMENTS_API_KEY` in your `.env` file. When these are not set, the app falls back to sample RetroAchievements game data for preview.

## Project Structure

```text
lcpgamestats/
├── server.js              # Express server + Steam API integration
├── package.json
├── .env.example
└── public/
    ├── index.html
    ├── css/
    │   ├── style.scss     # Source SCSS
    │   └── style.css      # Compiled CSS
    └── js/
        └── app.js          # Frontend logic
```

## Running tests & coverage

Run the unit tests with Node's built-in test runner:

```bash
npm test
```

To generate a coverage report, first install dev dependencies (this adds `c8`):

```bash
npm install --save-dev
```

Then run:

```bash
npm run coverage
```

This uses `c8` to produce an `lcov` report in the `coverage/` directory (file: `coverage/lcov.info`).
