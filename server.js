import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { fileURLToPath } from 'url';
import { randomBytes } from 'node:crypto';
import { getHeaderImage, getStoreGameLink, normalizeEpicAchievement, normalizeGogAchievement, getVideoTrailerData, resolveAchievementBadgeImage } from './lib/utils.js';
import multer from 'multer';
import auth from './lib/auth.js';
import feedbackStore from './lib/feedback.js';
import { isGogConfigured, fetchGogUserData, fetchGogOwnedGameIds, fetchGogProductDetails, fetchGogAchievements } from './lib/gog.js';
import { isEpicConfigured, fetchEpicAccountInfo, fetchEpicLibraryItems, fetchEpicCatalogItem } from './lib/epic.js';
import { isUplayConfigured, fetchUplayAccountInfo, fetchUplayOwnedGames, fetchUplayGameDetails } from './lib/uplay.js';
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
const hasGoogleOAuth = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
// Initialize auth DB
try {
  auth.init();
} catch (err) {
  console.warn('Auth DB init failed:', err.message);
}
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 30);
const SESSION_SECRET = process.env.SESSION_SECRET || 'changeme-session';
const requestCounts = new Map();

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  try {
    const user = auth.getUserById(id);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

passport.use(new LocalStrategy((username, password, done) => {
  try {
    const userRow = auth.getUserWithHashByUsername(username);
    if (!userRow || !auth.verifyPassword(userRow, password)) {
      return done(null, false, { message: 'Invalid username or password' });
    }
    const user = auth.getUserById(userRow.id);
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

if (hasGoogleOAuth) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const googleUsername = `google:${profile.id}`;
      let user = auth.getUserByUsername(googleUsername);
      if (!user) {
        const email = profile.emails && profile.emails[0] && profile.emails[0].value ? profile.emails[0].value : '';
        const displayName = profile.displayName || profile.username || 'Google User';
        const password = randomBytes(16).toString('hex');
        user = auth.createUser({
          username: googleUsername,
          password,
          displayName,
          email,
          role: 'user'
        });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
}

// Ensure public/images exists
const IMAGES_DIR = path.join(__dirname, 'public', 'images');
try {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
} catch (e) {
  // ignore
}

// Configure multer for background image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    const safeName = String(Date.now()) + '-' + file.originalname.replace(/[^a-z0-9.\-\_]/gi, '_');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error('Invalid file type'));
  }
});

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
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  if (!API_AUTH_TOKEN || API_AUTH_TOKEN === 'changeme') {
    return next();
  }

  if (req.path.startsWith('/auth')) {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token || token !== API_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized. Missing or invalid API token.' });
  }

  next();
}

function requireLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: 'Authentication required' });
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// Login/registration are disabled from midnight to 7am UTC (curfew window),
// so the restriction is consistent regardless of where the server or client is located.
const AUTH_CURFEW_START_HOUR_UTC = 0;
const AUTH_CURFEW_END_HOUR_UTC = 7;

function isWithinAuthCurfew(date = new Date()) {
  const hour = date.getUTCHours();
  return hour >= AUTH_CURFEW_START_HOUR_UTC && hour < AUTH_CURFEW_END_HOUR_UTC;
}

function blockDuringAuthCurfew(req, res, next) {
  if (isWithinAuthCurfew()) {
    return res.status(403).json({
      error: `Login and registration are unavailable from midnight to 7am UTC. Please try again after ${String(AUTH_CURFEW_END_HOUR_UTC).padStart(2, '0')}:00 UTC.`
    });
  }
  next();
}

function getProvider(providerId) {
  return PROVIDERS[providerId] || PROVIDERS.steam;
}


