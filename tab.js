const tabId = parseInt(new URLSearchParams(location.search).get("id"));
const estadoEl = document.getElementById("estado-el");
let tab = null;
let contenidoMostrado = "";   // la tab tal como se ve (puede estar transpuesta)

async function cargarTab(){
    if(!db){
        estadoEl.textContent = "Las tablaturas no están disponibles en este momento.";
        return;
    }
    const { data, error } = await db.from("tabs_resumen").select("*").eq("id", tabId).maybeSingle();
    if(error || !data){
        estadoEl.textContent = error ? "No se pudo cargar la tab: " + error.message : "Esta tab no existe o fue eliminada.";
        return;
    }
    tab = data;
    document.title = tab.titulo + " · Armonitabs";
    document.getElementById("titulo-el").textContent = tab.titulo;
    document.getElementById("artista-el").textContent = tab.artista || "";
    document.getElementById("datos-el").textContent = nombreArmonicas(tab.tonalidades) + " · " + DIFICULTADES[tab.dificultad];
    const autor = document.getElementById("autor-el");
    autor.textContent = tab.autor_nombre;
    autor.href = "perfil.html?id=" + tab.autor;
    contenidoMostrado = tab.contenido;
    document.getElementById("contenido-el").textContent = tab.contenido;
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
                id: tab.id, titulo: tab.titulo, artista: tab.artista, tonalidades: tab.tonalidades, dificultad: tab.dificultad
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
    const { error } = await db.from("tabs").delete().eq("id", tabId);
    if(error){
        mostrarAviso("No se pudo eliminar: " + error.message);
        return;
    }
    location.href = "perfil.html?id=" + tab.autor;
}

cargarTab();
