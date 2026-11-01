import { useMemo, useState } from 'react';
import { getChampIconUrl } from '../utils/formatters';
import { gw } from '../utils/stats';
import { ROLES } from '../utils/comp';

const ROLE_LABELS = { top: 'Top', jng: 'Jungla', mid: 'Mid', bot: 'Bot', sup: 'Support' };
const TOP_N = 10;
// Para el ranking por winrate se exige un mínimo de partidas en la línea (si no, un 3-0 queda
// primero): el mayor entre un piso fijo y una presencia mínima (% de las partidas de esa línea).
const MIN_GAMES_BY_SCOPE = { all: 20, recent: 8, latest: 4 };
const MIN_PRESENCE = 0.01; // 1%

function getRoleStats(champData, role, scope, tier) {
  if (champData.byRole) return gw(champData.byRole[role]?.stats?.[scope]?.[tier]);
  return { games: 0, wins: 0 };
}

export function Home({ data, tier, patchScope, onSelectChamp, ddragonVersion }) {
  const [sortBy, setSortBy] = useState('wr');
  const minFloor = MIN_GAMES_BY_SCOPE[patchScope] ?? 5;

  const byRole = useMemo(() => {
    const result = {};
    for (const role of ROLES) {
      const rows = Object.entries(data.champions)
        .map(([name, champ]) => {
          const { games, wins } = getRoleStats(champ, role, patchScope, tier);
          return { name, games, wr: games > 0 ? (wins / games) * 100 : 0 };
        })
        .filter((r) => r.games > 0);
      const roleGames = rows.reduce((sum, r) => sum + r.games, 0);
      const minGames = Math.max(minFloor, Math.ceil(roleGames * MIN_PRESENCE));
      result[role] = rows
        .filter((r) => sortBy === 'games' || r.games >= minGames)
        .sort((a, b) => (sortBy === 'wr' ? b.wr - a.wr || b.games - a.games : b.games - a.games))
        .slice(0, TOP_N)
        .map((r) => ({ ...r, pickRate: roleGames > 0 ? (r.games / roleGames) * 100 : 0 }));
    }
    return result;
  }, [data, patchScope, tier, sortBy, minFloor]);

  const hasLaneData = Object.values(data.champions).some((c) => c.byRole);
  if (!hasLaneData) {
    return (
      <div className="empty-message">
        Los datos están en el formato antiguo. Regenéralos con <code>npm run data</code> para ver el inicio.
      </div>
    );
  }

  return (
    <section className="home-section">
      <div className="home-header">
        <h2 className="home-title">Mejores campeones por línea</h2>
        <div className="segmented-control">
          <button
            type="button"
            className={`segmented-button ${sortBy === 'wr' ? 'active' : ''}`}
            onClick={() => setSortBy('wr')}
          >
            Winrate
          </button>
          <button
            type="button"
            className={`segmented-button ${sortBy === 'games' ? 'active' : ''}`}
            onClick={() => setSortBy('games')}
          >
            Más jugados
          </button>
        </div>
        {/* El texto va debajo, a todo el ancho: su largo cambia según el orden y no debe mover el selector. */}
        <p className="table-help home-help">
          {sortBy === 'wr'
            ? `Ordenados por winrate, entre los que tienen al menos ${MIN_PRESENCE * 100}% de presencia en su línea.`
            : 'Ordenados por cantidad de partidas.'}{' '}
          Haz click en uno para ver sus sinergias y counters.
        </p>
      </div>

      <div className="home-grid">
        {ROLES.map((role) => (
          <div key={role} className="home-role">
            <div className="home-role-header">
              <span className="home-role-name">{ROLE_LABELS[role]}</span>
              <span className="home-role-col">{sortBy === 'wr' ? 'WR' : 'Partidas'}</span>
            </div>
            {byRole[role].length === 0 ? (
              <div className="highlight-empty">Sin datos suficientes.</div>
            ) : (
              <ol className="home-list">
                {byRole[role].map((r, i) => (
                  <li key={r.name}>
                    <button
                      type="button"
                      className="home-row"
                      onClick={() => onSelectChamp(r.name, role)}
                      title={`${r.name} · ${r.wr.toFixed(1)}% en ${r.games} partidas · presencia ${r.pickRate.toFixed(1)}%`}
                    >
                      <span className="home-rank">{i + 1}</span>
                      <img src={getChampIconUrl(r.name, ddragonVersion)} alt="" className="home-icon" />
                      <span className="home-name">{r.name}</span>
                      <span className="home-stats">
                        <span
                          className={`home-value ${sortBy === 'wr' ? (r.wr >= 50 ? 'positive' : 'negative') : ''}`}
                        >
                          {sortBy === 'wr' ? `${r.wr.toFixed(1)}%` : r.games}
                        </span>
                        <span className="home-sub">
                          {sortBy === 'wr' ? `${r.games} p.` : `${r.wr.toFixed(1)}% WR`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
