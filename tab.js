// En las páginas fijas para buscadores el id viene en <body data-tab-id>; si no, en la URL (tab.html?id=5)
const tabId = parseInt(document.body.dataset.tabId || new URLSearchParams(location.search).get("id"));
const estadoEl = document.getElementById("estado-el");
let tab = null;
let contenidoMostrado = "";   // la tab tal como se ve (puede estar transpuesta)

async function cargarTab(){
    const paginaFija = Boolean(document.body.dataset.tabId);
    if(!db){
        estadoEl.textContent = "Las tablaturas no están disponibles en este momento.";
        return;
    }
    const { data, error } = tabId
        ? await db.from("tabs_resumen").select("*").eq("id", tabId).maybeSingle()
        : { data: null, error: null };
    if(error && paginaFija){
        // La página fija ya trae la tab escrita: se sigue viendo, solo sin votos ni versiones
        estadoEl.textContent = "No se pudo conectar con Armonitabs: por ahora no se puede votar ni ver otras versiones.";
        estadoEl.hidden = false;
        return;
    }
    if(error || !data){
        estadoEl.textContent = error ? "No se pudo cargar la tab: " + error.message : "Esta tab no existe o fue eliminada.";
        estadoEl.hidden = false;
        document.getElementById("tab-vista").hidden = true;
        return;
    }
    tab = data;
    datosParaBuscadores();
    document.getElementById("titulo-el").textContent = tab.titulo;
    mostrarArtista();
    document.getElementById("datos-el").textContent = nombreArmonicas(tab.tonalidades) + " · " + DIFICULTADES[tab.dificultad];
    const autor = document.getElementById("autor-el");
    autor.textContent = tab.autor_nombre;
    autor.href = "perfil.html?id=" + tab.autor;
    if(tab.autor_profe) autor.after(" ", crearEtiqueta("Profe", "profe"));
    document.getElementById("sello-el").hidden = !tab.revisada;
    contenidoMostrado = tab.contenido;
    document.getElementById("contenido-el").textContent = tab.contenido;
    mostrarVideo();
    enlaceWhatsapp();
    dibujarTransponer();
    mostrarPuntaje();
    mostrarVersiones();
    estadoEl.hidden = true;
    document.getElementById("tab-vista").hidden = false;

    const usuario = await obtenerUsuario();
    if(!usuario){
        document.getElementById("entrar-el").href = urlEntrar();
        document.getElementById("votar-entrar-el").hidden = false;
    } else if(usuario.id === tab.autor){
        document.getElementById("propias-el").hidden = false;
    } else {
        const { data: voto } = await db.from("votos").select("puntaje")
            .eq("tab_id", tabId).eq("usuario", usuario.id).maybeSingle();
        dibujarEstrellas(voto ? voto.puntaje : 0);
        document.getElementById("votar-el").hidden = false;
    }
    if(usuario && usuario.admin){
        document.getElementById("moderar-el").hidden = false;
        dibujarBotonSello();
    }
    document.getElementById("reportar-el").hidden = Boolean(usuario && usuario.id === tab.autor);
}

// Video de referencia de YouTube, dentro de la página (versión sin cookies hasta que se reproduce)
function mostrarVideo(){
    const contenedor = document.getElementById("video-el");
    if(!tab.video){
        contenedor.hidden = true;
        return;
    }
    const video = document.createElement("iframe");
    video.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(tab.video);
    video.title = "Video de referencia: " + tab.titulo;
    video.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    video.referrerPolicy = "strict-origin-when-cross-origin";
    video.loading = "lazy";
    contenedor.replaceChildren(video);
    contenedor.hidden = false;
}

// Moderación: sello "Revisada por la Escuela" (solo administradores)
function dibujarBotonSello(){
    document.getElementById("sello-btn").textContent = tab.revisada ? "Quitar el sello de revisada" : "Marcar como revisada";
}

async function cambiarSello(){
    const { data, error } = await db.from("tabs").update({ revisada: !tab.revisada }).eq("id", tabId).select("revisada");
    if(error || !data.length){
        mostrarAviso("No se pudo cambiar el sello" + (error ? ": " + error.message : ""));
        return;
    }
    tab.revisada = data[0].revisada;
    document.getElementById("sello-el").hidden = !tab.revisada;
    dibujarBotonSello();
    mostrarAviso(tab.revisada ? "Tab marcada como revisada" : "Sello quitado");
}

