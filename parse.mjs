import './load-env.mjs';
import fs from 'fs';
import { Readable } from 'stream';
import { parse } from 'csv-parse';
import { openDriveStream } from './drive-download.mjs';
import { fetchLeaguepediaRows, hasLeaguepediaCredentials } from './leaguepedia.mjs';

// Ligas tier 1. Incluye los códigos de Oracle's Elixir (WLDs) y de Leaguepedia (WCS, FST).
const TARGET_TIER1 = new Set(['LCK', 'LPL', 'LEC', 'LCS', 'LTA N', 'LTA S', 'LTA', 'LCP', 'MSI', 'WLDs', 'WCS', 'FST']);
const VALID_ROLES = new Set(['top', 'jng', 'mid', 'bot', 'sup']);

// Fuentes de datos (se usa UNA sola por ejecución; no se mezclan, para no duplicar partidas):
//   - CSV local (CSV_PATH o ./matches.csv si existe) o DATA_URL: se usan directamente si están.
//   - Con credenciales de Leaguepedia (LEAGUEPEDIA_BOT_USER/PASSWORD):
//       1. Leaguepedia (copia inicial en data/ + últimas semanas)  <- fuente principal
//       2. Oracle's Elixir en Google Drive, si Leaguepedia falla
//       3. Leaguepedia sin actualizar (solo la copia guardada)
//   - Sin credenciales:
//       1. Oracle's Elixir en Google Drive
//       2. Leaguepedia sin actualizar (solo la copia guardada)
//   - Si todo falla en Vercel: el synergies.json ya publicado (ver useFallback()).
// Forzar una fuente: "node parse.mjs --source=leaguepedia" o "--source=drive".
const DRIVE_FILE_ID = process.env.DRIVE_FILE_ID || '1hnpbrUpBMS1TZI7IovfpKeZfWJH1Aptm';
const CSV_PATH = process.env.CSV_PATH || './matches.csv';
const OUTPUT_PATH = './public/synergies.json';
// Si salen menos partidas que esto, algo falló en la descarga: abortar sin pisar los datos.
const MIN_EXPECTED_GAMES = Number(process.env.MIN_EXPECTED_GAMES || 100);

if (process.argv.includes('--if-missing') && fs.existsSync(OUTPUT_PATH)) {
  console.log(`[Data] ${OUTPUT_PATH} ya existe. Usa "npm run data" para actualizarlo.`);
  process.exit(0);
}

async function fetchOk(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`HTTP ${res.status} al descargar ${url}`);
  }
  return res;
}

function parseCsv(stream) {
  return stream.pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
    }),
  );
}

// Fuente usada en esta ejecución (se guarda en metadata.source y se muestra en la página).
let dataSource = 'desconocida';

// Descarga todo de Leaguepedia antes de empezar a procesar: si falla a mitad de camino,
// todavía se puede pasar a otra fuente sin haber mezclado filas.
async function loadLeaguepedia({ offline = false } = {}) {
  console.log(
    offline
      ? '[Data] Usando los datos guardados de Leaguepedia...'
      : '[Data] Descargando partidas desde Leaguepedia...',
  );
  const rows = [];
  for await (const row of fetchLeaguepediaRows({ offline })) rows.push(row);
  dataSource = offline ? 'Leaguepedia (sin actualizar)' : 'Leaguepedia';
  return rows;
}

async function loadDrive() {
  console.log(`[Data] Descargando CSV de Oracle's Elixir (Drive ${DRIVE_FILE_ID})...`);
  const stream = await openDriveStream(DRIVE_FILE_ID);
  dataSource = "Oracle's Elixir";
  return parseCsv(stream);
}

