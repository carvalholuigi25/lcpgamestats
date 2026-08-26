import axios from 'axios';
import fs from 'node:fs/promises';
import path from 'node:path';

const ENV_FILE_PATH = path.join(process.cwd(), '.env');

const UBI_SESSIONS_URL = 'https://public-ubiservices.ubi.com/v3/profiles/sessions';
const UBI_GRAPHQL_URL = 'https://public-ubiservices.ubi.com/v1/profiles/me/uplay/graphql';
const UBI_STATSCARD_BASE = 'https://public-ubiservices.ubi.com/v1/profiles';

// Ubisoft blocks requests without a browser-like user agent.
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36';

// Ubisoft Connect web app id + genome id used for both the login page and
// subsequent API calls - reverse-engineered by the open-source GOG Galaxy
// Ubisoft Connect plugin (melcom-creations/galaxy-integration-uplay), not a secret.
const DEFAULT_APP_ID = 'f68a4bb5-608a-4ff2-8123-be8ef797e0a6';
const DEFAULT_GENOME_ID = '954e66a0-be1b-4aa0-9690-fb75201e4e9e';

// Same GraphQL document galaxy-integration-uplay sends to list owned games.
const ALL_GAMES_QUERY = `query AllGames {
  viewer {
    id
    ...ownedGamesList
  }
}
fragment gameProps on Game {
  id
  spaceId
  name
  slug
  coverUrl
  bannerUrl
}
fragment ownedGameProps on Game {
  ...gameProps
  viewer {
    meta {
      id
      ownedPlatformGroups {
        id
        name
        type
      }
    }
  }
}
fragment ownedGamesList on User {
  ownedGames: games(filterBy: {isOwned: true}) {
    totalCount
    nodes {
      ...ownedGameProps
    }
  }
}`;

// process.env is read lazily (inside functions) rather than at module load time,
// because dotenv.config() in server.js runs after this module has already been
// imported - a top-level read here would always see undefined.
function getAppId() {
  return process.env.UPLAY_APP_ID || DEFAULT_APP_ID;
}

function getConfiguredRememberMeTicket() {
  return process.env.UPLAY_REMEMBER_ME_TICKET;
}

function getConfiguredUserId() {
  return process.env.UPLAY_USER_ID;
}

// Ubisoft's web login doesn't always issue a remember-me ticket (observed
// consistently for at least some accounts/2FA setups). Without one we can't
// mint fresh tickets unattended, so as a fallback we persist the raw ticket
// itself and use it directly until it naturally expires (a few hours).
function getConfiguredTicketSession() {
  const ticket = process.env.UPLAY_TICKET;
  const sessionId = process.env.UPLAY_SESSION_ID;
  const userId = getConfiguredUserId();
  const expiresAt = Number(process.env.UPLAY_TICKET_EXPIRES_AT);
  if (ticket && sessionId && userId && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
    return { ticket, sessionId, userId, nameOnPlatform: process.env.UPLAY_NAME_ON_PLATFORM, rememberMeTicket: '', expiresAt };
  }
  return null;
}

let cachedSession = null; // { ticket, sessionId, rememberMeTicket, userId, nameOnPlatform, expiresAt }
let refreshPromise = null; // in-flight refreshSession() call, shared so concurrent callers don't each spend the remember-me ticket

export function isUplayConfigured() {
  if (!getConfiguredUserId()) {
    return false;
  }
  return Boolean(getConfiguredRememberMeTicket()) || Boolean(getConfiguredTicketSession());
}

export function getUplayLoginUrl() {
  const params = new URLSearchParams({
    appId: getAppId(),
    genomeId: DEFAULT_GENOME_ID,
    lang: 'en-US',
    nextUrl: 'https://connect.ubisoft.com/'
  });
  return `https://connect.ubisoft.com/login?${params.toString()}`;
}

// Unlike GOG/Epic, Ubisoft's web login doesn't redirect with a code/token in
// the URL - the official web app stores the session as JSON under the
// "PRODloginData" key in https://connect.ubisoft.com's localStorage once
// login (including any 2FA challenge) completes. The user copies that value
// out of their browser's DevTools and pastes it into scripts/uplay-login.js.
export function parseUplayLoginPayload(rawJson) {
  // Keep unwrapping while it's still a string, so this tolerates both a
  // normal paste and a value copied with an extra layer of JSON-encoding
  // (some browsers' DevTools "copy value" action does this).
  let data = rawJson;
  for (let attempts = 0; typeof data === 'string' && attempts < 3; attempts += 1) {
    try {
      data = JSON.parse(data);
    } catch (err) {
      break;
    }
  }

  const { ticket, rememberMeTicket, sessionId, userId, nameOnPlatform, expiration } = data || {};

  if (!ticket || !sessionId || !userId) {
    throw new Error('Pasted data is missing ticket, sessionId, or userId');
  }

  // rememberMeTicket can come back empty from the web login (eg. without
  // "remember me"/for 2FA accounts) - that just means we can't mint fresh
  // tickets unattended later, not that this login itself is invalid.
  return { ticket, rememberMeTicket: rememberMeTicket || '', sessionId, userId, nameOnPlatform, expiration };
}

