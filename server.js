import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';
dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROVIDERS = JSON.parse(fs.readFileSync(path.join(__dirname, 'providers.json'), 'utf8'));
const SAMPLE_GAME_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'sample_game_data.json'), 'utf8'));

const PORT = process.env.PORT || 3000;
const STEAM_API_BASE = 'https://api.steampowered.com';
const STEAM_API_KEY = process.env.STEAM_API_KEY;
const STEAM_USER_ID = process.env.STEAM_USER_ID;
const RETROACHIEVEMENTS_API_BASE = process.env.RETROACHIEVEMENTS_API_BASE || 'https://retroachievements.org/API';
const RETROACHIEVEMENTS_USER = process.env.RETROACHIEVEMENTS_USER || '';
const RETROACHIEVEMENTS_API_KEY = process.env.RETROACHIEVEMENTS_API_KEY || '';
const EPIC_API_BASE = process.env.EPIC_API_BASE || '';
const EPIC_API_KEY = process.env.EPIC_API_KEY || '';
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || 'changeme';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 30);
const requestCounts = new Map();

function apiRateLimiter(req, res, next) {
  const key = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const record = requestCounts.get(key) || { count: 0, firstRequestAt: now };

  if (now - record.firstRequestAt > RATE_LIMIT_WINDOW_MS) {
    record.count = 0;
    record.firstRequestAt = now;
  }

  record.count += 1;
  requestCounts.set(key, record);

  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  next();
}

function requireApiAuth(req, res, next) {
  if (!API_AUTH_TOKEN || API_AUTH_TOKEN === 'changeme') {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token || token !== API_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized. Missing or invalid API token.' });
  }

  next();
}

function getProvider(providerId) {
  return PROVIDERS[providerId] || PROVIDERS.steam;
}

function getHeaderImage(provider, game) {
  return provider.id == "steam" ? (game.header_image || `${provider.sampleImageBase2}/${game.appid}/${game.img_logo_url || "header"}.jpg`) : (game.header_image || `${provider.sampleImageBase}/${game.ImageIcon}`);
}

function getStoreGameLink(provider, game) {
  return game.store_link || `${provider.storeBase}${game.store_path || game.appid || game.id || game.GameId || game.gameId}`;
}

function normalizeProviderGame(provider, game) {
  const normalized = provider.id === 'retroachievements' ? {
    gameId: game.gameId || game.GameId || game.ID || game.id,
    appid: game.gameId || game.GameId || game.ID || game.id,
    title: game.title || game.Title,
    name: game.title || game.Title,
    img_icon_url: game.imageIcon || game.ImageIcon,
    img_logo_url: game.imageIcon || game.ImageIcon,
    header_image: getHeaderImage(provider, game),
    consoleID: game.consoleId || game.ConsoleID,
    consoleName: game.consoleName || game.ConsoleName,
    maxPossible: game.maxPossible || game.MaxPossible,
    numAwarded: game.numAwarded || game.NumAwarded,
    pctWon: game.pctWon || game.PctWon,
    hardcoreMode: game.hardcoreMode || game.HardcoreMode,
    playtime_forever: Number(game.playtime_forever || 0),
    playtime_2weeks: Number(game.playtime_2weeks || 0),
    provider: provider.id
  } : {
    appid: game.appid || game.gameId || game.GameId,
    name: game.name,
    playtime_forever: Number(game.playtime_forever || 0),
    playtime_2weeks: Number(game.playtime_2weeks || 0),
    rtime_last_played: Number(game.rtime_last_played || 0),
    header_image: getHeaderImage(provider, game),
    store_link: getStoreGameLink(provider, game),
    provider: provider.id
  };

  if (Array.isArray(game.achievements)) {
    normalized.achievements = game.achievements.map((achievement) => ({
      apiname: achievement.apiname || achievement.name || '',
      name: achievement.name || achievement.apiname || '',
      description: achievement.description || achievement.descriptionText || '',
      achieved: Boolean(achievement.achieved)
    }));
  }

  return normalized;
}

function getQueryParamValue(req, key, fallback) {
  const value = req.query[key];
  return value !== undefined ? String(value).trim() : fallback;
}

