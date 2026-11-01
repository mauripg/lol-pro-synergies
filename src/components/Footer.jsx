// Créditos de las fuentes (Oracle's Elixir pide atribución; Leaguepedia es CC BY-SA 3.0)
// y de dónde salió la última actualización de los datos.
export function Footer({ metadata }) {
  const updated = metadata?.updatedAt
    ? new Date(metadata.updatedAt).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <footer className="app-footer">
      <span>
        Datos de partidas profesionales:{' '}
        <a href="https://oracleselixir.com" target="_blank" rel="noreferrer">
          Oracle's Elixir
        </a>{' '}
        y{' '}
        <a href="https://lol.fandom.com" target="_blank" rel="noreferrer">
          Leaguepedia
        </a>{' '}
        (
        <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">
          CC BY-SA 3.0
        </a>
        ).
      </span>
      {updated && (
        <span>
          Última actualización: {updated}
          {metadata.source ? ` · fuente: ${metadata.source}` : ''}.
        </span>
      )}
      <span>No afiliado a Riot Games.</span>
    </footer>
  );
}
