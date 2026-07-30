import axios from 'axios';

const EPIC_ACCOUNT_BASE = 'https://account-public-service-prod03.ol.epicgames.com';
const EPIC_LIBRARY_BASE = 'https://library-service.live.use1a.on.epicgames.com';
const EPIC_CATALOG_BASE = 'https://catalog-public-service-prod06.ol.epicgames.com';

// Public client credentials baked into the official Epic Games Launcher binary.
// Not a secret - the same pair is used by the open-source Legendary/Heroic/rare
// launchers to talk to Epic's own account API on behalf of an installed app.
const DEFAULT_CLIENT_ID = '34a02cf8f4414e29b15921876da36f9a';
const DEFAULT_CLIENT_SECRET = 'daafbccc737745039dffe53d94fc76cf';

// process.env is read lazily (inside functions) rather than at module load time,
// because dotenv.config() in server.js runs after this module has already been
// imported - a top-level read here would always see undefined.
function getClientId() {
  return process.env.EPIC_CLIENT_ID || DEFAULT_CLIENT_ID;
}

function getClientSecret() {
  return process.env.EPIC_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;
}

function getRefreshToken() {
  return process.env.EPIC_REFRESH_TOKEN || '';
}

function basicAuthHeader() {
  return 'Basic ' + Buffer.from(`${getClientId()}:${getClientSecret()}`).toString('base64');
}

let cachedToken = null; // { accessToken, accountId, expiresAt }

export function isEpicConfigured() {
  return Boolean(getRefreshToken());
}

export function getEpicLoginUrl() {
  const redirectUrl = `https://www.epicgames.com/id/api/redirect?clientId=${getClientId()}&responseType=code`;
  return `https://www.epicgames.com/id/login?redirectUrl=${encodeURIComponent(redirectUrl)}`;
}

export async function exchangeEpicAuthorizationCode(code) {
  const { data } = await axios.post(
    `${EPIC_ACCOUNT_BASE}/account/api/oauth/token`,
    new URLSearchParams({ grant_type: 'authorization_code', code, token_type: 'eg1' }).toString(),
    { headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return data;
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('EPIC_REFRESH_TOKEN is not configured');
  }

  const { data } = await axios.post(
    `${EPIC_ACCOUNT_BASE}/account/api/oauth/token`,
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, token_type: 'eg1' }).toString(),
    { headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  cachedToken = {
    accessToken: data.access_token,
    accountId: data.account_id,
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

export async function fetchEpicAccountInfo() {
  const token = await getToken();
  const { data } = await axios.get(`${EPIC_ACCOUNT_BASE}/account/api/public/account/${token.accountId}`, {
    headers: { Authorization: `Bearer ${token.accessToken}` }
  });
  return data;
}

// Epic doesn't expose a "playtime"/"achievements" API the way Steam does -
// this is the closest generic equivalent: the launcher's own entitlement list.
export async function fetchEpicLibraryItems() {
  const token = await getToken();
  const records = [];
  let cursor;

  do {
    const { data } = await axios.get(`${EPIC_LIBRARY_BASE}/library/api/public/items`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      params: { includeMetadata: true, cursor }
    });
    records.push(...(data?.records || []));
    cursor = data?.responseMetadata?.nextCursor || undefined;
  } while (cursor);

  return records;
}

export async function fetchEpicCatalogItem(namespace, catalogItemId) {
  const token = await getToken();
  const { data } = await axios.get(`${EPIC_CATALOG_BASE}/catalog/api/shared/namespace/${namespace}/bulk/items`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    params: { id: catalogItemId, includeMainGameDetails: true, country: 'US', locale: 'en' }
  });
  return data?.[catalogItemId] || null;
}
