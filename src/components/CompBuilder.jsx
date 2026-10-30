import { useMemo, useState } from 'react';
import { getChampIconUrl } from '../utils/formatters';
import { getLaneGames } from '../utils/stats';
import { ROLES, suggestPicks, teamPairs } from '../utils/comp';
import { ClassBadges, StyleBadge } from './TypeBadges';
import { MoreFilters } from './Filters';
import { ChampionPicker } from './ChampionPicker';

// Partidas mínimas sumadas entre el candidato y tus picks para sugerirlo.
const MIN_PAIR_GAMES = 8;

const ROLE_LABELS = { top: 'Top', jng: 'Jungla', mid: 'Mid', bot: 'Bot', sup: 'Support' };

function formatDelta(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function SlotInput({ role, value, options, onPick, onClear, ddragonVersion }) {
  if (value) {
    return (
      <div className="comp-slot filled">
        <span className="comp-slot-role">{ROLE_LABELS[role]}</span>
        <div className="comp-slot-champ">
          <img src={getChampIconUrl(value, ddragonVersion)} alt="" className="comp-slot-icon" />
          <span className="comp-slot-name">{value}</span>
          <button type="button" className="comp-slot-clear" onClick={onClear} aria-label={`Quitar ${value}`}>
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="comp-slot">
      <label className="comp-slot-role" htmlFor={`slot-${role}`}>
        {ROLE_LABELS[role]}
      </label>
      <ChampionPicker id={`slot-${role}`} options={options} onPick={onPick} ddragonVersion={ddragonVersion} />
    </div>
  );
}

export function CompBuilder({ data, slots, setSlots, tier, patchScope, getChampInfo, onSelectChamp, ddragonVersion }) {
  const [targetRole, setTargetRole] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');

  const emptyRoles = ROLES.filter((r) => !slots[r]);
  const pickedCount = ROLES.length - emptyRoles.length;
  const targetRoles = targetRole === 'all' || slots[targetRole] ? emptyRoles : [targetRole];

  // Opciones por línea: campeones jugados en esa línea, de más a menos partidas.
  const optionsByRole = useMemo(() => {
    const result = {};
    if (!data) return result;
    for (const role of ROLES) {
      result[role] = Object.entries(data.champions)
        .map(([name, champ]) => ({ name, games: getLaneGames(champ, role, 'all', 'all') }))
        .filter((c) => c.games > 0)
        .sort((a, b) => b.games - a.games);
    }
    return result;
  }, [data]);

  const suggestions = useMemo(
    () =>
      suggestPicks({
        data,
        slots,
        targetRoles,
        scope: patchScope,
        tier,
        getChampInfo,
        styleFilter,
        classFilter,
      })
        .filter((s) => s.pairGames >= MIN_PAIR_GAMES)
        .slice(0, 15),
    [data, slots, targetRoles.join(','), patchScope, tier, getChampInfo, styleFilter, classFilter]
  );

  const pairs = useMemo(() => teamPairs({ data, slots, scope: patchScope, tier }), [data, slots, patchScope, tier]);

  const setSlot = (role, champ) => setSlots((prev) => ({ ...prev, [role]: champ }));

  return (
    <section className="comp-section">
      <div className="comp-header">
        <h2 className="section-title">Armador de composición</h2>
        {pickedCount > 0 && (
          <button
            type="button"
            className="clear-filters"
            onClick={() => setSlots({ top: null, jng: null, mid: null, bot: null, sup: null })}
          >
            Vaciar equipo
          </button>
        )}
      </div>
      <p className="table-help">
        Elige de 1 a 4 campeones y te sugerimos el resto según cómo rinden junto a ellos en partidas profesionales. El
        puntaje es el promedio de cuánto sube (o baja) el winrate de cada candidato junto a tus picks.
      </p>

      <div className="comp-slots">
        {ROLES.map((role) => (
          <SlotInput
            key={role}
            role={role}
            value={slots[role]}
            options={(optionsByRole[role] || []).filter((o) => !Object.values(slots).includes(o.name))}
            onPick={(champ) => setSlot(role, champ)}
            onClear={() => setSlot(role, null)}
            ddragonVersion={ddragonVersion}
          />
        ))}
      </div>

      {pairs.length > 0 && (
        <div className="comp-pairs">
          <span className="filter-label">Sinergias del equipo:</span>
          {pairs.map((p) => (
            <span
              key={`${p.a}-${p.b}`}
              className={`pair-chip ${p.delta >= 0 ? 'positive' : 'negative'}`}
              title={`${p.games} partidas juntos`}
            >
              {p.a} + {p.b} <strong>{formatDelta(p.delta)}</strong>
            </span>
          ))}
        </div>
      )}

      {pickedCount === 0 ? (
        <div className="empty-message">Elige al menos un campeón para ver sugerencias.</div>
      ) : emptyRoles.length === 0 ? (
        <div className="empty-message">Equipo completo. Quita un campeón para ver alternativas.</div>
      ) : (
        <>
          <div className="toolbar comp-toolbar">
            <span className="filter-label">Sugerir para:</span>
            <div className="role-buttons">
              <button
                type="button"
                className={`role-button ${targetRole === 'all' ? 'active' : ''}`}
                onClick={() => setTargetRole('all')}
              >
                Libres
              </button>
              {emptyRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`role-button ${targetRole === role ? 'active' : ''}`}
                  onClick={() => setTargetRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
            <MoreFilters
              id="comp-filters"
              styleValue={styleFilter}
              onStyleChange={setStyleFilter}
              classValue={classFilter}
              onClassChange={setClassFilter}
            />
          </div>

          <div className="table-container">
            <table className="synergy-table">
              <thead>
                <tr>
                  <th>Candidato</th>
                  <th>Línea</th>
                  <th>Tipo</th>
                  <th title="Promedio de cuánto sube su winrate junto a cada pick">Puntaje</th>
                  <th title="Partidas sumadas junto a tus picks">Partidas juntos</th>
                  <th>WR base</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {suggestions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="table-empty">
                      Sin candidatos con datos suficientes para estos filtros.
                    </td>
                  </tr>
                ) : (
                  suggestions.map((s) => (
                    <tr key={`${s.name}-${s.role}`}>
                      <td>
                        <button type="button" className="champ-cell" onClick={() => onSelectChamp(s.name, s.role)}>
                          <img src={getChampIconUrl(s.name, ddragonVersion)} alt="" className="champ-cell-thumb" />
                          <span className="champ-cell-name">{s.name}</span>
                        </button>
                      </td>
                      <td>
                        <span className="role-badge small">{s.role.toUpperCase()}</span>
                      </td>
                      <td>
                        <div className="type-cell">
                          <ClassBadges classes={s.classes} official={s.official} small />
                          <StyleBadge style={s.style} small />
                        </div>
                      </td>
                      <td>
                        <span
                          className={`delta-badge ${s.score >= 0 ? 'positive' : 'negative'}`}
                          title={s.breakdown
                            .map((b) => `${b.ally}: ${formatDelta(b.delta)} (${b.games} p.)`)
                            .join('\n')}
                        >
                          {formatDelta(s.score)}
                        </span>
                      </td>
                      <td>{s.pairGames}</td>
                      <td>{s.baseWr.toFixed(1)}%</td>
                      <td>
                        <button type="button" className="add-button" onClick={() => setSlot(s.role, s.name)}>
                          Agregar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