// Devuelve un iterable de filas con las columnas del CSV de Oracle's Elixir.
async function openSource() {
  if (process.argv.includes('--source=leaguepedia')) return loadLeaguepedia();
  if (process.argv.includes('--source=drive')) return loadDrive();

  if (process.env.CSV_PATH || fs.existsSync(CSV_PATH)) {
    if (!fs.existsSync(CSV_PATH)) {
      throw new Error(`No se encontró el archivo: ${CSV_PATH}`);
    }
    console.log(`[Data] Leyendo CSV local: ${CSV_PATH}`);
    dataSource = "Oracle's Elixir";
    return parseCsv(fs.createReadStream(CSV_PATH));
  }
  if (process.env.DATA_URL) {
    console.log(`[Data] Descargando CSV desde ${process.env.DATA_URL}`);
    dataSource = "Oracle's Elixir";
    return parseCsv(Readable.fromWeb((await fetchOk(process.env.DATA_URL)).body));
  }

  const attempts = hasLeaguepediaCredentials()
    ? [() => loadLeaguepedia(), loadDrive, () => loadLeaguepedia({ offline: true })]
    : [loadDrive, () => loadLeaguepedia({ offline: true })];

  let lastError;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastError = err;
      console.warn(`[Data] ${err.message}`);
      console.warn('[Data] Probando con la siguiente fuente...');
    }
  }
  throw lastError;
}

// Todo el proceso va dentro de main(): ante un error se marca el código de salida en vez de
// llamar a process.exit() con una descarga a medio cerrar, que en Windows hace caer a Node
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)").
async function main() {
  const source = await openSource();

  const teams = new Map();
  const allPatches = new Set();
  let totalProcessedGames = 0;

  for await (const row of source) {
    const pos = row.position?.toLowerCase();
    if (!VALID_ROLES.has(pos)) continue;
    if (!row.gameid || !row.champion || row.datacompleteness !== 'complete') continue;

    const patch = row.patch || 'unknown';
    allPatches.add(patch);

    const key = `${row.gameid}_${row.side}`;
    if (!teams.has(key)) {
      teams.set(key, {
        gameid: row.gameid,
        isTier1: TARGET_TIER1.has(row.league),
        patch,
        win: row.result === '1',
        players: [],
      });
    }

    // Si una fila llega repetida (p. ej. por paginación de la API), no se cuenta dos veces.
    const team = teams.get(key);
    if (team.players.some((p) => p.role === pos)) continue;
    team.players.push({
      champion: row.champion,
      role: pos,
    });
  }

  const sortedPatches = Array.from(allPatches)
    .filter((p) => p !== 'unknown')
    .sort((a, b) => {
      const [majA, minA] = a.split('.').map(Number);
      const [majB, minB] = b.split('.').map(Number);
      if (majA !== majB) return (majB || 0) - (majA || 0);
      return (minB || 0) - (minA || 0);
    });

  const latestPatch = sortedPatches[0] || null;
  const previousPatch = sortedPatches[1] || null;
  const recentPatches = new Set([latestPatch, previousPatch].filter(Boolean));

  const champions = {};

  // Estructura (schemaVersion 3):
  //   champions[campeón].roles[línea]            -> partidas totales en esa línea
  //   champions[campeón].byRole[línea].stats      [ámbito][tier] = [partidas, victorias]
  //   champions[campeón].byRole[línea].synergies  [ámbito][tier]["Aliado|línea"] = [partidas, victorias]
  //   champions[campeón].byRole[línea].matchups   [ámbito][tier]["Rival|línea"]  = [partidas, victorias]
  // ámbito: all | recent | latest (parches) · tier: all | t1
  // Los pares [partidas, victorias] en vez de objetos reducen bastante el tamaño del JSON.
  const SCOPES = ['all', 'recent', 'latest'];

  function scopedBuckets(factory) {
    return Object.fromEntries(SCOPES.map((scope) => [scope, { all: factory(), t1: factory() }]));
  }

  function getRoleEntry(champ, role) {
    if (!champions[champ]) {
      champions[champ] = { roles: {}, byRole: {} };
    }
    const byRole = champions[champ].byRole;
    if (!byRole[role]) {
      byRole[role] = {
        stats: scopedBuckets(() => [0, 0]),
        synergies: scopedBuckets(() => ({})),
        matchups: scopedBuckets(() => ({})),
      };
    }
    return byRole[role];
  }

  function addResult(pair, win) {
    pair[0] += 1;
    if (win) pair[1] += 1;
  }

  function addPair(map, key, win) {
    if (!map[key]) map[key] = [0, 0];
    addResult(map[key], win);
  }

  // Agrupar los dos lados de cada partida para poder calcular los enfrentamientos.
  const gamesById = new Map();
  for (const team of teams.values()) {
    if (team.players.length !== 5) continue;
    if (!gamesById.has(team.gameid)) gamesById.set(team.gameid, []);
    gamesById.get(team.gameid).push(team);
  }

  for (const sides of gamesById.values()) {
    for (const team of sides) {
      totalProcessedGames += 0.5;
      const opponents = sides.length === 2 ? sides.find((t) => t !== team).players : [];

      const isLatest = team.patch === latestPatch;
      const isRecent = recentPatches.has(team.patch);
      const activeScopes = ['all'];
      if (isRecent) activeScopes.push('recent');
      if (isLatest) activeScopes.push('latest');
      const tiers = team.isTier1 ? ['all', 't1'] : ['all'];

      for (const p1 of team.players) {
        const entry = getRoleEntry(p1.champion, p1.role);
        const roles = champions[p1.champion].roles;
        roles[p1.role] = (roles[p1.role] || 0) + 1;

        for (const scope of activeScopes) {
          for (const tier of tiers) {
            addResult(entry.stats[scope][tier], team.win);
            for (const p2 of team.players) {
              if (p2 !== p1) addPair(entry.synergies[scope][tier], `${p2.champion}|${p2.role}`, team.win);
            }
            for (const p2 of opponents) {
              addPair(entry.matchups[scope][tier], `${p2.champion}|${p2.role}`, team.win);
            }
          }
        }
      }
    }
  }

  if (totalProcessedGames < MIN_EXPECTED_GAMES) {
    throw new Error(
      `Solo se procesaron ${totalProcessedGames} partidas (mínimo esperado: ${MIN_EXPECTED_GAMES}). ` +
        'Revisa la fuente de datos; no se sobrescribe synergies.json.',
    );
  }

  const output = {
    metadata: {
      totalMatches: Math.round(totalProcessedGames),
      championCount: Object.keys(champions).length,
      patches: sortedPatches,
      latestPatch,
      previousPatch,
      updatedAt: new Date().toISOString(),
      source: dataSource,
      schemaVersion: 3,
    },
    champions,
  };

  fs.mkdirSync('./public', { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));
  console.log(`[Build] Sinergias procesadas: ${totalProcessedGames} partidas guardadas en ${OUTPUT_PATH}`);
}

