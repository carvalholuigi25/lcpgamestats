import { fetchTranslations } from './functions.js';

const els = {
  adminStatus: document.getElementById('admin-status'),
  adminSummaryTotal: document.getElementById('admin-summary-total'),
  adminSummaryAdmins: document.getElementById('admin-summary-admins'),
  adminSummaryRecent: document.getElementById('admin-summary-recent'),
  adminUsersTableBody: document.getElementById('admin-users-table-body'),
  refreshAdminBtn: document.getElementById('refresh-admin-btn'),
  logoutBtn: document.getElementById('btn-logout'),
  langSelectFlag: document.getElementById('lang-select-flag'),
  langSelectLabel: document.getElementById('lang-select-label'),
  langSelectItems: document.querySelectorAll('#lang-select-btn + .dropdown-menu [data-lang]'),
  toggleThemeCodesBtn: document.getElementById('toggle-theme-codes-btn'),
  themeCodesTitle: document.getElementById('theme-codes-title'),
  themeCodesDesc: document.getElementById('theme-codes-desc'),
  langNameToggle: document.getElementById('lang-name-toggle'),
  navFeedback: document.getElementById('nav-feedback'),
  navAbout: document.getElementById('nav-about'),
  backToLibrary: document.getElementById('back-to-library'),
  appClockTime: document.getElementById('app-clock-time')
};

const THEME_CODES_SETTING_KEY = 'themeCodesEnabled';
const SETTINGS_STORAGE_KEY = 'settings';
const LANG_NAME_SETTING_KEY = 'showLanguageName';

let currentUser = null;
let translations = {};
let lastUsers = [];
let clockInterval;

function isThemeCodesEnabled() {
  const saved = localStorage.getItem(THEME_CODES_SETTING_KEY);
  return saved === null ? true : saved !== 'false';
}

function isLangNameVisible() {
  const saved = localStorage.getItem(LANG_NAME_SETTING_KEY);
  return saved === null ? true : saved !== 'false';
}

function updateLangNameToggleUI() {
  if (!els.langNameToggle) return;
  const visible = isLangNameVisible();
  document.body.classList.toggle('lang-name-hidden', !visible);
  const icon = els.langNameToggle.querySelector('i');
  if (icon) icon.className = visible ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
  const label = visible
    ? (translations.hideLanguageName || 'Hide language name')
    : (translations.showLanguageName || 'Show language name');
  els.langNameToggle.title = label;
  els.langNameToggle.setAttribute('aria-label', label);
  els.langNameToggle.setAttribute('aria-pressed', String(!visible));
}

function toggleLangName() {
  localStorage.setItem(LANG_NAME_SETTING_KEY, String(!isLangNameVisible()));
  updateLangNameToggleUI();
}

function updateClock() {
  if (!els.appClockTime) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  els.appClockTime.textContent = `${hh}:${mm}:${ss}`;
}

function startClock() {
  updateClock();
  clearInterval(clockInterval);
  clockInterval = setInterval(updateClock, 1000);
}

function updateToggleThemeCodesButton() {
  if (!els.toggleThemeCodesBtn) return;
  const enabled = isThemeCodesEnabled();
  const enabledLabel = translations.themeCodesEnabledLabel || 'Enabled';
  const disabledLabel = translations.themeCodesDisabledLabel || 'Disabled';
  els.toggleThemeCodesBtn.textContent = enabled ? enabledLabel : disabledLabel;
  els.toggleThemeCodesBtn.classList.toggle('btn-outline-primary', enabled);
  els.toggleThemeCodesBtn.classList.toggle('btn-outline-secondary', !enabled);
  els.toggleThemeCodesBtn.setAttribute('aria-pressed', String(enabled));
}

function toggleThemeCodesFeature() {
  localStorage.setItem(THEME_CODES_SETTING_KEY, String(!isThemeCodesEnabled()));
  updateToggleThemeCodesButton();
}

function getSavedLanguage() {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) {
      const settings = JSON.parse(saved);
      return settings.lang || 'en';
    }
  } catch (err) {
    console.warn('Failed to read language setting:', err.message);
  }
  return 'en';
}