function baseHeaders() {
  return {
    'Content-Type': 'application/json',
    'Ubi-AppId': getAppId(),
    'User-Agent': CHROME_USER_AGENT,
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
}

// Ubisoft rotates the remember-me ticket on every successful refresh and
// invalidates the previous one, and a plain ticket is only good for a few
// hours - either way, the value in .env goes stale unless we write the
// confirmed one back ourselves instead of relying on a manual copy-paste.
async function persistEnvValues(values) {
  try {
    let contents = await fs.readFile(ENV_FILE_PATH, 'utf8');
    for (const [key, value] of Object.entries(values)) {
      const line = `${key}="${value}"`;
      const pattern = new RegExp(`^${key}=.*$`, 'm');
      contents = pattern.test(contents)
        ? contents.replace(pattern, line)
        : `${contents.replace(/\n?$/, '\n')}${line}\n`;
    }
    await fs.writeFile(ENV_FILE_PATH, contents);
  } catch (err) {
    console.warn('Could not save the Uplay session to .env - update it manually:', err.message);
    console.warn(JSON.stringify(values));
  }
}

export async function refreshSession() {
  const rememberMeTicket = cachedSession?.rememberMeTicket || getConfiguredRememberMeTicket();
  if (!rememberMeTicket) {
    throw new Error('UPLAY_REMEMBER_ME_TICKET is not configured');
  }

  const { data } = await axios.post(UBI_SESSIONS_URL, { rememberMe: true }, {
    headers: {
      ...baseHeaders(),
      Authorization: `Ubi_v1 t=${rememberMeTicket}`
    }
  });

  const expiration = data?.expiration ? Date.parse(data.expiration) : NaN;
  const expiresAt = Number.isFinite(expiration) ? expiration - 60000 : Date.now() + 40 * 60 * 1000;

  cachedSession = {
    ticket: data.ticket,
    sessionId: data.sessionId,
    userId: data.userId || cachedSession?.userId || getConfiguredUserId(),
    nameOnPlatform: data.nameOnPlatform || cachedSession?.nameOnPlatform,
    rememberMeTicket: data.rememberMeTicket || rememberMeTicket,
    expiresAt
  };

  process.env.UPLAY_REMEMBER_ME_TICKET = cachedSession.rememberMeTicket;
  await persistEnvValues({
    UPLAY_TICKET: cachedSession.ticket,
    UPLAY_SESSION_ID: cachedSession.sessionId,
    UPLAY_TICKET_EXPIRES_AT: String(cachedSession.expiresAt),
    UPLAY_REMEMBER_ME_TICKET: cachedSession.rememberMeTicket,
    ...(cachedSession.nameOnPlatform ? { UPLAY_NAME_ON_PLATFORM: cachedSession.nameOnPlatform } : {})
  });

  return cachedSession;
}

export async function getSession() {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession;
  }

  if (cachedSession?.rememberMeTicket || getConfiguredRememberMeTicket()) {
    // /api/player and /api/games are fetched concurrently from the front end -
    // without this, both would race to redeem the same remember-me ticket and
    // one would lose with a 401.
    if (!refreshPromise) {
      refreshPromise = refreshSession().finally(() => { refreshPromise = null; });
    }
    try {
      return await refreshPromise;
    } catch (err) {
      // Fall back to a still-valid plain ticket rather than failing outright
      // on a stale/invalid remember-me ticket.
      const configuredTicketSession = getConfiguredTicketSession();
      if (configuredTicketSession) {
        cachedSession = configuredTicketSession;
        return cachedSession;
      }
      throw err;
    }
  }

  const configuredTicketSession = getConfiguredTicketSession();
  if (configuredTicketSession) {
    cachedSession = configuredTicketSession;
    return cachedSession;
  }

  throw new Error('Uplay session has expired - run "npm run login:uplay" again.');
}