function normalizePageValue(value) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizePageSizeValue(value) {
  const pageSize = Number(value);
  if (!Number.isInteger(pageSize) || pageSize < 1) return 24;
  return Math.min(Math.max(pageSize, 1), 100);
}

function sortGames(games, sortBy) {
  switch (sortBy) {
    case 'playtime-asc':
      return games.sort((a, b) => a.playtime_forever - b.playtime_forever);
    case 'name-asc':
      return games.sort((a, b) => a.name.localeCompare(b.name));
    case 'name-desc':
      return games.sort((a, b) => b.name.localeCompare(a.name));
    case 'recent':
      return games.sort((a, b) => b.rtime_last_played - a.rtime_last_played);
    case 'playtime-desc':
    default:
      return games.sort((a, b) => b.playtime_forever - a.playtime_forever);
  }
}

function filterGames(games, search) {
  if (!search) return games;
  const normalizedSearch = search.toLowerCase();
  return games.filter((game) => game.name.toLowerCase().includes(normalizedSearch));
}

function createGamesResponse(games, page, pageSize, provider) {
  const totalGames = games.length;
  const totalPages = Math.max(1, Math.ceil(totalGames / pageSize));
  const pageIndex = Math.min(page, totalPages) - 1;
  const pagedGames = games.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  const totalMinutes = games.reduce((sum, game) => sum + game.playtime_forever, 0);
  const recentlyPlayed = games.filter((game) => game.playtime_2weeks > 0).length;
  const topGames = [...games]
    .sort((a, b) => b.playtime_forever - a.playtime_forever)
    .slice(0, 5);
  const topGame = topGames[0] || null;

  return {
    provider: provider.id,
    page,
    pageSize,
    totalPages,
    totalGames,
    game_count: totalGames,
    totalMinutes,
    recentlyPlayed,
    topGame,
    topGames,
    games: pagedGames
  };
}

function escapeXml(value) {
  return String(value).replace(/[<>&'\"]/g, (char) => {
    return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char];
  });
}

function convertGamesResponseToXml(response) {
  const {
    provider,
    page,
    pageSize,
    totalPages,
    totalGames,
    totalMinutes,
    recentlyPlayed,
    topGame,
    games
  } = response;

  const topGameXml = topGame
    ? `<topGame>
        <appid>${escapeXml(topGame.appid)}</appid>
        <name>${escapeXml(topGame.name)}</name>
        <playtime_forever>${escapeXml(topGame.playtime_forever)}</playtime_forever>
        <playtime_2weeks>${escapeXml(topGame.playtime_2weeks)}</playtime_2weeks>
        <provider>${escapeXml(topGame.provider)}</provider>
      </topGame>`
    : '';

  const gamesXml = games.map((game) => `
      <game>
        <appid>${escapeXml(game.appid)}</appid>
        <name>${escapeXml(game.name)}</name>
        <playtime_forever>${escapeXml(game.playtime_forever)}</playtime_forever>
        <playtime_2weeks>${escapeXml(game.playtime_2weeks)}</playtime_2weeks>
        <header_image>${escapeXml(game.header_image)}</header_image>
        <store_link>${escapeXml(game.store_link)}</store_link>
        <provider>${escapeXml(game.provider)}</provider>
      </game>`).join('');

  return `<gamesResponse>
    <provider>${escapeXml(provider)}</provider>
    <page>${escapeXml(page)}</page>
    <pageSize>${escapeXml(pageSize)}</pageSize>
    <totalPages>${escapeXml(totalPages)}</totalPages>
    <totalGames>${escapeXml(totalGames)}</totalGames>
    <totalMinutes>${escapeXml(totalMinutes)}</totalMinutes>
    <recentlyPlayed>${escapeXml(recentlyPlayed)}</recentlyPlayed>
    ${topGameXml}
    <games>${gamesXml}
    </games>
  </gamesResponse>`;
}

function normalizeEpicAchievement(achievement) {
  return {
    apiname: achievement?.apiname || achievement?.id || achievement?.name || '',
    name: achievement?.name || achievement?.title || achievement?.apiname || '',
    description: achievement?.description || achievement?.desc || achievement?.descriptionText || '',
    achieved: Boolean(achievement?.achieved || achievement?.unlocked),
    unlocktime: achievement?.unlocktime || achievement?.dateUnlocked || 0,
    badgeimage: achievement?.badgeimage || achievement?.image || ''
  };
}

