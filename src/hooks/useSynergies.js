import { useState, useEffect, useMemo } from 'react';
import { getPrimaryRole } from '../utils/formatters';

export function useSynergies() {
  const [data, setData] = useState(null);
  const [ddragonVersion, setDdragonVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedChamp, setSelectedChamp] = useState('Jinx');
  const [tier, setTier] = useState('all');
  const [patchScope, setPatchScope] = useState('all');
  const [popularRoleFilter, setPopularRoleFilter] = useState('all');
  const [synergyRoleFilter, setSynergyRoleFilter] = useState('all');

  useEffect(() => {
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

  const champList = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.champions).sort();
  }, [data]);

  const popularChamps = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.champions)
      .map(([name, val]) => ({
        name,
        games: val.stats[patchScope]?.[tier]?.games || 0,
        primaryRole: getPrimaryRole(val.roles),
      }))
      .filter((c) => {
        if (c.games === 0) return false;
        if (popularRoleFilter === 'all') return true;
        return c.primaryRole === popularRoleFilter;
      })
      .sort((a, b) => b.games - a.games)
      .slice(0, 8);
  }, [data, patchScope, tier, popularRoleFilter]);

  const currentChampData = data?.champions[selectedChamp];
  const baseStats = currentChampData ? currentChampData.stats[patchScope]?.[tier] : { games: 0, wins: 0 };
  const baseWr = baseStats?.games > 0 ? (baseStats.wins / baseStats.games) * 100 : 0;
  const champMainRole = currentChampData ? getPrimaryRole(currentChampData.roles) : '';

  const minGames = patchScope === 'all' ? 3 : 2;
  const rawSynergies = currentChampData?.synergies[patchScope]?.[tier] || {};

  const synergiesList = useMemo(() => {
    return Object.entries(rawSynergies)
      .map(([key, stats]) => {
        const [ally, role] = key.split('|');
        const wr = stats.games > 0 ? (stats.wins / stats.games) * 100 : 0;
        const delta = wr - baseWr;
        return { ally, role, games: stats.games, wins: stats.wins, wr, delta };
      })
      .filter((item) => {
        if (synergyRoleFilter !== 'all' && item.role !== synergyRoleFilter) return false;
        return item.games >= minGames;
      })
      .sort((a, b) => b.games - a.games);
  }, [rawSynergies, synergyRoleFilter, baseWr, minGames]);

  return {
    data,
    loading,
    error,
    ddragonVersion,
    champList,
    selectedChamp,
    setSelectedChamp,
    tier,
    setTier,
    patchScope,
    setPatchScope,
    popularRoleFilter,
    setPopularRoleFilter,
    synergyRoleFilter,
    setSynergyRoleFilter,
    popularChamps,
    baseStats,
    baseWr,
    champMainRole,
    synergiesList,
    minGames,
  };
}