# Datos iniciales

`leaguepedia-AAAA.json.gz` es una copia comprimida de las partidas profesionales del año descargadas
desde [Leaguepedia](https://lol.fandom.com). Sirve para que los builds no tengan que descargar el año
completo (~30 minutos): parten desde esta copia y solo piden a Leaguepedia las semanas recientes.

- Leaguepedia es la fuente principal cuando hay credenciales (LEAGUEPEDIA_BOT_USER/PASSWORD);
  si falla, se usa Oracle's Elixir (Google Drive). Las fuentes nunca se mezclan en un mismo build.
- Sin credenciales, esta copia se usa tal cual (sin actualizar) si Google Drive no entrega el CSV.
- Para actualizarla: `npm run data:leaguepedia` y luego `npm run data:seed`, y subir el archivo con git.
  No hace falta hacerlo seguido: aunque quede vieja, el build descarga lo que falte.

Fuente: Leaguepedia, contenido bajo licencia [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
