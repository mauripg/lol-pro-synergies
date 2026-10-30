// Descarga partidas profesionales desde la API de Leaguepedia (lol.fandom.com, tablas Cargo)
// y las entrega con el mismo formato de filas que el CSV de Oracle's Elixir, para que parse.mjs
// las procese igual. Se usa como respaldo cuando Google Drive no entrega el CSV.
//
// IMPORTANTE: sin iniciar sesión, Fandom permite ~1 consulta por minuto, lo que no sirve.
// Hace falta una "contraseña de bot" gratuita (ver LEAGUEPEDIA_BOT_USER / LEAGUEPEDIA_BOT_PASSWORD
// en el README o en .env.example).
//
// Para no repetir cientos de consultas, lo descargado se guarda en un caché. En las siguientes
// ejecuciones solo se vuelven a pedir las últimas semanas. Si una descarga se corta, continúa
// desde la última semana guardada.
//
// Tablas usadas:
//   ScoreboardPlayers (SP): una fila por jugador y partida -> campeón, línea, lado, si ganó
//   ScoreboardGames   (SG): fecha y parche de la partida
//   Tournaments (T) + Leagues (L): liga (código corto, p. ej. "LCK") y nivel del torneo
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const API_URL = process.env.LEAGUEPEDIA_API || 'https://lol.fandom.com/api.php';
const PAGE_SIZE = 500;
const DELAY_MS = Number(process.env.LEAGUEPEDIA_DELAY_MS ?? 3000); // pausa entre consultas
const MAX_RETRIES = 6;
const REFRESH_DAYS = 21; // semanas recientes que se vuelven a pedir (correcciones y partidas nuevas)
const CACHE_DIR = process.env.LEAGUEPEDIA_CACHE_DIR || './node_modules/.cache/lol-pro-synergies';
// Copia inicial de los datos, guardada en el repo (comprimida). Evita que el primer build tenga que
// descargar el año completo (~30 min): parte desde aquí y solo pide las semanas que falten.
const SEED_DIR = process.env.LEAGUEPEDIA_SEED_DIR || './data';
const USER_AGENT = 'lol-pro-synergies (https://github.com/mauripg/lol-pro-synergies)';
const DAY = 86400000;

const ROLE_MAP = { top: 'top', jungle: 'jng', mid: 'mid', bot: 'bot', adc: 'bot', support: 'sup' };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatDate = (date) => date.toISOString().slice(0, 10);

export function hasLeaguepediaCredentials() {
  return Boolean(process.env.LEAGUEPEDIA_BOT_USER && process.env.LEAGUEPEDIA_BOT_PASSWORD);
}

// ---------- Cliente HTTP con cookies (necesarias para mantener la sesión) ----------

const cookies = new Map();

