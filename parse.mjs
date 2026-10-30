import fs from 'fs';
import { parse } from 'csv-parse';

const TARGET_TIER1 = new Set(['LCK', 'LPL', 'LEC', 'LCS', 'LTA N', 'LTA S', 'LTA', 'LCP', 'MSI', 'WLDs']);
const VALID_ROLES = new Set(['top', 'jng', 'mid', 'bot', 'sup']);

const CSV_PATH = process.env.CSV_PATH || './matches.csv';
const OUTPUT_PATH = './public/synergies.json';

if (!fs.existsSync(CSV_PATH)) {
  console.error(`[Error] No se encontró el archivo: ${CSV_PATH}`);
  process.exit(1);
}

const teams = new Map();
const allPatches = new Set();
let totalProcessedGames = 0;

const parser = fs.createReadStream(CSV_PATH).pipe(
  parse({
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  })
);

for await (const row of parser) {
  const pos = row.position?.toLowerCase();
  if (!VALID_ROLES.has(pos)) continue;
  if (!row.gameid || !row.champion || row.datacompleteness !== 'complete') continue;

  const patch = row.patch || 'unknown';
  allPatches.add(patch);

  const key = `${row.gameid}_${row.side}`;
  if (!teams.has(key)) {
    teams.set(key, {
      isTier1: TARGET_TIER1.has(row.league),
      patch,
      win: row.result === '1',
      players: [],
    });
  }

  teams.get(key).players.push({
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

function initChamp(champ) {
  if (!champions[champ]) {
    champions[champ] = {
      roles: {},
      stats: {
        all: { all: { games: 0, wins: 0 }, t1: { games: 0, wins: 0 } },
        latest: { all: { games: 0, wins: 0 }, t1: { games: 0, wins: 0 } },
        recent: { all: { games: 0, wins: 0 }, t1: { games: 0, wins: 0 } },
      },
      synergies: {
        all: { all: {}, t1: {} },
        latest: { all: {}, t1: {} },
        recent: { all: {}, t1: {} },
      },
    };
  }
}

for (const team of teams.values()) {
  if (team.players.length !== 5) continue;
  totalProcessedGames += 0.5;

  const isLatest = team.patch === latestPatch;
  const isRecent = recentPatches.has(team.patch);

  const activeScopes = ['all'];
  if (isRecent) activeScopes.push('recent');
  if (isLatest) activeScopes.push('latest');

  for (const player of team.players) {
    const champ = player.champion;
    initChamp(champ);

    champions[champ].roles[player.role] = (champions[champ].roles[player.role] || 0) + 1;

    for (const scope of activeScopes) {
      champions[champ].stats[scope].all.games += 1;
      if (team.win) champions[champ].stats[scope].all.wins += 1;

      if (team.isTier1) {
        champions[champ].stats[scope].t1.games += 1;
        if (team.win) champions[champ].stats[scope].t1.wins += 1;
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    const p1 = team.players[i];
    for (let j = 0; j < 5; j++) {
      if (i === j) continue;
      const p2 = team.players[j];
      const pairKey = `${p2.champion}|${p2.role}`;

      for (const scope of activeScopes) {
        if (!champions[p1.champion].synergies[scope].all[pairKey]) {
          champions[p1.champion].synergies[scope].all[pairKey] = { games: 0, wins: 0 };
        }
        champions[p1.champion].synergies[scope].all[pairKey].games += 1;
        if (team.win) champions[p1.champion].synergies[scope].all[pairKey].wins += 1;

        if (team.isTier1) {
          if (!champions[p1.champion].synergies[scope].t1[pairKey]) {
            champions[p1.champion].synergies[scope].t1[pairKey] = { games: 0, wins: 0 };
          }
          champions[p1.champion].synergies[scope].t1[pairKey].games += 1;
          if (team.win) champions[p1.champion].synergies[scope].t1[pairKey].wins += 1;
        }
      }
    }
  }
}

const output = {
  metadata: {
    totalMatches: Math.round(totalProcessedGames),
    championCount: Object.keys(champions).length,
    patches: sortedPatches,
    latestPatch,
    previousPatch,
    updatedAt: new Date().toISOString(),
  },
  champions,
};

fs.mkdirSync('./public', { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output));
console.log(`[Build] Sinergias procesadas: ${totalProcessedGames} partidas guardadas en ${OUTPUT_PATH}`);