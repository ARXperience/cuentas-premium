export const serviceAliases: Array<{ key: string; aliases: string[] }> = [
  { key: 'netflix', aliases: ['netflix', 'nflx'] },
  { key: 'disney', aliases: ['disney', 'disney+', 'disney plus'] },
  { key: 'hbo', aliases: ['hbo', 'hbo max', 'max'] },
  { key: 'amazon', aliases: ['amazon', 'amazon prime', 'prime video', 'amazon prime video'] },
  { key: 'crunchyroll', aliases: ['crunchyroll', 'crunchy'] },
  { key: 'paramount', aliases: ['paramount', 'paramount+'] },
  { key: 'apple', aliases: ['apple tv', 'appletv'] },
  { key: 'plex', aliases: ['plex'] },
  { key: 'vix', aliases: ['vix', 'vix+'] },
  { key: 'iptv', aliases: ['iptv', 'smarters'] },
  { key: 'directv', aliases: ['directv', 'dgo', 'directv go'] },
  { key: 'spotify', aliases: ['spotify'] },
  { key: 'youtube', aliases: ['youtube', 'youtube premium', 'yt premium'] },
  { key: 'xbox', aliases: ['xbox', 'xbox game pass', 'game pass', 'gamepass'] },
  { key: 'chatgpt', aliases: ['chatgpt', 'chat gpt', 'openai'] }
];

function normalizeMatchText(text: string) {
  return text
    .replace(/Ã±/gi, 'n')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function serviceKeyFromText(text: string) {
  const normalized = normalizeMatchText(text);
  return serviceAliases.find((entry) => entry.aliases.some((alias) => normalized.includes(alias)))?.key || '';
}