// Seeds the in-memory session from a freshly-pasted login payload and
// confirms it actually works before persisting it to .env.
export async function verifyUplaySession(loginPayload) {
  const expiration = loginPayload.expiration ? Date.parse(loginPayload.expiration) : NaN;
  const expiresAt = Number.isFinite(expiration) ? expiration - 60000 : Date.now() + 40 * 60 * 1000;
  cachedSession = { ...loginPayload, expiresAt };

  if (loginPayload.rememberMeTicket) {
    // A remember-me ticket can mint fresh tickets unattended later - refresh
    // now so it's that (still-valid) exchange we confirm and persist, not
    // just the paste.
    return refreshSession();
  }

  // No remember-me ticket was issued for this login - confirm the pasted
  // ticket itself is accepted by the API, then persist it directly so the
  // app can keep using it until it expires.
  await fetchUplayOwnedGames();
  await persistEnvValues({
    UPLAY_USER_ID: cachedSession.userId,
    UPLAY_TICKET: cachedSession.ticket,
    UPLAY_SESSION_ID: cachedSession.sessionId,
    UPLAY_TICKET_EXPIRES_AT: String(cachedSession.expiresAt),
    ...(cachedSession.nameOnPlatform ? { UPLAY_NAME_ON_PLATFORM: cachedSession.nameOnPlatform } : {})
  });
  return cachedSession;
}

export async function fetchUplayAccountInfo() {
  const session = await getSession();
  return { userId: session.userId, nameOnPlatform: session.nameOnPlatform };
}

function extractPlatformTypes(game) {
  const groups = game?.viewer?.meta?.ownedPlatformGroups || [];
  return groups.flat().map((platform) => platform?.type || '');
}

export async function fetchUplayOwnedGames() {
  const session = await getSession();
  const { data } = await axios.post(UBI_GRAPHQL_URL, {
    operationName: 'AllGames',
    variables: { owned: true },
    query: ALL_GAMES_QUERY
  }, {
    headers: {
      ...baseHeaders(),
      Authorization: `Ubi_v1 t=${session.ticket}`,
      'Ubi-SessionId': session.sessionId
    }
  });

  // Ubisoft's GraphQL endpoint returns HTTP 200 even for auth/session
  // failures, with an "errors" array and no viewer data - axios won't throw
  // on that, so without this check a degraded response reads as "0 games
  // owned" instead of the failed fetch it actually is.
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    throw new Error(`Ubisoft GraphQL error: ${data.errors.map((error) => error.message).join('; ')}`);
  }

  const ownedGames = data?.data?.viewer?.ownedGames;
  const nodes = ownedGames?.nodes || [];

  // Observed in practice: a long-lived session can get an empty node list
  // back while totalCount still reports the real owned-game count - another
  // silent-degradation case that would otherwise present as an empty library.
  if (ownedGames && ownedGames.totalCount > 0 && nodes.length === 0) {
    throw new Error(`Ubisoft reported ${ownedGames.totalCount} owned games but returned none - retry the request`);
  }

  // Ubisoft Connect's library also lists Stadia/other platform releases the
  // account owns - only keep the ones actually playable via the PC client.
  return nodes.filter((game) => extractPlatformTypes(game).includes('PC'));
}

// Games can report more than one "LongTimespan" stat card (eg. separate PvP
// and PvE timers) - ported from galaxy-integration-uplay's stats.py, which
// found this heuristic worked across most UplayClub games, to avoid either
// summing unrelated timers or missing a game's real total.
const TOTAL_PLAYTIME_DISPLAY_NAMES = ['playtime', 'time played', 'play time', 'total play time', 'total playtime'];
const SPLIT_MODE_KEYWORD_PAIRS = [['pvp', 'pve'], ['solo', 'coop'], ['single', 'multi']];
const TOTAL_KEYWORDS = ['all', 'total', 'absolute'];

function pickPlaytimeCards(timeStats) {
  if (timeStats.length <= 1) {
    return timeStats;
  }

  const totalCard = timeStats.find((card) => TOTAL_PLAYTIME_DISPLAY_NAMES.includes(String(card.displayName).toLowerCase()));
  if (totalCard) {
    return [totalCard];
  }

  if (timeStats.length === 2) {
    const [name1, name2] = timeStats.map((card) => String(card.statName).toLowerCase());
    const isSplitAcrossModes = SPLIT_MODE_KEYWORD_PAIRS.some(([a, b]) =>
      (name1.includes(a) && name2.includes(b)) || (name1.includes(b) && name2.includes(a)));
    if (isSplitAcrossModes) {
      return timeStats;
    }
  }

  const weights = timeStats.map((card) => TOTAL_KEYWORDS.filter((keyword) =>
    String(card.displayName).toLowerCase().includes(keyword) || String(card.statName).toLowerCase().includes(keyword)).length);
  const maxWeight = Math.max(...weights);
  return timeStats.filter((_, index) => weights[index] === maxWeight);
}