async function getActualHeaderFromSteamAPI(req, res) {
  try {
    const appid = req.query.appid;
    
    if(!appid) {
      return res.status(400).json({ error: 'Please provide the app id from steam' });
    }

    const endpoint = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
    const resp = await axios.get(endpoint, {
      headers: {
        Accept: 'application/json'
      }
    });

    const rawData = resp.data[appid].data.header_image;
    return res.json({
      data_images: {
        header_image: rawData,
        header_hash_image: rawData.replace("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/"+appid+"/", "").split("/")[0],
        timestamp: rawData.split("?t=")[1]
      }
    });
  } catch (err) {
    console.error('Error fetching Steam games:', err.message);
    return res.status(500).json({ error: 'Failed to fetch Steam game library' });
  }
}


async function fetchEpicAchievements(appid) {
  const sampleGames = SAMPLE_GAME_DATA.epic || [];
  const sampleGame = sampleGames.find((item) => [item.id, item.appid].some((field) => field !== undefined && String(field) === String(appid)));

  if (EPIC_API_BASE && EPIC_API_KEY) {
    try {
      const endpoint = `${EPIC_API_BASE.replace(/\/+$/, '')}/games/${encodeURIComponent(appid)}/achievements`;
      const { data } = await axios.get(endpoint, {
        headers: {
          Authorization: `Bearer ${EPIC_API_KEY}`,
          Accept: 'application/json'
        }
      });

      const rawAchievements = Array.isArray(data)
        ? data
        : data?.achievements || data;

      if (Array.isArray(rawAchievements) && rawAchievements.length > 0) {
        return rawAchievements.map(normalizeEpicAchievement);
      }
    } catch (err) {
      console.error('Error fetching Epic Games achievements from configured API:', err.message);
    }
  }

  const fallbackAchievements = sampleGame?.achievements || [
    { apiname: 'first_play', name: 'First Play', description: 'Start the game on Epic Games', achieved: false },
    { apiname: 'collector', name: 'Collector', description: 'Collect a few items', achieved: false },
    { apiname: 'completionist', name: 'Completionist', description: 'Complete all available objectives', achieved: false }
  ];

  return fallbackAchievements.map(normalizeEpicAchievement);
}

async function getApiPlayer(req, res) {
  const providerId = (req.query.provider || 'steam').toLowerCase();
  const provider = getProvider(providerId);

  if (provider.id !== 'steam') {
    return res.json({
      personaname: provider.id === 'retroachievements' ? RETROACHIEVEMENTS_USER : 'guest',
      avatarfull: `https://via.placeholder.com/128?text=${encodeURIComponent(provider.label)}`,
      profileurl: '#',
      provider: provider.id,
      providerLabel: provider.label
    });
  }

  if (!STEAM_API_KEY || !STEAM_USER_ID) {
    return res.status(400).json({ error: 'Steam API credentials are missing' });
  }

  try {
    const { data } = await axios.get(`${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/`, {
      params: {
        key: STEAM_API_KEY,
        steamids: STEAM_USER_ID
      }
    });

    const player = data?.response?.players?.[0];
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json({ ...player, provider: provider.id, providerLabel: provider.label });
  } catch (err) {
    console.error('Error fetching player summary:', err.message);
    res.status(500).json({ error: 'Failed to fetch player profile' });
  }
}

