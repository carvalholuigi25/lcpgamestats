import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  normalizePageValue,
  normalizePageSizeValue,
  sortGames,
  filterGames,
  createGamesResponse,
  convertGamesResponseToXml,
  fetchEpicAchievements,
  fetchGogAchievementsForAppid,
  getMixedDataGameHeader,
  getApiGames
} from './server.js';
import auth from './lib/auth.js';
import { getVideoTrailerData, resolveAchievementBadgeImage, normalizeGogAchievement } from './lib/utils.js';
import { isGogConfigured } from './lib/gog.js';
import { isEpicConfigured } from './lib/epic.js';
import { isUplayConfigured, parseUplayLoginPayload } from './lib/uplay.js';

const PROVIDER_CREDENTIAL_ENV_VARS = ['GOG_REFRESH_TOKEN', 'EPIC_REFRESH_TOKEN', 'UPLAY_REMEMBER_ME_TICKET', 'UPLAY_USER_ID'];

// These vars may legitimately be set in a developer's local .env once they've run
// `npm run login:gog` / `login:epic` / `login:uplay`. Tests that specifically exercise
// the "unconfigured" fallback path stub them out for their duration so they stay
// deterministic regardless of local .env contents.
function withoutProviderCredentials(fn) {
  return async () => {
    const saved = {};
    for (const key of PROVIDER_CREDENTIAL_ENV_VARS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    try {
      await fn();
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };
}

describe('server helper functions', () => {
  it('normalizes page values to integer >= 1', () => {
    assert.strictEqual(normalizePageValue('3'), 3);
    assert.strictEqual(normalizePageValue('0'), 1);
    assert.strictEqual(normalizePageValue('-5'), 1);
    assert.strictEqual(normalizePageValue('abc'), 1);
  });

  it('normalizes page sizes within allowed bounds', () => {
    assert.strictEqual(normalizePageSizeValue('12'), 12);
    assert.strictEqual(normalizePageSizeValue('0'), 24);
    assert.strictEqual(normalizePageSizeValue('-1'), 24);
    assert.strictEqual(normalizePageSizeValue('1000'), 100);
    assert.strictEqual(normalizePageSizeValue('abc'), 24);
  });

  it('sorts games by playtime descending by default', () => {
    const games = [
      { name: 'A', playtime_forever: 10 },
      { name: 'B', playtime_forever: 50 },
      { name: 'C', playtime_forever: 30 }
    ];
    const sorted = sortGames([...games], 'playtime-desc');
    assert.deepStrictEqual(sorted.map((g) => g.name), ['B', 'C', 'A']);
  });

  it('sorts games by name ascending', () => {
    const games = [
      { name: 'Zulu', playtime_forever: 10 },
      { name: 'Alpha', playtime_forever: 50 }
    ];
    const sorted = sortGames([...games], 'name-asc');
    assert.deepStrictEqual(sorted.map((g) => g.name), ['Alpha', 'Zulu']);
  });

  it('filters games case-insensitively', () => {
    const games = [
      { name: 'Fortnite' },
      { name: 'Rocket League' },
      { name: 'Hades' }
    ];
    const filtered = filterGames(games, 'rock');
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].name, 'Rocket League');
  });

  it('creates paginated game responses', () => {
    const provider = { id: 'test' };
    const games = Array.from({ length: 10 }, (_, index) => ({
      appid: index + 1,
      name: `Game ${index + 1}`,
      playtime_forever: index * 10,
      playtime_2weeks: 0
    }));

    const result = createGamesResponse(games, 2, 4, provider);
    assert.strictEqual(result.page, 2);
    assert.strictEqual(result.pageSize, 4);
    assert.strictEqual(result.totalPages, 3);
    assert.strictEqual(result.totalGames, 10);
    assert.strictEqual(result.games.length, 4);
    assert.strictEqual(result.games[0].appid, 5);
  });

  it('converts games response to XML safely', () => {
    const provider = { id: 'test' };
    const games = [
      { appid: '<1>', name: 'Game & One', playtime_forever: 120, playtime_2weeks: 5, header_image: 'image.jpg', store_link: 'http://store', provider: 'test' }
    ];
    const xml = convertGamesResponseToXml(createGamesResponse(games, 1, 24, provider));
    assert.ok(xml.includes('<provider>test</provider>'));
    assert.ok(xml.includes('&lt;1&gt;'));
    assert.ok(xml.includes('Game &amp; One'));
  });

  it('returns fallback Epic achievements when no external Epic API is configured', async () => {
    const achievements = await fetchEpicAchievements('fortnite');
    assert.ok(Array.isArray(achievements));
    assert.ok(achievements.length > 0);
    assert.strictEqual(achievements[0].apiname, 'first_play');
    assert.strictEqual(typeof achievements[0].achieved, 'boolean');
  });

  it('returns fallback GOG achievements when no GOG refresh token is configured', withoutProviderCredentials(async () => {
    assert.strictEqual(isGogConfigured(), false);
    const achievements = await fetchGogAchievementsForAppid('the-witcher-3-wild-hunt');
    assert.ok(Array.isArray(achievements));
    assert.ok(achievements.length > 0);
    assert.strictEqual(typeof achievements[0].achieved, 'boolean');
  }));

  it('reports Epic as unconfigured without an EPIC_REFRESH_TOKEN', withoutProviderCredentials(() => {
    assert.strictEqual(isEpicConfigured(), false);
  }));

  it('reports Uplay as unconfigured without UPLAY_REMEMBER_ME_TICKET/UPLAY_USER_ID', withoutProviderCredentials(() => {
    assert.strictEqual(isUplayConfigured(), false);
  }));

  it('parses a pasted Ubisoft PRODloginData payload and rejects incomplete ones', () => {
    const parsed = parseUplayLoginPayload(JSON.stringify({
      ticket: 't-1',
      rememberMeTicket: 'rmt-1',
      sessionId: 's-1',
      userId: 'u-1',
      nameOnPlatform: 'PlayerOne'
    }));
    assert.strictEqual(parsed.userId, 'u-1');
    assert.strictEqual(parsed.nameOnPlatform, 'PlayerOne');

    assert.throws(() => parseUplayLoginPayload(JSON.stringify({ ticket: 't-1' })));
  });

  it('normalizes a GOG achievement payload, deriving unlock state from date_unlocked', () => {
    const unlocked = normalizeGogAchievement({
      achievement_key: 'ach_finish_game',
      name: 'Finish the Game',
      description: 'Complete the main story',
      date_unlocked: '2024-01-15T12:00:00Z',
      image_url_unlocked: 'https://example.com/unlocked.jpg',
      image_url_locked: 'https://example.com/locked.jpg'
    });
    assert.strictEqual(unlocked.apiname, 'ach_finish_game');
    assert.strictEqual(unlocked.achieved, true);
    assert.strictEqual(unlocked.badgeimage, 'https://example.com/unlocked.jpg');
    assert.ok(unlocked.unlocktime > 0);

    const locked = normalizeGogAchievement({
      achievement_key: 'ach_hidden',
      name: 'Hidden',
      image_url_locked: 'https://example.com/locked.jpg'
    });
    assert.strictEqual(locked.achieved, false);
    assert.strictEqual(locked.badgeimage, 'https://example.com/locked.jpg');
    assert.strictEqual(locked.unlocktime, 0);
  });

  it('falls back to sample GOG/Epic/Uplay games when no credentials are configured', withoutProviderCredentials(async () => {
    for (const provider of ['gog', 'epic', 'uplay']) {
      const req = { query: { provider } };
      const res = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        type() { return this; },
        send(payload) { this.body = payload; return this; }
      };

      await getApiGames(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.provider, provider);
      assert.ok(Array.isArray(res.body.games));
      assert.ok(res.body.games.length > 0);
    }
  }));

  it('builds a Steam-style achievement icon URL when no direct badge image is provided', () => {
    const badgeImage = resolveAchievementBadgeImage({ apiname: 'ach_1' }, '730');
    assert.ok(badgeImage.includes('steamcommunity/public/images/apps/730/ach_1.jpg'));
  });

  it('updates a user role through the auth helper', () => {
    const username = `admin-test-${Date.now()}`;
    const created = auth.createUser({ username, password: 'secret123', role: 'user', displayName: 'Admin Test' });
    const updated = auth.updateUserRole(created.id, 'admin');

    assert.ok(updated);
    assert.strictEqual(updated.role, 'admin');
    assert.ok(auth.listUsers().some((user) => Number(user.id) === Number(created.id) && user.role === 'admin'));
  });

  it('can look up a newly created user immediately without async initialization races', () => {
    const username = `lookup-test-${Date.now()}`;
    const created = auth.createUser({ username, password: 'secret123', role: 'user', displayName: 'Lookup Test' });
    const lookup = auth.getUserWithHashByUsername(username);

    assert.ok(created);
    assert.ok(lookup);
    assert.strictEqual(lookup.username, username);
  });

  it('uses provider trailer data when available and falls back to the sample trailer otherwise', () => {
    const provider = { id: 'steam' };
    const withTrailer = getVideoTrailerData(provider, { trailer_url: 'https://example.com/steam-trailer.mp4' });
    assert.strictEqual(withTrailer.videoUrl, 'https://example.com/steam-trailer.mp4');

    const fallback = getVideoTrailerData(provider, {});
    assert.ok(fallback.videoUrl.includes('stream.mux.com'));
  });

  it('resolves the real Steam movie video URL instead of leaking the thumbnail image as the video src', () => {
    const provider = { id: 'steam' };
    // Current Steam appdetails responses only expose hls_h264/dash_h264 manifests plus a thumbnail image
    // (no more direct webm/mp4 files) - the thumbnail must never end up as the video src.
    const trailer = getVideoTrailerData(provider, {
      appid: 570,
      movies: [
        {
          thumbnail: 'https://example.com/570/trailer-thumb.jpg',
          hls_h264: 'https://example.com/570/hls_264_master.m3u8',
          dash_h264: 'https://example.com/570/dash_h264.mpd'
        }
      ]
    });

    assert.strictEqual(trailer.videoUrl, 'https://example.com/570/hls_264_master.m3u8');
    assert.strictEqual(trailer.thumbnailUrl, 'https://example.com/570/trailer-thumb.jpg');
  });

  it('combines game library data with a Steam header image response', async () => {
    const axios = (await import('axios')).default;
    const originalGet = axios.get;

    axios.get = async (url) => {
      if (url.includes('store.steampowered.com/api/appdetails')) {
        const appid = url.split('appids=')[1];
        return {
          data: {
            [appid]: {
              data: {
                header_image: 'https://example.com/header.jpg?t=1'
              }
            }
          }
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const req = {
      query: {
        provider: 'epic',
        appid: 'fortnite'
      }
    };

    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      }
    };

    await getMixedDataGameHeader(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.body);
    assert.strictEqual(res.body.game.appid, 'fortnite');
    assert.strictEqual(res.body.headerImage.header_image, 'https://example.com/header.jpg?t=1');

    axios.get = originalGet;
  });

  it('refreshes Steam games with the real trailer video and thumbnail from appdetails', async () => {
    const axios = (await import('axios')).default;
    const originalGet = axios.get;
    const originalKey = process.env.STEAM_API_KEY;
    const originalUserId = process.env.STEAM_USER_ID;

    process.env.STEAM_API_KEY = 'test-key';
    process.env.STEAM_USER_ID = 'test-user';

    axios.get = async (url) => {
      if (url.includes('IPlayerService/GetOwnedGames')) {
        return {
          data: {
            response: {
              games: [
                { appid: 570, name: 'Dota 2', playtime_forever: 100, playtime_2weeks: 10, rtime_last_played: 12345 }
              ]
            }
          }
        };
      }

      if (url.includes('store.steampowered.com/api/appdetails')) {
        const appid = url.split('appids=')[1];
        return {
          data: {
            [appid]: {
              data: {
                header_image: 'https://example.com/570/header.jpg',
                movies: [
                  {
                    thumbnail: 'https://example.com/570/trailer-thumb.jpg',
                    mp4: { max: 'https://example.com/570/trailer.mp4' }
                  }
                ]
              }
            }
          }
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const req = { query: {} };
    const res = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      }
    };

    await getApiGames(req, res);

    const game = res.body.games.find((g) => String(g.appid) === '570');
    assert.ok(game);
    assert.strictEqual(game.video_url, 'https://example.com/570/trailer.mp4');
    assert.strictEqual(game.video_thumbnail, 'https://example.com/570/trailer-thumb.jpg');
    assert.strictEqual(game.trailer_url, 'https://example.com/570/trailer.mp4');
    assert.strictEqual(game.trailer_thumbnail, 'https://example.com/570/trailer-thumb.jpg');

    axios.get = originalGet;
    process.env.STEAM_API_KEY = originalKey;
    process.env.STEAM_USER_ID = originalUserId;
  });
});
