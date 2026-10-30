import { formatPatch } from '../utils/formatters';

export function Header({ metadata, tier, setTier, patchScope, setPatchScope }) {
  const latestFormatted = formatPatch(metadata.latestPatch);
  const prevFormatted = formatPatch(metadata.previousPatch);

  return (
    <header className="app-header">
      <div className="header-titles">
        <h1 className="header-title">LoL Pro Synergies</h1>
        <div className="header-meta">
          <span>Partidas analizadas: <strong>{metadata.totalMatches.toLocaleString()}</strong></span>
          <span className="meta-separator">•</span>
          <span>Parche actual: <strong>{latestFormatted}</strong></span>
        </div>
      </div>

      <div className="header-filters">
        <div className="filter-group">
          <span className="filter-label">Ámbito:</span>
          <div className="segmented-control">
            <button
              className={`segmented-button ${tier === 'all' ? 'active' : ''}`}
              onClick={() => setTier('all')}
            >
              Todas las ligas
            </button>
            <button
              className={`segmented-button ${tier === 't1' ? 'active' : ''}`}
              onClick={() => setTier('t1')}
            >
              Tier 1
            </button>
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-label">Parche:</span>
          <div className="segmented-control">
            <button
              className={`segmented-button ${patchScope === 'all' ? 'active' : ''}`}
              onClick={() => setPatchScope('all')}
            >
              Todo el año
            </button>
            <button
              className={`segmented-button ${patchScope === 'recent' ? 'active' : ''}`}
              onClick={() => setPatchScope('recent')}
            >
              {prevFormatted} + {latestFormatted}
            </button>
            <button
              className={`segmented-button ${patchScope === 'latest' ? 'active' : ''}`}
              onClick={() => setPatchScope('latest')}
            >
              {latestFormatted}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}