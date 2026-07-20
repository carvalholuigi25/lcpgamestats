/**
 * Steam Game Library — Frontend Application
 * Fetches data from local Express API (/api/player, /api/games)
 * and renders an interactive, searchable, sortable game library.
 */

import { fetchTranslations, getVideoStuff } from './functions.js';

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
    topGames: [],
    showVideo: true,
    showAchievements: true,
    achievementsStatusFilter: 'all',
    achievementsDateSort: 'desc',
    activeGame: null
  };

  let currentAchievements = [];
  let currentAchievementsSummary = {};

  let translations = {};

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
    achievementsStatusFilter: document.getElementById('achievements-status-filter'),
    achievementsDateSort: document.getElementById('achievements-date-sort'),
    themeSelect: document.getElementById('theme-select'),
    langSelectBtn: document.getElementById('lang-select-btn'),
    langSelectFlag: document.getElementById('lang-select-flag'),
    langSelectLabel: document.getElementById('lang-select-label'),
    langSelectItems: document.querySelectorAll('#lang-select-btn + .dropdown-menu [data-lang]'),
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
    modalStoreLink: document.getElementById('modalStoreLink'),
    clearfilter: document.querySelectorAll('.clearfilter')[0],
    bgImageInput: document.getElementById('bg-image-input'),
    applyBgBtn: document.getElementById('apply-bg-btn'),
    clearBgBtn: document.getElementById('clear-bg-btn'),
    bgFileInput: document.getElementById('bg-file-input'),
    uploadBgBtn: document.getElementById('upload-bg-btn'),
    bkgControls: document.getElementById('background-controls'),
    videoContainer: document.getElementById('video-container'),
    toggleVideoBtn: document.getElementById('toggle-video-btn'),
    toggleAchievementsBtn: document.getElementById('toggle-achievements-btn')
  };

  // Auth-related elements
  els.btnLogin = document.getElementById('btn-login');
  els.btnRegister = document.getElementById('btn-register');
  els.btnAdmin = document.getElementById('btn-admin');
  els.btnLogout = document.getElementById('btn-logout');
  els.headerUsername = document.getElementById('header-username');
  els.loginModalEl = document.getElementById('loginModal');
  els.registerModalEl = document.getElementById('registerModal');
  els.loginForm = document.getElementById('login-form');
  els.registerForm = document.getElementById('register-form');
  els.loginError = document.getElementById('login-error');
  els.registerError = document.getElementById('register-error');

  els.themeCodeModalEl = document.getElementById('themeCodeModal');
  els.themeCodeForm = document.getElementById('theme-code-form');
  els.themeCodeInput = document.getElementById('theme-code-input');
  els.themeCodeError = document.getElementById('theme-code-error');
  els.themeCodeModalTitle = document.getElementById('themeCodeModalTitle');
  els.themeCodeInputLabel = document.getElementById('themeCodeInputLabel');
  els.themeCodeHint = document.getElementById('themeCodeHint');
  els.themeToastEl = document.getElementById('themeToast');
  els.themeToastBody = document.getElementById('themeToastBody');
  els.wandEffectEl = document.getElementById('wandEffect');
  els.spellFlashEl = document.getElementById('spellFlash');

  let gameModal;
  let loginModal, registerModal, themeCodeModal, themeToast;
  let themeCodeModalTransitioning = false;
  let spellEffectTimeout;
  let currentUser = null;

  const THEME_CODES = {
    nox: 'dark',
    dark: 'dark',
    lumos: 'light',
    light: 'light',
    liquidglass: 'liquid',
    glassmorphism: 'glassmorphism'
  };
  const THEME_CODES_SETTING_KEY = 'themeCodesEnabled';
  const THEME_CODE_SESSION_KEY = 'themeCodeTheme';

  function isThemeCodesEnabled() {
    const saved = localStorage.getItem(THEME_CODES_SETTING_KEY);
    return saved === null ? true : saved !== 'false';
  }

  function resolveThemeCode(rawCode) {
    const code = String(rawCode || '').trim().toLowerCase();
    return THEME_CODES[code] || null;
  }

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  function openThemeCodeModal() {
    if (els.themeCodeError) els.themeCodeError.classList.add('d-none');
    if (els.themeCodeInput) els.themeCodeInput.value = '';
    themeCodeModal.show();
    if (els.themeCodeInput) els.themeCodeInput.focus();
  }

  function closeThemeCodeModal() {
    // Bootstrap ignores hide() while the show transition is still in-flight
    // (e.g. code typed and submitted right after opening the modal via 'c').
    if (themeCodeModalTransitioning) {
      els.themeCodeModalEl.addEventListener('shown.bs.modal', () => themeCodeModal.hide(), { once: true });
      return;
    }
    themeCodeModal.hide();
  }

  function toggleThemeCodeModal() {
    const isOpen = els.themeCodeModalEl && els.themeCodeModalEl.classList.contains('show');
    if (isOpen) {
      closeThemeCodeModal();
    } else {
      openThemeCodeModal();
    }
  }

  function submitThemeCode() {
    const rawCode = els.themeCodeInput && els.themeCodeInput.value;
    const theme = resolveThemeCode(rawCode);
    if (!theme) {
      if (els.themeCodeError) {
        els.themeCodeError.textContent = translations.invalidThemeCode || 'Unknown theme code.';
        els.themeCodeError.classList.remove('d-none');
      }
      showThemeToast(translations.invalidThemeCode || 'Unknown theme code.', false);
      return;
    }
    castThemeSpell(rawCode);
    setTheme(theme);
    if (els.themeSelect) els.themeSelect.value = theme;
    sessionStorage.setItem(THEME_CODE_SESSION_KEY, theme);
    closeThemeCodeModal();
    showThemeToast(getThemeActivatedMessage(theme), true);
  }

  /** Play the wand spell animation for the classic "lumos"/"nox" incantations. */
  function castThemeSpell(rawCode) {
    const code = String(rawCode || '').trim().toLowerCase();
    if (code === 'lumos') playSpellEffect('lumos');
    else if (code === 'nox') playSpellEffect('nox');
  }

  function playSpellEffect(kind) {
    if (!els.wandEffectEl) return;
    const wandClass = kind === 'lumos' ? 'lumos-cast' : 'nox-cast';
    const flashClass = kind === 'lumos' ? 'lumos-flash' : 'nox-flash';

    els.wandEffectEl.classList.remove('lumos-cast', 'nox-cast');
    if (els.spellFlashEl) els.spellFlashEl.classList.remove('lumos-flash', 'nox-flash');
    // Force reflow so the animation restarts even if the same spell is cast again quickly.
    void els.wandEffectEl.offsetWidth;
    els.wandEffectEl.classList.add(wandClass);
    if (els.spellFlashEl) els.spellFlashEl.classList.add(flashClass);

    clearTimeout(spellEffectTimeout);
    spellEffectTimeout = setTimeout(() => {
      els.wandEffectEl.classList.remove(wandClass);
      if (els.spellFlashEl) els.spellFlashEl.classList.remove(flashClass);
    }, 1400);
  }

  function getThemeActivatedMessage(theme) {
    const themeLabel = translations[theme] || theme;
    const template = translations.themeActivated || '{theme} theme activated!';
    return template.replace('{theme}', themeLabel);
  }

  function showThemeToast(message, success = true) {
    if (!els.themeToastBody) return;
    els.themeToastBody.textContent = message;
    if (els.themeToastEl) els.themeToastEl.classList.toggle('text-danger', !success);
    if (themeToast) {
      themeToast.show();
    }
  }

  function getDefaultFetchOptions(overrides = {}) {
    return {
      credentials: 'include',
      headers: { 'Accept': 'application/json', ...(overrides.headers || {}) },
      ...overrides
    };
  }

  function updateAuthUI() {
    if (currentUser) {
      const urluser = currentUser.role === 'admin' ? 'admin' : `user/${currentUser.id}`;
      els.headerUsername.innerHTML = `<a href="/${urluser}">${currentUser.displayName || currentUser.username || ''}</a>`;
      els.headerUsername.classList.remove('d-none');
      els.btnLogin.classList.add('d-none');
      els.btnRegister.classList.add('d-none');
      els.btnLogout.classList.remove('d-none');
    } else {
      els.headerUsername.classList.add('d-none');
      els.btnLogin.classList.remove('d-none');
      els.btnRegister.classList.remove('d-none');
      els.btnLogout.classList.add('d-none');
    }
  }

  function updateAdminUI() {
    const isAdmin = Boolean(currentUser && currentUser.role === 'admin');
    if (els.btnAdmin) els.btnAdmin.classList.toggle('d-none', !isAdmin);
  }

  async function fetchCurrentUser() {
    try {
      const res = await fetch('/api/auth/me', getDefaultFetchOptions());
      if (!res.ok) {
        currentUser = null;
        updateAuthUI();
        return null;
      }
      const data = await res.json();
      currentUser = data.user || null;
      updateAuthUI();
      updateAdminUI();
      return currentUser;
    } catch (err) {
      console.warn('Failed to fetch current user:', err.message);
      currentUser = null;
      updateAuthUI();
      updateAdminUI();
      return null;
    }
  }

  // Shared frontend helpers (extracted to public/js/utils.js)
  const {
    formatPlaytime,
    formatHoursShort,
    escapeHtml,
    debounce,
    normalizePageSizeValue
  } = window.AppUtils || {};

  // Background image state handling
  function setBackgroundImage(url) {
    if (url && typeof url === 'string' && url.trim() !== '') {
      const safeUrl = url.trim();
      document.body.style.backgroundImage = `url('${safeUrl}')`;
      document.body.classList.add('has-custom-bg');
      state.backgroundImage = safeUrl;
    } else {
      document.body.style.backgroundImage = '';
      document.body.classList.remove('has-custom-bg');
      state.backgroundImage = '';
    }
    saveSettings();
  }

  // ============ LocalStorage Helper Functions ============
  /**
   * Save current settings to localStorage under "settings" object
   */
  function saveSettings() {
    const settings = {
      theme: state.theme,
      lang: state.lang,
      provider: state.provider,
      pageSize: state.pageSize,
      sortBy: state.sortBy,
      search: state.search,
      page: state.page,
      view: state.view
      ,
      backgroundImage: state.backgroundImage || '',
      showVideo: state.showVideo === undefined ? true : Boolean(state.showVideo),
      showAchievements: state.showAchievements === undefined ? true : Boolean(state.showAchievements)
    };
    localStorage.setItem('settings', JSON.stringify(settings));
  }

  /**
   * Load settings from localStorage and apply to state
   */
  function loadSettings() {
    try {
      const saved = localStorage.getItem('settings');
      if (saved) {
        const settings = JSON.parse(saved);
        state.theme = settings.theme || state.theme;
        state.lang = settings.lang || state.lang;
        state.provider = settings.provider || state.provider;
        state.pageSize = settings.pageSize || state.pageSize;
        state.sortBy = settings.sortBy || state.sortBy;
        state.search = settings.search || state.search;
        state.page = settings.page || state.page;
        state.view = settings.view || state.view;
        state.backgroundImage = settings.backgroundImage || '';
        state.showVideo = settings.showVideo === undefined ? true : Boolean(settings.showVideo);
        state.showAchievements = settings.showAchievements === undefined ? true : Boolean(settings.showAchievements);
      }
    } catch (err) {
      console.warn('Failed to load settings from localStorage:', err.message);
    }
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
      const res = await fetch(`/api/player?provider=${encodeURIComponent(state.provider)}`, getDefaultFetchOptions());
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

      const res = await fetch(`/api/games?${params.toString()}`, getDefaultFetchOptions());
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
    els.statTotalHours.textContent = formatHoursShort(parseInt(totalMinutes, 0));
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
            <span class="stats-chart__value">${formatHoursShort(parseInt(game.playtime_forever, 0))}h</span>
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
    saveSettings();
    loadGames();
  }

  function changePage(newPage) {
    if (newPage < 1 || newPage > state.totalPages || newPage === state.page) return;
    state.page = newPage;
    saveSettings();
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

      const cardEl = col.querySelector('.game-card');
      if (cardEl) {
        cardEl.setAttribute('tabindex', '0');
        cardEl.addEventListener('click', () => openModal(game));
        cardEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal(game);
          }
        });
      }
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
        ? (translations.emptySearch || 'No games match your search.')
        : (translations.emptyLibrary || 'No games found in this library.'));
      els.emptyText.textContent = text;
    } else {
      els.empty.classList.add('d-none');
    }
  }

  function getGameId(game) {
    return game.appid || game.GameID || game.gameId || game.GameId || game.id;
  }

  /** Open the game detail modal */
  function openModal(game) {
    state.activeGame = game;
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
    els.modalStoreLink.textContent = translations.viewMore || 'View more';

    state.achievementsStatusFilter = 'all';
    state.achievementsDateSort = 'desc';
    if (els.achievementsStatusFilter) els.achievementsStatusFilter.value = 'all';
    if (els.achievementsDateSort) els.achievementsDateSort.value = 'desc';

    els.modalAchievementsTitle.textContent = translations.achievements || 'Achievements';
    els.modalAchievementsStatus.textContent = translations.loadingAchievements || 'Loading achievements...';
    els.modalAchievements.innerHTML = `<div class="text-center text-muted small">${translations.loadingAchievements || 'Loading achievements...'}</div>`;
    updateToggleAchievementsButton();

    gameModal.show();
    loadVideoContent(game);
    // Reset modal scroll position and move focus to close button for accessibility
    try {
      const modalEl = document.getElementById('gameModal');
      const modalBody = modalEl.querySelector('.modal-body');
      if (modalBody) modalBody.scrollTop = 0;
      const closeBtn = modalEl.querySelector('.btn-close');
      if (closeBtn && typeof closeBtn.focus === 'function') closeBtn.focus();
    } catch (err) {
      // ignore
    }

    loadGameAchievements(achievementId);
  }

  async function loadGameAchievements(appid) {
    try {
      const res = await fetch(`/api/achievements?provider=${encodeURIComponent(state.provider)}&appid=${encodeURIComponent(appid)}`, getDefaultFetchOptions());
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load achievements');
      }

      renderAchievements(data.achievements || data["achievements"] || [], data);
    } catch (err) {
      els.modalAchievements.innerHTML = `<div class="text-danger small">${escapeHtml(err.message || (translations.noAchievements || 'No achievements are available for this game.'))}</div>`;
      els.modalAchievementsStatus.textContent = translations.noAchievements || 'No achievements are available for this game.';
    }
  }

  function renderAchievements(achievements = [], summary = {}) {
    currentAchievements = achievements;
    currentAchievementsSummary = summary;

    els.modalAchievementsTitle.textContent = translations.achievements || 'Achievements';
    const total = summary.total || achievements.length;
    const unlocked = summary.unlocked || achievements.filter((a) => a.achieved).length;
    const achievementsStatus = translations.achievementsStatus || 'Unlocked {unlocked} of {total}';
    els.modalAchievementsStatus.textContent = achievementsStatus
      .replace('{unlocked}', unlocked)
      .replace('{total}', total);

    renderAchievementsList();
  }

  /** Re-render the achievements list applying the current status filter and date sort */
  function renderAchievementsList() {
    if (currentAchievements.length === 0) {
      els.modalAchievements.innerHTML = `<div class="text-center text-muted small">${translations.noAchievements || 'No achievements are available for this game.'}</div>`;
      return;
    }

    const statusFilter = state.achievementsStatusFilter;
    const dateSort = state.achievementsDateSort;

    const filteredAchievements = currentAchievements.filter((achievement) => {
      if (statusFilter === 'unlocked') return achievement.achieved;
      if (statusFilter === 'locked') return !achievement.achieved;
      return true;
    });

    if (filteredAchievements.length === 0) {
      els.modalAchievements.innerHTML = `<div class="text-center text-muted small">${translations.noAchievementsFilter || 'No achievements match the selected filter.'}</div>`;
      return;
    }

    const sortedAchievements = [...filteredAchievements].sort((a, b) => {
      if (a.achieved !== b.achieved) return a.achieved ? -1 : 1;
      if (a.achieved) {
        const diff = (a.unlocktime || 0) - (b.unlocktime || 0);
        return dateSort === 'asc' ? diff : -diff;
      }
      return 0;
    });

    const fragment = document.createDocumentFragment();
    sortedAchievements.forEach((achievement) => {
      const item = document.createElement('div');
      item.className = 'machievementlist list-group-item list-group-item-dark d-flex justify-content-between align-items-start';
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

    if(state.theme == 'glassmorphism' || state.theme == 'liquid') {
      els.bkgControls.classList.remove('hidden');
    } else {
      els.bkgControls.classList.add('hidden');
    }
    
    saveSettings();
  }

  async function setLanguage(lang) {
    state.lang = lang;
    translations = await fetchTranslations(state.lang);
    updateInterfaceLanguage();
    updateLangSelectorUI(lang);
    renderGames();
    saveSettings();
  }

  /** Sync the language dropdown's active item, flag, and label with the current language. */
  function updateLangSelectorUI(lang) {
    if (!els.langSelectItems) return;
    els.langSelectItems.forEach((item) => {
      const isActive = item.dataset.lang === lang;
      item.classList.toggle('active', isActive);
      if (isActive) {
        if (els.langSelectFlag) els.langSelectFlag.src = `/node_modules/country-flag-icons/3x2/${item.dataset.flag}.svg`;
        if (els.langSelectLabel) els.langSelectLabel.textContent = item.textContent.trim();
      }
    });
  }

  function setProvider(provider) {
    state.provider = provider;
    state.page = 1;
    loadPlayer();
    loadGames();
    saveSettings();
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
    const t = translations;

    document.title = t.appTitle || 'LCPGameStats';
    document.getElementById('app-title').textContent = t.appTitle || 'LCPGameStats';
    els.loadingText.textContent = t.loadingLibrary || 'Fetching your game library...';
    els.providerInfoText.textContent = t.providerInfo || 'Use provider switcher to preview non-Steam sample libraries.';
    els.labelTotalGames.textContent = t.totalGames || 'Total Games';
    els.labelTotalHours.textContent = t.totalHours || 'Total Hours';
    els.labelRecentGames.textContent = t.playedRecently || 'Played Recently';
    els.labelTopGame.textContent = t.mostPlayed || 'Most Played';
    els.modalStoreLink.textContent = t.viewMore || 'View more';
    if (els.themeCodeModalTitle) els.themeCodeModalTitle.textContent = t.themeCodeModalTitle || 'Theme Codes';
    if (els.themeCodeInputLabel) els.themeCodeInputLabel.textContent = t.themeCodeInputLabel || 'Enter a theme code';
    if (els.themeCodeHint) els.themeCodeHint.textContent = t.themeCodeHint || 'Try: nox / dark, lumos / light, liquidglass, glassmorphism';

    if (els.empty.classList.contains('d-none') === false) {
      const message = els.searchInput.value.trim()
        ? (t.emptySearch || 'No games match your search.')
        : (t.emptyLibrary || 'No games found in this library.');
      els.emptyText.textContent = message;
    }

    updateAchievementsFilterLabels();
  }

  function updateAchievementsFilterLabels() {
    const t = translations;

    if (els.achievementsStatusFilter) {
      els.achievementsStatusFilter.title = t.achievementsFilterLabel || 'Filter achievements';
      els.achievementsStatusFilter.setAttribute('aria-label', t.achievementsFilterLabel || 'Filter achievements by status');
      const [allOpt, unlockedOpt, lockedOpt] = els.achievementsStatusFilter.options;
      if (allOpt) allOpt.textContent = t.achievementsFilterAll || 'All';
      if (unlockedOpt) unlockedOpt.textContent = t.achievementsFilterUnlocked || 'Unlocked';
      if (lockedOpt) lockedOpt.textContent = t.achievementsFilterLocked || 'Locked';
    }

    if (els.achievementsDateSort) {
      els.achievementsDateSort.title = t.achievementsSortLabel || 'Sort achievements by date';
      els.achievementsDateSort.setAttribute('aria-label', t.achievementsSortLabel || 'Sort achievements by date');
      const [newestOpt, oldestOpt] = els.achievementsDateSort.options;
      if (newestOpt) newestOpt.textContent = t.achievementsSortNewest || 'Newest first';
      if (oldestOpt) oldestOpt.textContent = t.achievementsSortOldest || 'Oldest first';
    }
  }

  function setView(view) {
    state.view = view;
    els.container.classList.toggle('list-view', state.view === 'list');
    els.viewGridBtn.classList.toggle('active', state.view === 'grid');
    els.viewListBtn.classList.toggle('active', state.view === 'list');
    renderGames();
    saveSettings();
  }

  

  function clearFilter() {
    if(els.clearfilter) {
      els.clearfilter.onclick = (e) => {
        e.preventDefault();
        state.search = "";
        state.sortBy = els.sortSelect.value;
        state.page = 1;
        state.pageSize = 8;

        els.searchInput.value = state.search;
        saveSettings();
        loadGames();
      }
    }
  }

  function setActiveViewType() {
    if(state.view === "grid") {
      if(els.viewListBtn.classList.contains("active")) {
        els.viewListBtn.classList.remove("active");
      }

      els.viewGridBtn.classList.add("active");
    } else {
      if(els.viewGridBtn.classList.contains("active")) {
        els.viewGridBtn.classList.remove("active");
      }
      
      els.viewListBtn.classList.add("active");
    }
  }

  function setPageSizeChange(event) {
    state.pageSize = normalizePageSizeValue(Number(event.target.value));
    state.page = 1;
    saveSettings();
    loadGames();
  }

  function getGameVideoData(game = state.activeGame) {
    const fallbackVideoUrl = 'https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4';
    const fallbackThumbnailUrl = 'https://image.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/thumbnail.webp';
    const videoUrl = game?.video_url || game?.videoUrl || game?.trailer_url || game?.trailerUrl || game?.movie_url || game?.movieUrl || '';
    const thumbnailUrl = game?.video_thumbnail || game?.videoThumbnail || game?.trailer_thumbnail || game?.trailerThumbnail || game?.movie_thumbnail || game?.movieThumbnail || '';

    return {
      videoUrl: videoUrl || fallbackVideoUrl,
      thumbnailUrl: thumbnailUrl || fallbackThumbnailUrl
    };
  }

  function loadVideoContent(game = state.activeGame) {
    if (!els.videoContainer) return;
    if (!state.showVideo) {
      els.videoContainer.innerHTML = '';
      return;
    }

    const { videoUrl, thumbnailUrl } = getGameVideoData(game);
    els.videoContainer.innerHTML = getVideoStuff(true, videoUrl, thumbnailUrl);
  }

  function updateToggleVideoButton() {
    if (!els.toggleVideoBtn || !els.videoContainer) return;
    els.toggleVideoBtn.textContent = state.showVideo ? 'Hide Video' : 'Show Video';
    els.toggleVideoBtn.setAttribute('aria-pressed', String(state.showVideo));
    els.videoContainer.classList.toggle('d-none', !state.showVideo);
    if (!state.showVideo) {
      els.videoContainer.innerHTML = '';
    }
  }

  function toggleVideo() {
    state.showVideo = !state.showVideo;
    saveSettings();
    updateToggleVideoButton();
    if (state.showVideo) {
      loadVideoContent();
    }
  }

  function updateToggleAchievementsButton() {
    if (!els.toggleAchievementsBtn || !els.modalAchievements) return;
    const hideLabel = translations.hideAchievements || 'Hide Achievements';
    const showLabel = translations.showAchievements || 'Show Achievements';
    els.toggleAchievementsBtn.textContent = state.showAchievements ? hideLabel : showLabel;
    els.toggleAchievementsBtn.setAttribute('aria-pressed', String(state.showAchievements));
    els.modalAchievements.classList.toggle('d-none', !state.showAchievements);
    if (els.modalAchievementsStatus) {
      els.modalAchievementsStatus.classList.toggle('d-none', !state.showAchievements);
    }
  }

  function toggleAchievements() {
    state.showAchievements = !state.showAchievements;
    saveSettings();
    updateToggleAchievementsButton();
  }

  async function init() {
    gameModal = new bootstrap.Modal(document.getElementById('gameModal'));
    loginModal = new bootstrap.Modal(els.loginModalEl);
    registerModal = new bootstrap.Modal(els.registerModalEl);
    if (els.themeCodeModalEl) {
      themeCodeModal = new bootstrap.Modal(els.themeCodeModalEl);
      els.themeCodeModalEl.addEventListener('show.bs.modal', () => { themeCodeModalTransitioning = true; });
      els.themeCodeModalEl.addEventListener('shown.bs.modal', () => { themeCodeModalTransitioning = false; });
    }
    if (els.themeToastEl) themeToast = new bootstrap.Toast(els.themeToastEl);

    // Load saved settings from localStorage
    loadSettings();

    els.searchInput.addEventListener('input', debounce(applyFiltersAndSort, 200));
    els.sortSelect.addEventListener('change', applyFiltersAndSort);
    els.providerSelect.addEventListener('change', (event) => setProvider(event.target.value));
    els.pageSizeSelect.addEventListener('change', (event) => setPageSizeChange(event));
    els.themeSelect.addEventListener('change', (event) => setTheme(event.target.value));
    els.langSelectItems.forEach((item) => {
      item.addEventListener('click', () => setLanguage(item.dataset.lang));
    });
    if (els.applyBgBtn && els.bgImageInput) {
      els.applyBgBtn.addEventListener('click', () => setBackgroundImage(els.bgImageInput.value));
    }
    if (els.clearBgBtn) {
      els.clearBgBtn.addEventListener('click', () => {
        if (els.bgImageInput) els.bgImageInput.value = 'images/cool_gaming_bkg.png';
        setBackgroundImage(els.bgImageInput.value);
      });
    }
    if (els.uploadBgBtn && els.bgFileInput) {
      els.uploadBgBtn.addEventListener('click', () => {
        const file = els.bgFileInput.files && els.bgFileInput.files[0];
        if (!file) return alert('Select an image file to upload');
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const dataUrl = reader.result;
            const payload = { filename: file.name, data: dataUrl };
            const res = await fetch('/api/upload-bg', {
              method: 'POST',
              ...getDefaultFetchOptions({ headers: { 'Content-Type': 'application/json' } }),
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            if (data.url) {
              if (els.bgImageInput) els.bgImageInput.value = data.url;
              setBackgroundImage(data.url);
              els.bgFileInput.value = '';
            }
          } catch (err) {
            console.error('Upload error:', err.message);
            alert('Upload failed: ' + err.message);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    if (els.btnLogin) els.btnLogin.addEventListener('click', () => loginModal.show());
    if (els.btnRegister) els.btnRegister.addEventListener('click', () => registerModal.show());
    if (els.btnLogout) els.btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', ...getDefaultFetchOptions() });
      } catch (err) {
        console.warn('Logout failed:', err.message);
      }
      currentUser = null;
      updateAuthUI();
      updateAdminUI();
    });

    if (els.loginForm) {
      els.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          els.loginError.classList.add('d-none');
          const username = document.getElementById('login-username').value.trim();
          const password = document.getElementById('login-password').value;
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            ...getDefaultFetchOptions({ headers: { 'Content-Type': 'application/json' } }),
            body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (!res.ok) {
            els.loginError.textContent = data.error || 'Login failed';
            els.loginError.classList.remove('d-none');
            return;
          }
          await fetchCurrentUser();
          loginModal.hide();
        } catch (err) {
          els.loginError.textContent = err.message || 'Login error';
          els.loginError.classList.remove('d-none');
        }
      });
    }

    if (els.registerForm) {
      els.registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          els.registerError.classList.add('d-none');
          const username = document.getElementById('reg-username').value.trim();
          const password = document.getElementById('reg-password').value;
          const displayName = document.getElementById('reg-displayName').value.trim();
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            ...getDefaultFetchOptions({ headers: { 'Content-Type': 'application/json' } }),
            body: JSON.stringify({ username, password, displayName })
          });
          const data = await res.json();
          if (!res.ok) {
            els.registerError.textContent = data.error || 'Registration failed';
            els.registerError.classList.remove('d-none');
            return;
          }
          await fetchCurrentUser();
          registerModal.hide();
        } catch (err) {
          els.registerError.textContent = err.message || 'Registration error';
          els.registerError.classList.remove('d-none');
        }
      });
    }
    els.exportJsonBtn.addEventListener('click', () => downloadExport('json'));
    els.exportXmlBtn.addEventListener('click', () => downloadExport('xml'));
    els.viewGridBtn.addEventListener('click', () => setView('grid'));
    els.viewListBtn.addEventListener('click', () => setView('list'));
    if (els.toggleVideoBtn) els.toggleVideoBtn.addEventListener('click', toggleVideo);
    if (els.toggleAchievementsBtn) els.toggleAchievementsBtn.addEventListener('click', toggleAchievements);
    if (els.achievementsStatusFilter) els.achievementsStatusFilter.addEventListener('change', (e) => {
      state.achievementsStatusFilter = e.target.value;
      renderAchievementsList();
    });
    if (els.achievementsDateSort) els.achievementsDateSort.addEventListener('change', (e) => {
      state.achievementsDateSort = e.target.value;
      renderAchievementsList();
    });

    if (els.themeCodeForm) {
      els.themeCodeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitThemeCode();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'c' && e.key !== 'C') return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isTypingTarget(e.target)) return;
      if (!themeCodeModal) return;

      const openModalEl = document.querySelector('.modal.show');
      if (openModalEl && openModalEl !== els.themeCodeModalEl) return;
      if (!openModalEl && !isThemeCodesEnabled()) return;

      toggleThemeCodeModal();
    });

    const bkgimg = state.backgroundImage || 'images/cool_gaming_bkg.png';
    if (els.bgImageInput) els.bgImageInput.value = bkgimg;

    els.providerSelect.value = state.provider;
    els.pageSizeSelect.value = String(state.pageSize);
    els.themeSelect.value = state.theme;
    els.searchInput.value = state.search;
    els.sortSelect.value = state.sortBy;

    await fetchCurrentUser();

    setTheme(state.theme);
    const sessionThemeCode = sessionStorage.getItem(THEME_CODE_SESSION_KEY);
    if (sessionThemeCode && isThemeCodesEnabled()) {
      setTheme(sessionThemeCode);
      if (els.themeSelect) els.themeSelect.value = sessionThemeCode;
    }
    setBackgroundImage(bkgimg);
    await setLanguage(state.lang);
    setView(state.view || "grid");
    setActiveViewType();
    loadPlayer();
    loadGames();
    showStats();
    clearFilter();
    updateToggleVideoButton();
    loadVideoContent();
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((err) => {
      console.error('Failed to initialize app:', err);
    });
  });
})();
