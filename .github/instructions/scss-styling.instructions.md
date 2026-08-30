---
name: scss-styling-instructions
description: "SCSS and CSS guidelines for public/css/. Use when writing styles, adding components, creating themes, managing responsive design, or troubleshooting styling issues."
applyTo: "public/css/**/*.scss"
---

# SCSS & Styling Instructions

## Architecture

This project uses **SCSS with Bootstrap 5** organized into logical modules:

```
public/css/
  style.scss          # Main entry point (imports all partials)
  style.css           # Compiled CSS (auto-generated)
  
  base/
    _variables.scss   # Theme colors, typography, spacing
    _reset.scss       # Global resets
    _animations.scss  # Keyframe animations
    _theme-mixins.scss # Reusable mixins
    
  components/
    _header.scss      # Header/navbar
    _buttons.scss     # Button styles
    _forms.scss       # Input, textarea, select
    _cards.scss       # Card containers
    _modals.scss      # Modal dialogs
    _footer.scss      # Footer section
    _stats.scss       # Stats display
    _tables.scss      # Table styling
    _toast.scss       # Toast notifications
    _states.scss      # Loading, error, success states
    _controls.scss    # UI controls
    _spell-effects.scss # Special visual effects
    _dropdowns.scss   # Dropdown menus
    _feedback.scss    # Feedback components
    _clock.scss       # Clock/timer display
    
  layout/
    _responsive.scss  # Responsive breakpoints
    _medias.scss      # Media queries, print styles
    _custom-bg.scss   # Background patterns, images
    
  themes/
    _light.scss       # Light theme
    _dark.scss        # Dark theme
    _cyberpunk.scss   # Cyberpunk theme
    _matrix.scss      # Matrix theme
    _retro80s.scss    # Retro 80s theme
    _liquid.scss      # Liquid theme
    _glassmorphism.scss # Glassmorphism theme
    _neomorphism.scss # Neomorphism theme
    
  vendor/
    _player.scss      # Video player styling
```

## Compiling

### One-time Compile
```bash
npm run build:css    # Compile style.scss → style.css
```

### Watch Mode (Development)
```bash
npm run watchscss         # Watch and rebuild on changes
npm run startall          # Start server + watch SCSS together
```

### Manual Compile
```bash
npx sass public/css/style.scss public/css/style.css
npx sass --watch public/css:public/css
```

## SCSS Conventions

### Variables (in _variables.scss)
```scss
// Colors
$primary-color: #6c5ce7;
$secondary-color: #0984e3;
$success-color: #00b894;
$error-color: #d63031;
$bg-color: #f5f6fa;
$text-color: #2d3436;

// Typography
$font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
$font-size-base: 16px;
$line-height-base: 1.5;
$h1-size: 2.5rem;

// Spacing
$spacing-xs: 0.25rem;
$spacing-sm: 0.5rem;
$spacing-md: 1rem;
$spacing-lg: 1.5rem;
$spacing-xl: 2rem;

// Breakpoints (mobile-first)
$breakpoint-sm: 576px;
$breakpoint-md: 768px;
$breakpoint-lg: 992px;
$breakpoint-xl: 1200px;
```

### Mixins (in _theme-mixins.scss)
```scss
// Responsive breakpoint helper
@mixin respond-to($breakpoint) {
  @if $breakpoint == 'sm' {
    @media (min-width: $breakpoint-sm) { @content; }
  }
  @else if $breakpoint == 'md' {
    @media (min-width: $breakpoint-md) { @content; }
  }
  // etc.
}

// Usage:
@include respond-to('md') {
  width: 50%;
}

// Flexbox helper
@mixin flexbox($direction: row, $justify: center, $align: center) {
  display: flex;
  flex-direction: $direction;
  justify-content: $justify;
  align-items: $align;
}

// Shadow effect
@mixin box-shadow($level: 1) {
  @if $level == 1 {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  @else if $level == 2 {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
}
```

### Nesting
```scss
// DO: Nest related selectors
.card {
  background: white;
  padding: $spacing-md;
  
  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
  
  .card-header {
    font-size: $h3-size;
    margin-bottom: $spacing-sm;
  }
  
  .card-body {
    color: $text-color;
  }
}

// DON'T: Nest too deeply (>3 levels)
// ❌ .card .header .title .text { } — too deep
// ✅ .card-title { } — simpler selector
```

## Bootstrap Integration

### Using Bootstrap Variables/Mixins
```scss
// Import Bootstrap functions first
@import '../../node_modules/bootstrap/scss/functions';
@import '../../node_modules/bootstrap/scss/variables';

// Now use Bootstrap variables
.btn-primary {
  background-color: $primary;
  color: $white;
}

// Use Bootstrap mixins for responsive
@include media-breakpoint-up(md) {
  width: 50%;
}
```

