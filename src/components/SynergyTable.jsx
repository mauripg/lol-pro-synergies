import { getChampIconUrl } from '../utils/formatters';

const ROLES = ['all', 'top', 'jng', 'mid', 'bot', 'sup'];

export function SynergyTable({
  synergiesList,
  roleFilter,
  onRoleFilterChange,
  minGames,
  ddragonVersion,
}) {
  return (
    <section className="table-section">
      <div className="table-header">
        <h3 className="section-title">Compañeros y Sinergias</h3>
        <div className="role-buttons">
          {ROLES.map((role) => (
            <button
              key={role}
              className={`role-button ${roleFilter === role ? 'active' : ''}`}
              onClick={() => onRoleFilterChange(role)}
            >
              {role === 'all' ? 'Todos' : role}
            </button>
          ))}
        </div>
      </div>

      <div className="table-container">
        <table className="synergy-table">
          <thead>
            <tr>
              <th>Compañero</th>
              <th>Línea</th>
              <th>Partidas</th>
              <th>Victorias</th>
              <th>Winrate Dúo</th>
              <th>Impacto (Delta)</th>
            </tr>
          </thead>
          <tbody>
            {synergiesList.length === 0 ? (
              <tr>
                <td colSpan="6" className="table-empty">
                  No hay suficientes datos (mínimo {minGames} partidas con este filtro).
                </td>
              </tr>
            ) : (
              synergiesList.map((row) => {
                const isPositive = row.delta >= 0;
                return (
                  <tr key={`${row.ally}-${row.role}`}>
                    <td className="champ-cell">
                      <img
                        src={getChampIconUrl(row.ally, ddragonVersion)}
                        alt={row.ally}
                        className="champ-cell-thumb"
                      />
                      <span className="champ-cell-name">{row.ally}</span>
                    </td>
                    <td>
                      <span className="role-badge small">{row.role.toUpperCase()}</span>
                    </td>
                    <td>{row.games}</td>
                    <td>{row.wins}</td>
                    <td>
                      <div className="wr-bar-container">
                        <span className="wr-label">{row.wr.toFixed(1)}%</span>
                        <div className="wr-bar-track">
                          <div
                            className="wr-bar-fill"
                            style={{ width: `${Math.min(row.wr, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`delta-badge ${isPositive ? 'positive' : 'negative'}`}>
                        {isPositive ? `+${row.delta.toFixed(1)}%` : `${row.delta.toFixed(1)}%`}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}