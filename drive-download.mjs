// Descarga un archivo público de Google Drive como stream, sin dependencias.
// Drive a veces responde con una página HTML (aviso de "no se pudo analizar en busca de virus",
// cuota de descargas excedida, etc.). Aquí se sigue el mismo proceso que la herramienta `gdown`:
// buscar en esa página el link o formulario de descarga real y reintentar, guardando las cookies.
import fs from 'fs';
import { Readable } from 'stream';

// Si Drive no entrega el archivo, se guarda aquí la página que devolvió (para diagnosticar).
const DEBUG_HTML_PATH = './drive-error.html';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\u003d/g, '=')
    .replace(/\\u0026/g, '&');
}

function getAttr(tag, name) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i'))?.[1];
}

// Busca en el HTML de Drive la URL de descarga real.
function findDownloadUrl(html, pageUrl) {
  // 1) Formulario de confirmación (formato actual de drive.usercontent.google.com).
  const form = html.match(/<form[^>]*id="download-form"[^>]*>([\s\S]*?)<\/form>/i);
  if (form) {
    const formTag = form[0].match(/<form[^>]*>/i)[0];
    const action = decodeHtml(getAttr(formTag, 'action') || '');
    const params = new URLSearchParams();
    for (const input of form[1].match(/<input[^>]*>/gi) || []) {
      const name = getAttr(input, 'name');
      const value = getAttr(input, 'value');
      if (name && value !== undefined) params.set(name, decodeHtml(value));
    }
    if (action) return `${new URL(action, pageUrl)}?${params}`;
  }

  // 2) Link directo de confirmación (formato antiguo de drive.google.com).
  const href = html.match(/href="(\/uc\?export=download[^"]+)"/);
  if (href) return new URL(decodeHtml(href[1]), 'https://drive.google.com').toString();

  // 3) URL embebida en JSON.
  const json = html.match(/"downloadUrl":"([^"]+)"/);
  if (json) return decodeHtml(json[1]);

  return null;
}

function describeHtmlError(html) {
  if (/too many users have viewed or downloaded|can.t view or download this file at this time/i.test(html)) {
    return 'Google Drive bloqueó la descarga por exceso de descargas del archivo (cuota diaria). Suele liberarse en unas horas.';
  }
  if (/sign in|accounts\.google\.com\/ServiceLogin/i.test(html) && !/download-form/.test(html)) {
    return 'Google Drive pide iniciar sesión: el archivo no es público o el DRIVE_FILE_ID es incorrecto.';
  }
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  return `Google Drive devolvió una página HTML en vez del CSV${title ? ` ("${title}")` : ''}.`;
}

export function openDriveStream(fileId) {
  return openDriveUrl(`https://drive.google.com/uc?export=download&id=${fileId}`);
}

export async function openDriveUrl(startUrl) {
  const cookies = new Map();
  let url = startUrl;

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
    });

    for (const cookie of res.headers.getSetCookie?.() || []) {
      const [pair] = cookie.split(';');
      const idx = pair.indexOf('=');
      if (idx > 0) cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }

    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`Google Drive respondió HTTP ${res.status}.`);
    }

    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) {
      return Readable.fromWeb(res.body);
    }

    const html = await res.text();
    const next = findDownloadUrl(html, res.url);
    if (!next || next === url) {
      try {
        fs.writeFileSync(DEBUG_HTML_PATH, html);
      } catch {
        // no es crítico
      }
      throw new Error(`${describeHtmlError(html)} (página guardada en ${DEBUG_HTML_PATH})`);
    }
    url = next;
  }

  throw new Error('Google Drive no entregó el archivo después de varios intentos.');
}
