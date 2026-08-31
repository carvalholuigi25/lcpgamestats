// Game data formatting and normalization utilities
// Handles video trailer extraction, header images, store links, and achievement normalization

const SAMPLE_VIDEO_URL = 'https://stream.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/highest.mp4';
const SAMPLE_VIDEO_THUMBNAIL = 'https://image.mux.com/BV3YZtogl89mg9VcNBhhnHm02Y34zI1nlMuMQfAbl3dM/thumbnail.webp';

function pickFirstUrl(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function isAbsoluteUrl(u) {
  return typeof u === 'string' && /^(https?:)?\/\//i.test(u);
}

function pickMovieVideoUrl(movie) {
  if (!movie || typeof movie !== 'object') return '';
  // hls_h264 plays back in every browser via hls.js; dash_h264/webm/mp4 are legacy/fallback fields.
  return pickFirstUrl(movie?.hls_h264, movie?.webm?.max, movie?.webm?.high, movie?.webm?.hd, movie?.mp4?.max, movie?.mp4?.high, movie?.mp4?.hd, movie?.dash_h264, movie?.url, movie?.video, movie?.src);
}

function pickMovieThumbnailUrl(movie) {
  if (!movie || typeof movie !== 'object') return '';
  return pickFirstUrl(movie?.thumbnail, movie?.image, movie?.preview);
}

export function getVideoTrailerData(provider, game = {}) {
  const providerId = provider?.id || provider || 'steam';
  const movieVideoCandidates = [];
  const movieThumbnailCandidates = [];

  if (game?.movies && Array.isArray(game.movies)) {
    game.movies.forEach((movie) => {
      movieVideoCandidates.push(pickMovieVideoUrl(movie));
      movieThumbnailCandidates.push(pickMovieThumbnailUrl(movie));
    });
  }

  const candidates = [
    pickFirstUrl(game?.trailer_url, game?.trailerUrl, game?.video_url, game?.videoUrl, game?.movie_url, game?.movieUrl),
    pickFirstUrl(game?.trailer?.url, game?.trailer?.src, game?.video?.url, game?.video?.src, game?.movie?.url, game?.movie?.src),
    pickMovieVideoUrl(game?.movie),
    ...movieVideoCandidates
  ];

  const videoUrl = pickFirstUrl(...candidates);
  const thumbnailUrl = pickFirstUrl(
    game?.trailer_thumbnail,
    game?.trailerThumbnail,
    game?.video_thumbnail,
    game?.videoThumbnail,
    game?.movie_thumbnail,
    game?.movieThumbnail,
    ...movieThumbnailCandidates,
    game?.trailer?.thumbnail,
    game?.video?.thumbnail,
    game?.movie?.thumbnail,
    game?.movie?.image,
    game?.movie?.preview
  );

  if (videoUrl) {
    return {
      videoUrl,
      thumbnailUrl: thumbnailUrl || (providerId === 'steam' ? '' : SAMPLE_VIDEO_THUMBNAIL)
    };
  }

  return {
    videoUrl: SAMPLE_VIDEO_URL,
    thumbnailUrl: SAMPLE_VIDEO_THUMBNAIL
  };
}

export function getHeaderImage(provider, game) {
  const candidate = game.header_image || game.img_logo_url || game.ImageIcon || '';
  if (candidate && isAbsoluteUrl(candidate)) return candidate;

  if (provider.id === 'steam') {
    const base = provider.sampleImageBase || provider.sampleImageBase2 || '';
    if (base && game.appid) return `${base.replace(/\/$/, '')}/${String(game.appid).replace(/^\//, '')}/header.jpg`;
  }

  const base = provider.sampleImageBase || '';
  if (base && game.ImageIcon) return `${base.replace(/\/$/, '')}/${String(game.ImageIcon).replace(/^\//, '')}`;

  return game.header_image || '/images/notfound.jpg';
}

export function getStoreGameLink(provider, game) {
  return game.store_link || `${provider.storeBase}${game.store_path || game.appid || game.id || game.GameId || game.gameId}`;
}

export function resolveAchievementBadgeImage(achievement = {}, appid = '') {
  const directBadge = achievement?.badgeimage || achievement?.image || achievement?.icon || achievement?.badgeIcon || achievement?.badgeicon || '';
  if (typeof directBadge === 'string' && directBadge.trim()) return directBadge.trim();

  const apiname = achievement?.apiname || achievement?.name || achievement?.id || '';
  const cleanedAppid = String(appid || '').trim();
  const cleanedApiname = String(apiname || '').trim();

  if (cleanedAppid && cleanedApiname) {
    const url = `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${encodeURIComponent(cleanedAppid)}/${encodeURIComponent(cleanedApiname)}.jpg`;
    return url;
  }

  return '/images/notfound.jpg';
}

export function normalizeEpicAchievement(achievement) {
  return {
    apiname: achievement?.apiname || achievement?.id || achievement?.name || '',
    name: achievement?.name || achievement?.title || achievement?.apiname || '',
    description: achievement?.description || achievement?.desc || achievement?.descriptionText || '',
    achieved: Boolean(achievement?.achieved || achievement?.unlocked),
    unlocktime: achievement?.unlocktime || achievement?.dateUnlocked || 0,
    badgeimage: achievement?.badgeimage || achievement?.image || '/images/notfound.jpg'
  };
}

export function normalizeGogAchievement(achievement) {
  const unlocked = Boolean(achievement?.date_unlocked || achievement?.achieved || achievement?.unlocked);
  const unlockDate = achievement?.date_unlocked ? new Date(achievement.date_unlocked) : null;

  return {
    apiname: achievement?.achievement_key || achievement?.achievement_id || achievement?.apiname || achievement?.id || '',
    name: achievement?.name || achievement?.achievement_key || '',
    description: achievement?.description || '',
    achieved: unlocked,
    unlocktime: unlockDate && !Number.isNaN(unlockDate.getTime()) ? Math.floor(unlockDate.getTime() / 1000) : 0,
    badgeimage: (unlocked ? achievement?.image_url_unlocked : achievement?.image_url_locked) || achievement?.badgeimage || '/images/notfound.jpg'
  };
}
