import { getChampIconUrl } from '../utils/formatters';

const ROLES = ['all', 'top', 'jng', 'mid', 'bot', 'sup'];

export function PopularPicks({
  popularChamps,
  selectedChamp,
  onSelectChamp,
  roleFilter,
  onRoleFilterChange,
  ddragonVersion,
}) {
  return (
    <section className="popular-section">
      <div className="popular-header">
        <span className="section-title">Más jugados en el filtro:</span>
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

      <div className="popular-grid">
        {popularChamps.length === 0 ? (
          <div className="empty-message">Sin registros para este rol en el parche actual.</div>
        ) : (
          popularChamps.map((champ) => (
            <button
              key={champ.name}
              className={`pick-card ${selectedChamp === champ.name ? 'active' : ''}`}
              onClick={() => onSelectChamp(champ.name)}
            >
              <img
                src={getChampIconUrl(champ.name, ddragonVersion)}
                alt={champ.name}
                className="pick-card-thumb"
              />
              <span className="pick-card-name">{champ.name}</span>
              <span className="pick-card-games">{champ.games}p</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}