// Respaldo: si no se pudo descargar el CSV (p. ej. Drive bloqueado por cuota), reutilizar el
// synergies.json que ya está publicado. En Vercel la URL de producción viene en
// VERCEL_PROJECT_PRODUCTION_URL; también se puede fijar a mano con FALLBACK_DATA_URL.
function getFallbackUrl() {
  if (process.env.FALLBACK_DATA_URL) return process.env.FALLBACK_DATA_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/synergies.json`;
  }
  return null;
}

async function useFallback() {
  const url = getFallbackUrl();
  if (!url) return false;
  try {
    console.warn(`[Data] Usando los datos ya publicados como respaldo: ${url}`);
    const res = await fetchOk(url);
    const json = await res.json();
    if (!json?.champions || !json?.metadata) throw new Error('el JSON de respaldo no tiene el formato esperado');
    fs.mkdirSync('./public', { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(json));
    console.warn(
      `[Data] Respaldo guardado (datos del ${json.metadata.updatedAt}). Se actualizarán en el próximo build.`,
    );
    return true;
  } catch (err) {
    console.error(`[Error] Tampoco se pudo usar el respaldo: ${err.message}`);
    return false;
  }
}

main().catch(async (err) => {
  console.error(`[Error] ${err.message}`);
  if (await useFallback()) return;
  process.exitCode = 1;
});
