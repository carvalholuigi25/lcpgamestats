import axios from 'axios';

const GOG_AUTH_BASE = 'https://auth.gog.com';
const GOG_API_BASE = 'https://api.gog.com';
const GOG_EMBED_BASE = 'https://embed.gog.com';
const GOG_GAMEPLAY_BASE = 'https://gameplay.gog.com';
const GOG_REDIRECT_URI = 'https://embed.gog.com/on_login_success?origin=client';

// Public client credentials baked into the official GOG Galaxy client binary.
// They aren't secret - every community GOG API client (gogapidocs, minigalaxy,
// GOGDB, Heroic) ships this same pair to talk to GOG's own account/library API.
const DEFAULT_CLIENT_ID = '46899977096215655';
const DEFAULT_CLIENT_SECRET = '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';

// process.env is read lazily (inside functions) rather than at module load time,
// because dotenv.config() in server.js runs after this module has already been
// imported - a top-level read here would always see undefined.
function getClientId() {
  return process.env.GOG_CLIENT_ID || DEFAULT_CLIENT_ID;
}

function getClientSecret() {
  return process.env.GOG_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;
}

function getRefreshToken() {
  return process.env.GOG_REFRESH_TOKEN || '';
}

let cachedToken = null; // { accessToken, userId, expiresAt }

export function isGogConfigured() {
  return Boolean(getRefreshToken());
}

export function getGogLoginUrl() {
  const params = new URLSearchParams({
    client_id: getClientId(),
    layout: 'client2',
    redirect_uri: GOG_REDIRECT_URI,
    response_type: 'code'
  });
  return `${GOG_AUTH_BASE}/auth?${params.toString()}`;
}

export async function exchangeGogAuthorizationCode(code) {
  const { data } = await axios.get(`${GOG_AUTH_BASE}/token`, {
    params: {
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: 'authorization_code',
      code,
      redirect_uri: GOG_REDIRECT_URI
    }
  });
  return data;
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('GOG_REFRESH_TOKEN is not configured');
  }

  const { data } = await axios.get(`${GOG_AUTH_BASE}/token`, {
    params: {
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }
  });

  cachedToken = {
    accessToken: data.access_token,
    userId: data.user_id,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) - 60) * 1000
  };

  return cachedToken;
}

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken;
  }
  return refreshAccessToken();
}

export async function fetchGogUserData() {
  const token = await getToken();
  const { data } = await axios.get(`${GOG_EMBED_BASE}/userData.json`, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  return data;
}

export async function fetchGogOwnedGameIds() {
  const token = await getToken();
  const { data } = await axios.get(`${GOG_EMBED_BASE}/user/data/games`, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  return data?.owned || [];
}

export async function fetchGogProductDetails(productId) {
  const { data } = await axios.get(`${GOG_API_BASE}/products/${productId}`, {
    params: { expand: 'downloads' }
  });
  return data;
}

// Undocumented, community-reverse-engineered endpoint (no official spec) - GOG
// Galaxy calls this to sync achievement unlock state. Kept isolated so a shape
// change only needs a fix here, not in every caller.
export async function fetchGogAchievements(productId) {
  const token = await getToken();
  const { data } = await axios.get(`${GOG_GAMEPLAY_BASE}/clients/${productId}/users/${token.userId}/achievements`, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  return data?.items || [];
}
