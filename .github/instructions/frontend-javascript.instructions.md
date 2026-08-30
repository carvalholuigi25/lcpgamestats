---
name: frontend-javascript-instructions
description: "Frontend JavaScript development for public/js/. Use when writing client-side scripts, handling UI interactions, managing DOM, working with Bootstrap integration, or debugging frontend logic."
applyTo: "public/js/**/*.js"
---

# Frontend JavaScript Instructions

## Project Pattern: Vanilla JavaScript

This project uses **vanilla JavaScript only** — no frameworks (React, Vue, etc.). Keep it simple and performant.

## File Organization

```
public/js/
  app.js          # Main app initialization & layout
  functions.js    # Utility functions (shared by pages)
  utils.js        # DOM helpers, formatters, validators
  
  admin.js        # Admin page logic
  feedback.js     # Feedback form & submission
  about.js        # About page logic
  nav-chrome.js   # Navigation menu chrome (UI chrome)
```

## Conventions

### Module Pattern
```javascript
// Each file should be self-contained and export functions/objects
export function setupPage() {
  // Initialize page
}

export function handleUserAction(event) {
  // Handle DOM event
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  setupPage();
});
```

### Naming
- Functions: `camelCase` (handleClick, fetchGames, renderList)
- Constants: `UPPER_SNAKE_CASE` (API_URL, MAX_ITEMS)
- DOM selectors: descriptive (gamesList, feedbackForm, userMenu)
- Event handlers: `handle*` or `on*` (handleSubmit, onItemClick)

### DOM Manipulation
```javascript
// Use querySelector (modern, preferred)
const element = document.querySelector('.game-card');
const elements = document.querySelectorAll('[data-game-id]');

// Avoid older methods
// ❌ document.getElementById, document.getElementsByClassName (slower)
// ✅ document.querySelector, document.querySelectorAll

// Add/remove classes (use classList)
element.classList.add('active');
element.classList.remove('hidden');
element.classList.toggle('expanded');
```

### Event Handling
```javascript
// Delegate events when possible (more efficient)
document.addEventListener('click', (e) => {
  if (e.target.matches('.btn-delete')) {
    handleDelete(e.target.dataset.id);
  }
});

// Avoid inline event handlers (onclick attribute)
// ❌ <button onclick="handleClick()">
// ✅ element.addEventListener('click', handleClick)
```

### Async/Await Pattern
```javascript
async function fetchAndRenderGames() {
  try {
    const response = await fetch('/api/games');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    renderGames(data);
  } catch (err) {
    console.error('Failed to load games:', err);
    showError('Could not load games. Please try again.');
  }
}
```

## Bootstrap 5 Integration

### Utility Classes
```html
<!-- Spacing: m/p + direction + size (0-5) -->
<div class="mb-3 p-2">Content</div>

<!-- Flexbox -->
<div class="d-flex justify-content-between align-items-center">
  <span>Left</span>
  <span>Right</span>
</div>

<!-- Display/Visibility -->
<div class="d-none d-md-block">Visible on medium+ screens</div>

<!-- Grid/Layout -->
<div class="row">
  <div class="col-md-6">Half width on medium+</div>
</div>
```

### Component Initialization
```javascript
// Bootstrap components (modals, tooltips, dropdowns)
const modal = new bootstrap.Modal(document.getElementById('myModal'));
modal.show();

// Event listeners for Bootstrap events
const modalEl = document.getElementById('myModal');
modalEl.addEventListener('hidden.bs.modal', () => {
  console.log('Modal closed');
});
```

## Common Patterns

### Fetch with Error Handling
```javascript
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error(`Failed to call ${endpoint}:`, err);
    throw err;
  }
}
```

### Render HTML from Data
```javascript
function renderGames(games) {
  const container = document.querySelector('.games-container');
  
  container.innerHTML = games.map(game => `
    <div class="card game-card" data-game-id="${game.id}">
      <h3>${escapeHtml(game.name)}</h3>
      <p>${game.playtime} hours</p>
    </div>
  `).join('');
}

// Always escape user data to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### Debounce User Input
```javascript
function debounce(fn, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Usage: search input that fetches as user types
searchInput.addEventListener('input', debounce(async (e) => {
  const results = await searchGames(e.target.value);
  renderResults(results);
}, 300));
```

### Show/Hide Loading State
```javascript
function showLoading(element) {
  element.innerHTML = '<div class="spinner-border"></div>';
  element.disabled = true;
}

function hideLoading(element, content) {
  element.innerHTML = content;
  element.disabled = false;
}

// Usage
const btn = document.querySelector('.btn-load');
btn.addEventListener('click', async () => {
  showLoading(btn);
  try {
    const data = await fetch('/api/data');
    btn.textContent = 'Loaded!';
  } catch (err) {
    btn.textContent = 'Error. Try again.';
  } finally {
    hideLoading(btn, 'Done');
  }
});
```

## Translations (i18n)

Game translations are in `public/json/langs/`:
```javascript
// Load translations
const translations = await (await fetch('/json/langs/en.json')).json();

// Use in templates
const greeting = translations['greeting']; // "Hello"

// Pass to render functions
renderPage(data, translations);
```

## Performance Tips

✅ **DO**:
- Use `querySelectorAll` for modern selectors
- Debounce frequent events (input, scroll, resize)
- Lazy-load images with `loading="lazy"`
- Cache DOM queries in variables
- Use event delegation for dynamic content
- Minimize DOM reflows (batch updates)

❌ **DON'T**:
- Loop through `document.getElementById` (cache it)
- Add inline event handlers
- Manipulate DOM in tight loops (batch updates)
- Load all data at once for large lists (pagination/virtualization)
- Forget to escape user input (XSS risk)

## Browser Compatibility

Target: Modern browsers (Chrome, Firefox, Safari, Edge latest versions)
- Use `fetch()` not `XMLHttpRequest`
- Use `const`/`let` not `var`
- Use template literals (backticks)
- Native ES6 modules are fine

## Debugging

### Console Logging
```javascript
console.log('Info:', value);           // General info
console.warn('Warning:', issue);       // Warnings
console.error('Error:', err.message);  // Errors
console.table(arrayOfObjects);         // Pretty print arrays
```

### Check Element State
```javascript
// Inspect element in devtools
console.log(document.querySelector('.element'));

// Check all event listeners
console.log(getEventListeners(element)); // Chrome only
```

### Network Debugging
- Open DevTools → Network tab
- Check API responses in Console
- Look for failed requests (red)
- Check Content-Type headers match (application/json)

## Accessibility

- Use semantic HTML (not just divs)
- Include `alt` text for images
- Use `label` with form inputs
- Keyboard navigation support (tab order)
- ARIA labels for screen readers when needed

## Before Committing

✅ No console.log() in production code
✅ No hardcoded URLs (use `/api/*` relative paths)
✅ User data escaped to prevent XSS
✅ Error handling for all fetch() calls
✅ Responsive design tested on mobile
✅ No inline styles (use CSS classes)
