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
function transponer(contenido, tonalidades, reemplazos, celdaG4 = "(2)"){
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
        if(destino === seccion.tonalidad) return seccion.lineas;

        const indices = [];
        for(const linea of seccion.lineas){
            if(!esLineaDeTab(linea)) continue;
            for(const palabra of linea.split(/\s+/)){
                if(INDICE_CELDA.has(palabra)) indices.push(INDICE_CELDA.get(palabra));
            }
        }
        const corrimiento = SEMITONOS_TONALIDAD[seccion.tonalidad] - SEMITONOS_TONALIDAD[destino];
        let mejorOctava = 0;
        let mejorCantidad = -1;
        for(const octava of [0, 12, -12]){
            const cantidad = indices.filter(i => i + corrimiento + octava >= 0 && i + corrimiento + octava < CELDAS.length).length;
            if(cantidad > mejorCantidad){
                mejorCantidad = cantidad;
                mejorOctava = octava;
            }
        }

        return seccion.lineas.map((linea, numero) => {
            if(seccion.marca && numero === 0) return marcaArmonica(destino);
            if(!esLineaDeTab(linea)) return linea;
            return linea.replace(/\S+/g, palabra => {
                if(!INDICE_CELDA.has(palabra)) return palabra;
                const nuevo = INDICE_CELDA.get(palabra) + corrimiento + mejorOctava;
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
            const id = data.session.user.id;
            const { data: perfil } = await db.from("perfiles").select("nombre").eq("id", id).single();
            return { id, nombre: perfil ? perfil.nombre : "" };
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

async function dibujarNav(){
    const nav = document.getElementById("nav-el");
    if(!nav) return;
    nav.replaceChildren(crearEnlace("Tablaturas", "index.html"), crearEnlace("Escribir", "escribir.html"));
    const pagina = location.pathname.split("/").pop() || "index.html";
    for(const enlace of nav.children){
        if(enlace.getAttribute("href") === pagina) enlace.classList.add("actual");
    }
    if(!db) return;

    const usuario = await obtenerUsuario();
    if(usuario){
        const perfil = crearEnlace(usuario.nombre, "perfil.html?id=" + usuario.id);
        if(pagina === "perfil.html" && new URLSearchParams(location.search).get("id") === usuario.id){
            perfil.classList.add("actual");
        }
        const salir = crearEnlace("Salir", "#");
        salir.addEventListener("click", (event) => { event.preventDefault(); cerrarSesion(); });
        nav.append(perfil, salir);
    } else {
        nav.append(crearEnlace("Entrar", urlEntrar()));
    }
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

// Tarjeta de una tab para los listados
function crearTarjetaTab(tab){
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
    const puntaje = document.createElement("p");
    puntaje.className = "puntaje";
    puntaje.textContent = tab.cantidad_votos
        ? estrellas(tab.promedio) + " " + tab.promedio + " (" + tab.cantidad_votos + ")"
        : "Sin votos todavía";

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
