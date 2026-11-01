import { gw, adjustedWr } from './stats';

export const ROLES = ['top', 'jng', 'mid', 'bot', 'sup'];

function getRoleStats(champData, role, scope, tier) {
  return gw(champData?.byRole?.[role]?.stats?.[scope]?.[tier]);
}

// Sinergia de un par (desde el punto de vista de `champ` en `role`) ajustada hacia su winrate base.
function pairSynergy(champData, role, ally, allyRole, scope, tier) {
  const base = getRoleStats(champData, role, scope, tier);
  const baseWr = base.games > 0 ? (base.wins / base.games) * 100 : 50;
  const pair = gw(champData?.byRole?.[role]?.synergies?.[scope]?.[tier]?.[`${ally}|${allyRole}`]);
  const adj = adjustedWr(pair.wins, pair.games, baseWr);
  return { games: pair.games, wins: pair.wins, delta: adj - baseWr };
}

/**
 * Sugiere campeones para las líneas vacías de una composición.
 * Puntaje = promedio de la sinergia ajustada del candidato con cada aliado elegido.
 */
export function suggestPicks({ data, slots, targetRoles, scope, tier, getChampInfo, styleFilter, classFilter, minBaseGames = 5 }) {
  if (!data) return [];
  const allies = Object.entries(slots).filter(([, champ]) => champ);
  if (allies.length === 0) return [];
  const taken = new Set(allies.map(([, champ]) => champ));

  const results = [];
  for (const [name, champData] of Object.entries(data.champions)) {
    if (taken.has(name) || !champData.byRole) continue;
    const info = getChampInfo(name);
    if (styleFilter !== 'all' && info.style !== styleFilter) continue;
    if (classFilter !== 'all' && !info.classes.includes(classFilter)) continue;

    for (const role of targetRoles) {
      const base = getRoleStats(champData, role, scope, tier);
      if (base.games < minBaseGames) continue;

      const breakdown = allies.map(([allyRole, ally]) => ({
        ally,
        allyRole,
        ...pairSynergy(champData, role, ally, allyRole, scope, tier),
      }));
      const pairGames = breakdown.reduce((sum, b) => sum + b.games, 0);
      if (pairGames === 0) continue;

      const score = breakdown.reduce((sum, b) => sum + b.delta, 0) / breakdown.length;
      results.push({
        name,
        role,
        score,
        pairGames,
        baseGames: base.games,
        baseWr: (base.wins / base.games) * 100,
        breakdown,
        ...info,
      });
    }
  }

  return results.sort((a, b) => b.score - a.score || b.pairGames - a.pairGames);
}

// Sinergias entre los campeones ya elegidos (para mostrar cómo encaja el equipo actual).
export function teamPairs({ data, slots, scope, tier }) {
  const picked = Object.entries(slots).filter(([, champ]) => champ);
  const pairs = [];
  for (let i = 0; i < picked.length; i++) {
    for (let j = i + 1; j < picked.length; j++) {
      const [roleA, champA] = picked[i];
      const [roleB, champB] = picked[j];
      const syn = pairSynergy(data?.champions[champA], roleA, champB, roleB, scope, tier);
      pairs.push({ a: champA, b: champB, ...syn });
    }
  }
  return pairs;
}