function storeCookies(res) {
  for (const cookie of res.headers.getSetCookie?.() || []) {
    const [pair] = cookie.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}

async function apiRequest(params, { method = 'GET' } = {}) {
  const body = new URLSearchParams({ format: 'json', ...params });
  const headers = { 'User-Agent': USER_AGENT };
  if (cookies.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');

  const res =
    method === 'POST'
      ? await fetch(API_URL, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        })
      : await fetch(`${API_URL}?${body}`, { headers });
  storeCookies(res);

  if (res.status === 429 || res.status >= 500) {
    await res.body?.cancel();
    throw Object.assign(new Error(`HTTP ${res.status}`), { retry: true });
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new Error(`Leaguepedia respondió HTTP ${res.status}`);
  }
  return res.json();
}

async function login() {
  const user = process.env.LEAGUEPEDIA_BOT_USER;
  const password = process.env.LEAGUEPEDIA_BOT_PASSWORD;
  const tokenRes = await apiRequest({ action: 'query', meta: 'tokens', type: 'login' });
  const token = tokenRes?.query?.tokens?.logintoken;
  if (!token) throw new Error('Leaguepedia no entregó el token de inicio de sesión.');

  const loginRes = await apiRequest(
    { action: 'login', lgname: user, lgpassword: password, lgtoken: token },
    { method: 'POST' },
  );
  if (loginRes?.login?.result !== 'Success') {
    const reason = loginRes?.login?.reason || loginRes?.login?.result || 'respuesta inesperada';
    throw new Error(
      `No se pudo iniciar sesión en Leaguepedia (${reason}). Revisa LEAGUEPEDIA_BOT_USER ` +
        '(formato "TuUsuario@NombreDelBot") y LEAGUEPEDIA_BOT_PASSWORD.',
    );
  }
  console.log(`[Leaguepedia] Sesión iniciada como ${loginRes.login.lgusername}.`);
}

async function cargoQuery(params) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let body;
    try {
      body = await apiRequest({ action: 'cargoquery', assert: 'user', limit: String(PAGE_SIZE), ...params });
    } catch (err) {
      if (attempt === MAX_RETRIES || (err.retry !== true && err.name !== 'TypeError')) throw err;
      const wait = 5000 * 2 ** attempt;
      console.warn(`[Leaguepedia] ${err.message}; reintentando en ${wait / 1000}s...`);
      await sleep(wait);
      continue;
    }

    if (body.error) {
      if (body.error.code === 'ratelimited' && attempt < MAX_RETRIES) {
        const wait = 15000 * 2 ** attempt;
        console.warn(`[Leaguepedia] Límite de consultas alcanzado; esperando ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (body.error.code === 'assertuserfailed') {
        throw new Error('La sesión de Leaguepedia se cerró. Vuelve a intentarlo.');
      }
      throw new Error(`Leaguepedia: ${body.error.code} - ${body.error.info}`);
    }
    return (body.cargoquery || []).map((r) => r.title);
  }
  throw new Error('Leaguepedia no respondió después de varios intentos.');
}

// ---------- Caché ----------

// Filas compactas: [gameid, side, position, champion, result, patch, league, date]
function cachePath(year) {
  return path.join(CACHE_DIR, `leaguepedia-${year}.json`);
}

function seedPath(year) {
  return path.join(SEED_DIR, `leaguepedia-${year}.json.gz`);
}

function readJson(file, gzipped = false) {
  try {
    const raw = fs.readFileSync(file);
    return JSON.parse(gzipped ? zlib.gunzipSync(raw).toString('utf8') : raw.toString('utf8'));
  } catch {
    return null;
  }
}

// Usa lo más reciente entre el caché local y la copia inicial del repo.
function loadCache(year) {
  const candidates = [
    { data: readJson(cachePath(year)), from: 'caché local' },
    { data: readJson(seedPath(year), true), from: `copia inicial (${seedPath(year)})` },
  ].filter((c) => c.data?.year === year && Array.isArray(c.data.rows));
  candidates.sort((a, b) => String(b.data.fetchedUntil).localeCompare(String(a.data.fetchedUntil)));
  if (candidates.length) {
    console.log(
      `[Leaguepedia] Usando ${candidates[0].from}: datos hasta ${candidates[0].data.fetchedUntil?.slice(0, 10)}.`,
    );
    return candidates[0].data;
  }
  return { year, fetchedUntil: null, rows: [] };
}

function saveCache(cache) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath(cache.year), JSON.stringify(cache));
}

// Borra los archivos de años anteriores (caché o copia inicial). Cada año es independiente:
// la página solo muestra la temporada actual, así que lo viejo solo ocuparía espacio.
function removeOtherYears(dir, year, pattern) {
  let removed = 0;
  try {
    for (const name of fs.readdirSync(dir)) {
      const match = name.match(pattern);
      if (match && Number(match[1]) !== year) {
        fs.unlinkSync(path.join(dir, name));
        removed++;
      }
    }
  } catch {
    // la carpeta no existe o no se puede limpiar: no es crítico
  }
  return removed;
}

// Guarda el caché actual como copia inicial en el repo (npm run data:seed).
export function writeSeed(year = new Date().getUTCFullYear()) {
  const cache = readJson(cachePath(year));
  if (!cache?.rows?.length) {
    throw new Error(`No hay caché de Leaguepedia para ${year}. Corre primero "npm run data:leaguepedia".`);
  }
  fs.mkdirSync(SEED_DIR, { recursive: true });
  const gz = zlib.gzipSync(JSON.stringify(cache), { level: 9 });
  fs.writeFileSync(seedPath(year), gz);
  const removed = removeOtherYears(SEED_DIR, year, /^leaguepedia-(\d{4})\.json\.gz$/);
  return {
    file: seedPath(year),
    rows: cache.rows.length,
    kb: Math.round(gz.length / 1024),
    until: cache.fetchedUntil,
    removed,
  };
}

function toCsvRow([gameid, side, position, champion, result, patch, league]) {
  return { gameid, side, position, champion, result, datacompleteness: 'complete', patch, league };
}

async function fetchWeek(from, to) {
  const rows = [];
  let offset = 0;
  while (true) {
    const page = await cargoQuery({
      tables: 'ScoreboardPlayers=SP,ScoreboardGames=SG,Tournaments=T,Leagues=L',
      join_on: 'SP.GameId=SG.GameId,SG.OverviewPage=T.OverviewPage,T.League=L.League',
      fields:
        'SP.GameId=gameid,SP.Champion=champion,SP.IngameRole=role,SP.Role=fallbackrole,SP.Side=side,' +
        'SP.PlayerWin=win,SG.DateTime_UTC=date,SG.LegacyPatch=legacypatch,SG.Patch=patch,' +
        'L.League_Short=league,T.TournamentLevel=level',
      where:
        `SG.DateTime_UTC >= "${formatDate(from)}" AND SG.DateTime_UTC < "${formatDate(to)}" ` +
        'AND T.TournamentLevel IN ("Primary","Secondary")',
      order_by: 'SP.GameId,SP.Side,SP.IngameRole',
      offset: String(offset),
    });

    for (const r of page) {
      const position = ROLE_MAP[(r.role || r.fallbackrole || '').trim().toLowerCase()];
      if (!position || !r.gameid || !r.champion) continue;
      rows.push([
        `lp-${r.gameid}`,
        String(r.side) === '1' ? 'Blue' : 'Red',
        position,
        r.champion,
        r.win === 'Yes' ? '1' : '0',
        r.legacypatch || r.patch || 'unknown',
        r.league || '',
        (r.date || formatDate(from)).slice(0, 10),
      ]);
    }

    if (page.length < PAGE_SIZE) return rows;
    offset += PAGE_SIZE;
    await sleep(DELAY_MS);
  }
}

/**
 * Genera filas con el formato del CSV de Oracle's Elixir:
 * { gameid, side, position, champion, result, datacompleteness, patch, league }
 */
// offline: no consultar la API; usar solo la copia inicial / caché (si no hay, error).
export async function* fetchLeaguepediaRows({
  year = new Date().getUTCFullYear(),
  now = new Date(),
  offline = false,
} = {}) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  // Hasta el inicio de mañana (UTC), para incluir las partidas de hoy.
  const tomorrow = new Date(formatDate(new Date(now.getTime() + DAY)));
  const end = new Date(Math.min(Date.UTC(year + 1, 0, 1), tomorrow.getTime()));
  const cache = loadCache(year);
  const removed = removeOtherYears(CACHE_DIR, year, /^leaguepedia-(\d{4})\.json$/);
  if (removed) console.log(`[Leaguepedia] Caché de ${removed} año(s) anterior(es) eliminado.`);

  // Sin credenciales no se puede consultar (Fandom permite ~1 consulta/min sin sesión).
  // Si hay copia inicial o caché, se usan tal cual en vez de fallar.
  if (offline || !hasLeaguepediaCredentials()) {
    if (cache.rows.length) {
      console.warn(
        offline
          ? '[Leaguepedia] Usando los datos guardados sin actualizar.'
          : '[Leaguepedia] Sin LEAGUEPEDIA_BOT_USER/LEAGUEPEDIA_BOT_PASSWORD: se usan los datos guardados sin actualizar.',
      );
      for (const row of cache.rows) yield toCsvRow(row);
      return;
    }
    throw new Error(
      'Faltan LEAGUEPEDIA_BOT_USER y LEAGUEPEDIA_BOT_PASSWORD. Sin iniciar sesión Leaguepedia permite ' +
        '~1 consulta por minuto. Crea una contraseña de bot gratuita en https://lol.fandom.com/wiki/Special:BotPasswords.',
    );
  }

  // Se reutiliza lo descargado, salvo las últimas semanas, que se vuelven a pedir.
  let from = yearStart;
  if (cache.fetchedUntil) {
    const refreshFrom = new Date(new Date(cache.fetchedUntil).getTime() - REFRESH_DAYS * DAY);
    from = refreshFrom > yearStart ? refreshFrom : yearStart;
    const cutoff = formatDate(from);
    cache.rows = cache.rows.filter((r) => r[7] < cutoff);
    console.log(`[Leaguepedia] Caché con ${cache.rows.length} filas; actualizando desde ${cutoff}.`);
  }

  const weeks = Math.ceil((end - from) / (7 * DAY));
  if (weeks > 0) {
    await login();
    console.log(`[Leaguepedia] ${weeks} semana(s) por descargar.`);
  }

  let done = 0;
  for (let weekStart = from; weekStart < end; weekStart = new Date(weekStart.getTime() + 7 * DAY)) {
    const weekEnd = new Date(Math.min(weekStart.getTime() + 7 * DAY, end.getTime()));
    if (done > 0) await sleep(DELAY_MS);
    const rows = await fetchWeek(weekStart, weekEnd);
    cache.rows.push(...rows);
    cache.fetchedUntil = weekEnd.toISOString();
    saveCache(cache); // se guarda cada semana: si se corta, continúa desde aquí
    done++;
    console.log(`[Leaguepedia] ${done}/${weeks} · hasta ${formatDate(weekEnd)} · ${cache.rows.length} filas en total`);
  }

  for (const row of cache.rows) yield toCsvRow(row);
}
