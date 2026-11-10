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
const { urlPaginaTab, tituloPaginaTab, descripcionTab, nombreArmonicas, estrellas } = contexto;

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
    html = reemplazar(html, '<p id="artista-el" class="artista"></p>', `<p id="artista-el" class="artista">${escapar(tab.artista || "")}</p>`);
    html = reemplazar(html, '<span id="datos-el"></span>',
        `<span id="datos-el">${escapar(nombreArmonicas(tab.tonalidades) + " · " + DIFICULTADES[tab.dificultad])}</span>`);
    html = reemplazar(html, '<a id="autor-el"></a>', `<a id="autor-el" href="perfil.html?id=${tab.autor}">${escapar(tab.autor_nombre)}</a>`);
    html = reemplazar(html, '<p id="puntaje-el" class="puntaje"></p>', `<p id="puntaje-el" class="puntaje">${escapar(puntaje)}</p>`);
    html = reemplazar(html, '<pre id="contenido-el" class="contenido"></pre>', `<pre id="contenido-el" class="contenido">${escapar(tab.contenido)}</pre>`);
    return html;
}

function sitemap(tabs){
    const direcciones = [
        { loc: SITIO },
        { loc: SITIO + "escribir.html" },
        { loc: SITIO + "privacidad.html" },
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
    fs.writeFileSync(path.join(SALIDA, "sitemap.xml"), sitemap(tabs));
    console.log(tabs.length + " páginas de tabs y sitemap.xml en " + SALIDA);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
