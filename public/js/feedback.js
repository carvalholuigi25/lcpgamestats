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

const els = {
  title: document.getElementById('feedback-title'),
  subtitle: document.getElementById('feedback-subtitle'),
  status: document.getElementById('feedback-status'),
  form: document.getElementById('feedback-form'),
  nameLabel: document.getElementById('feedback-name-label'),
  emailLabel: document.getElementById('feedback-email-label'),
  categoryLabel: document.getElementById('feedback-category-label'),
  categoryBug: document.getElementById('feedback-category-bug'),
  categoryFeature: document.getElementById('feedback-category-feature'),
  categoryGeneral: document.getElementById('feedback-category-general'),
  ratingLabel: document.getElementById('feedback-rating-label'),
  messageLabel: document.getElementById('feedback-message-label'),
  message: document.getElementById('feedback-message'),
  submitBtn: document.getElementById('feedback-submit-btn'),
  name: document.getElementById('feedback-name'),
  email: document.getElementById('feedback-email'),
  category: document.getElementById('feedback-category')
};

let translations = {};

function setStatus(message, type) {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.classList.remove('d-none', 'alert-info', 'alert-danger', 'alert-success');
  els.status.classList.add(`alert-${type}`);
}

function updateInterfaceLanguage() {
  const t = translations;
  document.title = t.feedbackTitle ? `${t.feedbackTitle} - LCPGameStats` : 'Feedback - LCPGameStats';
  if (els.title) els.title.textContent = t.feedbackTitle || 'Send Feedback';
  if (els.subtitle) els.subtitle.textContent = t.feedbackSubtitle || "We'd love to hear your thoughts, bug reports, or feature ideas.";
  if (els.nameLabel) els.nameLabel.textContent = t.feedbackNameLabel || 'Name';
  if (els.emailLabel) els.emailLabel.textContent = t.feedbackEmailLabel || 'Email';
  if (els.categoryLabel) els.categoryLabel.textContent = t.feedbackCategoryLabel || 'Category';
  if (els.categoryBug) els.categoryBug.textContent = t.feedbackCategoryBug || 'Bug report';
  if (els.categoryFeature) els.categoryFeature.textContent = t.feedbackCategoryFeature || 'Feature request';
  if (els.categoryGeneral) els.categoryGeneral.textContent = t.feedbackCategoryGeneral || 'General feedback';
  if (els.ratingLabel) els.ratingLabel.textContent = t.feedbackRatingLabel || 'Overall rating';
  if (els.messageLabel) els.messageLabel.textContent = t.feedbackMessageLabel || 'Message';
  if (els.message) els.message.placeholder = t.feedbackMessagePlaceholder || "Tell us what's on your mind...";
  if (els.submitBtn) els.submitBtn.textContent = t.feedbackSubmit || 'Send Feedback';
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

function getDefaultFetchOptions(overrides = {}) {
  return {
    credentials: 'include',
    headers: { Accept: 'application/json', ...(overrides.headers || {}) },
    ...overrides
  };
}

async function submitFeedback(event) {
  event.preventDefault();
  const rating = Number((els.form.querySelector('input[name="rating"]:checked') || {}).value || 0);
  const payload = {
    name: els.name.value.trim(),
    email: els.email.value.trim(),
    category: els.category.value,
    message: els.message.value.trim(),
    rating
  };

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = translations.feedbackSending || 'Sending...';

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      ...getDefaultFetchOptions({ headers: { 'Content-Type': 'application/json' } }),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || translations.feedbackError || 'Unable to send feedback. Please try again.');
    setStatus(translations.feedbackSuccess || 'Thanks! Your feedback has been received.', 'success');
    els.form.reset();
  } catch (err) {
    setStatus(err.message || translations.feedbackError || 'Unable to send feedback. Please try again.', 'danger');
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = translations.feedbackSubmit || 'Send Feedback';
  }
}

async function init() {
  initLangDropdown((lang) => setLanguage(lang));
  initLangNameToggle(() => translations);
  startClock();
  await setLanguage(getSavedLanguage());
  showAdminLinkIfAdmin();

  if (els.form) els.form.addEventListener('submit', submitFeedback);
}

init().catch((err) => {
  console.error('Feedback page initialization failed:', err);
});
