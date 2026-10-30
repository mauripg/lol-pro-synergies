import { useMemo, useRef, useState } from 'react';
import { getChampIconUrl } from '../utils/formatters';

// Campo para elegir un campeón con lista desplegable de íconos.
// Al enfocarlo muestra los más jugados; al escribir, filtra por nombre.
// Teclado: ↑/↓ para moverse, Enter para elegir, Esc para cerrar.
export function ChampionPicker({ id, options, onPick, placeholder = 'Elegir…', ddragonVersion }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
    return list.slice(0, 40);
  }, [options, query]);

  function pick(name) {
    onPick(name);
    setQuery('');
    setOpen(false);
  }

  function moveHighlight(next) {
    setHighlight(next);
    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' });
  }

  function handleKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveHighlight(Math.min(highlight + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveHighlight(Math.max(highlight - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) pick(filtered[highlight].name);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="champ-picker">
      <input
        id={id}
        className="comp-slot-input"
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {open && filtered.length > 0 && (
        <ul className="champ-picker-list" id={`${id}-list`} role="listbox" ref={listRef}>
          {filtered.map((o, i) => (
            <li
              key={o.name}
              role="option"
              aria-selected={i === highlight}
              className={`champ-picker-item ${i === highlight ? 'highlight' : ''}`}
              // mousedown en vez de click: se dispara antes del blur que cierra la lista
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o.name);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <img src={getChampIconUrl(o.name, ddragonVersion)} alt="" className="champ-picker-icon" />
              <span className="champ-picker-name">{o.name}</span>
              {o.games > 0 && <span className="champ-picker-games">{o.games}p</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