// Reportar la tab: queda para que la vea un administrador en la página de moderación
const reporteDialogo = document.getElementById("reporte-dialogo");
const reporteForm = document.getElementById("reporte-form");

document.getElementById("reportar-el").addEventListener("click", async (event) => {
    event.preventDefault();
    if(!await obtenerUsuario()){
        location.href = urlEntrar();
        return;
    }
    reporteForm.reset();
    reporteDialogo.showModal();
});

reporteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const detalle = reporteForm.detalle.value.trim();
    const motivo = reporteForm.tipo.value + (detalle ? ": " + detalle : "");
    const boton = document.getElementById("reporte-btn");
    boton.disabled = true;
    // Sin .select(): los reportes solo los pueden leer los administradores
    const { error } = await db.from("reportes").insert({ tab_id: tabId, motivo });
    boton.disabled = false;
    reporteDialogo.close();
    if(error){
        mostrarAviso(error.code === "23505" ? "Ya reportaste esta tab" : "No se pudo enviar el reporte: " + error.message);
        return;
    }
    mostrarAviso("¡Gracias! La Escuela lo va a revisar");
});

// Título, descripción y dirección oficial (la página fija), para buscadores y vistas previas
async function datosParaBuscadores(){
    document.title = tituloPaginaTab(tab);
    let descripcion = document.querySelector('meta[name="description"]');
    if(!descripcion){
        descripcion = document.createElement("meta");
        descripcion.name = "description";
        document.head.append(descripcion);
    }
    descripcion.content = descripcionTab(tab);
    const pagina = urlPaginaTab(tab);
    let canonica = document.querySelector('link[rel="canonical"]');
    if(!canonica){
        canonica = document.createElement("link");
        canonica.rel = "canonical";
        document.head.append(canonica);
    }
    canonica.href = SITIO + pagina;
    // Desde tab.html?id=5 se pasa a la dirección linda, si su página ya fue generada
    if(!document.body.dataset.tabId){
        try {
            const respuesta = await fetch(pagina, { method: "HEAD" });
            if(respuesta.ok) history.replaceState(null, "", pagina);
        } catch(error){}
    }
}

function mostrarPuntaje(){
    document.getElementById("puntaje-el").textContent = tab.cantidad_votos
        ? estrellas(tab.promedio) + " " + tab.promedio + " (" + tab.cantidad_votos + (tab.cantidad_votos === 1 ? " voto)" : " votos)")
        : "Sin votos todavía";
}

// Otras tabs del mismo tema: un selector para pasar de una a otra
async function mostrarVersiones(){
    const temas = await cargarTemas();
    const tema = temas.get(claveTema(tab.titulo, tab.artista));
    if(!tema || tema.ids.length < 2) return;
    const { data } = await db.from("tabs_resumen")
        .select("id, tonalidades, dificultad, autor_nombre, promedio, cantidad_votos")
        .in("id", tema.ids)
        .order("promedio", { ascending: false })
        .order("cantidad_votos", { ascending: false });
    if(!data || data.length < 2) return;

    const selector = document.getElementById("versiones-select");
    for(const version of data){
        const votos = version.cantidad_votos ? " · ★ " + version.promedio + " (" + version.cantidad_votos + ")" : "";
        const texto = "por " + version.autor_nombre + " · " + nombreArmonicas(version.tonalidades)
            + " · " + DIFICULTADES[version.dificultad] + votos;
        selector.add(new Option(texto, version.id, false, version.id === tab.id));
    }
    selector.addEventListener("change", () => {
        location.href = "tab.html?id=" + selector.value;
    });
    document.getElementById("versiones-ttl").textContent = "Hay " + data.length + " versiones de este tema:";
    document.getElementById("versiones-el").hidden = false;
}

function dibujarEstrellas(puntaje){
    const contenedor = document.getElementById("estrellas-el");
    contenedor.replaceChildren();
    for(let i = 1; i <= 5; i++){
        const estrella = document.createElement("button");
        estrella.textContent = i <= puntaje ? "★" : "☆";
        estrella.title = i + (i === 1 ? " estrella" : " estrellas");
        estrella.addEventListener("click", () => votar(i));
        contenedor.append(estrella);
    }
}

