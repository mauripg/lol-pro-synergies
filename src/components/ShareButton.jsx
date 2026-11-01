import { useState } from 'react';

// Copia la URL actual (que ya incluye campeón, línea y filtros) al portapapeles.
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copia este link:', url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type="button" className="share-button" onClick={handleClick}>
      {copied ? '¡Link copiado!' : 'Copiar link'}
    </button>
  );
}
