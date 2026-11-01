import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getPrimaryRole, getDDragonKey } from '../utils/formatters';
import { getChampionClasses, getChampionStyle, CLASS_INFO, STYLE_INFO } from '../data/championTypes';
import { getChampSlice, getLaneGames } from '../utils/stats';
import { readUrlState, useUrlSync, parseComp, serializeComp, rememberScroll } from './useUrlState';

// Mínimo de partidas para mostrar un dúo, según cuántos parches se miran.
// Con menos partidas el winrate es demasiado ruidoso para sacar conclusiones.
const MIN_GAMES_BY_SCOPE = { all: 10, recent: 5, latest: 3 };

// Columnas de texto empiezan en A→Z; las numéricas, de mayor a menor.
const TEXT_SORT_KEYS = new Set(['ally', 'role', 'type', 'styleLabel']);

function parseSort(value) {
  const [key, dir] = (value || '').split('-');
  return { key: key || 'games', dir: dir === 'asc' ? 'asc' : 'desc' };
}

export function useSynergies() {
  const [initial] = useState(readUrlState);

  const [data, setData] = useState(null);
  const [ddragonVersion, setDdragonVersion] = useState(null);
  const [ddragonTags, setDdragonTags] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [view, setView] = useState(initial.view);
  const [selectedChamp, setSelectedChampState] = useState(initial.champ);
  const [selectedLane, setSelectedLane] = useState(initial.lane || null); // null = línea principal
  const [tier, setTier] = useState(initial.tier);
  const [patchScope, setPatchScope] = useState(initial.scope);

  const [popularRoleFilter, setPopularRoleFilter] = useState(initial.prole);
  const [popularClassFilter, setPopularClassFilter] = useState(initial.pcls);
  const [popularStyleFilter, setPopularStyleFilter] = useState(initial.pstyle);

  const [tableMode, setTableMode] = useState(initial.tab); // 'synergy' | 'counter'
  const [synergyRoleFilter, setSynergyRoleFilter] = useState(initial.role);
  const [classFilter, setClassFilter] = useState(initial.cls);
  const [styleFilter, setStyleFilter] = useState(initial.style);
  const [sortConfig, setSortConfig] = useState(() => parseSort(initial.sort));

  const [compSlots, setCompSlots] = useState(() => parseComp(initial.comp));

  // Navegación con historial: "Volver" regresa al campeón/vista anterior y a la misma posición.
  const pushRef = useRef(null);
  const [nav, setNav] = useState(() => ({
    depth: window.history.state?.depth || 0,
    backLabel: window.history.state?.backLabel || null,
  }));

  const currentLabel = () => (view === 'comp' ? 'la composición' : view === 'home' ? 'Inicio' : selectedChamp);

  function navigate(change) {
    rememberScroll();
    pushRef.current = currentLabel();
    change();
  }

  // Al usar "Volver" o el botón atrás del navegador, se restaura el estado guardado en la URL.
  useEffect(() => {
    function onPopState(event) {
      const s = readUrlState();
      pushRef.current = null;
      setView(s.view);
      setSelectedChampState(s.champ);
      setSelectedLane(s.lane || null);
      setTier(s.tier);
      setPatchScope(s.scope);
      setTableMode(s.tab);
      setSynergyRoleFilter(s.role);
      setClassFilter(s.cls);
      setStyleFilter(s.style);
      setSortConfig(parseSort(s.sort));
      setPopularRoleFilter(s.prole);
      setPopularClassFilter(s.pcls);
      setPopularStyleFilter(s.pstyle);
      setCompSlots(parseComp(s.comp));
      setNav({ depth: event.state?.depth || 0, backLabel: event.state?.backLabel || null });
      const y = event.state?.scrollY || 0;
      // Esperar a que se dibuje la vista restaurada antes de mover el scroll.
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })));
    }
    // El scroll lo restauramos nosotros cuando la vista ya está dibujada.
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const goBack = useCallback(() => window.history.back(), []);

  useUrlSync({
    view,
    champ: selectedChamp,
    lane: selectedLane || '',
    tier,
    scope: patchScope,
    tab: tableMode,
    role: synergyRoleFilter,
    cls: classFilter,
    style: styleFilter,
    sort: `${sortConfig.key}-${sortConfig.dir}`,
    prole: popularRoleFilter,
    pcls: popularClassFilter,
    pstyle: popularStyleFilter,
    comp: serializeComp(compSlots),
  }, { pushRef, onPush: (entry) => setNav({ depth: entry.depth, backLabel: entry.backLabel }) });

  useEffect(() => {
    // Clases de Data Dragon (Tank, Mage...) como respaldo para campeones sin clase oficial cargada.
    async function loadDdragonTags(version) {
      try {
        const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`);
        if (!res.ok) return;
        const { data: champs } = await res.json();
        const tags = {};
        for (const champ of Object.values(champs)) {
          tags[champ.id] = champ.tags;
          tags[champ.name] = champ.tags;
        }
        setDdragonTags(tags);
      } catch {
        // sin respaldo
      }
    }

    async function init() {
      try {
        const [vRes, sRes] = await Promise.all([
          fetch('https://ddragon.leagueoflegends.com/api/versions.json'),
          fetch('/synergies.json'),
        ]);

        if (!vRes.ok || !sRes.ok) throw new Error('Error al consultar datos');

        const versions = await vRes.json();
        const json = await sRes.json();

        if (versions && versions.length > 0) {
          setDdragonVersion(versions[0]);
          loadDdragonTags(versions[0]);
        }
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const getChampInfo = useCallback(
    (name) => {
      const tags = ddragonTags[name] || ddragonTags[getDDragonKey(name)];
      const { classes, official } = getChampionClasses(name, tags);
      return { classes, official, style: getChampionStyle(name, classes) };
    },
    [ddragonTags]
  );

  // Elegir un campeón (opcionalmente en una línea concreta) y volver a la vista de campeón.
  const setSelectedChamp = (name, lane = null) =>
    navigate(() => {
      setSelectedChampState(name);
      setSelectedLane(lane);
      setView('champ');
    });

  const changeView = (next) => navigate(() => setView(next));

  function toggleSort(key) {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' };
      }
      return { key, dir: TEXT_SORT_KEYS.has(key) ? 'asc' : 'desc' };
    });
  }

  const hasMatchups = useMemo(() => {
    const first = data && Object.values(data.champions)[0];
    return Boolean(first?.byRole && Object.values(first.byRole)[0]?.matchups);
  }, [data]);
  const hasLaneDataGlobal = useMemo(() => {
    const first = data && Object.values(data.champions)[0];
    return Boolean(first?.byRole);
  }, [data]);

  const champList = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.champions).sort();
  }, [data]);

  const popularChamps = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.champions)
      .map(([name, val]) => {
        let games;
        if (val.byRole) {
          games = getLaneGames(val, popularRoleFilter, patchScope, tier);
        } else {
          // Formato antiguo: se filtra por la línea principal del campeón.
          const matchesRole = popularRoleFilter === 'all' || getPrimaryRole(val.roles) === popularRoleFilter;
          games = matchesRole ? getLaneGames(val, 'all', patchScope, tier) : 0;
        }
        return { name, games, ...getChampInfo(name) };
      })
      .filter((c) => {
        if (c.games === 0) return false;
        if (popularStyleFilter !== 'all' && c.style !== popularStyleFilter) return false;
        if (popularClassFilter !== 'all' && !c.classes.includes(popularClassFilter)) return false;
        return true;
      })
      .sort((a, b) => b.games - a.games)
      .slice(0, 10);
  }, [data, patchScope, tier, popularRoleFilter, popularStyleFilter, popularClassFilter, getChampInfo]);

  const currentChampData = data?.champions[selectedChamp];
  const champMainRole = currentChampData ? getPrimaryRole(currentChampData.roles) : '';
  const hasLaneData = Boolean(currentChampData?.byRole);
  const activeLane = hasLaneData ? selectedLane || champMainRole : 'all';

  // Líneas en que se jugó el campeón, con partidas en el filtro actual.
  const champLanes = useMemo(() => {
    if (!currentChampData?.byRole) return [];
    return Object.keys(currentChampData.byRole)
      .map((role) => ({ role, games: getLaneGames(currentChampData, role, patchScope, tier) }))
      .sort((a, b) => b.games - a.games);
  }, [currentChampData, patchScope, tier]);

  const champSlice = useMemo(
    () => getChampSlice(currentChampData, activeLane, patchScope, tier),
    [currentChampData, activeLane, patchScope, tier]
  );

  const baseStats = champSlice.stats;
  const baseWr = baseStats.games > 0 ? (baseStats.wins / baseStats.games) * 100 : 0;
  const champInfo = getChampInfo(selectedChamp);

  const minGames = MIN_GAMES_BY_SCOPE[patchScope] ?? 3;

  const effectiveMode = tableMode === 'counter' && hasMatchups ? 'counter' : 'synergy';

  const synergiesList = useMemo(() => {
    const source = effectiveMode === 'counter' ? champSlice.matchups : champSlice.synergies;
    return Object.entries(source)
      .map(([key, stats]) => {
        const [ally, role] = key.split('|');
        const wr = stats.games > 0 ? (stats.wins / stats.games) * 100 : 0;
        const delta = wr - baseWr;
        const { classes, official, style } = getChampInfo(ally);
        return {
          ally,
          role,
          games: stats.games,
          wins: stats.wins,
          wr,
          delta,
          classes,
          official,
          style,
          styleLabel: STYLE_INFO[style]?.label || '',
          type: classes.map((c) => CLASS_INFO[c]?.label || c).join(' / '),
        };
      })
      .filter((item) => {
        if (synergyRoleFilter !== 'all' && item.role !== synergyRoleFilter) return false;
        if (classFilter !== 'all' && !item.classes.includes(classFilter)) return false;
        if (styleFilter !== 'all' && item.style !== styleFilter) return false;
        return item.games >= minGames;
      })
      .sort((a, b) => {
        const { key, dir } = sortConfig;
        const sign = dir === 'asc' ? 1 : -1;
        const va = a[key];
        const vb = b[key];
        const cmp = typeof va === 'string' ? va.localeCompare(vb, 'es') : va - vb;
        // Desempate: más partidas primero.
        if (cmp === 0) return b.games - a.games;
        return cmp * sign;
      });
  }, [effectiveMode, champSlice, synergyRoleFilter, classFilter, styleFilter, baseWr, minGames, sortConfig, getChampInfo]);

  // Destacados para la tarjeta del campeón: mejores aliados y peores rivales (sin filtros de tabla).
  // Destacados para la tarjeta del campeón (independientes de los filtros de la tabla):
  //   best:      aliados de su equipo con los que más sube su winrate
  //   laneBest:  rivales de SU MISMA línea a los que mejor les gana (matchups favorables)
  //   laneWorst: rivales de su misma línea que lo counterean
  const matchupLane = activeLane === 'all' ? champMainRole : activeLane;
  const highlights = useMemo(() => {
    const toRows = (source) =>
      Object.entries(source)
        .map(([key, stats]) => {
          const [ally, role] = key.split('|');
          const wr = stats.games > 0 ? (stats.wins / stats.games) * 100 : 0;
          return { ally, role, games: stats.games, wins: stats.wins, wr, delta: wr - baseWr };
        })
        .filter((r) => r.games >= minGames);
    const laneRows = hasMatchups ? toRows(champSlice.matchups).filter((r) => r.role === matchupLane) : [];
    return {
      lane: matchupLane,
      best: toRows(champSlice.synergies)
        .filter((r) => r.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 3),
      laneBest: laneRows
        .filter((r) => r.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 3),
      laneWorst: laneRows
        .filter((r) => r.delta < 0)
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 3),
    };
  }, [champSlice, baseWr, minGames, hasMatchups, matchupLane]);

  return {
    data,
    highlights,
    matchupLane,
    loading,
    error,
    ddragonVersion,
    champList,
    getChampInfo,
    view,
    setView: changeView,
    canGoBack: nav.depth > 0,
    backLabel: nav.backLabel,
    goBack,
    selectedChamp,
    setSelectedChamp,
    tier,
    setTier,
    patchScope,
    setPatchScope,
    popularRoleFilter,
    setPopularRoleFilter,
    popularClassFilter,
    setPopularClassFilter,
    popularStyleFilter,
    setPopularStyleFilter,
    popularChamps,
    tableMode: effectiveMode,
    setTableMode,
    hasMatchups,
    hasLaneDataGlobal,
    synergyRoleFilter,
    setSynergyRoleFilter,
    classFilter,
    setClassFilter,
    styleFilter,
    setStyleFilter,
    baseStats,
    baseWr,
    champMainRole,
    champInfo,
    champLanes,
    activeLane,
    setSelectedLane,
    hasLaneData,
    synergiesList,
    minGames,
    sortConfig,
    toggleSort,
    compSlots,
    setCompSlots,
  };
}
