const estadoEl = document.getElementById("estado-el");
const reportesEl = document.getElementById("reportes-el");

// Reportes de tabs: solo los administradores los pueden leer (lo controla la base)
async function cargarReportes(){
    if(!db){
        estadoEl.textContent = "La moderación no está disponible en este momento.";
        return;
    }
    const usuario = await obtenerUsuario();
    if(!usuario){
        location.href = urlEntrar();
        return;
    }
    if(!usuario.admin){
        estadoEl.textContent = "Esta página es solo para los administradores de la Escuela.";
        return;
    }
    const { data, error } = await db.from("reportes")
        .select("id, motivo, creado, tab_id, tabs(titulo, artista), perfiles(nombre)")
        .order("creado", { ascending: false });
    if(error){
        estadoEl.textContent = "No se pudieron cargar los reportes: " + error.message;
        return;
    }
    estadoEl.textContent = data.length
        ? (data.length === 1 ? "1 reporte pendiente" : data.length + " reportes pendientes")
        : "No hay reportes pendientes. ¡Todo en orden!";
    reportesEl.replaceChildren(...data.map(crearReporte));
}

function crearReporte(reporte){
    const caja = document.createElement("div");
    caja.className = "reporte";

    const tab = document.createElement("a");
    tab.href = "tab.html?id=" + reporte.tab_id;
    tab.target = "_blank";
    tab.className = "reporte-tab";
    tab.textContent = reporte.tabs.titulo + (reporte.tabs.artista ? " - " + reporte.tabs.artista : "");
    const motivo = document.createElement("p");
    motivo.className = "reporte-motivo";
    motivo.textContent = reporte.motivo;
    const datos = document.createElement("p");
    datos.className = "datos";
    datos.textContent = "Reportada por " + (reporte.perfiles ? reporte.perfiles.nombre : "?") + " el " +
        new Date(reporte.creado).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

    const acciones = document.createElement("div");
    acciones.className = "acciones";
    const descartar = document.createElement("button");
    descartar.textContent = "Descartar el reporte";
    descartar.addEventListener("click", () => descartarReporte(reporte));
    const eliminar = document.createElement("button");
    eliminar.textContent = "Eliminar la tab";
    eliminar.addEventListener("click", () => eliminarTab(reporte));
    acciones.append(descartar, eliminar);

    caja.append(tab, motivo, datos, acciones);
    return caja;
}

async function descartarReporte(reporte){
    const { error } = await db.from("reportes").delete().eq("id", reporte.id);
    if(error){
        mostrarAviso("No se pudo descartar: " + error.message);
        return;
    }
    mostrarAviso("Reporte descartado");
    cargarReportes();
}

// Al borrar la tab se borran también sus votos y reportes
async function eliminarTab(reporte){
    if(!confirm("¿Eliminar «" + reporte.tabs.titulo + "»? No se puede deshacer.")) return;
    const { data, error } = await db.from("tabs").delete().eq("id", reporte.tab_id).select("id");
    if(error || !data.length){
        mostrarAviso("No se pudo eliminar" + (error ? ": " + error.message : ""));
        return;
    }
    mostrarAviso("Tab eliminada");
    cargarReportes();
}

cargarReportes();
