import { useSynergies } from './hooks/useSynergies';
import { Header } from './components/Header';
import { SearchBar } from './components/SearchBar';
import { PopularPicks } from './components/PopularPicks';
import { ChampionSummary } from './components/ChampionSummary';
import { SynergyTable } from './components/SynergyTable';
import { CompBuilder } from './components/CompBuilder';
import { Home } from './components/Home';
import { ShareButton } from './components/ShareButton';
import { Footer } from './components/Footer';
import './styles/app.css';

export default function App() {
  const s = useSynergies();

  if (s.error) {
    return <div className="state-screen">Error al cargar datos: {s.error}</div>;
  }

  if (s.loading || !s.ddragonVersion || !s.data) {
    return <div className="state-screen">Cargando base de datos competitiva...</div>;
  }

  return (
    <div className="app-wrapper">
      <Header
        metadata={s.data.metadata}
        tier={s.tier}
        setTier={s.setTier}
        patchScope={s.patchScope}
        setPatchScope={s.setPatchScope}
      />

      <nav className="view-tabs">
        <button
          type="button"
          className={`view-tab ${s.view === 'home' ? 'active' : ''}`}
          onClick={() => s.setView('home')}
        >
          Inicio
        </button>
        <button
          type="button"
          className={`view-tab ${s.view === 'champ' ? 'active' : ''}`}
          onClick={() => s.setView('champ')}
        >
          Explorar campeón
        </button>
        <button
          type="button"
          className={`view-tab ${s.view === 'comp' ? 'active' : ''}`}
          onClick={() => s.setView('comp')}
        >
          Armar composición
        </button>
        <SearchBar champList={s.champList} onSelectChamp={s.setSelectedChamp} ddragonVersion={s.ddragonVersion} />
        <ShareButton />
      </nav>

      {s.canGoBack && (
        <button type="button" className="back-button" onClick={s.goBack}>
          ← Volver a {s.backLabel}
        </button>
      )}

      {s.view === 'home' ? (
        <Home
          data={s.data}
          tier={s.tier}
          patchScope={s.patchScope}
          onSelectChamp={s.setSelectedChamp}
          ddragonVersion={s.ddragonVersion}
        />
      ) : s.view === 'comp' ? (
        s.hasLaneDataGlobal ? (
          <CompBuilder
            data={s.data}
            slots={s.compSlots}
            setSlots={s.setCompSlots}
            tier={s.tier}
            patchScope={s.patchScope}
            getChampInfo={s.getChampInfo}
            onSelectChamp={s.setSelectedChamp}
            ddragonVersion={s.ddragonVersion}
          />
        ) : (
          <div className="empty-message">
            Los datos están en el formato antiguo. Regenéralos con <code>npm run data</code> para usar el armador.
          </div>
        )
      ) : (
        <>
          <PopularPicks
            popularChamps={s.popularChamps}
            selectedChamp={s.selectedChamp}
            onSelectChamp={s.setSelectedChamp}
            roleFilter={s.popularRoleFilter}
            onRoleFilterChange={s.setPopularRoleFilter}
            styleFilter={s.popularStyleFilter}
            onStyleFilterChange={s.setPopularStyleFilter}
            classFilter={s.popularClassFilter}
            onClassFilterChange={s.setPopularClassFilter}
            ddragonVersion={s.ddragonVersion}
          />

          <ChampionSummary
            selectedChamp={s.selectedChamp}
            mainRole={s.champMainRole}
            champInfo={s.champInfo}
            champLanes={s.champLanes}
            activeLane={s.activeLane}
            onLaneChange={s.setSelectedLane}
            hasLaneData={s.hasLaneData}
            baseStats={s.baseStats}
            baseWr={s.baseWr}
            highlights={s.highlights}
            hasMatchups={s.hasMatchups}
            onSelectChamp={s.setSelectedChamp}
            ddragonVersion={s.ddragonVersion}
          />

          <SynergyTable
            mode={s.tableMode}
            onModeChange={s.setTableMode}
            hasMatchups={s.hasMatchups}
            matchupLane={s.matchupLane}
            synergiesList={s.synergiesList}
            onSelectChamp={s.setSelectedChamp}
            baseWr={s.baseWr}
            roleFilter={s.synergyRoleFilter}
            onRoleFilterChange={s.setSynergyRoleFilter}
            classFilter={s.classFilter}
            onClassFilterChange={s.setClassFilter}
            styleFilter={s.styleFilter}
            onStyleFilterChange={s.setStyleFilter}
            minGames={s.minGames}
            sortConfig={s.sortConfig}
            onSort={s.toggleSort}
            ddragonVersion={s.ddragonVersion}
          />
        </>
      )}

      <Footer metadata={s.data.metadata} />
    </div>
  );
}
