const tabId = parseInt(new URLSearchParams(location.search).get("id"));
const estadoEl = document.getElementById("estado-el");
let tab = null;

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
    document.getElementById("datos-el").textContent = "Armónica en " + tab.tonalidad + " · " + DIFICULTADES[tab.dificultad];
    const autor = document.getElementById("autor-el");
    autor.textContent = tab.autor_nombre;
    autor.href = "perfil.html?id=" + tab.autor;
    document.getElementById("contenido-el").textContent = tab.contenido;
    mostrarPuntaje();
    estadoEl.hidden = true;
    document.getElementById("tab-el").hidden = false;

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

function copiar(){
    navigator.clipboard.writeText(tab.contenido);
    mostrarAviso("¡Tab copiada al portapapeles!");
}

function descargar(){
    descargarTexto(tab.contenido, tab.titulo);
}

// Lleva la tab al editor. Con "Editar", al publicar se actualiza esta misma tab.
function abrirEnEditor(editar){
    let actual = "";
    try { actual = localStorage.getItem("tabwriter-tab") || ""; } catch(error){}
    if(actual.trim() && actual !== tab.contenido
        && !confirm("En el editor hay otra tab sin publicar. ¿Reemplazarla por esta?")) return;
    try {
        localStorage.setItem("tabwriter-tab", tab.contenido);
        if(editar){
            localStorage.setItem("armonitabs-editando", JSON.stringify({
                id: tab.id, titulo: tab.titulo, artista: tab.artista, tonalidad: tab.tonalidad, dificultad: tab.dificultad
            }));
        } else {
            localStorage.removeItem("armonitabs-editando");
        }
    } catch(error){
        mostrarAviso("Tu navegador no permite guardar datos de esta página");
        return;
    }
    location.href = "index.html";
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
