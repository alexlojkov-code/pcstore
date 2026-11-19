// «Температура» заявки (PRD §5.4, SPEC §6.3).
export function score({ timing, budget } = {}) {
  if (timing === 'browsing') return 'cold';
  if ((timing === 'now' || timing === 'week') && budget !== 'unknown') return 'hot';
  return 'warm';
}

export const TEMPERATURE = {
  hot: { icon: '🔥', label: 'горячая' },
  warm: { icon: '🟡', label: 'тёплая' },
  cold: { icon: '❄️', label: 'холодная' },
};
