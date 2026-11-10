// Conexión con Supabase y piezas compartidas por todas las páginas de Armonitabs
const db = (typeof supabase !== "undefined" && SUPABASE_URL)
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const TONALIDADES = ["G", "Ab", "A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "F#"];
const DIFICULTADES = { 1: "Principiante", 2: "Intermedio", 3: "Avanzado" };

// Semitonos de cada armónica respecto de una en C
const SEMITONOS_TONALIDAD = { G: -5, Ab: -4, A: -3, Bb: -2, B: -1, C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, "F#": 6 };

// Celdas de una armónica diatónica Richter, una por semitono desde el 1 soplado.
// El índice 7 (G4 en una armónica en C) también se toca como 3 soplado.
const CELDAS = [
    "1", "(1)b", "(1)", "1ob", "2", "(2)bb", "(2)b", "(2)", "(3)bbb", "(3)bb",
    "(3)b", "(3)", "4", "(4)b", "(4)", "4ob", "5", "(5)", "5ob", "6",
    "(6)b", "(6)", "6ob", "(7)", "7", "(7)od", "(8)", "8b", "8", "(9)",
    "9b", "9", "(9)od", "(10)", "10bb", "10b", "10", "(10)od"
];
const INDICE_CELDA = new Map(CELDAS.map((celda, i) => [celda, i]));
INDICE_CELDA.set("3", 7);

// Línea que marca un cambio de armónica dentro de la tab, por ejemplo "— Armónica en D —"
const MARCA_ARMONICA = /^[\s—–-]*arm[oó]nica en ([a-g][b#]?)[\s—–-]*$/i;

function marcaArmonica(tonalidad){
    return "— Armónica en " + tonalidad + " —";
}

function leerMarcaArmonica(linea){
    const coincidencia = linea.match(MARCA_ARMONICA);
    if(!coincidencia) return null;
    const tonalidad = coincidencia[1][0].toUpperCase() + coincidencia[1].slice(1).toLowerCase();
    return TONALIDADES.includes(tonalidad) ? tonalidad : null;
}

// Armónicas marcadas dentro de la tab, en el orden en que aparecen
function armonicasEnContenido(contenido){
    const encontradas = [];
    for(const linea of contenido.split("\n")){
        const tonalidad = leerMarcaArmonica(linea);
        if(tonalidad && !encontradas.includes(tonalidad)) encontradas.push(tonalidad);
    }
    return encontradas;
}

function nombreArmonicas(tonalidades){
    if(tonalidades.length === 1) return "Armónica en " + tonalidades[0];
    return "Armónicas en " + tonalidades.slice(0, -1).join(", ") + " y " + tonalidades[tonalidades.length - 1];
}

// Una línea es de tablatura si al menos la mitad de sus palabras son celdas (así no se tocan títulos ni comentarios)
function esLineaDeTab(linea){
    const palabras = linea.trim().split(/\s+/).filter(Boolean);
    const celdas = palabras.filter(palabra => INDICE_CELDA.has(palabra)).length;
    return celdas > 0 && celdas * 2 >= palabras.length;
}

// Reescribe la tab para tocar las mismas notas con otras armónicas.
// reemplazos: { tonalidadOriginal: tonalidadNueva }. Antes de la primera marca rige tonalidades[0].
// Cada sección se corre una octava si así entran más notas; las que no entran quedan como "?".
// octavas: { tonalidadOriginal: n } sube o baja n octavas más, a elección del usuario.
function transponer(contenido, tonalidades, reemplazos, celdaG4 = "(2)", octavas = {}){
    const lineas = contenido.split("\n");
    const secciones = [];
    let actual = { tonalidad: tonalidades[0], lineas: [] };
    for(const linea of lineas){
        const tonalidad = leerMarcaArmonica(linea);
        if(tonalidad){
            secciones.push(actual);
            actual = { tonalidad, marca: true, lineas: [linea] };
        } else {
            actual.lineas.push(linea);
        }
    }
    secciones.push(actual);

    return secciones.flatMap(seccion => {
        const destino = reemplazos[seccion.tonalidad] || seccion.tonalidad;
        const octavaElegida = (octavas[seccion.tonalidad] || 0) * 12;
        const mismaArmonica = destino === seccion.tonalidad;
        if(mismaArmonica && !octavaElegida) return seccion.lineas;

        const indices = [];
        for(const linea of seccion.lineas){
            if(!esLineaDeTab(linea)) continue;
            for(const palabra of linea.split(/\s+/)){
                if(INDICE_CELDA.has(palabra)) indices.push(INDICE_CELDA.get(palabra));
            }
        }
        // Se elige la octava donde entran más notas y, si empatan, la que necesita menos bends y overblows
        const corrimiento = SEMITONOS_TONALIDAD[seccion.tonalidad] - SEMITONOS_TONALIDAD[destino];
        let mejorOctava = 0;
        let mejorCantidad = -1;
        let mejorDificultad = Infinity;
        for(const octava of (mismaArmonica ? [0] : [0, 12, -12])){
            const nuevos = indices.map(i => i + corrimiento + octava).filter(i => i >= 0 && i < CELDAS.length);
            const dificultad = nuevos.filter(i => /b|o/.test(CELDAS[i])).length;
            if(nuevos.length > mejorCantidad || (nuevos.length === mejorCantidad && dificultad < mejorDificultad)){
                mejorCantidad = nuevos.length;
                mejorDificultad = dificultad;
                mejorOctava = octava;
            }
        }

        return seccion.lineas.map((linea, numero) => {
            if(seccion.marca && numero === 0) return mismaArmonica ? linea : marcaArmonica(destino);
            if(!esLineaDeTab(linea)) return linea;
            return linea.replace(/\S+/g, palabra => {
                if(!INDICE_CELDA.has(palabra)) return palabra;
                const nuevo = INDICE_CELDA.get(palabra) + corrimiento + mejorOctava + octavaElegida;
                if(nuevo < 0 || nuevo >= CELDAS.length) return "?";
                return nuevo === 7 ? celdaG4 : CELDAS[nuevo];
            });
        });
    }).join("\n");
}

let usuarioPromesa = null;

// Devuelve { id, nombre } del usuario con sesión iniciada, o null
function obtenerUsuario(){
    if(!usuarioPromesa){
        usuarioPromesa = (async () => {
            if(!db) return null;
            const { data } = await db.auth.getSession();
            if(!data.session) return null;
            const { id, app_metadata, user_metadata } = data.session.user;
            const { data: perfil } = await db.from("perfiles").select("nombre, admin, profe").eq("id", id).single();
            return {
                id,
                nombre: perfil ? perfil.nombre : "",
                admin: Boolean(perfil && perfil.admin),
                profe: Boolean(perfil && perfil.profe),
                // Quien se registró con Google recibe el nombre de su cuenta: se le ofrece elegir otro una vez
                debeElegirNombre: app_metadata.provider === "google" && !user_metadata.nombre_elegido,
            };
        })();
    }
    return usuarioPromesa;
}

async function cerrarSesion(){
    await db.auth.signOut();
    location.reload();
}

function crearEnlace(texto, href){
    const enlace = document.createElement("a");
    enlace.textContent = texto;
    enlace.href = href;
    return enlace;
}

// Modo oscuro: se recuerda en el navegador; si nunca se eligió, sigue al sistema (ver el script del <head>)
function botonTema(){
    const boton = document.createElement("button");
    boton.className = "tema";
    const dibujar = () => {
        const oscuro = document.documentElement.classList.contains("oscuro");
        boton.textContent = oscuro ? "☀" : "☾";
        boton.title = oscuro ? "Modo claro" : "Modo oscuro";
        boton.setAttribute("aria-label", boton.title);
    };
    boton.addEventListener("click", () => {
        const oscuro = document.documentElement.classList.toggle("oscuro");
        try { localStorage.setItem("tabwriter-tema", oscuro ? "oscuro" : "claro"); } catch(error){}
        dibujar();
    });
    dibujar();
    return boton;
}

async function dibujarNav(){
    const nav = document.getElementById("nav-el");
    if(!nav) return;
    nav.replaceChildren(crearEnlace("Tablaturas", "index.html"), crearEnlace("Escribir", "escribir.html"));
    const tema = botonTema();
    nav.append(tema);
    const pagina = location.pathname.split("/").pop() || "index.html";
    for(const enlace of nav.children){
        if(enlace.getAttribute("href") === pagina) enlace.classList.add("actual");
    }
    if(!db) return;

    const usuario = await obtenerUsuario();
    if(usuario && usuario.debeElegirNombre && pagina !== "perfil.html"){
        const actual = pagina + location.search;
        location.href = "perfil.html?bienvenida=1&volver=" + encodeURIComponent(actual);
        return;
    }
    if(usuario){
        const perfil = crearEnlace(usuario.nombre, "perfil.html?id=" + usuario.id);
        if(pagina === "perfil.html" && new URLSearchParams(location.search).get("id") === usuario.id){
            perfil.classList.add("actual");
        }
        const salir = crearEnlace("Salir", "#");
        salir.addEventListener("click", (event) => { event.preventDefault(); cerrarSesion(); });
        if(usuario.admin){
            const moderacion = crearEnlace("Moderación", "admin.html");
            if(pagina === "admin.html") moderacion.classList.add("actual");
            nav.append(moderacion);
        }
        nav.append(perfil, salir);
    } else {
        nav.append(crearEnlace("Entrar", urlEntrar()));
    }
    nav.append(tema);   // siempre al final
}

// Link a la página de login que después vuelve a la página actual
function urlEntrar(){
    const actual = (location.pathname.split("/").pop() || "index.html") + location.search;
    return "entrar.html?volver=" + encodeURIComponent(actual);
}

function estrellas(promedio){
    const llenas = Math.round(promedio);
    return "★".repeat(llenas) + "☆".repeat(5 - llenas);
}

// Versiones: tabs del mismo tema (título y artista iguales sin contar mayúsculas, tildes ni signos)
function normalizarTexto(texto){
    return (texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase().replace(/[^a-z0-9ñ]+/g, " ").trim();
}

// Nombres de usuario que se confunden con la Escuela o con el sitio (igual que nombre_reservado() en la base)
function nombreReservado(nombre){
    const n = normalizarTexto(nombre).replace(/ /g, "");
    return (n.includes("escuela") && n.includes("armonica")) || n.includes("armonitabs")
        || /^(admin|administrador|moderador|moderacion|soporte|staff)/.test(n);
}

// Marquitas junto al nombre del autor y en las tabs con el sello de la Escuela
function crearEtiqueta(texto, clase){
    const etiqueta = document.createElement("span");
    etiqueta.className = "etiqueta " + clase;
    etiqueta.textContent = texto;
    return etiqueta;
}

function claveTema(titulo, artista){
    return normalizarTexto(artista) + "|" + normalizarTexto(titulo);
}

// Cantidad de letras a cambiar, agregar o sacar para pasar de un texto al otro
function distanciaTextos(a, b){
    let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
    for(let i = 1; i <= a.length; i++){
        const actual = [i];
        for(let j = 1; j <= b.length; j++){
            actual[j] = Math.min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        anterior = actual;
    }
    return anterior[b.length];
}

// Parecidos: hasta 1 error cada 5 letras (al menos 1)
function textosParecidos(a, b){
    if(a.replace(/ /g, "") === b.replace(/ /g, "")) return true;   // "Ji ji ji" y "Jijiji"
    return distanciaTextos(a, b) <= Math.max(1, Math.floor(Math.max(a.length, b.length) / 5));
}

// Para buscadores: cada tab tiene además una página fija (la arma .github/generar-paginas.js cada hora)
const SITIO = "https://tomasgarmonica.github.io/tabwriter/";

function urlPaginaTab(tab){
    const nombre = normalizarTexto(tab.titulo + " " + (tab.artista || "")).replace(/ñ/g, "n")
        .replace(/[^a-z0-9]+/g, "-").slice(0, 80).replace(/^-+|-+$/g, "");
    return "tab-" + tab.id + (nombre ? "-" + nombre : "") + ".html";
}

function urlPaginaArtista(artista){
    return "artista-" + normalizarTexto(artista).replace(/ñ/g, "n").replace(/[^a-z0-9]+/g, "-").slice(0, 60).replace(/^-+|-+$/g, "") + ".html";
}

function tituloPaginaTab(tab){
    return tab.titulo + (tab.artista ? " - " + tab.artista : "") + " · Tablatura para armónica · Armonitabs";
}

function descripcionTab(tab){
    return "Cómo tocar " + tab.titulo + (tab.artista ? " de " + tab.artista : "") + " en armónica diatónica. " +
        "Tablatura para a" + nombreArmonicas(tab.tonalidades).slice(1) + ", nivel " +
        DIFICULTADES[tab.dificultad].toLowerCase() + ". Transponela a tu armónica y votala en Armonitabs.";
}

// Título y artista de todas las tabs, agrupados por tema: Map clave → { titulo, artista, ids }
async function cargarTemas(){
    const temas = new Map();
    if(!db) return temas;
    // De a 1000, que es lo máximo que devuelve Supabase por consulta
    const data = [];
    for(let desde = 0; ; desde += 1000){
        const { data: pagina } = await db.from("tabs").select("id, titulo, artista").order("id").range(desde, desde + 999);
        data.push(...(pagina || []));
        if(!pagina || pagina.length < 1000) break;
    }
    for(const tab of data){
        const clave = claveTema(tab.titulo, tab.artista);
        if(!temas.has(clave)) temas.set(clave, { titulo: tab.titulo, artista: tab.artista || "", ids: [] });
        temas.get(clave).ids.push(tab.id);
    }
    return temas;
}

// Tarjeta de una tab para los listados
function crearTarjetaTab(tab, versiones){
    const tarjeta = document.createElement("a");
    tarjeta.className = "tarjeta";
    tarjeta.href = "tab.html?id=" + tab.id;

    const titulo = document.createElement("h3");
    titulo.textContent = tab.titulo;
    const artista = document.createElement("p");
    artista.className = "artista";
    artista.textContent = tab.artista || "";
    const datos = document.createElement("p");
    datos.className = "datos";
    datos.textContent = nombreArmonicas(tab.tonalidades) + " · " + DIFICULTADES[tab.dificultad] + " · por " + tab.autor_nombre;
    if(tab.autor_profe) datos.append(" ", crearEtiqueta("Profe", "profe"));
    if(tab.revisada) titulo.append(" ", crearEtiqueta("✓ Revisada por la Escuela", "revisada"));
    const puntaje = document.createElement("p");
    puntaje.className = "puntaje";
    puntaje.textContent = tab.cantidad_votos
        ? estrellas(tab.promedio) + " " + tab.promedio + " (" + tab.cantidad_votos + ")"
        : "Sin votos todavía";

    if(versiones > 1){
        const etiqueta = document.createElement("span");
        etiqueta.className = "versiones";
        etiqueta.textContent = versiones + " versiones";
        tarjeta.append(etiqueta);
    }
    tarjeta.append(titulo, artista, datos, puntaje);
    return tarjeta;
}

function descargarTexto(texto, nombre){
    const archivo = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = nombre.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) + ".txt";
    enlace.click();
    URL.revokeObjectURL(enlace.href);
}

function mostrarAviso(mensaje){
    const aviso = document.getElementById("aviso-el");
    aviso.textContent = mensaje;
    aviso.classList.add("visible");
    clearTimeout(aviso.temporizador);
    aviso.temporizador = setTimeout(() => aviso.classList.remove("visible"), 2500);
}

dibujarNav();
