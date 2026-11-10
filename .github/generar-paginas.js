// Arma el sitio para publicar: copia los archivos del repo y agrega, para los buscadores,
// una página fija por tab (tab-5-tan-solo-los-piojos.html) y el sitemap.xml.
// Lo corre .github/workflows/publicar.yml cada hora. Uso local: node .github/generar-paginas.js [carpeta]
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const RAIZ = path.resolve(__dirname, "..");
const SALIDA = path.resolve(RAIZ, process.argv[2] || "_sitio");
const NO_PUBLICAR = new Set([".git", ".github", "_sitio", "node_modules"]);

// Las mismas funciones que usa el sitio (urlPaginaTab, tituloPaginaTab, descripcionTab...)
const contexto = vm.createContext({ document: { getElementById: () => null }, location: { pathname: "/", search: "" } });
vm.runInContext(fs.readFileSync(path.join(RAIZ, "config.js"), "utf8"), contexto);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "comun.js"), "utf8"), contexto);
const { SUPABASE_URL, SUPABASE_ANON_KEY, SITIO, DIFICULTADES } =
    vm.runInContext("({ SUPABASE_URL, SUPABASE_ANON_KEY, SITIO, DIFICULTADES })", contexto);
const { urlPaginaTab, urlPaginaArtista, tituloPaginaTab, descripcionTab, nombreArmonicas, estrellas, normalizarTexto } = contexto;

