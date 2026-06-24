/**
 * Steam Game Library — Frontend Application
 * Fetches data from local Express API (/api/player, /api/games)
 * and renders an interactive, searchable, sortable game library.
 */

(() => {
  const state = {
    games: [],
    filtered: [],
    view: 'grid', // 'grid' | 'list'
    theme: 'dark',
    lang: 'en',
    provider: 'steam',
    search: '',
    sortBy: 'playtime-desc',
    page: 1,
    pageSize: 24,
    totalPages: 1,
    totalGames: 0,
    totalMinutes: 0,
    recentlyPlayed: 0,
    topGames: []
  };

  const translations = {
    en: {
      appTitle: 'LCPGameStats',
      loadingLibrary: 'Fetching your game library from Steam...',
      emptySearch: 'No games match your search.',
      emptyLibrary: 'No games found in this library.',
      providerInfo: 'Use provider switcher to preview non-Steam sample libraries.',
      totalGames: 'Total Games',
      totalHours: 'Total Hours',
      playedRecently: 'Played Recently',
      mostPlayed: 'Most Played',
      totalPlaytime: 'Total Playtime',
      last2Weeks: 'Last 2 Weeks',
      viewOnStore: 'View on Store',
      achievements: 'Achievements',
      noAchievements: 'No achievements are available for this game.',
      loadingAchievements: 'Loading achievements...',
      achievementsStatus: 'Unlocked {unlocked} of {total}'
    },
    es: {
      appTitle: 'LCPGameStats',
      loadingLibrary: 'Obteniendo tu biblioteca de juegos...',
      emptySearch: 'Ningún juego coincide con tu búsqueda.',
      emptyLibrary: 'No se encontraron juegos en esta biblioteca.',
      providerInfo: 'Usa el selector de plataforma para ver bibliotecas de muestra.',
      totalGames: 'Juegos Totales',
      totalHours: 'Horas Totales',
      playedRecently: 'Jugados Recientemente',
      mostPlayed: 'Más Jugado',
      totalPlaytime: 'Tiempo Total',
      last2Weeks: 'Últimas 2 Semanas',
      viewOnStore: 'Ver en la Tienda',
      achievements: 'Logros',
      noAchievements: 'No hay logros disponibles para este juego.',
      loadingAchievements: 'Cargando logros...',
      achievementsStatus: 'Desbloqueados {unlocked} de {total}'
    }
  };

  const els = {
    loading: document.getElementById('loading-state'),
    loadingText: document.getElementById('loading-text'),
    error: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    empty: document.getElementById('empty-state'),
    emptyText: document.getElementById('empty-state-text'),
    container: document.getElementById('games-container'),
    playerName: document.getElementById('player-name'),
    playerCard: document.getElementById('player-card'),
    playerAvatar: document.getElementById('player-avatar'),
    playerCardName: document.getElementById('player-card-name'),
    playerProfileLink: document.getElementById('player-profile-link'),
    searchInput: document.getElementById('search-input'),
    sortSelect: document.getElementById('sort-select'),
    providerSelect: document.getElementById('provider-select'),
    pageSizeSelect: document.getElementById('page-size-select'),
    paginationControls: document.getElementById('pagination-controls'),
    pageInfo: document.getElementById('page-info'),
    panelChart: document.querySelectorAll('.mchartstats')[0],
    chartContainer: document.getElementById('stats-chart'),
    showChartBtn: document.querySelectorAll('.btnshowstats')[0],
    exportJsonBtn: document.getElementById('export-json'),
    exportXmlBtn: document.getElementById('export-xml'),
    modalAchievementsTitle: document.getElementById('modalAchievementsTitle'),
    modalAchievementsStatus: document.getElementById('modalAchievementsStatus'),
    modalAchievements: document.getElementById('modalAchievements'),
    themeSelect: document.getElementById('theme-select'),
    langSelect: document.getElementById('lang-select'),
    providerInfoText: document.getElementById('provider-info-text'),
    labelTotalGames: document.getElementById('label-total-games'),
    labelTotalHours: document.getElementById('label-total-hours'),
    labelRecentGames: document.getElementById('label-recent-games'),
    labelTopGame: document.getElementById('label-top-game'),
    viewGridBtn: document.getElementById('view-grid'),
    viewListBtn: document.getElementById('view-list'),
    statTotalGames: document.getElementById('stat-total-games'),
    statTotalHours: document.getElementById('stat-total-hours'),
    statRecentGames: document.getElementById('stat-recent-games'),
    statTopGame: document.getElementById('stat-top-game'),
    modalGameTitle: document.getElementById('modalGameTitle'),
    modalGameImage: document.getElementById('modalGameImage'),
    modalPlaytime: document.getElementById('modalPlaytime'),
    modalRecent: document.getElementById('modalRecent'),
    modalStoreLink: document.getElementById('modalStoreLink')
  };

  let gameModal;

  /** Convert minutes to a human-readable "Xh Ym" or "Xh" string */
  function formatPlaytime(minutes) {
    if (!minutes || minutes <= 0) return 'Never played';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  function formatHoursShort(minutes) {
    return (minutes / 60).toFixed(1);
  }

  function showStats() {
    if(els.showChartBtn) {
      els.showChartBtn.onclick = (e) => {
        e.preventDefault();
        els.panelChart.classList.toggle("hidden");
        els.showChartBtn.textContent = !els.panelChart.classList.contains("hidden") ? "Hide" : "Show";
      }
    }
  }

  /** Fetch player profile and populate header */
  async function loadPlayer() {
    try {
      const res = await fetch(`/api/player?provider=${encodeURIComponent(state.provider)}`);
      if (!res.ok) throw new Error('Failed to load profile');
      const player = await res.json();

      els.playerName.textContent = player.personaname || 'Library User';
      els.playerCardName.textContent = player.personaname || 'Library User';
      els.playerAvatar.src = player.avatarfull || player.avatarmedium || '/images/notfound.jpg';
      els.playerAvatar.onerror = () => { els.playerAvatar.onerror = null; els.playerAvatar.src = '/images/notfound.jpg'; };
      els.playerProfileLink.href = player.profileurl || '#';
      els.playerCard.classList.remove('d-none');
    } catch (err) {
      els.playerName.textContent = 'Game Library';
      console.warn('Could not load player profile:', err.message);
    }
  }

  /** Fetch the owned games list */
  async function loadGames() {
    els.loading.classList.remove('d-none');
    els.error.classList.add('d-none');
    els.empty.classList.add('d-none');

    try {
      const params = new URLSearchParams({
        provider: state.provider,
        search: state.search,
        sortBy: state.sortBy,
        page: String(state.page),
        pageSize: String(state.pageSize)
      });

      const res = await fetch(`/api/games?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load games');
      }

      state.games = data.games || [];
      state.topGames = data.topGames || [];
      state.totalGames = data.totalGames || 0;
      state.totalPages = data.totalPages || 1;
      state.totalMinutes = data.totalMinutes || 0;
      state.recentlyPlayed = data.recentlyPlayed || 0;
      state.page = data.page || state.page;

      els.loading.classList.add('d-none');

      if (state.games.length === 0) {
        renderPagination();
        showEmpty(true);
        return;
      }

      updateStats();
      renderStatsChart();
      renderPagination();
      renderGames();
    } catch (err) {
      els.loading.classList.add('d-none');
      els.error.classList.remove('d-none');
      els.errorMessage.textContent = err.message || 'Unable to load games.';
    }
  }

  /** Update the top stats bar */
  function updateStats() {
    const totalGames = state.totalGames || state.games.length;
    const totalMinutes = state.totalMinutes || state.games.reduce((sum, g) => sum + g.playtime_forever, 0);
    const recentlyPlayed = state.recentlyPlayed || state.games.filter((g) => g.playtime_2weeks > 0).length;
    const topGame = state.games.reduce((best, game) => {
      if (!best || game.playtime_forever > best.playtime_forever) {
        return game;
      }
      return best;
    }, null);

    els.statTotalGames.textContent = totalGames.toLocaleString();
    els.statTotalHours.textContent = formatHoursShort(totalMinutes);
    els.statRecentGames.textContent = recentlyPlayed.toLocaleString();
    els.statTopGame.textContent = topGame ? topGame.name : '--';
    els.statTopGame.title = topGame ? topGame.name : '';
  }

  function renderStatsChart() {
    const games = (state.topGames && state.topGames.length)
      ? [...state.topGames]
      : [...state.games].sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 5);
    if (!games.length) {
      els.chartContainer.innerHTML = '<div class="text-muted small">No data available for chart.</div>';
      return;
    }

    const maxPlaytime = Math.max(...games.map((game) => game.playtime_forever), 1);
    els.chartContainer.innerHTML = games.map((game) => {
      const width = Math.max(6, Math.round((game.playtime_forever / maxPlaytime) * 100));
      return `
        <div class="stats-chart__row">
          <div class="stats-chart__meta">
            <span class="stats-chart__label" title="${escapeHtml(game.name)}">${escapeHtml(game.name)}</span>
            <span class="stats-chart__value">${formatHoursShort(game.playtime_forever)}h</span>
          </div>
          <div class="stats-chart__bar-wrap">
            <div class="stats-chart__bar" style="width: ${width}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  function renderPagination() {
    els.paginationControls.innerHTML = '';

    if (state.totalPages <= 1) {
      els.pageInfo.textContent = `Showing ${state.games.length} of ${state.totalGames} games`;
      return;
    }

    const createPageItem = (pageNumber, label, active = false, disabled = false) => {
      const li = document.createElement('li');
      li.className = `page-item${active ? ' active' : ''}${disabled ? ' disabled' : ''}`;
      li.innerHTML = `<button class="page-link" type="button">${label}</button>`;
      if (!disabled) {
        li.querySelector('button').addEventListener('click', () => changePage(pageNumber));
      }
      return li;
    };

    els.paginationControls.appendChild(createPageItem(1, '« First', state.page === 1, state.page === 1));
    els.paginationControls.appendChild(createPageItem(state.page - 1, '‹ Prev', false, state.page === 1));

    const startPage = Math.max(1, state.page - 2);
    const endPage = Math.min(state.totalPages, state.page + 2);

    for (let page = startPage; page <= endPage; page += 1) {
      els.paginationControls.appendChild(createPageItem(page, page, state.page === page));
    }

    els.paginationControls.appendChild(createPageItem(state.page + 1, 'Next ›', false, state.page === state.totalPages));
    els.paginationControls.appendChild(createPageItem(state.totalPages, 'Last »', false, state.page === state.totalPages));

    const firstResult = (state.page - 1) * state.pageSize + 1;
    const lastResult = Math.min(state.page * state.pageSize, state.totalGames);
    els.pageInfo.textContent = `Showing ${firstResult}–${lastResult} of ${state.totalGames} games`;
  }

  /** Apply current search + sort settings and reload page data */
  function applyFiltersAndSort() {
    state.search = els.searchInput.value.trim();
    state.sortBy = els.sortSelect.value;
    state.page = 1;
    loadGames();
  }

  function changePage(newPage) {
    if (newPage < 1 || newPage > state.totalPages || newPage === state.page) return;
    state.page = newPage;
    loadGames();
  }

  /** Render the games list into the DOM */
  function renderGames() {
    els.container.innerHTML = '';

    if (state.games.length === 0) {
      showEmpty(true);
      return;
    }
    showEmpty(false);

    const fragment = document.createDocumentFragment();

    state.games.forEach((game, index) => {
      const col = document.createElement('div');
      col.className = state.view === 'grid'
        ? 'col-12 col-sm-6 col-md-4 col-lg-3 game-card-col'
        : 'game-card-col';
      col.style.animationDelay = `${Math.min(index * 0.03, 0.6)}s`;

      const recentBadge = game.playtime_2weeks > 0
        ? `<span class="game-card__recent-badge">Playing</span>`
        : '';

      col.innerHTML = `
        <div class="game-card" data-appid="${getGameId(game)}">
          <div class="game-card__image">
            <img
              src="${game.header_image || '/images/notfound.jpg'}"
              alt="${escapeHtml(game.name)}"
              loading="lazy"
              onerror="this.onerror=null;this.src='/images/notfound.jpg';"
            />
            ${recentBadge}
          </div>
          <div class="game-card__body">
            <div class="game-card__title" title="${escapeHtml(game.name)}">${escapeHtml(game.name)}</div>
            <div class="game-card__meta">
              <span class="game-card__playtime">
                <i class="fa-solid fa-clock"></i> ${formatPlaytime(game.playtime_forever)}
              </span>
              ${game.playtime_2weeks > 0
                ? `<span class="text-success">+${formatPlaytime(game.playtime_2weeks)} (2wk)</span>`
                : ''}
            </div>
          </div>
        </div>
      `;

      col.querySelector('.game-card').addEventListener('click', () => openModal(game));
      fragment.appendChild(col);
    });

    els.container.appendChild(fragment);
  }

  /** Show/hide the "no results" empty state */
  function showEmpty(show, message) {
    if (show) {
      els.empty.classList.remove('d-none');
      els.error.classList.add('d-none');
      const text = message || (els.searchInput.value.trim()
        ? translations[state.lang].emptySearch
        : translations[state.lang].emptyLibrary);
      els.emptyText.textContent = text;
    } else {
      els.empty.classList.add('d-none');
    }
  }

  function getGameId(game) {
    return game.provider === "retroachievements" ? game.appid : (game.GameID || game.gameId || game.GameId || game.id);
  }

  /** Open the game detail modal */
  function openModal(game) {
    els.modalGameTitle.textContent = game.name;
    els.modalGameImage.src = game.header_image || '/images/notfound.jpg';
    els.modalGameImage.alt = game.name;
    els.modalGameImage.onerror = () => { els.modalGameImage.onerror = null; els.modalGameImage.src = '/images/notfound.jpg'; };
    els.modalPlaytime.textContent = formatPlaytime(game.playtime_forever);
    els.modalRecent.textContent = formatPlaytime(game.playtime_2weeks);
    const achievementId = getGameId(game);
    els.modalStoreLink.href = game.store_link || (state.provider === 'retroachievements'
      ? `https://retroachievements.org/game/${encodeURIComponent(achievementId)}`
      : `https://store.steampowered.com/app/${encodeURIComponent(game.appid)}`);
    els.modalStoreLink.textContent = translations[state.lang].viewOnStore;

    els.modalAchievementsTitle.textContent = translations[state.lang].achievements;
    els.modalAchievementsStatus.textContent = translations[state.lang].loadingAchievements;
    els.modalAchievements.innerHTML = `<div class="text-center text-muted small">${translations[state.lang].loadingAchievements}</div>`;

    gameModal.show();
    loadGameAchievements(achievementId);
  }

  async function loadGameAchievements(appid) {
    try {
      const res = await fetch(`/api/achievements?provider=${encodeURIComponent(state.provider)}&appid=${encodeURIComponent(appid)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load achievements');
      }

      renderAchievements(data.achievements || data["achievements"] || [], data);
    } catch (err) {
      els.modalAchievements.innerHTML = `<div class="text-danger small">${escapeHtml(err.message || translations[state.lang].noAchievements)}</div>`;
      els.modalAchievementsStatus.textContent = translations[state.lang].noAchievements;
    }
  }

  function renderAchievements(achievements = [], summary = {}) {
    els.modalAchievementsTitle.textContent = translations[state.lang].achievements;
    const total = summary.total || achievements.length;
    const unlocked = summary.unlocked || achievements.filter((a) => a.achieved).length;
    els.modalAchievementsStatus.textContent = translations[state.lang].achievementsStatus
      .replace('{unlocked}', unlocked)
      .replace('{total}', total);

    if (achievements.length === 0) {
      els.modalAchievements.innerHTML = `<div class="text-center text-muted small">${translations[state.lang].noAchievements}</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    achievements.forEach((achievement) => {
      const item = document.createElement('div');
      item.className = 'list-group-item list-group-item-dark d-flex justify-content-between align-items-start';
      item.innerHTML = `
      <div class="w-100">
        <div class="row justify-content-center align-items-center text-start">
          <div class="col-12 col-md-2 col-lg-1 achbadge">
            <img src="${achievement.badgeimage}" onerror="this.onerror=null;this.src='/images/notfound.jpg';" class="img-fluid imgbadge" width="50" height="50" alt="${achievement.title}" title="${achievement.title}" />
          </div>
          <div class="col-12 col-md-10 col-lg-11 achinfo">
            <div>
              <div class="fw-semibold">${escapeHtml(achievement.name)}</div>
              <div class="small text-muted">${escapeHtml(achievement.description || '')}</div>
            </div>
            <span class="badge rounded-pill ${achievement.achieved ? 'bg-success' : 'bg-secondary'}">
              ${achievement.achieved ? 'Unlocked' : 'Locked'}
            </span>
          </div>
        </div>
      </div>
      `;
      fragment.appendChild(item);
    });

    els.modalAchievements.innerHTML = '';
    els.modalAchievements.appendChild(fragment);
  }

  function setTheme(theme) {
    state.theme = theme;
    document.body.classList.toggle('theme-light', theme === 'light');
    document.documentElement.dataset.bsTheme = theme;
  }

  function setLanguage(lang) {
    state.lang = lang;
    updateInterfaceLanguage();
    renderGames();
  }

  function setProvider(provider) {
    state.provider = provider;
    state.page = 1;
    loadPlayer();
    loadGames();
  }

  function buildExportUrl(format) {
    const params = new URLSearchParams({
      provider: state.provider,
      search: state.search,
      sortBy: state.sortBy,
      page: String(state.page),
      pageSize: String(state.pageSize),
      format
    });
    return `/api/games?${params.toString()}`;
  }

  function downloadExport(format) {
    const anchor = document.createElement('a');
    anchor.href = buildExportUrl(format);
    anchor.download = `games-${state.provider}-${format}.` + format;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function updateInterfaceLanguage() {
    const t = translations[state.lang];
    document.title = t.appTitle;
    document.getElementById('app-title').textContent = t.appTitle;
    els.loadingText.textContent = t.loadingLibrary;
    els.providerInfoText.textContent = t.providerInfo;
    els.labelTotalGames.textContent = t.totalGames;
    els.labelTotalHours.textContent = t.totalHours;
    els.labelRecentGames.textContent = t.playedRecently;
    els.labelTopGame.textContent = t.mostPlayed;
    els.modalStoreLink.textContent = t.viewOnStore;

    if (els.empty.classList.contains('d-none') === false) {
      const message = els.searchInput.value.trim()
        ? t.emptySearch
        : translations[state.lang].emptyLibrary;
      els.emptyText.textContent = message;
    }
  }

  function setView(view) {
    state.view = view;
    els.container.classList.toggle('list-view', view === 'list');
    els.viewGridBtn.classList.toggle('active', view === 'grid');
    els.viewListBtn.classList.toggle('active', view === 'list');
    renderGames();
  }

  /** Basic HTML escaping for game titles */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Debounce helper for the search input */
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function init() {
    gameModal = new bootstrap.Modal(document.getElementById('gameModal'));

    els.searchInput.addEventListener('input', debounce(applyFiltersAndSort, 200));
    els.sortSelect.addEventListener('change', applyFiltersAndSort);
    els.providerSelect.addEventListener('change', (event) => setProvider(event.target.value));
    els.pageSizeSelect.addEventListener('change', (event) => {
      state.pageSize = Number(event.target.value);
      state.page = 1;
      loadGames();
    });
    els.themeSelect.addEventListener('change', (event) => setTheme(event.target.value));
    els.langSelect.addEventListener('change', (event) => setLanguage(event.target.value));
    els.exportJsonBtn.addEventListener('click', () => downloadExport('json'));
    els.exportXmlBtn.addEventListener('click', () => downloadExport('xml'));
    els.viewGridBtn.addEventListener('click', () => setView('grid'));
    els.viewListBtn.addEventListener('click', () => setView('list'));

    setTheme(state.theme);
    setLanguage(state.lang);
    els.providerSelect.value = state.provider;
    els.pageSizeSelect.value = String(state.pageSize);
    els.themeSelect.value = state.theme;
    els.langSelect.value = state.lang;

    loadPlayer();
    loadGames();
    showStats();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
