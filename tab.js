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
function dibujarTransponer(){
    const filas = document.getElementById("transponer-el");
    for(const tonalidad of tab.tonalidades){
        const fila = document.createElement("label");
        fila.append("Armónica en " + tonalidad + " → ");
        const select = document.createElement("select");
        select.dataset.original = tonalidad;
        for(const opcion of TONALIDADES) select.add(new Option(opcion, opcion));
        select.value = tonalidad;
        select.addEventListener("change", aplicarTransposicion);
        fila.append(select);
        filas.append(fila);
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
    for(const select of document.querySelectorAll("#transponer-el select")){
        reemplazos[select.dataset.original] = select.value;
    }
    contenidoMostrado = transponer(tab.contenido, tab.tonalidades, reemplazos, celdaG4());
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
