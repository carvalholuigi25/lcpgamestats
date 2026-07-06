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
  getMixedDataGameHeader
} from './server.js';

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
});
