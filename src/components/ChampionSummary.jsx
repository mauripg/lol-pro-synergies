import { getChampIconUrl } from '../utils/formatters';
import { ClassBadges, StyleBadge } from './TypeBadges';

function formatDelta(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// mode "delta": muestra cuánto sube/baja su winrate (aliados).
// mode "wr": muestra su winrate en el enfrentamiento (matchups de línea).
function HighlightList({ title, hint, items, emptyText, tone, mode = 'delta', onSelectChamp, ddragonVersion }) {
  return (
    <div className="highlight-block">
      <span className="stat-label" title={hint}>
        {title}
      </span>
      {items.length === 0 ? (
        <span className="highlight-empty">{emptyText}</span>
      ) : (
        <div className="highlight-list">
          {items.map((item) => (
            <button
              key={`${item.ally}-${item.role}`}
              type="button"
              className="highlight-chip"
              onClick={() => onSelectChamp(item.ally, item.role)}
              title={
                mode === 'wr'
                  ? `Contra ${item.ally}: ${item.wins} de ${item.games} ganadas (${formatDelta(item.delta)} vs. su winrate base)`
                  : `Junto a ${item.ally} (${item.role}): ${item.wr.toFixed(1)}% en ${item.games} partidas`
              }
            >
              <img src={getChampIconUrl(item.ally, ddragonVersion)} alt="" className="highlight-icon" />
              <span className="highlight-name">{item.ally}</span>
              {mode === 'delta' && <span className="highlight-role">{item.role}</span>}
              <span className={`highlight-delta ${tone}`}>
                {mode === 'wr' ? `${item.wr.toFixed(1)}%` : formatDelta(item.delta)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChampionSummary({
  selectedChamp,
  champInfo,
  champLanes,
  activeLane,
  onLaneChange,
  hasLaneData,
  mainRole,
  baseStats,
  baseWr,
  highlights,
  hasMatchups,
  onSelectChamp,
  ddragonVersion,
}) {
  return (
    <section className="summary-card">
      <div className="summary-main">
        <img src={getChampIconUrl(selectedChamp, ddragonVersion)} alt="" className="summary-avatar" />
        <div className="summary-info">
          <div className="summary-headline">
            <h2 className="summary-title">{selectedChamp}</h2>
            <ClassBadges classes={champInfo.classes} official={champInfo.official} />
            <StyleBadge style={champInfo.style} />
          </div>

          {hasLaneData ? (
            <div className="lane-picker">
              <div className="role-buttons">
                {champLanes.map(({ role, games }) => (
                  <button
                    key={role}
                    className={`role-button ${activeLane === role ? 'active' : ''}`}
                    onClick={() => onLaneChange(role)}
                    disabled={games === 0}
                    title={`${games} partidas como ${role}`}
                  >
                    {role} <span className="lane-games">{games}</span>
                  </button>
                ))}
                {champLanes.length > 1 && (
                  <button
                    className={`role-button ${activeLane === 'all' ? 'active' : ''}`}
                    onClick={() => onLaneChange('all')}
                  >
                    Todas
                  </button>
                )}
              </div>
            </div>
          ) : (
            <span className="role-badge">{mainRole.toUpperCase()}</span>
          )}

          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">Partidas</span>
              <span className="stat-value">{baseStats.games}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Victorias</span>
              <span className="stat-value">{baseStats.wins}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Winrate base</span>
              <span className="stat-value">{baseWr.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="summary-highlights">
        <HighlightList
          title="Mejor con (su equipo)"
          hint="Aliados con los que más sube su winrate"
          items={highlights.best}
          emptyText="Sin dúos destacados en este filtro."
          tone="positive"
          onSelectChamp={onSelectChamp}
          ddragonVersion={ddragonVersion}
        />
        {hasMatchups && (
          <>
            <HighlightList
              title={`Le gana a (${highlights.lane})`}
              hint="Rivales de su misma línea contra los que mejor le va"
              items={highlights.laneBest}
              emptyText="Sin matchups favorables claros."
              tone="positive"
              mode="wr"
              onSelectChamp={onSelectChamp}
              ddragonVersion={ddragonVersion}
            />
            <HighlightList
              title={`Lo counterean (${highlights.lane})`}
              hint="Rivales de su misma línea contra los que peor le va"
              items={highlights.laneWorst}
              emptyText="Sin counters claros en este filtro."
              tone="negative"
              mode="wr"
              onSelectChamp={onSelectChamp}
              ddragonVersion={ddragonVersion}
            />
          </>
        )}
      </div>
    </section>
  );
}
