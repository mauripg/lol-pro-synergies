import { useState, useMemo } from 'react';
import { getChampIconUrl } from '../utils/formatters';

export function SearchBar({ champList, onSelectChamp, ddragonVersion }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    return champList.filter((name) =>
      name.toLowerCase().includes(query.toLowerCase().trim())
    );
  }, [champList, query]);

  function handleSelect(name) {
    onSelectChamp(name);
    setQuery('');
  }

  return (
    <div className="search-container">
      <input
        type="text"
        className="search-input"
        placeholder="Buscar campeón (ej. Nautilus, Ahri, Yunara)..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length > 0 && (
        <ul className="search-dropdown">
          {filtered.map((name) => (
            <li key={name} className="search-item" onClick={() => handleSelect(name)}>
              <img
                src={getChampIconUrl(name, ddragonVersion)}
                alt={name}
                className="search-item-thumb"
              />
              <span>{name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}