async function getApiGames(req, res) {
  const providerId = (req.query.provider || 'steam').toLowerCase();
  const provider = getProvider(providerId);

  const search = getQueryParamValue(req, 'search', '');
  const sortBy = getQueryParamValue(req, 'sortBy', 'playtime-desc');
  const page = normalizePageValue(getQueryParamValue(req, 'page', '1'));
  const pageSize = normalizePageSizeValue(getQueryParamValue(req, 'pageSize', '24'));

  if (provider.id === 'retroachievements') {
    if (!RETROACHIEVEMENTS_USER || !RETROACHIEVEMENTS_API_KEY) {
      return res.status(400).json({ error: 'RetroAchievements credentials are missing' });
    }

    // Previously this route returned sample RetroAchievements game data.
    // Now it fetches the user's recent games directly from the RetroAchievements API.
    try {
      const endpoint = `${RETROACHIEVEMENTS_API_BASE}/API_GetUserCompletedGames.php`;
      const response = await axios.get(endpoint, {
        params: {
          y: RETROACHIEVEMENTS_API_KEY,
          u: RETROACHIEVEMENTS_USER
        },
        headers: {
          Accept: 'application/json'
        }
      });

      let data = response.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(JSON.stringify(data));
        } catch (parseErr) {
          console.warn('RetroAchievements games JSON parse failed:', parseErr.message);
        }
      }

      let rawGames = data || [];

      let games = rawGames.map((game) => normalizeProviderGame(provider, {
        gameId: game.GameID || game.GameId || game.gameId || game.id || 3971,
        appid: game.GameID,
        title: game.title || game.Title,
        name: game.title || game.Title,
        img_icon_url: game.imageIcon || game.ImageIcon,
        img_logo_url: game.imageIcon || game.ImageIcon,
        header_image: getHeaderImage(provider, game),
        consoleID: game.consoleId || game.ConsoleID,
        consoleName: game.consoleName || game.ConsoleName,
        maxPossible: game.maxPossible || game.MaxPossible,
        numAwarded: game.numAwarded || game.NumAwarded,
        pctWon: game.pctWon || game.PctWon,
        hardcoreMode: game.hardcoreMode || game.HardcoreMode,
        provider: provider.id
      }));

      games = filterGames(games, search);
      games = sortGames(games, sortBy);

      const responseData = createGamesResponse(games, page, pageSize, provider);
      const format = getQueryParamValue(req, 'format', 'json').toLowerCase();
      if (format === 'xml') {
        return res.type('application/xml').send(convertGamesResponseToXml(responseData));
      }

      return res.json(responseData);
    } catch (err) {
      console.error('Error fetching RetroAchievements games:', err.message);
      return res.status(500).json({ error: 'Failed to fetch RetroAchievements game library' });
    }
  }

  if (provider.id === 'steam') {
    if (!STEAM_API_KEY || !STEAM_USER_ID) {
      return res.status(400).json({ error: 'Steam API credentials are missing' });
    }

    try {
      const { data } = await axios.get(`${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`, {
        params: {
          key: STEAM_API_KEY,
          steamid: STEAM_USER_ID,
          include_appinfo: true,
          include_played_free_games: true,
          format: 'json'
        }
      });

      const response = data?.response;

      if (!response || !response.games) {
        return res.status(404).json({ error: 'No games found. The profile may be private.' });
      }

      let games = response.games.map((game) => normalizeProviderGame(provider, {
        appid: game.appid,
        name: game.name,
        img_icon_url: game.img_icon_url,
        img_logo_url: game.img_logo_url,
        header_image: getHeaderImage(provider, game),
        playtime_forever: Number(game.playtime_forever || 0),
        playtime_2weeks: Number(game.playtime_2weeks || 0),
        rtime_last_played: Number(game.rtime_last_played || 0),
        store_path: String(game.appid)
      }));

      games = filterGames(games, search);
      games = sortGames(games, sortBy);

      const responseData = createGamesResponse(games, page, pageSize, provider);
      const format = getQueryParamValue(req, 'format', 'json').toLowerCase();
      if (format === 'xml') {
        return res.type('application/xml').send(convertGamesResponseToXml(responseData));
      }

      return res.json(responseData);
    } catch (err) {
      console.error('Error fetching owned games:', err.message);
      return res.status(500).json({ error: 'Failed to fetch games library' });
    }
  }

  const sampleGames = SAMPLE_GAME_DATA[provider.id] || [];
  let games = sampleGames.map((game) => normalizeProviderGame(provider, game));

  games = filterGames(games, search);
  games = sortGames(games, sortBy);

  const responseData = createGamesResponse(games, page, pageSize, provider);
  const format = getQueryParamValue(req, 'format', 'json').toLowerCase();
  if (format === 'xml') {
    return res.type('application/xml').send(convertGamesResponseToXml(responseData));
  }

  res.json(responseData);
}