### Bootstrap Utilities
```scss
// Use Bootstrap's built-in utilities in HTML
// <div class="d-flex justify-content-between align-items-center mb-3">

// Extend Bootstrap's utilities with custom utilities
// Instead of creating new class, add utility modifiers
.mx-4 { margin-left: 2rem; margin-right: 2rem; }
```

## Responsive Design (Mobile-First)

### Pattern: Mobile First, Enhance at Breakpoints
```scss
.game-list {
  display: block;        // Mobile: stacked
  margin: $spacing-md;
  
  @include respond-to('md') {
    display: grid;       // Tablet+: grid
    grid-template-columns: repeat(2, 1fr);
    gap: $spacing-lg;
  }
  
  @include respond-to('lg') {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Bootstrap Breakpoints
- `xs` (default): < 576px
- `sm`: ≥ 576px
- `md`: ≥ 768px
- `lg`: ≥ 992px
- `xl`: ≥ 1200px
- `xxl`: ≥ 1400px

## Theming

Themes are in `public/css/themes/`. Each theme file defines color variables:

```scss
// _dark.scss
@mixin theme-dark {
  $bg-color: #1a1a1a;
  $text-color: #e0e0e0;
  $primary: #bb86fc;
  
  background-color: $bg-color;
  color: $text-color;
  
  .card { background-color: #2a2a2a; }
  .button { background-color: $primary; }
}
```

### Switching Themes in HTML
```html
<body class="theme-dark">
  <!-- Content -->
</body>
```

```scss
// In main style.scss
body.theme-dark {
  @include theme-dark;
}

body.theme-light {
  @include theme-light;
}

body.theme-cyberpunk {
  @include theme-cyberpunk;
}
```

## Common Patterns

### Flexbox Layout
```scss
// Center content both ways
.centered {
  @include flexbox($direction: column, $justify: center, $align: center);
  width: 100%;
  height: 100%;
}

// Navbar: items spaced apart
.navbar {
  @include flexbox($direction: row, $justify: space-between, $align: center);
}
```

### Cards with Hover Effect
```scss
.card {
  background: $bg-color;
  border-radius: 8px;
  padding: $spacing-md;
  transition: all 0.3s ease;
  
  &:hover {
    @include box-shadow(2);
    transform: translateY(-4px);
  }
}
```

### Responsive Grid
```scss
.grid {
  display: grid;
  gap: $spacing-md;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  
  @include respond-to('md') {
    gap: $spacing-lg;
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### States (Loading, Error, Success)
```scss
// In _states.scss
.state-loading {
  opacity: 0.6;
  pointer-events: none;
  
  &::after {
    content: '';
    animation: spin 1s linear infinite;
  }
}

.state-error {
  border-color: $error-color;
  background-color: rgba($error-color, 0.1);
}

.state-success {
  border-color: $success-color;
  background-color: rgba($success-color, 0.1);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## Performance Tips

✅ **DO**:
- Use variables for repeated values
- Combine related styles in components
- Use mixins for common patterns
- Minify CSS in production (sass auto-minifies)
- Keep specificity low (avoid deep nesting)

❌ **DON'T**:
- Don't import entire Bootstrap (use functions/mixins as needed)
- Don't nest more than 3 levels deep
- Don't use `!important` (indicates specificity problem)
- Don't hardcode colors (use variables)
- Don't add unnecessary media queries

## File Naming

```scss
// Partial file names start with underscore
_component-name.scss

// Main file (not a partial)
style.scss

// What to import in style.scss
@import 'base/variables';
@import 'base/reset';
@import 'components/buttons';
// etc.
```

## Debugging Styles

### Check Compiled CSS
- Open DevTools → Styles tab
- Look for the style rule being applied
- Check for specificity conflicts
- Hover over source to see which file

### Inspect Computed Styles
```scss
// In DevTools console
getComputedStyle(element).backgroundColor
```

### Watch for Issues
- Colors not changing: check theme selector specificity
- Spacing off: verify $spacing-* variables
- Responsive broken: check breakpoint media queries
- Animations stuttering: check GPU acceleration (transform, will-change)

## Before Compiling

✅ No hardcoded colors (use $variables)
✅ Responsive tested at: mobile (375px), tablet (768px), desktop (1200px+)
✅ No nested selectors >3 levels
✅ Variables defined in _variables.scss
✅ Mixins defined in _theme-mixins.scss
✅ Theme classes applied to body/root
✅ CSS compiles without errors: `npm run build:css`