function saveLanguage(lang) {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = saved ? JSON.parse(saved) : {};
    settings.lang = lang;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save language setting:', err.message);
  }
}

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

function updateInterfaceLanguage() {
  const t = translations;
  document.title = t.adminTitle ? `${t.adminTitle} - LCPGameStats` : 'Admin Dashboard - LCPGameStats';
  const titleEl = document.querySelector('header h1');
  const subtitleEl = document.querySelector('header p');
  if (titleEl) titleEl.textContent = t.adminTitle || 'Admin Dashboard';
  if (subtitleEl) subtitleEl.textContent = t.adminSubtitle || 'Manage users and review administration data.';
  if (els.logoutBtn) els.logoutBtn.textContent = t.logout || 'Logout';
  if (els.themeCodesTitle) els.themeCodesTitle.textContent = t.themeCodesTitle || 'Theme codes';
  if (els.themeCodesDesc) els.themeCodesDesc.textContent = t.themeCodesDesc || 'Allow users to press "C" and type a secret code to unlock a theme.';
  updateToggleThemeCodesButton();
  updateLangNameToggleUI();
  if (els.navFeedback) els.navFeedback.textContent = t.navFeedback || 'Feedback';
  if (els.navAbout) els.navAbout.textContent = t.navAbout || 'About';
  if (els.backToLibrary) els.backToLibrary.textContent = t.backToLibrary || 'Back to library';

  const totalLabel = document.getElementById('admin-summary-total-label');
  const adminsLabel = document.getElementById('admin-summary-admins-label');
  const recentLabel = document.getElementById('admin-summary-recent-label');
  if (totalLabel) totalLabel.textContent = t.totalUsers || 'Total users';
  if (adminsLabel) adminsLabel.textContent = t.adminsLabel || 'Admins';
  if (recentLabel) recentLabel.textContent = t.recentSignups || 'Recent signups';

  const userManagementTitle = document.getElementById('user-management-title');
  const userManagementDesc = document.getElementById('user-management-desc');
  if (userManagementTitle) userManagementTitle.textContent = t.userManagementTitle || 'User management';
  if (userManagementDesc) userManagementDesc.textContent = t.userManagementDesc || 'Promote or demote users from this dashboard.';
  if (els.refreshAdminBtn) els.refreshAdminBtn.textContent = t.refresh || 'Refresh';

  const colUser = document.getElementById('col-user');
  const colRole = document.getElementById('col-role');
  const colCreated = document.getElementById('col-created');
  const colActions = document.getElementById('col-actions');
  if (colUser) colUser.textContent = t.colUser || 'User';
  if (colRole) colRole.textContent = t.colRole || 'Role';
  if (colCreated) colCreated.textContent = t.colCreated || 'Created';
  if (colActions) colActions.textContent = t.colActions || 'Actions';

  renderUsers(lastUsers);
}

async function setLanguage(lang) {
  try {
    translations = await fetchTranslations(lang);
  } catch (err) {
    console.warn('Failed to load translations:', err.message);
    translations = {};
  }
  updateInterfaceLanguage();
  updateLangSelectorUI(lang);
  saveLanguage(lang);
}

function getDefaultFetchOptions(overrides = {}) {
  return {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(overrides.headers || {}) },
    ...overrides
  };
}