function normalizeProviderGame(provider, game) {
  const trailer = getVideoTrailerData(provider, game);

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
    provider: provider.id,
    video_url: trailer.videoUrl,
    video_thumbnail: trailer.thumbnailUrl,
    trailer_url: trailer.videoUrl,
    trailer_thumbnail: trailer.thumbnailUrl
  } : {
    appid: game.appid || game.gameId || game.GameId || game.id || game.ID,
    name: game.name || game.title || game.Title,
    playtime_forever: Number(game.playtime_forever || 0),
    playtime_2weeks: Number(game.playtime_2weeks || 0),
    rtime_last_played: Number(game.rtime_last_played || 0),
    header_image: getHeaderImage(provider, game),
    store_link: getStoreGameLink(provider, game),
    provider: provider.id,
    video_url: trailer.videoUrl,
    video_thumbnail: trailer.thumbnailUrl,
    trailer_url: trailer.videoUrl,
    trailer_thumbnail: trailer.thumbnailUrl
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

const steamAppDetailsCache = new Map();

async function fetchSteamAppDetails(appid) {
  if (steamAppDetailsCache.has(appid)) return steamAppDetailsCache.get(appid);

  let details = null;
  try {
    const endpoint = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
    const resp = await axios.get(endpoint, {
      headers: {
        Accept: 'application/json'
      }
    });

    details = resp.data?.[appid]?.data || null;
  } catch (err) {
    console.error(`Error fetching Steam app details for appid ${appid}:`, err.message);
  }

  steamAppDetailsCache.set(appid, details);
  return details;
}

async function fetchActualSteamHeaderImage(appid) {
  const details = await fetchSteamAppDetails(appid);
  return details?.header_image || '';
}

async function getActualHeaderFromSteamAPI(req, res) {
  try {
    const appid = req.query.appid;

    if(!appid) {
      return res.status(400).json({ error: 'Please provide the app id from steam' });
    }

    const rawData = await fetchActualSteamHeaderImage(appid);
    if (!rawData) {
      return res.status(404).json({ error: 'Header image not found for the given app id' });
    }

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


const steamSchemaCache = new Map();

async function fetchSteamAchievementSchema(appid) {
  if (steamSchemaCache.has(appid)) return steamSchemaCache.get(appid);

  const icons = new Map();
  try {
    const { data } = await axios.get(`${STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/`, {
      params: { key: STEAM_API_KEY, appid, l: 'en' }
    });

    const schemaAchievements = data?.game?.availableGameStats?.achievements || [];
    schemaAchievements.forEach((achievement) => {
      icons.set(achievement.name, {
        icon: achievement.icon || '',
        icongray: achievement.icongray || '',
        displayName: achievement.displayName || '',
        description: achievement.description || ''
      });
    });
  } catch (err) {
    console.error('Error fetching Steam achievement schema:', err.message);
  }

  steamSchemaCache.set(appid, icons);
  return icons;
}

const gogProductDetailsCache = new Map();

async function fetchCachedGogProductDetails(productId) {
  if (gogProductDetailsCache.has(productId)) return gogProductDetailsCache.get(productId);

  let details = null;
  try {
    details = await fetchGogProductDetails(productId);
  } catch (err) {
    console.error(`Error fetching GOG product details for ${productId}:`, err.message);
  }

  gogProductDetailsCache.set(productId, details);
  return details;
}

const epicCatalogItemCache = new Map();

async function fetchCachedEpicCatalogItem(namespace, catalogItemId) {
  const cacheKey = `${namespace}:${catalogItemId}`;
  if (epicCatalogItemCache.has(cacheKey)) return epicCatalogItemCache.get(cacheKey);

  let item = null;
  try {
    item = await fetchEpicCatalogItem(namespace, catalogItemId);
  } catch (err) {
    console.error(`Error fetching Epic catalog item ${cacheKey}:`, err.message);
  }

  epicCatalogItemCache.set(cacheKey, item);
  return item;
}

// Unlike GOG's product details/Epic's catalog items, this is per-game
// playtime rather than static metadata, so it's re-fetched (not cached)
// every /api/games call to stay current.
async function fetchUplayGameDetailsSafe(spaceId) {
  try {
    return await fetchUplayGameDetails(spaceId);
  } catch (err) {
    console.error(`Error fetching Uplay game details for ${spaceId}:`, err.message);
    return { playtimeMinutes: 0, lastPlayed: 0 };
  }
}

// Ubisoft only assigns a real slug to some games - others (eg. Far Cry 3 Blood
// Dragon in testing) get the spaceId echoed back as "slug", which doesn't
// resolve on the storefront, so fall back to a search link in that case.
function getUplayStoreLink(game) {
  const spaceId = game.spaceId || game.id;
  if (game.slug && game.slug !== spaceId) {
    return `https://store.ubi.com/us/${game.slug}`;
  }
  return `https://store.ubi.com/us/search/?q=${encodeURIComponent(game.name)}`;
}

function pickEpicKeyImage(catalogItem) {
  const images = catalogItem?.keyImages || [];
  const preferredTypes = ['DieselStoreFrontWide', 'OfferImageWide', 'DieselGameBoxWide', 'Thumbnail'];
  for (const type of preferredTypes) {
    const match = images.find((img) => img.type === type);
    if (match?.url) return match.url;
  }
  return images[0]?.url || '';
}

async function fetchGogAchievementsForAppid(appid) {
  const sampleGames = SAMPLE_GAME_DATA.gog || [];
  const sampleGame = sampleGames.find((item) => [item.id, item.appid].some((field) => field !== undefined && String(field) === String(appid)));

  if (isGogConfigured()) {
    try {
      const rawAchievements = await fetchGogAchievements(appid);
      if (Array.isArray(rawAchievements) && rawAchievements.length > 0) {
        return rawAchievements.map(normalizeGogAchievement);
      }
    } catch (err) {
      console.error('Error fetching GOG achievements from API:', err.message);
    }
  }

  const fallbackAchievements = sampleGame?.achievements || [
    { apiname: 'first_play', name: 'First Play', description: 'Start the game on GOG', achieved: false },
    { apiname: 'collector', name: 'Collector', description: 'Collect a few items', achieved: false },
    { apiname: 'completionist', name: 'Completionist', description: 'Complete all available objectives', achieved: false }
  ];

  return fallbackAchievements.map(normalizeGogAchievement);
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

  if (provider.id === 'gog' && isGogConfigured()) {
    try {
      const userData = await fetchGogUserData();
      return res.json({
        personaname: userData?.username || 'GOG User',
        avatarfull: userData?.avatar || `https://via.placeholder.com/128?text=${encodeURIComponent(provider.label)}`,
        profileurl: userData?.username ? `https://www.gog.com/u/${userData.username}` : '#',
        provider: provider.id,
        providerLabel: provider.label
      });
    } catch (err) {
      console.error('Error fetching GOG player profile:', err.message);
      return res.status(500).json({ error: 'Failed to fetch GOG player profile' });
    }
  }

  if (provider.id === 'epic' && isEpicConfigured()) {
    try {
      const account = await fetchEpicAccountInfo();
      return res.json({
        personaname: account?.displayName || account?.preferredLanguage || 'Epic User',
        avatarfull: `https://via.placeholder.com/128?text=${encodeURIComponent(provider.label)}`,
        profileurl: '#',
        provider: provider.id,
        providerLabel: provider.label
      });
    } catch (err) {
      console.error('Error fetching Epic player profile:', err.message);
      return res.status(500).json({ error: 'Failed to fetch Epic player profile' });
    }
  }

  if (provider.id === 'uplay' && isUplayConfigured()) {
    try {
      const account = await fetchUplayAccountInfo();
      return res.json({
        personaname: account?.nameOnPlatform || 'Uplay User',
        avatarfull: `https://via.placeholder.com/128?text=${encodeURIComponent(provider.label)}`,
        profileurl: '#',
        provider: provider.id,
        providerLabel: provider.label
      });
    } catch (err) {
      console.error('Error fetching Uplay player profile:', err.message);
      return res.status(500).json({ error: 'Failed to fetch Uplay player profile' });
    }
  }

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

      const gamesNeedingHeaders = new Map();
      [...responseData.games, ...responseData.topGames, ...(responseData.topGame ? [responseData.topGame] : [])]
        .forEach((game) => gamesNeedingHeaders.set(game.appid, game));

      await Promise.all([...gamesNeedingHeaders.keys()].map(async (appid) => {
        const details = await fetchSteamAppDetails(appid);
        const game = gamesNeedingHeaders.get(appid);

        if (details?.header_image) {
          game.header_image = details.header_image;
        }

        const movies = Array.isArray(details?.movies) ? details.movies : [];
        if (movies.length > 0) {
          const trailer = getVideoTrailerData(provider, { movies, appid });
          game.video_url = trailer.videoUrl;
          game.video_thumbnail = trailer.thumbnailUrl;
          game.trailer_url = trailer.videoUrl;
          game.trailer_thumbnail = trailer.thumbnailUrl;
        }
      }));

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

  if (provider.id === 'gog' && isGogConfigured()) {
    try {
      const ownedIds = await fetchGogOwnedGameIds();
      const details = await Promise.all(ownedIds.map((id) => fetchCachedGogProductDetails(id)));

      let games = ownedIds
        .map((id, index) => ({ id, details: details[index] }))
        .filter((entry) => entry.details)
        .map((entry) => normalizeProviderGame(provider, {
          appid: entry.id,
          name: entry.details.title,
          header_image: entry.details.images?.background || entry.details.images?.logo2x || entry.details.images?.sidebarIcon || '',
          store_path: entry.details.slug || entry.id,
          playtime_forever: 0,
          playtime_2weeks: 0
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
      console.error('Error fetching GOG games:', err.message);
      // Fall through to sample data below.
    }
  }

  if (provider.id === 'epic' && isEpicConfigured()) {
    try {
      const records = await fetchEpicLibraryItems();
      const catalogItems = await Promise.all(
        records.map((record) => fetchCachedEpicCatalogItem(record.namespace, record.catalogItemId))
      );

      let games = records.map((record, index) => {
        const catalogItem = catalogItems[index];
        return normalizeProviderGame(provider, {
          appid: record.catalogItemId,
          name: catalogItem?.title || record.appName,
          header_image: pickEpicKeyImage(catalogItem),
          store_path: catalogItem?.urlSlug || record.catalogItemId,
          playtime_forever: 0,
          playtime_2weeks: 0
        });
      });

      games = filterGames(games, search);
      games = sortGames(games, sortBy);

      const responseData = createGamesResponse(games, page, pageSize, provider);
      const format = getQueryParamValue(req, 'format', 'json').toLowerCase();
      if (format === 'xml') {
        return res.type('application/xml').send(convertGamesResponseToXml(responseData));
      }
      return res.json(responseData);
    } catch (err) {
      console.error('Error fetching Epic games:', err.message);
      // Fall through to sample data below.
    }
  }

  if (provider.id === 'uplay' && isUplayConfigured()) {
    try {
      const ownedGames = await fetchUplayOwnedGames();
      const details = await Promise.all(ownedGames.map((game) => fetchUplayGameDetailsSafe(game.spaceId || game.id)));

      let games = ownedGames.map((game, index) => normalizeProviderGame(provider, {
        appid: game.spaceId || game.id,
        name: game.name,
        header_image: game.bannerUrl || game.coverUrl || '',
        store_link: getUplayStoreLink(game),
        playtime_forever: details[index].playtimeMinutes,
        playtime_2weeks: 0,
        rtime_last_played: details[index].lastPlayed
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
      console.error('Error fetching Uplay games:', err.message);
      // Fall through to sample data below.
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

// Fetch game list details and the Steam header image for the requested appid.
async function getMixedDataGameHeader(req, res) {
  try {
    const providerId = (req.query.provider || 'steam').toLowerCase();
    const appid = getQueryParamValue(req, 'appid', '');

    if (!appid) {
      return res.status(400).json({ error: 'Missing required appid parameter' });
    }

    const captureResponse = () => ({
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
      type() {
        return this;
      },
      send(payload) {
        this.body = payload;
        return this;
      }
    });

    const gamesResponse = captureResponse();
    const headerResponse = captureResponse();

    await Promise.all([
      getApiGames(req, gamesResponse),
      getActualHeaderFromSteamAPI(req, headerResponse)
    ]);

    const gamesPayload = gamesResponse.body;
    const headerPayload = headerResponse.body;

    if (!gamesPayload || !headerPayload) {
      return res.status(500).json({ error: 'Failed to fetch game data or header image' });
    }

    const games = Array.isArray(gamesPayload?.games)
      ? gamesPayload.games
      : gamesPayload?.data?.games || [];

    const game = games.find((g) => String(g.appid) === String(appid));
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    return res.json({
      game,
      headerImage: headerPayload.data_images || headerPayload
    });
  } catch (err) {
    console.error('Error fetching mixed game header:', err.message);
    return res.status(500).json({ error: 'Failed to fetch mixed game header' });
  }
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

  if (provider.id === 'gog') {
    try {
      const achievements = await fetchGogAchievementsForAppid(appid);
      const unlocked = achievements.filter((a) => a.achieved).length;
      return res.json({ provider: provider.id, appid, total: achievements.length, unlocked, achievements });
    } catch (err) {
      console.error('Error fetching GOG achievements:', err.message);
      return res.status(500).json({ error: 'Failed to fetch GOG achievements' });
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
    const [{ data }, schemaIcons] = await Promise.all([
      axios.get(`${STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/`, {
        params: {
          key: STEAM_API_KEY,
          steamid: STEAM_USER_ID,
          appid,
          l: 'en'
        }
      }),
      fetchSteamAchievementSchema(appid)
    ]);

    const stats = data?.playerstats;
    if (!stats || !stats.achievements) {
      return res.status(404).json({ error: 'No achievement data available for this game' });
    }

    const achievements = stats.achievements.map((achievement) => {
      const icons = schemaIcons.get(achievement.apiname) || {};
      const badgeimage = (achievement.achieved ? icons.icon : icons.icongray) || icons.icon
        || resolveAchievementBadgeImage(achievement, appid);
      return {
        apiname: achievement.apiname,
        name: achievement.name || icons.displayName || achievement.apiname,
        description: achievement.description || icons.description || '',
        achieved: Boolean(achievement.achieved),
        badgeimage,
        unlocktime: achievement.unlocktime || 0
      };
    });

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
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(passport.initialize());
app.use(passport.session());
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

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/pages/admin.html'));
});

app.get('/feedback', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/pages/feedback.html'));
});

app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/pages/about.html'));
});

app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to the Game Library API', endpoints: ['/api/health', '/api/providers', '/api/player', '/api/games', '/api/achievements', '/api/feedback'] });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/providers', (req, res) => {
  res.json({ providers: Object.values(PROVIDERS).map(({ id, label }) => ({ id, label })) });
});

const FEEDBACK_CATEGORIES = ['bug', 'feature', 'general'];

app.post('/api/feedback', (req, res) => {
  const { name, email, category, message } = req.body || {};
  const rating = Number(req.body && req.body.rating);

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const entry = {
    name: String(name).trim().slice(0, 200),
    email: String(email).trim().slice(0, 200),
    category: FEEDBACK_CATEGORIES.includes(category) ? category : 'general',
    message: String(message).trim().slice(0, 5000),
    rating: Number.isFinite(rating) ? Math.min(5, Math.max(1, Math.round(rating))) : null,
    createdAt: Math.floor(Date.now() / 1000)
  };

  try {
    feedbackStore.save(entry);
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to save feedback:', err.message);
    res.status(500).json({ error: 'Unable to save feedback' });
  }
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

app.get('/api/gamesmixedheader', async (req, res) => {
  await getMixedDataGameHeader(req, res);
});

app.get('/api/achievements', async (req, res) => {
  await getApiAchievements(req, res);
});

// Authentication routes
app.post('/api/auth/register', blockDuringAuthCurfew, (req, res, next) => {
  try {
    const { username, password, displayName, email } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
    const existing = auth.getUserByUsername(username);
    if (existing) return res.status(409).json({ error: 'User already exists' });
    const user = auth.createUser({ username, password, displayName, email, role: 'user' });
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      return res.json({ user });
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to register' });
  }
});

app.post('/api/auth/login', blockDuringAuthCurfew, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error('Login error:', err.message);
      return next(err);
    }
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Invalid credentials' });
    }
    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error('Login error:', loginErr.message);
        return next(loginErr);
      }
      return res.json({ user });
    });
  })(req, res, next);
});

app.post('/api/auth/logout', requireLogin, (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out' });
    });
  });
});