async function getApiAchievements(req, res) {
  const providerId = (req.query.provider || 'steam').toLowerCase();
  const provider = getProvider(providerId);
  const appid = getQueryParamValue(req, 'appid', '');

  if (!appid) {
    return res.status(400).json({ error: 'Missing required appid parameter' });
  }

  if (provider.id === 'retroachievements') {
    const sample = SAMPLE_GAME_DATA[provider.id] || [];
    const game = sample.find((item) => {
      return [item.id, item.appid, item.gameId, item.GameId].some(
        (field) => field !== undefined && String(field) === String(appid)
      );
    });

    if (!RETROACHIEVEMENTS_USER || !RETROACHIEVEMENTS_API_KEY) {
      const achievements = (game?.achievements || [
        { apiname: 'first_play', name: 'First Play', description: 'Start your first game', achieved: true },
        { apiname: 'collector', name: 'Collector', description: 'Own 3 games in your library', achieved: false },
        { apiname: 'completionist', name: 'Completionist', description: 'Complete all available achievements', achieved: false }
      ]).map((achievement) => ({
        apiname: achievement.apiname,
        name: achievement.name,
        description: achievement.description,
        achieved: Boolean(achievement.achieved)
      }));

      const unlocked = achievements.filter((a) => a.achieved).length;
      return res.json({ provider: provider.id, appid, total: achievements.length, unlocked, achievements });
    }

    try {
      const endpoint = `${RETROACHIEVEMENTS_API_BASE}/API_GetGameInfoAndUserProgress.php`;
      const response = await axios.get(endpoint, {
        params: {
          y: RETROACHIEVEMENTS_API_KEY,
          u: RETROACHIEVEMENTS_USER,
          g: appid,
          a: "0"
        },
        headers: {
          Accept: 'application/json'
        }
      });

      let data = response.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(JSON.stringify(data));
        } catch (parseErr) {
          console.warn('RetroAchievements JSON parse failed:', parseErr.message);
        }
      }

      const rawAchievements = data?.Achievements;
      let achievementsList = [];

      if (!rawAchievements) {
        achievementsList = [];
      } else if (Array.isArray(rawAchievements)) {
        if (rawAchievements.length === 1 && rawAchievements[0] && typeof rawAchievements[0] === 'object' && !Array.isArray(rawAchievements[0])) {
          achievementsList = Object.values(rawAchievements[0]);
        } else {
          achievementsList = rawAchievements;
        }
      } else if (typeof rawAchievements === 'object') {
        achievementsList = Object.values(rawAchievements);
      }

      // Normalize RetroAchievements achievement objects to match frontend expectations
      // Provide: `apiname`, `name`, `description`, `achieved`, and optional `unlocktime`
      const achievements = achievementsList.map((achievement) => {
        const dateEarned = achievement?.DateEarned || achievement?.dateEarned || '';
        const earned = Boolean(dateEarned && dateEarned !== '0000-00-00 00:00:00');
        let unlocktime = 0;
        if (earned) {
          const d = new Date(dateEarned);
          if (!Number.isNaN(d.getTime())) unlocktime = Math.floor(d.getTime() / 1000);
        }

        const badgeimg = `https://media.retroachievements.org/Badge/${achievement?.BadgeName || '345631'}.png`;

        return {
          apiname: achievement?.BadgeName || achievement?.Badge || achievement?.APIName || (`ra_${achievement?.ID || achievement?.id || ''}`),
          name: achievement?.Title || achievement?.title || achievement?.Name || '' ,
          description: achievement?.Description || achievement?.description || '',
          badgeimage: badgeimg,
          achieved: earned,
          unlocktime,
          // keep some raw fields for debugging if needed
          _raw: {
            id: achievement?.ID || achievement?.id,
            points: achievement?.Points || achievement?.points,
            type: achievement?.Type || achievement?.type
          }
        };
      });

      const unlocked = achievements.filter((a) => a.achieved).length;
      return res.json({ provider: provider.id, appid, total: achievements.length, unlocked, achievements });
    } catch (err) {
      console.error('Error fetching RetroAchievements stats:', err.message);
      return res.status(500).json({ error: 'Failed to fetch RetroAchievements achievements' });
    }
  }

  if (provider.id === 'epic') {
    try {
      const achievements = await fetchEpicAchievements(appid);
      const unlocked = achievements.filter((a) => a.achieved).length;
      return res.json({ provider: provider.id, appid, total: achievements.length, unlocked, achievements });
    } catch (err) {
      console.error('Error fetching Epic Games achievements:', err.message);
      return res.status(500).json({ error: 'Failed to fetch Epic Games achievements' });
    }
  }

  if (provider.id !== 'steam') {
    const sample = SAMPLE_GAME_DATA[provider.id] || [];
    const game = sample.find((item) => String(item.id) === String(appid) || String(item.appid) === String(appid));
    const achievements = (game?.achievements || [
      { apiname: 'first_play', name: 'First Play', description: 'Start your first game', achieved: true },
      { apiname: 'collector', name: 'Collector', description: 'Own 3 games in your library', achieved: false },
      { apiname: 'completionist', name: 'Completionist', description: 'Complete all available achievements', achieved: false }
    ]).map((achievement) => ({
      apiname: achievement.apiname,
      name: achievement.name,
      description: achievement.description,
      achieved: Boolean(achievement.achieved)
    }));

    const unlocked = achievements.filter((a) => a.achieved).length;
    return res.json({ provider: provider.id, appid, total: achievements.length, unlocked, achievements });
  }

  if (!STEAM_API_KEY || !STEAM_USER_ID) {
    return res.status(400).json({ error: 'Steam API credentials are missing' });
  }

  try {
    const { data } = await axios.get(`${STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/`, {
      params: {
        key: STEAM_API_KEY,
        steamid: STEAM_USER_ID,
        appid,
        l: 'en'
      }
    });

    const stats = data?.playerstats;
    if (!stats || !stats.achievements) {
      return res.status(404).json({ error: 'No achievement data available for this game' });
    }

    const achievements = stats.achievements.map((achievement) => ({
      apiname: achievement.apiname,
      name: achievement.name || achievement.apiname,
      description: achievement.description || '',
      achieved: Boolean(achievement.achieved),
      unlocktime: achievement.unlocktime || 0
    }));

    const unlocked = achievements.filter((a) => a.achieved).length;
    res.json({ provider: provider.id, appid, total: achievements.length, unlocked, achievements });
  } catch (err) {
    console.error('Error fetching achievements:', err.message);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
}

