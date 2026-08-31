// URL validation utilities
// Extracted from gameData for general-purpose use

export const isAbsoluteUrl = (u) => typeof u === 'string' && /^(https?:)?\/\//i.test(u);

export const isHlsSource = (u) => typeof u === 'string' && /\.m3u8(\?|$)/i.test(u);