app.get('/api/auth/me', requireLogin, (req, res) => {
  res.json({ user: req.user });
});

app.put('/api/auth/me', requireLogin, (req, res) => {
  try {
    const updates = req.body || {};
    const updated = auth.updateUserProfile(req.user.id, updates);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: updated });
  } catch (err) {
    console.error('Profile update error:', err.message);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.get('/api/admin/users', requireLogin, requireRole('admin'), (req, res) => {
  try {
    const users = auth.listUsers();
    res.json({ users });
  } catch (err) {
    console.error('List users error:', err.message);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

app.get('/api/admin/summary', requireLogin, requireRole('admin'), (req, res) => {
  try {
    const users = auth.listUsers();
    const now = Math.floor(Date.now() / 1000);
    const recentWindow = now - 7 * 24 * 60 * 60;
    const summary = {
      totalUsers: users.length,
      totalAdmins: users.filter((user) => user.role === 'admin').length,
      recentSignups: users.filter((user) => (user.createdAt || 0) >= recentWindow).length
    };
    res.json({ summary });
  } catch (err) {
    console.error('Admin summary error:', err.message);
    res.status(500).json({ error: 'Failed to load admin summary' });
  }
});

app.patch('/api/admin/users/:id/role', requireLogin, requireRole('admin'), (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (Number(req.user.id) === userId) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }
    const updated = auth.updateUserRole(userId, req.body?.role);
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: updated });
  } catch (err) {
    console.error('Role update error:', err.message);
    return res.status(400).json({ error: err.message || 'Failed to update role' });
  }
});

