# Armonitabs

Comunidad de tablaturas para armónica diatónica de la Escuela de Armónica de Buenos Aires (antes "TabWriter"; el repo conserva ese nombre). Sitio estático en GitHub Pages: https://tomasgarmonica.github.io/tabwriter/ (se publica desde `main`). Usuarios, tabs y votos en Supabase.

## Estructura
- HTML/CSS/JS sin frameworks ni build: cada página carga sus scripts con `<script>` clásicos (no módulos), así que los nombres globales se comparten entre `comun.js` y el script de la página. Evitar nombres repetidos.
- Orden de scripts en cada página: supabase-js (CDN) → `config.js` → `comun.js` → script de la página.
- `index.html` + `tabs.js`: portada, lista y búsqueda de tablaturas. `tabs.html` solo redirige a la portada (enlaces viejos).
- `escribir.html` + `escribir.js`: editor (botones, modo teclado, detector de notas por micrófono, publicar).
- `tab.html` + `tab.js`: una tab (votos, transponer, copiar/descargar, editar/eliminar propias).
- `perfil.html`/`perfil.js`, `entrar.html`/`entrar.js` (login por email; el botón de Google aparece solo si el proveedor está activo en Supabase).
- `comun.js`: cliente Supabase (`db`, es `null` si no hay configuración o falla el CDN: las páginas deben seguir andando), menú, celdas de la armónica (`CELDAS`), marcas de cambio de armónica y `transponer()`.
- `config.js`: URL y clave publicable de Supabase (son públicas; la seguridad está en las políticas RLS).
- Publicación: `.github/workflows/publicar.yml` corre con cada push a `main` y cada hora `.github/generar-paginas.js`, que copia el repo y agrega una página fija por tab (`tab-5-tan-solo-los-piojos.html`, armada desde `tab.html`) y `sitemap.xml`, para buscadores. Reusa `urlPaginaTab()`, `tituloPaginaTab()` y `descripcionTab()` de `comun.js`. Si cambian los `id` o el marcado vacío de `tab.html`, actualizar los reemplazos del script (si no coinciden, falla y no publica). Prueba local: `node .github/generar-paginas.js carpeta`.
- `supabase/`: `esquema.sql` (instalación desde cero, siempre al día) + migraciones numeradas (`02-...sql`).

## Convenciones
- Código, comentarios, nombres y textos de la interfaz en español rioplatense ("Entrá", "tocá"), igual que el código existente.
- Texto de usuarios siempre con `textContent`, nunca `innerHTML`.
- Notación de celdas: número = soplado, `(n)` = aspirado, sufijos `b`/`bb`/`bbb` = bends, `ob` = overblow, `od` = overdraw. G4 es a la vez `(2)` y `3`: el usuario elige cuál escribir.
- Las marcas de cambio de armónica son líneas `— Armónica en D —` (ver `MARCA_ARMONICA` en `comun.js`).
- Claves de `localStorage` `tabwriter-*`: no renombrarlas, guardan la tab y los ajustes de los usuarios.
- Paleta: violeta `#645A78`. Revisar los cambios de diseño en pantalla ancha (1920 px) y en celular (390 px).

## Cambios en la base de datos
El dueño del proyecto ejecuta el SQL a mano en Supabase (SQL Editor). Orden para no romper la página publicada:
1. Escribir la migración en `supabase/0N-...sql` y actualizar `esquema.sql`.
2. Preparar el código en una rama aparte (no en `main`).
3. Esperar a que se ejecute la migración y verificarla con la API REST.
4. Recién entonces mergear a `main`.

## Pruebas
No hay suite de tests; se prueba con scripts descartables (fuera del repo):
- SQL y políticas RLS: PGlite (`@electric-sql/pglite`) simulando `auth.users`, `auth.uid()` y los roles `anon`/`authenticated`.
- Páginas: Chrome headless con `puppeteer-core` y un servidor estático local (el login con `file://` no sirve). El micrófono se simula con `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=archivo.wav`.
- `transponer()`: verificar para todas las combinaciones de tonalidades y celdas que la nota resultante sea la misma (o ±1 octava).
- `node --check archivo.js` para la sintaxis.
