import { useState } from 'react';
import { CLASS_INFO, STYLE_INFO } from '../data/championTypes';

const ROLES = ['all', 'top', 'jng', 'mid', 'bot', 'sup'];

// Subclases agrupadas por clase principal para el selector.
const CLASS_GROUPS = Object.entries(CLASS_INFO).reduce((groups, [key, info]) => {
  (groups[info.family] ||= []).push({ key, label: info.label });
  return groups;
}, {});

export function RoleButtons({ value, onChange, roles = ROLES, allLabel = 'Todas' }) {
  return (
    <div className="role-buttons">
      {roles.map((role) => (
        <button
          key={role}
          type="button"
          className={`role-button ${value === role ? 'active' : ''}`}
          onClick={() => onChange(role)}
        >
          {role === 'all' ? allLabel : role}
        </button>
      ))}
    </div>
  );
}

export function StyleButtons({ value, onChange }) {
  return (
    <div className="role-buttons">
      <button
        type="button"
        className={`role-button ${value === 'all' ? 'active' : ''}`}
        onClick={() => onChange('all')}
      >
        Todos
      </button>
      {Object.entries(STYLE_INFO).map(([key, info]) => (
        <button
          key={key}
          type="button"
          className={`role-button no-transform ${value === key ? 'active' : ''}`}
          onClick={() => onChange(key)}
          title={info.description}
        >
          {info.label}
        </button>
      ))}
    </div>
  );
}

export function ClassSelect({ id, value, onChange }) {
  return (
    <select id={id} className="filter-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="all">Todas</option>
      {Object.entries(CLASS_GROUPS).map(([family, items]) => (
        <optgroup key={family} label={family}>
          {items.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// Botón "Filtros" que despliega Estilo y Clase; muestra cuántos hay activos.
export function MoreFilters({ id, styleValue, onStyleChange, classValue, onClassChange }) {
  const [open, setOpen] = useState(false);
  const activeCount = (styleValue !== 'all' ? 1 : 0) + (classValue !== 'all' ? 1 : 0);

  return (
    <>
      <button
        type="button"
        className={`more-filters-toggle ${open || activeCount > 0 ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
      >
        Filtros{activeCount > 0 ? ` (${activeCount})` : ''} <span className="toggle-caret">{open ? '▴' : '▾'}</span>
      </button>
      {activeCount > 0 && (
        <button
          type="button"
          className="clear-filters"
          onClick={() => {
            onStyleChange('all');
            onClassChange('all');
          }}
        >
          Limpiar
        </button>
      )}
      {open && (
        <div className="more-filters-panel" id={`${id}-panel`}>
          <div className="filter-group">
            <span className="filter-label">Estilo:</span>
            <StyleButtons value={styleValue} onChange={onStyleChange} />
          </div>
          <div className="filter-group">
            <label className="filter-label" htmlFor={`${id}-class`}>Clase:</label>
            <ClassSelect id={`${id}-class`} value={classValue} onChange={onClassChange} />
          </div>
        </div>
      )}
    </>
  );
}