async function votar(puntaje){
    const usuario = await obtenerUsuario();
    const { error } = await db.from("votos").upsert({ tab_id: tabId, usuario: usuario.id, puntaje });
    if(error){
        mostrarAviso("No se pudo guardar el voto: " + error.message);
        return;
    }
    dibujarEstrellas(puntaje);
    mostrarAviso("¡Gracias por votar!");
    const { data } = await db.from("tabs_resumen").select("promedio, cantidad_votos").eq("id", tabId).single();
    if(data){
        tab.promedio = data.promedio;
        tab.cantidad_votos = data.cantidad_votos;
        mostrarPuntaje();
    }
}

//Transponer
// Por cada armónica de la tab: { select, octava } con la armónica elegida y las octavas extra
const transposicion = {};

function dibujarTransponer(){
    const filas = document.getElementById("transponer-el");
    for(const tonalidad of tab.tonalidades){
        const fila = document.createElement("div");
        fila.className = "fila";

        const etiqueta = document.createElement("label");
        etiqueta.append("Armónica en " + tonalidad + " → ");
        const select = document.createElement("select");
        for(const opcion of TONALIDADES) select.add(new Option(opcion, opcion));
        select.value = tonalidad;
        select.addEventListener("change", () => {
            // Al cambiar de armónica se vuelve a la octava que elige la app
            transposicion[tonalidad].octava = 0;
            aplicarTransposicion();
        });
        etiqueta.append(select);

        const control = document.createElement("span");
        control.className = "octava";
        const bajar = document.createElement("button");
        bajar.textContent = "−";
        bajar.title = "Bajar una octava";
        const valor = document.createElement("span");
        const subir = document.createElement("button");
        subir.textContent = "+";
        subir.title = "Subir una octava";
        bajar.addEventListener("click", () => moverOctava(tonalidad, -1));
        subir.addEventListener("click", () => moverOctava(tonalidad, 1));
        control.append("Octava ", bajar, valor, subir);

        transposicion[tonalidad] = { select, octava: 0, valor, bajar, subir };
        fila.append(etiqueta, control);
        filas.append(fila);
    }
    dibujarOctavas();
}

function moverOctava(tonalidad, cambio){
    transposicion[tonalidad].octava += cambio;
    aplicarTransposicion();
}

// La armónica tiene 3 octavas: más de 2 hacia cualquier lado deja todo fuera de registro
function dibujarOctavas(){
    for(const { octava, valor, bajar, subir } of Object.values(transposicion)){
        valor.textContent = octava > 0 ? "+" + octava : octava < 0 ? "−" + -octava : "0";
        bajar.disabled = octava <= -2;
        subir.disabled = octava >= 2;
    }
}

// G4 se escribe como lo eligió el usuario en el editor
function celdaG4(){
    try {
        const ajustes = JSON.parse(localStorage.getItem("tabwriter-ajustes"));
        if(ajustes && ajustes.g4) return ajustes.g4;
    } catch(error){}
    return "(2)";
}

function aplicarTransposicion(){
    const reemplazos = {};
    const octavas = {};
    for(const [tonalidad, { select, octava }] of Object.entries(transposicion)){
        reemplazos[tonalidad] = select.value;
        octavas[tonalidad] = octava;
    }
    dibujarOctavas();
    contenidoMostrado = transponer(tab.contenido, tab.tonalidades, reemplazos, celdaG4(), octavas);
    document.getElementById("contenido-el").textContent = contenidoMostrado;
    document.getElementById("fuera-de-registro-el").hidden = !/(^|\s)\?(\s|$)/.test(contenidoMostrado);
}

// El artista lleva a su página (la arma el generador cada hora); si todavía no existe, a la búsqueda
async function mostrarArtista(){
    const artistaEl = document.getElementById("artista-el");
    if(!tab.artista){
        artistaEl.textContent = "";
        return;
    }
    const enlace = crearEnlace(tab.artista, "index.html?texto=" + encodeURIComponent(tab.artista));
    artistaEl.replaceChildren(enlace);
    try {
        const pagina = urlPaginaArtista(tab.artista);
        if((await fetch(pagina, { method: "HEAD" })).ok) enlace.href = pagina;
    } catch(error){}
}

// El mensaje de WhatsApp dice de qué tab viene la consulta
function enlaceWhatsapp(){
    const tema = tab.titulo + (tab.artista ? " - " + tab.artista : "");
    const boton = document.querySelector(".clases a.boton");
    boton.href = "https://wa.me/5491130703928?text=" +
        encodeURIComponent("¡Hola! Vengo de Armonitabs (tab: " + tema + ") y quiero info sobre las clases");
    // En GoatCounter se cuenta desde qué tab se consultó
    boton.dataset.goatcounterClick = "whatsapp-clases: " + tema;
}

