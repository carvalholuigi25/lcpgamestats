import axios from 'axios';

const UBI_SESSIONS_URL = 'https://public-ubiservices.ubi.com/v3/profiles/sessions';
const UBI_GRAPHQL_URL = 'https://public-ubiservices.ubi.com/v1/profiles/me/uplay/graphql';

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
  return process.env.UPLAY_REMEMBER_ME_TICKET || '';
}

function getConfiguredUserId() {
  return process.env.UPLAY_USER_ID || '';
}

let cachedSession = null; // { ticket, sessionId, rememberMeTicket, userId, nameOnPlatform, expiresAt }

export function isUplayConfigured() {
  return Boolean(getConfiguredRememberMeTicket() && getConfiguredUserId());
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

  const { ticket, rememberMeTicket, sessionId, userId, nameOnPlatform } = data || {};

  if (!ticket || !rememberMeTicket || !userId) {
    throw new Error('Pasted data is missing ticket, rememberMeTicket, or userId');
  }

  return { ticket, rememberMeTicket, sessionId, userId, nameOnPlatform };
}

function baseHeaders() {
  return {
    'Content-Type': 'application/json',
    'Ubi-AppId': getAppId(),
    'User-Agent': CHROME_USER_AGENT
  };
}

async function refreshSession() {
  const rememberMeTicket = cachedSession?.rememberMeTicket || getConfiguredRememberMeTicket();
  if (!rememberMeTicket) {
    throw new Error('UPLAY_REMEMBER_ME_TICKET is not configured');
  }

  const { data } = await axios.post(UBI_SESSIONS_URL, { rememberMe: true }, {
    headers: {
      ...baseHeaders(),
      Authorization: `rm_v1 t=${rememberMeTicket}`
    }
  });

  const expiration = data?.expiration ? Date.parse(data.expiration) : NaN;
  const expiresAt = Number.isFinite(expiration) ? expiration - 60000 : Date.now() + 40 * 60 * 1000;

  if (data.rememberMeTicket && data.rememberMeTicket !== rememberMeTicket) {
    console.warn('Ubisoft issued a new remember-me ticket - update UPLAY_REMEMBER_ME_TICKET in .env to avoid losing access after a restart:');
    console.warn(data.rememberMeTicket);
  }

  cachedSession = {
    ticket: data.ticket,
    sessionId: data.sessionId,
    userId: data.userId || cachedSession?.userId || getConfiguredUserId(),
    nameOnPlatform: data.nameOnPlatform || cachedSession?.nameOnPlatform,
    rememberMeTicket: data.rememberMeTicket || rememberMeTicket,
    expiresAt
  };

  return cachedSession;
}

async function getSession() {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession;
  }
  return refreshSession();
}

// Seeds the in-memory session from a freshly-pasted login payload and
// immediately refreshes it, so scripts/uplay-login.js can confirm the
// pasted data actually works before the user copies it into .env.
export async function verifyUplaySession(loginPayload) {
  cachedSession = { ...loginPayload, expiresAt: 0 };
  return refreshSession();
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

  const nodes = data?.data?.viewer?.ownedGames?.nodes || [];
  // Ubisoft Connect's library also lists Stadia/other platform releases the
  // account owns - only keep the ones actually playable via the PC client.
  return nodes.filter((game) => extractPlatformTypes(game).includes('PC'));
}
