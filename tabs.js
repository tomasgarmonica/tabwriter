const buscarForm = document.getElementById("buscar-form");
const estadoEl = document.getElementById("estado-el");
const listaEl = document.getElementById("lista-el");
const masBtn = document.getElementById("mas-btn");
// Para contar las versiones de cada tema (se carga una sola vez)
const temasPromesa = cargarTemas();
const POR_PAGINA = 60;

for(const tonalidad of TONALIDADES) buscarForm.tonalidad.add(new Option(tonalidad, tonalidad));

// Los filtros quedan en la URL para poder compartir una búsqueda
const parametros = new URLSearchParams(location.search);
buscarForm.texto.value = parametros.get("texto") || "";
buscarForm.tonalidad.value = parametros.get("tonalidad") || "";
buscarForm.dificultad.value = parametros.get("dificultad") || "";
buscarForm.orden.value = parametros.get("orden") || "puntaje";

buscarForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nuevos = new URLSearchParams();
    if(buscarForm.texto.value.trim()) nuevos.set("texto", buscarForm.texto.value.trim());
    if(buscarForm.tonalidad.value) nuevos.set("tonalidad", buscarForm.tonalidad.value);
    if(buscarForm.dificultad.value) nuevos.set("dificultad", buscarForm.dificultad.value);
    if(buscarForm.orden.value !== "puntaje") nuevos.set("orden", buscarForm.orden.value);
    history.replaceState(null, "", "?" + nuevos);
    buscar();
});

// Los filtros cambian la lista apenas se eligen
for(const filtro of [buscarForm.tonalidad, buscarForm.dificultad, buscarForm.orden]){
    filtro.addEventListener("change", () => buscarForm.requestSubmit());
}

// Estado de la búsqueda actual: cuántas filas se pidieron y qué temas ya tienen tarjeta
let desde = 0;
let vistos = new Set();

function armarConsulta(){
    let consulta = db.from("tabs_resumen")
        .select("id, titulo, artista, tonalidades, dificultad, autor_nombre, autor_profe, revisada, promedio, cantidad_votos");
    // Se busca en título y artista sin tildes ni signos (columna busqueda); cada palabra tiene que aparecer
    for(const palabra of normalizarTexto(buscarForm.texto.value).split(" ").filter(Boolean)){
        consulta = consulta.ilike("busqueda", `%${palabra}%`);
    }
    if(buscarForm.tonalidad.value) consulta = consulta.contains("tonalidades", [buscarForm.tonalidad.value]);
    if(buscarForm.dificultad.value) consulta = consulta.eq("dificultad", parseInt(buscarForm.dificultad.value));
    if(buscarForm.orden.value === "nuevas"){
        consulta = consulta.order("creada", { ascending: false });
    } else {
        consulta = consulta.order("promedio", { ascending: false })
            .order("cantidad_votos", { ascending: false })
            .order("creada", { ascending: false });
    }
    return consulta.order("id", { ascending: false });
}

async function buscar(){
    if(!db){
        estadoEl.textContent = "Las tablaturas no están disponibles en este momento.";
        return;
    }
    estadoEl.textContent = "Buscando...";
    listaEl.replaceChildren();
    masBtn.hidden = true;
    desde = 0;
    vistos = new Set();
    await cargarPagina();
    if(!listaEl.children.length) estadoEl.textContent = "No se encontraron tablaturas.";
}

async function cargarPagina(){
    masBtn.disabled = true;
    const [{ data, error }, temas] = await Promise.all([armarConsulta().range(desde, desde + POR_PAGINA - 1), temasPromesa]);
    masBtn.disabled = false;
    if(error){
        estadoEl.textContent = "No se pudieron cargar las tablaturas: " + error.message;
        return;
    }
    estadoEl.textContent = "";
    desde += data.length;
    // Una tarjeta por tema: la primera versión según el orden elegido (la mejor votada o la más nueva)
    for(const tab of data){
        const clave = claveTema(tab.titulo, tab.artista);
        if(vistos.has(clave)) continue;
        vistos.add(clave);
        const tema = temas.get(clave);
        listaEl.append(crearTarjetaTab(tab, tema ? tema.ids.length : 1));
    }
    masBtn.hidden = data.length < POR_PAGINA;
}

masBtn.addEventListener("click", cargarPagina);

buscar();