// Modo práctica: tamaño de letra (se recuerda) y avance automático
const contenidoEl = document.getElementById("contenido-el");
let tamanoLetra = 16;
try { tamanoLetra = parseInt(localStorage.getItem("tabwriter-letra")) || 16; } catch(error){}

function aplicarLetra(cambio){
    tamanoLetra = Math.min(36, Math.max(12, tamanoLetra + cambio));
    contenidoEl.style.fontSize = tamanoLetra + "px";
    try { localStorage.setItem("tabwriter-letra", tamanoLetra); } catch(error){}
}
document.getElementById("letra-menos").addEventListener("click", () => aplicarLetra(-2));
document.getElementById("letra-mas").addEventListener("click", () => aplicarLetra(2));
aplicarLetra(0);

const avanceBtn = document.getElementById("avance-btn");
let avanceActivo = false;
let ultimoCuadro = 0;
let restoAvance = 0;

function moverPantalla(tiempo){
    if(!avanceActivo) return;
    const pixelesPorSegundo = parseInt(document.getElementById("velocidad-el").value);
    if(ultimoCuadro){
        // Se acumulan las fracciones de píxel para que a velocidad lenta igual avance
        restoAvance += pixelesPorSegundo * (tiempo - ultimoCuadro) / 1000;
        const paso = Math.floor(restoAvance);
        restoAvance -= paso;
        if(paso) window.scrollBy(0, paso);
    }
    ultimoCuadro = tiempo;
    // Se detiene cuando el final de la tab ya está a la vista
    if(contenidoEl.getBoundingClientRect().bottom <= window.innerHeight - 20 ||
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2){
        cambiarAvance(false);
        return;
    }
    requestAnimationFrame(moverPantalla);
}

function cambiarAvance(activo){
    avanceActivo = activo;
    avanceBtn.textContent = activo ? "⏸ Pausar" : "▶ Avance automático";
    avanceBtn.classList.toggle("activo", activo);
    if(activo){
        ultimoCuadro = 0;
        restoAvance = 0;
        // Arranca con el principio de la tab arriba de la pantalla
        if(contenidoEl.getBoundingClientRect().top > window.innerHeight / 3){
            window.scrollTo({ top: window.scrollY + contenidoEl.getBoundingClientRect().top - 10 });
        }
        requestAnimationFrame(moverPantalla);
    }
}
avanceBtn.addEventListener("click", () => cambiarAvance(!avanceActivo));

function copiar(){
    navigator.clipboard.writeText(contenidoMostrado);
    mostrarAviso("¡Tab copiada al portapapeles!");
}

function descargar(){
    descargarTexto(contenidoMostrado, tab.titulo);
}

// Lleva la tab al editor (transpuesta, si se eligió otra armónica).
// Con "Editar" se lleva la original y al publicar se actualiza esta misma tab.
function abrirEnEditor(editar){
    const contenido = editar ? tab.contenido : contenidoMostrado;
    let actual = "";
    try { actual = localStorage.getItem("tabwriter-tab") || ""; } catch(error){}
    if(actual.trim() && actual !== contenido
        && !confirm("En el editor hay otra tab sin publicar. ¿Reemplazarla por esta?")) return;
    try {
        localStorage.setItem("tabwriter-tab", contenido);
        if(editar){
            localStorage.setItem("armonitabs-editando", JSON.stringify({
                id: tab.id, autor: tab.autor, titulo: tab.titulo, artista: tab.artista, tonalidades: tab.tonalidades, dificultad: tab.dificultad, video: tab.video
            }));
        } else {
            localStorage.removeItem("armonitabs-editando");
        }
    } catch(error){
        mostrarAviso("Tu navegador no permite guardar datos de esta página");
        return;
    }
    location.href = "escribir.html";
}

async function eliminar(){
    if(!confirm("¿Eliminar «" + tab.titulo + "»? No se puede deshacer.")) return;
    const { data, error } = await db.from("tabs").delete().eq("id", tabId).select("id");
    if(error || !data.length){
        mostrarAviso("No se pudo eliminar" + (error ? ": " + error.message : ""));
        return;
    }
    location.href = "perfil.html?id=" + tab.autor;
}

cargarTab();
