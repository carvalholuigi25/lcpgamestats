import { fetchTranslations } from './functions.js';
import {
  getSavedLanguage,
  saveLanguage,
  updateLangSelectorUI,
  initLangDropdown,
  updateLangNameToggleUI,
  initLangNameToggle,
  startClock,
  applyNavTranslations,
  showAdminLinkIfAdmin
} from './nav-chrome.js';

let translations = {};

function updateInterfaceLanguage() {
  const t = translations;
  document.title = t.aboutTitle ? `${t.aboutTitle} - LCPGameStats` : 'About - LCPGameStats';

  const textMap = {
    'about-title': t.aboutTitle || 'About LCPGameStats',
    'about-subtitle': t.aboutSubtitle || 'A personal project to track and explore your game library.',
    'about-description': t.aboutDescription || 'LCPGameStats is a web application that connects to Steam and other providers to visualize your game library, playtime, and achievements in one place.',
    'about-features-title': t.aboutFeaturesTitle || 'Features',
    'about-feature-multi-provider': t.aboutFeatureMultiProvider || 'Multi-provider support: Steam, Epic Games, GOG, Uplay, and RetroAchievements',
    'about-feature-themes': t.aboutFeatureThemes || 'Multiple themes including Dark, Light, Glassmorphism, Liquid Glass, and Neomorphism',
    'about-feature-achievements': t.aboutFeatureAchievements || 'Detailed achievement tracking with filters and search',
    'about-feature-export': t.aboutFeatureExport || 'Export your library data to JSON or XML',
    'about-feature-auth': t.aboutFeatureAuth || 'Secure accounts with local login or Google sign-in',
    'about-created-by-label': t.aboutCreatedByLabel || 'Created by',
    'about-version-label': t.aboutVersionLabel || 'Version',
    'about-contact-label': t.aboutContactLabel || 'Contact'
  };
  Object.entries(textMap).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  applyNavTranslations(t);
  updateLangNameToggleUI(t);
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

async function init() {
  initLangDropdown((lang) => setLanguage(lang));
  initLangNameToggle(() => translations);
  startClock();
  await setLanguage(getSavedLanguage());
  showAdminLinkIfAdmin();
}

init().catch((err) => {
  console.error('About page initialization failed:', err);
});
