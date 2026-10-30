import { getChampIconUrl } from '../utils/formatters';

export function ChampionSummary({ selectedChamp, mainRole, baseStats, baseWr, ddragonVersion }) {
  return (
    <section className="summary-card">
      <img
        src={getChampIconUrl(selectedChamp, ddragonVersion)}
        alt={selectedChamp}
        className="summary-avatar"
      />
      <div className="summary-info">
        <div className="summary-headline">
          <h2 className="summary-title">{selectedChamp}</h2>
          <span className="role-badge">{mainRole.toUpperCase()}</span>
        </div>
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
            <span className="stat-label">Winrate Base</span>
            <span className="stat-value">{baseWr.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}