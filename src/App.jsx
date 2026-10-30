import { useSynergies } from './hooks/useSynergies';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { PopularPicks } from './components/PopularPicks';
import { ChampionSummary } from './components/ChampionSummary';
import { SynergyTable } from './components/SynergyTable';
import './styles/app.css';

export default function App() {
  const {
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
  } = useSynergies();

  if (loading || !ddragonVersion || !data) {
    return <div className="state-screen">Cargando base de datos competitiva...</div>;
  }

  if (error) {
    return <div className="state-screen">Error al cargar datos: {error}</div>;
  }

  return (
    <div className="app-wrapper">
      <Header
        metadata={data.metadata}
        tier={tier}
        setTier={setTier}
        patchScope={patchScope}
        setPatchScope={setPatchScope}
      />

      <SearchBar
        champList={champList}
        onSelectChamp={setSelectedChamp}
        ddragonVersion={ddragonVersion}
      />

      <PopularPicks
        popularChamps={popularChamps}
        selectedChamp={selectedChamp}
        onSelectChamp={setSelectedChamp}
        roleFilter={popularRoleFilter}
        onRoleFilterChange={setPopularRoleFilter}
        ddragonVersion={ddragonVersion}
      />

      <ChampionSummary
        selectedChamp={selectedChamp}
        mainRole={champMainRole}
        baseStats={baseStats}
        baseWr={baseWr}
        ddragonVersion={ddragonVersion}
      />

      <SynergyTable
        synergiesList={synergiesList}
        roleFilter={synergyRoleFilter}
        onRoleFilterChange={setSynergyRoleFilter}
        minGames={minGames}
        ddragonVersion={ddragonVersion}
      />
    </div>
  );
}