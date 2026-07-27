/**
 * Shared header chrome (site nav labels, digital clock, language dropdown +
 * show/hide-name toggle) used by the static pages: admin, feedback, about.
 */

const LANG_NAME_SETTING_KEY = 'showLanguageName';
const SETTINGS_STORAGE_KEY = 'settings';

export function getSavedLanguage() {
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

export function saveLanguage(lang) {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const settings = saved ? JSON.parse(saved) : {};
    settings.lang = lang;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to save language setting:', err.message);
  }
}

export function isLangNameVisible() {
  const saved = localStorage.getItem(LANG_NAME_SETTING_KEY);
  return saved === null ? true : saved !== 'false';
}

export function updateLangNameToggleUI(translations) {
  const btn = document.getElementById('lang-name-toggle');
  if (!btn) return;
  const visible = isLangNameVisible();
  document.body.classList.toggle('lang-name-hidden', !visible);
  const icon = btn.querySelector('i');
  if (icon) icon.className = visible ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
  const label = visible
    ? (translations.hideLanguageName || 'Hide language name')
    : (translations.showLanguageName || 'Show language name');
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(!visible));
}

export function initLangNameToggle(translationsGetter) {
  const btn = document.getElementById('lang-name-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    localStorage.setItem(LANG_NAME_SETTING_KEY, String(!isLangNameVisible()));
    updateLangNameToggleUI(translationsGetter());
  });
}

export function updateLangSelectorUI(lang) {
  const flag = document.getElementById('lang-select-flag');
  const label = document.getElementById('lang-select-label');
  const items = document.querySelectorAll('#lang-select-btn + .dropdown-menu [data-lang]');
  items.forEach((item) => {
    const isActive = item.dataset.lang === lang;
    item.classList.toggle('active', isActive);
    if (isActive) {
      if (flag) flag.src = `/node_modules/country-flag-icons/3x2/${item.dataset.flag}.svg`;
      if (label) label.textContent = item.textContent.trim();
    }
  });
}

export function initLangDropdown(onSelect) {
  document.querySelectorAll('#lang-select-btn + .dropdown-menu [data-lang]').forEach((item) => {
    item.addEventListener('click', () => onSelect(item.dataset.lang));
  });
}

export function updateClock() {
  const timeEl = document.getElementById('app-clock-time');
  if (!timeEl) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  timeEl.textContent = `${hh}:${mm}:${ss}`;
  const dateEl = document.getElementById('app-clock-date');
  if (dateEl) {
    try {
      dateEl.textContent = now.toLocaleDateString(document.documentElement.lang || undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      dateEl.textContent = now.toDateString();
    }
  }
}

let clockInterval;
export function startClock() {
  if (!document.getElementById('app-clock')) return;
  updateClock();
  clearInterval(clockInterval);
  clockInterval = setInterval(updateClock, 1000);
}

/** Apply the nav link labels/titles + admin-link visibility shared by every static page. */
export function applyNavTranslations(t) {
  const map = {
    'nav-home-label': t.navHome || 'Home',
    'nav-feedback-label': t.navFeedback || 'Feedback',
    'nav-about-label': t.navAbout || 'About',
    'nav-admin-label': t.navAdmin || 'Admin',
    'back-to-library': t.backToLibrary || 'Back to library',
    'footer-text': t.footerText || 'Powered by the LCP - Created by Luis Carvalho - @2026'
  };
  Object.entries(map).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  const titleMap = {
    'nav-home': t.navHome || 'Home',
    'nav-feedback': t.navFeedback || 'Feedback',
    'nav-about': t.navAbout || 'About',
    'btn-admin': t.navAdmin || 'Admin'
  };
  Object.entries(titleMap).forEach(([id, title]) => {
    const el = document.getElementById(id);
    if (el) el.title = title;
  });

  const clockEl = document.getElementById('app-clock');
  if (clockEl) clockEl.title = t.currentTimeLabel || 'Current time';
}

export async function showAdminLinkIfAdmin() {
  const btnAdmin = document.getElementById('btn-admin');
  if (!btnAdmin) return;
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include', headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const data = await res.json();
    if (data.user && data.user.role === 'admin') {
      btnAdmin.classList.remove('d-none');
    }
  } catch (err) {
    // Not logged in / unreachable — leave the admin link hidden.
  }
}
