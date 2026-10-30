// Copia el caché de Leaguepedia a data/ (comprimido) para subirlo al repo.
// Uso: npm run data:seed   (después de "npm run data:leaguepedia")
import { writeSeed } from './leaguepedia.mjs';

try {
  const { file, rows, kb, until, removed } = writeSeed();
  console.log(`[Seed] ${rows} filas (datos hasta ${until?.slice(0, 10)}) guardadas en ${file} (${kb} KB).`);
  if (removed) console.log(`[Seed] Se eliminaron ${removed} copia(s) de años anteriores de data/.`);
  console.log('[Seed] Súbelo al repo con git para que los builds partan desde aquí.');
} catch (err) {
  console.error(`[Error] ${err.message}`);
  process.exitCode = 1;
}