function escapar(texto){
    return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function leerTabs(){
    const campos = "id,titulo,artista,tonalidades,dificultad,contenido,autor,autor_nombre,actualizada,promedio,cantidad_votos";
    const tabs = [];
    for(let desde = 0; ; desde += 1000){
        const respuesta = await fetch(`${SUPABASE_URL}/rest/v1/tabs_resumen?select=${campos}&order=id&offset=${desde}&limit=1000`,
            { headers: { apikey: SUPABASE_ANON_KEY } });
        if(!respuesta.ok) throw new Error("Supabase respondió " + respuesta.status + ": " + await respuesta.text());
        const pagina = await respuesta.json();
        tabs.push(...pagina);
        if(pagina.length < 1000) return tabs;
    }
}

// Reemplazo que tiene que estar sí o sí: si tab.html cambia, el script avisa en vez de armar páginas rotas
function reemplazar(html, buscado, nuevo){
    if(!html.includes(buscado)) throw new Error("No se encontró en tab.html: " + buscado);
    return html.replace(buscado, () => nuevo);
}

function paginaDeTab(plantilla, tab){
    const url = SITIO + urlPaginaTab(tab);
    const titulo = escapar(tituloPaginaTab(tab));
    const descripcion = escapar(descripcionTab(tab));
    const puntaje = tab.cantidad_votos
        ? estrellas(tab.promedio) + " " + tab.promedio + " (" + tab.cantidad_votos + (tab.cantidad_votos === 1 ? " voto)" : " votos)")
        : "Sin votos todavía";
    let html = plantilla;
    html = reemplazar(html, "<title>Armonitabs</title>", `<title>${titulo}</title>
    <meta name="description" content="${descripcion}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Armonitabs">
    <meta property="og:title" content="${titulo}">
    <meta property="og:description" content="${descripcion}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${SITIO}img/logo-escuela.png">
    <meta property="og:locale" content="es_AR">`);
    html = reemplazar(html, "<body>", `<body data-tab-id="${tab.id}">`);
    html = reemplazar(html, '<p id="estado-el" class="estado">', '<p id="estado-el" class="estado" hidden>');
    html = reemplazar(html, '<article id="tab-vista" hidden>', '<article id="tab-vista">');
    html = reemplazar(html, '<h2 id="titulo-el"></h2>', `<h2 id="titulo-el">${escapar(tab.titulo)}</h2>`);
    const artista = tab.artista ? `<a href="${urlPaginaArtista(tab.artista)}">${escapar(tab.artista)}</a>` : "";
    html = reemplazar(html, '<p id="artista-el" class="artista"></p>', `<p id="artista-el" class="artista">${artista}</p>`);
    html = reemplazar(html, '<span id="datos-el"></span>',
        `<span id="datos-el">${escapar(nombreArmonicas(tab.tonalidades) + " · " + DIFICULTADES[tab.dificultad])}</span>`);
    html = reemplazar(html, '<a id="autor-el"></a>', `<a id="autor-el" href="perfil.html?id=${tab.autor}">${escapar(tab.autor_nombre)}</a>`);
    html = reemplazar(html, '<p id="puntaje-el" class="puntaje"></p>', `<p id="puntaje-el" class="puntaje">${escapar(puntaje)}</p>`);
    html = reemplazar(html, '<pre id="contenido-el" class="contenido"></pre>', `<pre id="contenido-el" class="contenido">${escapar(tab.contenido)}</pre>`);
    return html;
}

// Artistas: { nombre, tabs } con el nombre como lo escribió la primera tab (sin contar mayúsculas ni tildes)
function agruparArtistas(tabs){
    const porClave = new Map();
    for(const tab of tabs){
        if(!tab.artista || !normalizarTexto(tab.artista)) continue;
        const clave = normalizarTexto(tab.artista);
        if(!porClave.has(clave)) porClave.set(clave, { nombre: tab.artista.trim(), tabs: [] });
        porClave.get(clave).tabs.push(tab);
    }
    return [...porClave.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

// Páginas simples (artista y lista de artistas) armadas sobre privacidad.html: mismo encabezado, menú y pie
function paginaSimple(base, { titulo, descripcion, url, contenido }){
    let html = reemplazar(base, "<title>Privacidad y condiciones · Armonitabs</title>", `<title>${escapar(titulo)}</title>
    <meta name="description" content="${escapar(descripcion)}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Armonitabs">
    <meta property="og:title" content="${escapar(titulo)}">
    <meta property="og:description" content="${escapar(descripcion)}">
    <meta property="og:url" content="${url}">
    <meta property="og:image" content="${SITIO}img/logo-escuela.png">
    <meta property="og:locale" content="es_AR">`);
    const main = html.match(/<main class="pagina texto">[\s\S]*?<\/main>/);
    if(!main) throw new Error("No se encontró <main class=\"pagina texto\"> en privacidad.html");
    return html.replace(main[0], () => `<main class="pagina">\n${contenido}\n    </main>`);
}

function paginaDeArtista(base, artista){
    const temas = [...new Set(artista.tabs.map(tab => tab.titulo))];
    const tarjetas = artista.tabs
        .slice().sort((a, b) => a.titulo.localeCompare(b.titulo, "es") || b.promedio - a.promedio)
        .map(tab => `            <a class="tarjeta" href="${urlPaginaTab(tab)}">
                <h3>${escapar(tab.titulo)}</h3>
                <p class="datos">${escapar(nombreArmonicas(tab.tonalidades) + " · " + DIFICULTADES[tab.dificultad] + " · por " + tab.autor_nombre)}</p>
            </a>`).join("\n");
    return paginaSimple(base, {
        titulo: artista.nombre + " · Tablaturas para armónica · Armonitabs",
        descripcion: "Tablaturas para armónica de " + artista.nombre + ": " + temas.slice(0, 8).join(", ") +
            ". Cómo tocar sus canciones en armónica diatónica.",
        url: SITIO + urlPaginaArtista(artista.nombre),
        contenido: `        <h2>${escapar(artista.nombre)}</h2>
        <p class="ayuda">Tablaturas para armónica de ${escapar(artista.nombre)} (${artista.tabs.length === 1 ? "1 tab" : artista.tabs.length + " tabs"}). <a href="artistas.html">Ver todos los artistas</a></p>
        <div class="lista">
${tarjetas}
        </div>`,
    });
}

function paginaDeArtistas(base, artistas){
    const enlaces = artistas.map(a => `            <li><a href="${urlPaginaArtista(a.nombre)}">${escapar(a.nombre)}</a> <span class="datos">(${a.tabs.length})</span></li>`).join("\n");
    return paginaSimple(base, {
        titulo: "Artistas · Tablaturas para armónica · Armonitabs",
        descripcion: "Todos los artistas con tablaturas para armónica diatónica en Armonitabs: " +
            artistas.slice(0, 10).map(a => a.nombre).join(", ") + ".",
        url: SITIO + "artistas.html",
        contenido: `        <h2>Artistas</h2>
        <p class="ayuda">Todos los artistas con tablaturas para armónica en Armonitabs.</p>
        <ul class="artistas">
${enlaces}
        </ul>`,
    });
}

function sitemap(tabs, artistas){
    const direcciones = [
        { loc: SITIO },
        { loc: SITIO + "escribir.html" },
        { loc: SITIO + "privacidad.html" },
        { loc: SITIO + "artistas.html" },
        ...artistas.map(a => ({ loc: SITIO + urlPaginaArtista(a.nombre) })),
        ...tabs.map(tab => ({ loc: SITIO + urlPaginaTab(tab), lastmod: tab.actualizada.slice(0, 10) })),
    ];
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        direcciones.map(d => `  <url><loc>${escapar(d.loc)}</loc>${d.lastmod ? `<lastmod>${d.lastmod}</lastmod>` : ""}</url>`).join("\n") +
        "\n</urlset>\n";
}

async function main(){
    const tabs = await leerTabs();
    fs.rmSync(SALIDA, { recursive: true, force: true });
    fs.mkdirSync(SALIDA, { recursive: true });
    for(const nombre of fs.readdirSync(RAIZ)){
        if(NO_PUBLICAR.has(nombre)) continue;
        fs.cpSync(path.join(RAIZ, nombre), path.join(SALIDA, nombre), { recursive: true });
    }
    const plantilla = fs.readFileSync(path.join(RAIZ, "tab.html"), "utf8").replace(/\r\n/g, "\n");
    for(const tab of tabs){
        fs.writeFileSync(path.join(SALIDA, urlPaginaTab(tab)), paginaDeTab(plantilla, tab));
    }
    const base = fs.readFileSync(path.join(RAIZ, "privacidad.html"), "utf8").replace(/\r\n/g, "\n");
    const artistas = agruparArtistas(tabs);
    for(const artista of artistas){
        fs.writeFileSync(path.join(SALIDA, urlPaginaArtista(artista.nombre)), paginaDeArtista(base, artista));
    }
    fs.writeFileSync(path.join(SALIDA, "artistas.html"), paginaDeArtistas(base, artistas));
    fs.writeFileSync(path.join(SALIDA, "sitemap.xml"), sitemap(tabs, artistas));
    console.log(tabs.length + " páginas de tabs, " + artistas.length + " de artistas y sitemap.xml en " + SALIDA);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