function setAdminFeedback(message, type = 'info') {
  if (!els.adminStatus) return;
  els.adminStatus.textContent = message;
  els.adminStatus.classList.remove('d-none', 'alert-info', 'alert-danger', 'alert-success');
  els.adminStatus.classList.add('alert-' + type);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderUsers(users) {
  if (!els.adminUsersTableBody) return;
  lastUsers = users;
  if (!users.length) {
    els.adminUsersTableBody.innerHTML = `<tr><td colspan="4" class="text-muted">${escapeHtml(translations.noUsersFound || 'No users found.')}</td></tr>`;
    return;
  }

  const adminLabel = translations.roleAdmin || 'Admin';
  const userLabel = translations.roleUser || 'User';
  const promoteLabel = translations.promote || 'Promote';
  const demoteLabel = translations.demote || 'Demote';

  els.adminUsersTableBody.innerHTML = users.map((user) => {
    const createdLabel = user.createdAt ? new Date(Number(user.createdAt) * 1000).toLocaleDateString() : '—';
    const roleLabel = user.role === 'admin' ? adminLabel : userLabel;
    const isSelf = currentUser && Number(user.id) === Number(currentUser.id);
    return `
      <tr>
        <td>
          <div class="fw-semibold">${escapeHtml(user.displayName || user.username || 'User')}</div>
          <div class="small text-muted">${escapeHtml(user.username || '')}</div>
        </td>
        <td>${escapeHtml(roleLabel)}</td>
        <td>${escapeHtml(createdLabel)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" type="button" data-action="toggle-role" data-user-id="${user.id}" data-role="${user.role === 'admin' ? 'user' : 'admin'}" ${isSelf ? 'disabled' : ''}>
            ${user.role === 'admin' ? demoteLabel : promoteLabel}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  els.adminUsersTableBody.querySelectorAll('[data-action="toggle-role"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const userId = button.getAttribute('data-user-id');
      const nextRole = button.getAttribute('data-role');
      try {
        const res = await fetch(`/api/admin/users/${userId}/role`, {
          method: 'PATCH',
          ...getDefaultFetchOptions({ headers: { 'Content-Type': 'application/json' } }),
          body: JSON.stringify({ role: nextRole })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update role');
        setAdminFeedback(`Role updated to ${nextRole}.`, 'success');
        await loadAdminData();
      } catch (err) {
        setAdminFeedback(err.message || 'Unable to update role', 'danger');
      }
    });
  });
}

async function loadAdminData() {
  try {
    const [summaryRes, usersRes] = await Promise.all([
      fetch('/api/admin/summary', getDefaultFetchOptions()),
      fetch('/api/admin/users', getDefaultFetchOptions())
    ]);
    if (!summaryRes.ok || !usersRes.ok) {
      throw new Error('Unable to load admin data');
    }
    const summaryData = await summaryRes.json();
    const usersData = await usersRes.json();
    const summary = summaryData.summary || {};
    if (els.adminSummaryTotal) els.adminSummaryTotal.textContent = summary.totalUsers ?? 0;
    if (els.adminSummaryAdmins) els.adminSummaryAdmins.textContent = summary.totalAdmins ?? 0;
    if (els.adminSummaryRecent) els.adminSummaryRecent.textContent = summary.recentSignups ?? 0;
    renderUsers(usersData.users || []);
    setAdminFeedback('Admin data loaded.', 'info');
  } catch (err) {
    console.warn('Failed to load admin data:', err.message);
    setAdminFeedback(err.message || 'Unable to load admin data', 'danger');
  }
}

async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', getDefaultFetchOptions());
    if (!res.ok) {
      currentUser = null;
      window.location.href = '/';
      return null;
    }
    const data = await res.json();
    currentUser = data.user || null;
    if (!currentUser || currentUser.role !== 'admin') {
      window.location.href = '/';
      return null;
    }
    return currentUser;
  } catch (err) {
    console.warn('Failed to fetch current user:', err.message);
    window.location.href = '/';
    return null;
  }
}

async function init() {
  els.langSelectItems.forEach((item) => {
    item.addEventListener('click', () => setLanguage(item.dataset.lang));
  });
  if (els.langNameToggle) els.langNameToggle.addEventListener('click', toggleLangName);
  updateLangNameToggleUI();
  startClock();
  await setLanguage(getSavedLanguage());

  if (els.toggleThemeCodesBtn) {
    els.toggleThemeCodesBtn.addEventListener('click', toggleThemeCodesFeature);
  }

  if (els.refreshAdminBtn) {
    els.refreshAdminBtn.addEventListener('click', () => loadAdminData());
  }

  if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', ...getDefaultFetchOptions() });
      } catch (err) {
        console.warn('Logout failed:', err.message);
      }
      window.location.href = '/';
    });
  }

  const user = await fetchCurrentUser();
  if (!user) return;
  await loadAdminData();
}

init().catch((err) => {
  console.error('Admin initialization failed:', err);
  setAdminFeedback(err.message || 'Unable to initialize admin page', 'danger');
});
