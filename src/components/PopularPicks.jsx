import { getChampIconUrl } from '../utils/formatters';
import { RoleButtons, MoreFilters } from './Filters';

export function PopularPicks({
  popularChamps,
  selectedChamp,
  onSelectChamp,
  roleFilter,
  onRoleFilterChange,
  styleFilter,
  onStyleFilterChange,
  classFilter,
  onClassFilterChange,
  ddragonVersion,
}) {
  return (
    <section className="popular-section">
      <div className="toolbar">
        <span className="section-title">Más jugados</span>
        <RoleButtons value={roleFilter} onChange={onRoleFilterChange} allLabel="Todos" />
        <MoreFilters
          id="popular-filters"
          styleValue={styleFilter}
          onStyleChange={onStyleFilterChange}
          classValue={classFilter}
          onClassChange={onClassFilterChange}
        />
      </div>

      <div className="popular-grid">
        {popularChamps.length === 0 ? (
          <div className="empty-message">Sin registros con estos filtros.</div>
        ) : (
          popularChamps.map((champ) => (
            <button
              key={champ.name}
              className={`pick-card ${selectedChamp === champ.name ? 'active' : ''}`}
              onClick={() => onSelectChamp(champ.name, roleFilter === 'all' ? null : roleFilter)}
            >
              <img src={getChampIconUrl(champ.name, ddragonVersion)} alt="" className="pick-card-thumb" />
              <span className="pick-card-name">{champ.name}</span>
              <span className="pick-card-games">{champ.games}p</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
