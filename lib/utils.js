export const isAbsoluteUrl = (u) => typeof u === 'string' && /^(https?:)?\/\//i.test(u);

export function getHeaderImage(provider, game) {
  const candidate = game.header_image || game.img_logo_url || game.ImageIcon || '';
  if (candidate && isAbsoluteUrl(candidate)) return candidate;

  if (provider.id === 'steam') {
    const logoPart = game.img_logo_url || 'header';
    const base = provider.sampleImageBase2 || provider.sampleImageBase || '';
    if (base) return `${base.replace(/\/$/, '')}/${String(game.appid).replace(/^\//, '')}/${String(logoPart).replace(/^\//, '')}.jpg`;
  }

  const base = provider.sampleImageBase || '';
  if (base && game.ImageIcon) return `${base.replace(/\/$/, '')}/${String(game.ImageIcon).replace(/^\//, '')}`;

  return game.header_image || '/images/notfound.jpg';
}

export function getStoreGameLink(provider, game) {
  return game.store_link || `${provider.storeBase}${game.store_path || game.appid || game.id || game.GameId || game.gameId}`;
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
