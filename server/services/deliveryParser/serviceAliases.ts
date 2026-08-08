export const deliveryServiceAliases: Array<{ canonical: string; key: string; aliases: string[] }> = [
  { canonical: 'Netflix', key: 'netflix', aliases: ['netflix', 'nflx'] },
  { canonical: 'Disney+', key: 'disney', aliases: ['disney', 'disney+', 'disney plus'] },
  { canonical: 'HBO Max', key: 'hbo', aliases: ['hbo', 'hbo max', 'max'] },
  { canonical: 'Amazon Prime', key: 'amazon', aliases: ['amazon', 'amazon prime', 'amazon prime video', 'prime video'] },
  { canonical: 'Crunchyroll', key: 'crunchyroll', aliases: ['crunchyroll', 'crunchy'] },
  { canonical: 'Paramount+', key: 'paramount', aliases: ['paramount', 'paramount+'] },
  { canonical: 'Apple TV', key: 'apple', aliases: ['apple', 'apple tv', 'apple tv+', 'appletv'] },
  { canonical: 'Plex', key: 'plex', aliases: ['plex'] },
  { canonical: 'VIX', key: 'vix', aliases: ['vix', 'vixx'] },
  { canonical: 'IPTV', key: 'iptv', aliases: ['iptv', 'smarters'] },
  { canonical: 'DIRECTV GO', key: 'directv', aliases: ['directv', 'directv go', 'dgo'] },
  { canonical: 'Spotify', key: 'spotify', aliases: ['spotify'] },
  { canonical: 'YouTube Premium', key: 'youtube', aliases: ['youtube', 'youtube premium', 'yt premium'] },
  { canonical: 'Xbox Game Pass', key: 'xbox', aliases: ['xbox', 'xbox game pass', 'game pass', 'gamepass'] },
  { canonical: 'ChatGPT', key: 'chatgpt', aliases: ['chatgpt', 'chat gpt', 'openai'] }
];

function normalizeMatchText(text: string) {
  return text
    .replace(/Ã±/gi, 'n')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function deliveryServiceFromText(text: string) {
  const normalized = normalizeMatchText(text);
  return deliveryServiceAliases.find((entry) => entry.aliases.some((alias) => normalized.includes(alias)));
}