// All known games report "Seconds" here regardless of the stat's declared
// unit, per galaxy-integration-uplay's own notes - the factors below convert
// each declared unit to minutes anyway, in case that assumption ever changes.
function normalizePlaytimeMinutes(card) {
  const factor = { Hours: 1 / 60, Minutes: 1, Seconds: 60, Miliseconds: 60000 }[card?.unit];
  if (!factor) {
    return null;
  }
  const value = Number(card?.value === '' ? 0 : card?.value);
  return Number.isFinite(value) ? value / factor : null;
}

function extractPlaytimeAndLastPlayed(statscards) {
  const lastPlayed = statscards.reduce((latest, card) => {
    const parsed = card?.lastModified ? Date.parse(card.lastModified) : NaN;
    return Number.isFinite(parsed) ? Math.max(latest, Math.floor(parsed / 1000)) : latest;
  }, 0);

  const timeStats = statscards.filter((card) => card.format === 'LongTimespan');
  const playtimeMinutes = timeStats.length
    ? Math.max(0, Math.floor(pickPlaytimeCards(timeStats).reduce((sum, card) => {
      const minutes = normalizePlaytimeMinutes(card);
      return minutes === null ? sum : sum + minutes;
    }, 0)))
    : 0;

  return { playtimeMinutes, lastPlayed };
}

// Undocumented, community-reverse-engineered endpoint (no official spec) -
// galaxy-integration-uplay polls this per game for Ubisoft Connect's
// game-time/last-played stats. Games with no stats tracked yet 412.
export async function fetchUplayGameDetails(spaceId) {
  const session = await getSession();
  try {
    const { data } = await axios.get(`${UBI_STATSCARD_BASE}/${session.userId}/statscard`, {
      params: { spaceId },
      headers: {
        ...baseHeaders(),
        Authorization: `Ubi_v1 t=${session.ticket}`,
        'Ubi-SessionId': session.sessionId,
        'Ubi-RequestedPlatformType': 'uplay',
        'Ubi-LocaleCode': 'en-GB'
      }
    });
    return extractPlaytimeAndLastPlayed(data?.Statscards || []);
  } catch (err) {
    if (err.response?.status === 412) {
      return { playtimeMinutes: 0, lastPlayed: 0 };
    }
    throw err;
  }
}

export async function refreshMyUplaySession(req, res) {
  try {
      // await getSession();
      // await refreshSession();

      if (!process.env.UPLAY_EMAIL || !process.env.UPLAY_PASSWORD) {
        res.status(400).json({ error: 'UPLAY_EMAIL and UPLAY_PASSWORD must be set in .env to refresh session' });
        return;
      }

    //   const logresp = await axios.post(getUplayLoginUrl(), {
    //     headers: {
    //       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome 91.0.4472.124 Safari/537.36 Edg/91.0.864.64',
    //       'Accept': 'application/json, text/plain, */*',
    //       'Accept-Language': 'en-US,en;q=0.9',
    //       'Origin': 'https://store.ubi.com',
    //       'Referer': 'https://store.ubi.com/',
    //       'Connection': 'keep-alive'
    //     },
    //     body: JSON.stringify({
    //       "email": process.env.UPLAY_EMAIL,
    //       "password": process.env.UPLAY_PASSWORD,
    //       "rememberMe": true
    //     })
    //   });
  
    //   if(logresp.status === 200 && logresp.data != null) {
    //     const prodloginpayload = JSON.parse(logresp.data || logresp).PRODloginData || logresp.PRODloginData || logresp.data.PRODloginData;
    //     const payload = parseUplayLoginPayload(prodloginpayload);
    //     const session = await verifyUplaySession(payload);
      
    //     // res.json({ success: true, message: `\nLogged in as ${session.nameOnPlatform || payload.userId}.` });
    //     res.json({ message: 'Uplay session refreshed successfully', ticket: logresp.data.ticket });
    //     console.log('\nYour Uplay session has been saved to .env automatically - no need to copy anything.');
    //     if (session.rememberMeTicket) {
    //       console.log('Ubisoft issued a remember-me ticket, so it will keep refreshing itself unattended.');
    //     } else {
    //       console.log('Ubisoft did not issue a remember-me ticket for this login, so this session is only');
    //       console.log('valid until it expires (a few hours) - re-run this script and paste a fresh');
    //       console.log('PRODloginData once it does.');
    //     }
    //   } else {
    //     res.status(500).json({ error: 'Failed to refresh Uplay session', details: logresp.data });
    //   }
    // } catch (err) {
    //   console.error('Error refreshing Uplay data:', err.message);
    //   res.status(500).json({ error: 'Failed to refresh Uplay data' });
    // }
      
    try {
      const session = await getSession();
      res.json({ success: true, userId: session.userId, nameOnPlatform: session.nameOnPlatform });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  } catch (err) {
    console.error('Error refreshing Uplay session:', err.message);
    res.status(500).json({ error: 'Failed to refresh Uplay session', details: err.message });
  }
}