const spaces = 4;
app.set("json spaces", spaces);
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
// app.use('/assets/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));
// app.use('/assets/@popperjs/core', express.static(path.join(__dirname, 'node_modules', '@popperjs', 'core', 'dist')));
// app.use('/assets/@fortawesome/fontawesome-free', express.static(path.join(__dirname, 'node_modules', '@fortawesome', 'fontawesome-free')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ space: spaces, limit: '10mb' }));
app.use(cors());
app.use('/api', apiRateLimiter);
app.use('/api', (req, res, next) => {
  if (req.path === '/' || req.path === '/health') {
    return next();
  }
  return requireApiAuth(req, res, next);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to the Game Library API', endpoints: ['/api/health', '/api/providers', '/api/player', '/api/games', '/api/achievements'] });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/providers', (req, res) => {
  res.json({ providers: Object.values(PROVIDERS).map(({ id, label }) => ({ id, label })) });
});
app.get('/api/player', async (req, res) => {
  await getApiPlayer(req, res);
});

app.get('/api/games', async (req, res) => {
  await getApiGames(req, res);
});

app.get('/api/gametestheader', async (req, res) => {
  await getActualHeaderFromSteamAPI(req, res);
});

app.get('/api/achievements', async (req, res) => {
  await getApiAchievements(req, res);
});

if (process.argv[1] === __filename) {
  app.listen(PORT, () => {
    console.log(`LCPGameStats running at http://localhost:${PORT}`);
  });
}

export {
  app,
  getQueryParamValue,
  normalizePageValue,
  normalizePageSizeValue,
  sortGames,
  filterGames,
  createGamesResponse,
  convertGamesResponseToXml,
  fetchEpicAchievements,
  requireApiAuth,
  apiRateLimiter
};
