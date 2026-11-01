import { getChampIconUrl } from '../utils/formatters';
import { ClassBadges, StyleBadge } from './TypeBadges';
import { RoleButtons, MoreFilters } from './Filters';

const MODES = {
  synergy: {
    tab: 'Sinergias',
    partner: 'Compañero',
    wr: 'Winrate dúo',
    help: 'Winrate del campeón cuando juega junto a este aliado.',
  },
  counter: {
    tab: 'Counters',
    partner: 'Rival',
    wr: 'Winrate vs.',
    help: 'Winrate del campeón contra este rival. Impacto negativo = lo countera.',
  },
};

function getColumns(mode) {
  const labels = MODES[mode];
  return [
    { key: 'ally', label: labels.partner },
    { key: 'role', label: 'Línea' },
    { key: 'type', label: 'Tipo', title: 'Clase oficial y estilo de pelea' },
    { key: 'games', label: 'Partidas' },
    { key: 'wr', label: labels.wr },
    { key: 'delta', label: 'Impacto', title: 'Diferencia con el winrate base del campeón' },
  ];
}

function SortableHeader({ column, sortConfig, onSort }) {
  const isActive = sortConfig.key === column.key;
  const arrow = isActive ? (sortConfig.dir === 'asc' ? '▲' : '▼') : '↕';
  const ariaSort = isActive ? (sortConfig.dir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <th aria-sort={ariaSort}>
      <button
        type="button"
        className={`sort-button ${isActive ? 'active' : ''}`}
        onClick={() => onSort(column.key)}
        title={column.title || 'Ordenar'}
      >
        {column.label}
        <span className="sort-arrow">{arrow}</span>
      </button>
    </th>
  );
}

function formatDelta(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function SynergyTable({
  mode,
  onModeChange,
  hasMatchups,
  matchupLane,
  synergiesList,
  onSelectChamp,
  baseWr,
  roleFilter,
  onRoleFilterChange,
  classFilter,
  onClassFilterChange,
  styleFilter,
  onStyleFilterChange,
  minGames,
  sortConfig,
  onSort,
  ddragonVersion,
}) {
  const labels = MODES[mode];
  const columns = getColumns(mode);

  return (
    <section className="table-section">
      <div className="table-header">
        <div className="table-tabs" role="tablist">
          {Object.entries(MODES).map(([key, m]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={`table-tab ${mode === key ? 'active' : ''}`}
              onClick={() => onModeChange(key)}
              disabled={key === 'counter' && !hasMatchups}
              title={key === 'counter' && !hasMatchups ? 'Regenera los datos (npm run data) para ver counters' : m.help}
            >
              {m.tab}
            </button>
          ))}
        </div>
        <p className="table-help">{labels.help}</p>
      </div>

      <div className="toolbar table-toolbar">
        {mode === 'counter' && matchupLane && (
          <button
            type="button"
            className={`lane-shortcut ${roleFilter === matchupLane ? 'active' : ''}`}
            onClick={() => onRoleFilterChange(roleFilter === matchupLane ? 'all' : matchupLane)}
            title="Mostrar solo los rivales que juegan en su misma línea"
          >
            Solo su línea ({matchupLane})
          </button>
        )}
        <RoleButtons value={roleFilter} onChange={onRoleFilterChange} />
        <MoreFilters
          id="table-filters"
          styleValue={styleFilter}
          onStyleChange={onStyleFilterChange}
          classValue={classFilter}
          onClassChange={onClassFilterChange}
        />
      </div>

      <div className="table-container">
        <table className="synergy-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <SortableHeader key={column.key} column={column} sortConfig={sortConfig} onSort={onSort} />
              ))}
            </tr>
          </thead>
          <tbody>
            {synergiesList.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  No hay dúos con al menos {minGames} partidas en este filtro.
                </td>
              </tr>
            ) : (
              synergiesList.map((row) => {
                const isPositive = row.delta >= 0;
                return (
                  <tr key={`${row.ally}-${row.role}`}>
                    <td>
                      <button
                        type="button"
                        className="champ-cell"
                        onClick={() => onSelectChamp(row.ally, row.role)}
                        title={`Ver ${row.ally}`}
                      >
                        <img src={getChampIconUrl(row.ally, ddragonVersion)} alt="" className="champ-cell-thumb" />
                        <span className="champ-cell-name">{row.ally}</span>
                      </button>
                    </td>
                    <td>
                      <span className="role-badge small">{row.role.toUpperCase()}</span>
                    </td>
                    <td>
                      <div className="type-cell">
                        <ClassBadges classes={row.classes} official={row.official} small />
                        <StyleBadge style={row.style} small />
                      </div>
                    </td>
                    <td>{row.games}</td>
                    <td>
                      <div className="wr-bar-container" title={`${row.wins} de ${row.games} ganadas`}>
                        <span className="wr-label">{row.wr.toFixed(1)}%</span>
                        <div className="wr-bar-track">
                          <div
                            className={`wr-bar-fill ${row.wr >= baseWr ? 'above' : 'below'}`}
                            style={{ width: `${Math.min(row.wr, 100)}%` }}
                          />
                          <div className="wr-bar-base" style={{ left: `${Math.min(baseWr, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`delta-badge ${isPositive ? 'positive' : 'negative'}`}>
                        {formatDelta(row.delta)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="table-footnote">
        Dúos con al menos {minGames} partidas. La marca blanca en la barra es el winrate base del campeón.
      </p>
    </section>
  );
}
