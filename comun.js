// Conexión con Supabase y piezas compartidas por todas las páginas de Armonitabs
const db = (typeof supabase !== "undefined" && SUPABASE_URL)
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const TONALIDADES = ["G", "Ab", "A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "F#"];
const DIFICULTADES = { 1: "Principiante", 2: "Intermedio", 3: "Avanzado" };

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
    datos.textContent = "Armónica en " + tab.tonalidad + " · " + DIFICULTADES[tab.dificultad] + " · por " + tab.autor_nombre;
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
