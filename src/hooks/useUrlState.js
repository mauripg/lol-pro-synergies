import { useEffect } from 'react';

// Guarda el estado de la página en la URL (?champ=Ahri&lane=mid...) para poder compartir links.
// Solo se escriben los valores distintos del valor por defecto, para que la URL quede corta.

export const URL_DEFAULTS = {
  view: 'home',
  champ: 'Jinx',
  lane: '',
  tier: 'all',
  scope: 'all',
  tab: 'synergy',
  role: 'all',
  cls: 'all',
  style: 'all',
  sort: 'games-desc',
  prole: 'all',
  pcls: 'all',
  pstyle: 'all',
  comp: '',
};

export function readUrlState() {
  const state = { ...URL_DEFAULTS };
  if (typeof window === 'undefined') return state;
  const params = new URLSearchParams(window.location.search);
  for (const key of Object.keys(URL_DEFAULTS)) {
    const value = params.get(key);
    if (value !== null) state[key] = value;
  }
  // Links antiguos (?champ=Ahri sin "view") abren la vista del campeón.
  if (!params.has('view') && params.has('champ')) state.view = 'champ';
  return state;
}

// Escribe el estado en la URL. Normalmente reemplaza la entrada actual del historial; cuando
// `pushRef.current` tiene una etiqueta (al abrir otro campeón o cambiar de vista) crea una entrada
// nueva, para que el botón "Volver" y el botón atrás del navegador regresen a donde estabas.
export function useUrlSync(state, { pushRef, onPush } = {}) {
  const serialized = JSON.stringify(state);
  useEffect(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(state)) {
      if (value !== undefined && value !== null && String(value) !== String(URL_DEFAULTS[key] ?? '')) {
        params.set(key, value);
      }
    }
    // ':' y ',' se dejan sin codificar para que el link sea legible (comp=top:Gnar,mid:Ahri).
    const query = params.toString().replace(/%3A/gi, ':').replace(/%2C/gi, ',');
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    const current = window.history.state || {};

    if (pushRef?.current && url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      const backLabel = pushRef.current;
      pushRef.current = null;
      const entry = { depth: (current.depth || 0) + 1, backLabel, scrollY: 0 };
      window.history.pushState(entry, '', url);
      window.scrollTo({ top: 0 });
      onPush?.(entry);
    } else {
      if (pushRef) pushRef.current = null;
      window.history.replaceState(current, '', url);
    }
  }, [serialized]);
}

// Guarda la posición de scroll en la entrada actual del historial (para restaurarla al volver).
export function rememberScroll() {
  const current = window.history.state || {};
  window.history.replaceState({ ...current, scrollY: window.scrollY }, '');
}

// "top:Gnar,mid:Ahri" <-> { top: 'Gnar', mid: 'Ahri' }
export function parseComp(value) {
  const slots = { top: null, jng: null, mid: null, bot: null, sup: null };
  for (const part of (value || '').split(',')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const role = part.slice(0, idx);
    const champ = part.slice(idx + 1);
    if (role in slots && champ) slots[role] = champ;
  }
  return slots;
}

export function serializeComp(slots) {
  return Object.entries(slots)
    .filter(([, champ]) => champ)
    .map(([role, champ]) => `${role}:${champ}`)
    .join(',');
}