app.get('/auth/google', (req, res, next) => {
  if (!hasGoogleOAuth) {
    return res.status(501).send('Google OAuth is not configured.');
  }
  if (isWithinAuthCurfew()) {
    return res.redirect('/?auth=curfew');
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback', (req, res, next) => {
  if (!hasGoogleOAuth) {
    return res.status(501).send('Google OAuth is not configured.');
  }
  passport.authenticate('google', {
    failureRedirect: '/?auth=failed'
  })(req, res, next);
}, (req, res) => {
  res.redirect('/');
});

app.post('/api/upload-bg', upload.single('bg'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/images/${req.file.filename}`;
    return res.json({ url });
  } catch (err) {
    console.error('Upload error:', err.message);
    return res.status(500).json({ error: 'Failed to save uploaded image' });
  }
});

function startServer(port = PORT) {
  const server = app.listen(port, () => {
    console.log(`LCPGameStats running at http://localhost:${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is busy. Trying ${nextPort} instead.`);
      server.close(() => startServer(nextPort));
      return;
    }

    console.error(err);
    process.exit(1);
  });
}

if (process.argv[1] === __filename) {
  startServer(PORT);
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
  fetchGogAchievementsForAppid,
  getMixedDataGameHeader,
  getApiGames,
  requireApiAuth,
  apiRateLimiter
};
