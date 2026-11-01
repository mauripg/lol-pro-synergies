// Utilidades para leer synergies.json y calcular estadísticas más robustas.

export const EMPTY = { games: 0, wins: 0 };

// Acepta [partidas, victorias] (formato nuevo) u { games, wins } (formato antiguo).
export function gw(value) {
  if (!value) return EMPTY;
  if (Array.isArray(value)) return { games: value[0], wins: value[1] };
  return value;
}

function sumInto(target, value) {
  const { games, wins } = gw(value);
  target.games += games;
  target.wins += wins;
}

// Devuelve { stats, synergies, matchups } de un campeón para una línea ('all' = todas sumadas).
// Los mapas devueltos tienen valores { games, wins }.
export function getChampSlice(champData, lane, scope, tier) {
  const result = { stats: { games: 0, wins: 0 }, synergies: {}, matchups: {} };
  if (!champData) return result;

  // Formato antiguo: sin separación por línea ni counters.
  if (!champData.byRole) {
    sumInto(result.stats, champData.stats?.[scope]?.[tier]);
    for (const [k, v] of Object.entries(champData.synergies?.[scope]?.[tier] || {})) {
      result.synergies[k] = gw(v);
    }
    return result;
  }

  const entries = lane === 'all' ? Object.values(champData.byRole) : [champData.byRole[lane]].filter(Boolean);
  for (const entry of entries) {
    sumInto(result.stats, entry.stats?.[scope]?.[tier]);
    for (const field of ['synergies', 'matchups']) {
      for (const [k, v] of Object.entries(entry[field]?.[scope]?.[tier] || {})) {
        if (!result[field][k]) result[field][k] = { games: 0, wins: 0 };
        sumInto(result[field][k], v);
      }
    }
  }
  return result;
}

export function getLaneGames(champData, lane, scope, tier) {
  if (!champData) return 0;
  if (!champData.byRole) return gw(champData.stats?.[scope]?.[tier]).games;
  const entries = lane === 'all' ? Object.values(champData.byRole) : [champData.byRole[lane]].filter(Boolean);
  return entries.reduce((sum, e) => sum + gw(e.stats?.[scope]?.[tier]).games, 0);
}

// Partidas "virtuales" con las que se acerca un winrate al promedio (solo para ordenar
// sugerencias del armador: así un 2-0 no supera a un 60% en 50 partidas).
export const PRIOR_GAMES = 10;

// Winrate ajustado (suavizado bayesiano) hacia `priorWr` (en %).
export function adjustedWr(wins, games, priorWr, priorGames = PRIOR_GAMES) {
  return ((wins + (priorWr / 100) * priorGames) / (games + priorGames)) * 100;
}
